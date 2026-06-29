<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
require_auth();
$rows = db()->query(
    'SELECT id, full_name, role FROM app_users WHERE active = 1 ORDER BY full_name'
)->fetchAll();

respond(['users' => array_map(static fn(array $row): array => [
    'id' => (int) $row['id'],
    'fullName' => $row['full_name'],
    'role' => $row['role'],
], $rows)]);
