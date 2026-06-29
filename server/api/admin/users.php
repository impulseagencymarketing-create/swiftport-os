<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
$admin = require_roles(['admin']);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $rows = db()->query(
        'SELECT id, email, full_name, role, active, last_login_at, created_at
         FROM app_users ORDER BY full_name'
    )->fetchAll();
    respond(['users' => array_map(static fn(array $row): array => [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'fullName' => $row['full_name'],
        'role' => $row['role'],
        'active' => (bool) $row['active'],
        'lastLoginAt' => $row['last_login_at'],
        'createdAt' => $row['created_at'],
    ], $rows)]);
}

require_method('POST');
verify_csrf();
$data = input();
$email = strtolower(trim((string) ($data['email'] ?? '')));
$fullName = trim((string) ($data['fullName'] ?? ''));
$password = (string) ($data['password'] ?? '');
$role = (string) ($data['role'] ?? 'operations');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)
    || mb_strlen($fullName) < 2
    || strlen($password) < 12
    || !in_array($role, ['operations', 'finance', 'admin'], true)
) {
    respond(['error' => 'Revisa los datos del nuevo usuario.'], 422);
}

try {
    $statement = db()->prepare(
        'INSERT INTO app_users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    );
    $statement->execute([$email, password_hash($password, PASSWORD_DEFAULT), $fullName, $role]);
} catch (PDOException $error) {
    if ((string) $error->getCode() === '23000') {
        respond(['error' => 'Ya existe un usuario con ese email.'], 409);
    }
    throw $error;
}

$id = (int) db()->lastInsertId();
audit((int) $admin['id'], 'users.create', ['created_user_id' => $id, 'role' => $role]);
respond(['id' => $id], 201);
