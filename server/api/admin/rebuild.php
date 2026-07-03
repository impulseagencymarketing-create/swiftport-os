<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require dirname(__DIR__) . '/mail/_service.php';

ensure_schema();
$user = require_roles(['admin']);
require_method('POST');
verify_csrf();
$payload = input();
$action = (string) ($payload['action'] ?? '');

function rebuild_period_bounds(array $payload): array
{
    $startValue = trim((string) ($payload['start'] ?? ''));
    $endValue = trim((string) ($payload['end'] ?? ''));
    $start = DateTimeImmutable::createFromFormat('!Y-m-d', $startValue);
    $end = DateTimeImmutable::createFromFormat('!Y-m-d', $endValue);
    if (!$start || !$end || $start->format('Y-m-d') !== $startValue || $end->format('Y-m-d') !== $endValue) {
        throw new InvalidArgumentException('El periodo de reconstrucción no es válido.');
    }
    $days = (int) $start->diff($end)->format('%r%a');
    if ($days < 1 || $days > 62) {
        throw new InvalidArgumentException('El periodo debe tener entre 1 y 62 días.');
    }
    return [$startValue, $endValue];
}

function rebuild_date_in_period(string $value, string $start, string $end): bool
{
    $date = trim($value);
    return is_valid_service_date($date) && $date >= $start && $date < $end;
}

function rebuild_data_matches_period(array $data, string $start, string $end): bool
{
    [$transportDate] = port_call_operational_slot($data, 'transport');
    $dates = [
        (string) ($data['eta'] ?? ''),
        (string) ($data['etb'] ?? ''),
        (string) ($data['reception']['date'] ?? ''),
        $transportDate,
    ];
    foreach ($dates as $date) {
        if (rebuild_date_in_period($date, $start, $end)) return true;
    }
    foreach (is_array($data['tasks'] ?? null) ? $data['tasks'] : [] as $task) {
        if (is_array($task) && rebuild_date_in_period((string) ($task['date'] ?? ''), $start, $end)) {
            return true;
        }
    }
    return false;
}

if ($action === 'preview_period') {
    try {
        [$start, $end] = rebuild_period_bounds($payload);
        $row = db()->query('SELECT data FROM app_operational_state WHERE id = 1')->fetch();
        $state = $row ? json_decode((string) $row['data'], true, 512, JSON_THROW_ON_ERROR) : [];
        $mailCount = db()->prepare(
            'SELECT COUNT(*) FROM app_mail_items WHERE received_at >= ? AND received_at < ?'
        );
        $mailCount->execute([$start, $end]);
        respond([
            'ok' => true,
            'caseCount' => count(is_array($state['cases'] ?? null) ? $state['cases'] : []),
            'mailCount' => (int) $mailCount->fetchColumn(),
            'start' => $start,
            'end' => $end,
        ]);
    } catch (Throwable $error) {
        respond(['error' => $error->getMessage()], 422);
    }
}

