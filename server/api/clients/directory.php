<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
require_auth();
$rows = db()->query(
    'SELECT code, name FROM app_clients WHERE active = 1 ORDER BY name'
)->fetchAll();
respond(['clients' => array_map(static fn(array $row): array => [
    'code' => $row['code'],
    'name' => $row['name'],
], $rows)]);
