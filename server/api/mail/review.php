<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/_service.php';

ensure_schema();
$user = require_roles(['operations', 'admin']);
require_method('PUT');
verify_csrf();
$payload = input();
$id = (int) ($payload['id'] ?? 0);
$action = (string) ($payload['action'] ?? '');
if ($id < 1 || !in_array($action, ['approve', 'ignore'], true)) {
    respond(['error' => 'Acción no válida.'], 422);
}

if ($action === 'ignore') {
    $statement = db()->prepare(
        "UPDATE app_mail_items SET status = 'ignored', review_reason = 'Descartado manualmente',
         reviewed_by = ?, reviewed_at = NOW(), processed_at = NOW() WHERE id = ? AND status <> 'processed'"
    );
    $statement->execute([$user['id'], $id]);
    audit((int) $user['id'], 'mail.ignore', ['mailId' => $id]);
    respond(['ok' => true]);
}

$data = $payload['extracted'] ?? null;
if (!is_array($data)) {
    respond(['error' => 'Revisa los datos extraídos antes de aprobar.'], 422);
}
$data['confidence'] = 1;
try {
    $caseRef = apply_service_email($id, $data, (int) $user['id']);
    audit((int) $user['id'], 'mail.approve', ['mailId' => $id, 'caseRef' => $caseRef]);
    respond(['ok' => true, 'caseRef' => $caseRef]);
} catch (InvalidArgumentException $error) {
    respond(['error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    respond(['error' => 'No se pudo crear el trabajo: ' . $error->getMessage()], 500);
}
