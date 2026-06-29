<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

ensure_schema();
$user = require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $statement = db()->query('SELECT data, updated_at FROM app_operational_state WHERE id = 1');
    $row = $statement->fetch();
    respond([
        'data' => $row ? json_decode($row['data'], true, 512, JSON_THROW_ON_ERROR) : null,
        'updatedAt' => $row['updated_at'] ?? null,
    ]);
}

require_method('PUT');
verify_csrf();
$payload = input();
$data = $payload['data'] ?? null;
if (!is_array($data)
    || !is_array($data['cases'] ?? null)
    || !is_array($data['transports'] ?? null)
    || !is_array($data['warehouseEntries'] ?? null)
) {
    respond(['error' => 'Los datos operativos no son válidos.'], 422);
}

$encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
if (strlen($encoded) > 1000000) {
    respond(['error' => 'Los datos operativos superan el tamaño permitido.'], 413);
}

$statement = db()->prepare(
    'INSERT INTO app_operational_state (id, data, updated_by)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)'
);
$statement->execute([$encoded, $user['id']]);
audit((int) $user['id'], 'operational.update');
respond(['ok' => true]);