if ($action === 'reset_period') {
    try {
        [$start, $end] = rebuild_period_bounds($payload);
    } catch (Throwable $error) {
        respond(['error' => $error->getMessage()], 422);
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $row = $pdo->query('SELECT data FROM app_operational_state WHERE id = 1 FOR UPDATE')->fetch();
        $state = $row ? json_decode((string) $row['data'], true, 512, JSON_THROW_ON_ERROR) : [];
        $removedCases = count(is_array($state['cases'] ?? null) ? $state['cases'] : []);
        $backup = $pdo->prepare(
            'INSERT INTO app_operational_backups (label, data, created_by) VALUES (?, ?, ?)'
        );
        $backup->execute([
            'Antes de reconstruir ' . $start . ' a ' . $end,
            json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $user['id'],
        ]);
        $backupId = (int) $pdo->lastInsertId();
        foreach (['cases', 'transports', 'warehouseEntries', 'customs', 'calendarEvents'] as $collection) {
            $state[$collection] = [];
        }
        $save = $pdo->prepare(
            'INSERT INTO app_operational_state (id, data, updated_by) VALUES (1, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)'
        );
        $save->execute([
            json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $user['id'],
        ]);
        $pdo->exec(
            "UPDATE app_mail_items SET status = 'ignored', review_reason = 'Fuera del periodo reconstruido',
             error_message = NULL, case_ref = NULL, processed_at = NULL, reviewed_by = NULL, reviewed_at = NULL"
        );
        $resetMail = $pdo->prepare(
            "UPDATE app_mail_items SET status = 'review', confidence = 0, extracted = NULL,
             review_reason = 'Pendiente de reconstrucción de junio', error_message = NULL,
             case_ref = NULL, processed_at = NULL, reviewed_by = NULL, reviewed_at = NULL
             WHERE received_at >= ? AND received_at < ?"
        );
        $resetMail->execute([$start, $end]);
        $pendingEmails = (int) $resetMail->rowCount();
        audit((int) $user['id'], 'operational.period_rebuild_reset', [
            'removedCases' => $removedCases,
            'pendingEmails' => $pendingEmails,
            'start' => $start,
            'end' => $end,
        ]);
        $pdo->commit();
        respond([
            'ok' => true,
            'removedCases' => $removedCases,
            'pendingEmails' => $pendingEmails,
            'backupId' => $backupId,
        ]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond(['error' => 'No se pudo preparar junio desde cero: ' . $error->getMessage()], 500);
    }
}

if ($action === 'process_period_batch') {
    try {
        [$start, $end] = rebuild_period_bounds($payload);
    } catch (Throwable $error) {
        respond(['error' => $error->getMessage()], 422);
    }
    $pdo = db();
    $select = $pdo->prepare(
        "SELECT id, subject, body, sender_name, sender_email, received_at
         FROM app_mail_items
         WHERE status = 'review' AND extracted IS NULL AND received_at >= ? AND received_at < ?
         ORDER BY received_at ASC, id ASC LIMIT 3"
    );
    $select->execute([$start, $end]);
    $rows = $select->fetchAll();
    $summary = ['processed' => 0, 'review' => 0, 'ignored' => 0, 'outsidePeriod' => 0];
    foreach ($rows as $mail) {
        $mailId = (int) $mail['id'];
        $data = extract_local_service($mail);
        $confidence = (float) ($data['confidence'] ?? 0);
        $related = find_existing_thread_case_ref($pdo, $mailId, (string) $mail['subject']);
        if ($related === '') $related = find_correlated_case_ref($pdo, $data, (string) $mail['subject']);
        $canUpdate = $related !== ''
            && $confidence >= 0.82
            && in_array((string) ($data['request_action'] ?? ''), ['new', 'update', 'information'], true)
            && (!empty($data['is_service']) || port_call_data_has_schedule($data));
        $inPeriod = rebuild_data_matches_period($data, $start, $end);
        $reasons = service_review_reasons($data);
        $update = $pdo->prepare(
            "UPDATE app_mail_items SET status = 'review', confidence = ?, extracted = ?,
             review_reason = ?, error_message = NULL WHERE id = ?"
        );
        $update->execute([
            $confidence,
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            mb_substr($reasons ? implode('. ', $reasons) : 'Interpretado durante la reconstrucción de junio', 0, 800),
            $mailId,
        ]);
        if (empty($data['ai_unavailable']) && ($inPeriod || $canUpdate)
            && (service_required_data_complete($data) || $canUpdate)) {
            try {
                apply_service_email($mailId, $data, (int) $user['id']);
                $summary['processed']++;
                continue;
            } catch (Throwable) {
                // Permanece visible para revisión manual.
            }
        }
        if (!empty($data['ai_unavailable'])) {
            $summary['review']++;
        } elseif (!$inPeriod && !$canUpdate) {
            $ignore = $pdo->prepare(
                "UPDATE app_mail_items SET status = 'ignored',
                 review_reason = 'El servicio no corresponde a junio de 2026', processed_at = NOW() WHERE id = ?"
            );
            $ignore->execute([$mailId]);
            $summary['ignored']++;
            $summary['outsidePeriod']++;
        } elseif (empty($data['is_service']) && $confidence >= 0.90) {
            $ignore = $pdo->prepare(
                "UPDATE app_mail_items SET status = 'ignored', review_reason = 'No se detecta trabajo operativo',
                 processed_at = NOW() WHERE id = ?"
            );
            $ignore->execute([$mailId]);
            $summary['ignored']++;
        } else {
            $summary['review']++;
        }
    }
    $remainingStatement = $pdo->prepare(
        "SELECT COUNT(*) FROM app_mail_items
         WHERE status = 'review' AND extracted IS NULL AND received_at >= ? AND received_at < ?"
    );
    $remainingStatement->execute([$start, $end]);
    $remaining = (int) $remainingStatement->fetchColumn();
    audit((int) $user['id'], 'operational.period_rebuild_batch', $summary + [
        'remaining' => $remaining,
        'start' => $start,
        'end' => $end,
    ]);
    respond(['ok' => true, 'summary' => $summary, 'remaining' => $remaining]);
}

if ($action === 'reset') {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $row = $pdo->query('SELECT data FROM app_operational_state WHERE id = 1 FOR UPDATE')->fetch();
        $state = $row ? json_decode((string) $row['data'], true, 512, JSON_THROW_ON_ERROR) : [];
        $prepared = prepare_operational_rebuild($state);
        $state = $prepared['state'];
        $openRefs = $prepared['openRefs'];
        $completedCases = $prepared['completedCases'];
        $save = $pdo->prepare(
            'INSERT INTO app_operational_state (id, data, updated_by) VALUES (1, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)'
        );
        $save->execute([
            json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $user['id'],
        ]);

        if ($openRefs) {
            $placeholders = implode(',', array_fill(0, count($openRefs), '?'));
            $resetMail = $pdo->prepare(
                "UPDATE app_mail_items SET status = 'review', confidence = 0, extracted = NULL,
                 review_reason = 'Pendiente de reconstrucción operativa', error_message = NULL,
                 case_ref = NULL, processed_at = NULL, reviewed_by = NULL, reviewed_at = NULL
                 WHERE case_ref IS NULL OR case_ref IN ($placeholders)"
            );
            $resetMail->execute($openRefs);
        } else {
            $pdo->exec(
                "UPDATE app_mail_items SET status = 'review', confidence = 0, extracted = NULL,
                 review_reason = 'Pendiente de reconstrucción operativa', error_message = NULL,
                 processed_at = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE case_ref IS NULL"
            );
        }
        audit((int) $user['id'], 'operational.rebuild_reset', [
            'removedOpenCases' => count($openRefs),
            'preservedCompletedCases' => count($completedCases),
        ]);
        $pdo->commit();
        respond([
            'ok' => true,
            'removedOpenCases' => count($openRefs),
            'preservedCompletedCases' => count($completedCases),
            'pendingEmails' => (int) $pdo->query("SELECT COUNT(*) FROM app_mail_items WHERE status = 'review' AND extracted IS NULL")->fetchColumn(),
        ]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond(['error' => 'No se pudo preparar la reconstrucción: ' . $error->getMessage()], 500);
    }
}

if ($action === 'process_batch') {
    $pdo = db();
    $rows = $pdo->query(
        "SELECT id, subject, body, sender_name, sender_email, received_at
         FROM app_mail_items
         WHERE status = 'review' AND extracted IS NULL
         ORDER BY received_at ASC, id ASC LIMIT 3"
    )->fetchAll();
    $summary = ['processed' => 0, 'review' => 0, 'ignored' => 0];
    foreach ($rows as $mail) {
        $mailId = (int) $mail['id'];
        $data = extract_local_service($mail);
        $confidence = (float) ($data['confidence'] ?? 0);
        $related = find_existing_thread_case_ref($pdo, $mailId, (string) $mail['subject']);
        if ($related === '') $related = find_correlated_case_ref($pdo, $data, (string) $mail['subject']);
        $canUpdate = $related !== ''
            && $confidence >= 0.82
            && in_array((string) ($data['request_action'] ?? ''), ['new', 'update', 'information'], true)
            && (!empty($data['is_service']) || port_call_data_has_schedule($data));
        $reasons = service_review_reasons($data);
        $update = $pdo->prepare(
            "UPDATE app_mail_items SET status = 'review', confidence = ?, extracted = ?,
             review_reason = ?, error_message = NULL WHERE id = ?"
        );
        $update->execute([
            $confidence,
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            mb_substr($reasons ? implode('. ', $reasons) : 'Interpretado durante la reconstrucción', 0, 800),
            $mailId,
        ]);
        if (empty($data['ai_unavailable']) && (service_required_data_complete($data) || $canUpdate)) {
            try {
                apply_service_email($mailId, $data, (int) $user['id']);
                $summary['processed']++;
                continue;
            } catch (Throwable) {
                // Permanece visible para revisión manual.
            }
        }
        if (empty($data['is_service']) && !$canUpdate && $confidence >= 0.90) {
            $ignore = $pdo->prepare(
                "UPDATE app_mail_items SET status = 'ignored', review_reason = 'No se detecta trabajo operativo',
                 processed_at = NOW() WHERE id = ?"
            );
            $ignore->execute([$mailId]);
            $summary['ignored']++;
        } else {
            $summary['review']++;
        }
    }
    $remaining = (int) $pdo->query(
        "SELECT COUNT(*) FROM app_mail_items WHERE status = 'review' AND extracted IS NULL"
    )->fetchColumn();
    audit((int) $user['id'], 'operational.rebuild_batch', $summary + ['remaining' => $remaining]);
    respond(['ok' => true, 'summary' => $summary, 'remaining' => $remaining]);
}

respond(['error' => 'Acción de reconstrucción no válida.'], 422);
