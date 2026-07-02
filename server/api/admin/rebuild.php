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
