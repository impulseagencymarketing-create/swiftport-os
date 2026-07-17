<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $user = require_roles(['operations', 'finance', 'admin']);
    verify_csrf();
    $payload = input();
    $name = trim((string) ($payload['name'] ?? ''));
    if ($name === '') {
        respond(['error' => 'Indica el nombre del cliente.'], 422);
    }
    $name = strtoupper(substr($name, 0, 160));
    $code = preg_replace('/[^A-Z0-9]+/', '', $name) ?: 'CLIENTE';
    $code = substr($code, 0, 24);
    $baseCode = $code;
    $suffix = 2;
    $check = db()->prepare('SELECT code FROM app_clients WHERE code = ? AND name <> ? LIMIT 1');
    while (true) {
        $check->execute([$code, $name]);
        if (!$check->fetch()) break;
        $code = substr($baseCode, 0, 20) . '-' . $suffix++;
    }
    $statement = db()->prepare(
        'INSERT INTO app_clients
         (code, name, contact, active_cases, reception_rate, storage_rate, transport_rate, surcharge_rate, active)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), active=1'
    );
    $statement->execute([$code, $name, '', 'Pendiente', 'Pendiente', 'Pendiente', 'Pendiente']);
    audit((int) $user['id'], 'clients.create');
    respond(['client' => ['code' => $code, 'name' => $name]]);
}

require_auth();
$rows = db()->query(
    'SELECT code, name FROM app_clients WHERE active = 1 ORDER BY name'
)->fetchAll();
respond(['clients' => array_map(static fn(array $row): array => [
    'code' => $row['code'],
    'name' => $row['name'],
], $rows)]);
