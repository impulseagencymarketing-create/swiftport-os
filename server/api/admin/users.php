<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
$admin = require_roles(['admin']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $rows = db()->query(
        'SELECT id, email, full_name, role, roles, active, last_login_at, created_at
         FROM app_users ORDER BY full_name'
    )->fetchAll();
    respond(['users' => array_map(static fn(array $row): array => [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'fullName' => $row['full_name'],
        'role' => $row['role'],
        'roles' => public_user($row)['roles'],
        'active' => (bool) $row['active'],
        'lastLoginAt' => $row['last_login_at'],
        'createdAt' => $row['created_at'],
    ], $rows)]);
}

if ($method === 'PUT') {
    verify_csrf();
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    $allowed = ['driver', 'operations', 'finance', 'admin'];
    $roles = array_values(array_unique(array_filter((array) ($data['roles'] ?? []), static fn($role): bool => in_array($role, $allowed, true))));
    if ($id < 1 || $roles === []) {
        respond(['error' => 'Selecciona al menos un rol válido.'], 422);
    }
    $currentStatement = db()->prepare('SELECT role FROM app_users WHERE id = ?');
    $currentStatement->execute([$id]);
    $currentRole = (string) ($currentStatement->fetchColumn() ?: '');
    if ($currentRole === 'admin' && !in_array('admin', $roles, true)) {
        $adminCount = (int) db()->query("SELECT COUNT(*) FROM app_users WHERE role = 'admin' AND active = 1")->fetchColumn();
        if ($adminCount <= 1) {
            respond(['error' => 'Debe quedar al menos una cuenta con Administración.'], 422);
        }
    }
    $primaryRole = in_array('admin', $roles, true) ? 'admin' : (in_array('finance', $roles, true) ? 'finance' : (in_array('operations', $roles, true) ? 'operations' : 'driver'));
    $statement = db()->prepare('UPDATE app_users SET role = ?, roles = ? WHERE id = ?');
    $statement->execute([$primaryRole, json_encode($roles, JSON_UNESCAPED_UNICODE), $id]);
    audit((int) $admin['id'], 'users.roles_update', ['updated_user_id' => $id, 'roles' => $roles]);
    respond(['ok' => true]);
}

require_method('POST');
verify_csrf();
$data = input();
$email = strtolower(trim((string) ($data['email'] ?? '')));
$fullName = trim((string) ($data['fullName'] ?? ''));
$password = (string) ($data['password'] ?? '');
$allowed = ['driver', 'operations', 'finance', 'admin'];
$roles = array_values(array_unique(array_filter((array) ($data['roles'] ?? ['operations']), static fn($role): bool => in_array($role, $allowed, true))));
$primaryRole = in_array('admin', $roles, true) ? 'admin' : (in_array('finance', $roles, true) ? 'finance' : (in_array('operations', $roles, true) ? 'operations' : 'driver'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)
    || mb_strlen($fullName) < 2
    || strlen($password) < 4
    || $roles === []
) {
    respond(['error' => 'Revisa los datos del nuevo usuario.'], 422);
}

try {
    $statement = db()->prepare(
        'INSERT INTO app_users (email, password_hash, full_name, role, roles) VALUES (?, ?, ?, ?, ?)'
    );
    $statement->execute([$email, password_hash($password, PASSWORD_DEFAULT), $fullName, $primaryRole, json_encode($roles, JSON_UNESCAPED_UNICODE)]);
} catch (PDOException $error) {
    if ((string) $error->getCode() === '23000') {
        respond(['error' => 'Ya existe un usuario con ese email.'], 409);
    }
    throw $error;
}

$id = (int) db()->lastInsertId();
audit((int) $admin['id'], 'users.create', ['created_user_id' => $id, 'roles' => $roles]);
respond(['id' => $id], 201);
