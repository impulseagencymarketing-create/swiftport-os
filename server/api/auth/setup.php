<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

require_method('POST');
ensure_schema();
$data = input();

if ((int) db()->query('SELECT COUNT(*) FROM app_users')->fetchColumn() > 0) {
    respond(['error' => 'La configuración inicial ya está cerrada.'], 409);
}

$token = (string) ($data['setupToken'] ?? '');
if ($token === '' || !hash_equals(config('setup_token'), $token)) {
    respond(['error' => 'Código de configuración incorrecto.'], 403);
}

$email = strtolower(trim((string) ($data['email'] ?? '')));
$fullName = trim((string) ($data['fullName'] ?? ''));
$password = (string) ($data['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(['error' => 'Introduce un email válido.'], 422);
}
if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 120) {
    respond(['error' => 'Introduce un nombre válido.'], 422);
}
if (strlen($password) < 12) {
    respond(['error' => 'La contraseña debe tener al menos 12 caracteres.'], 422);
}

$statement = db()->prepare(
    "INSERT INTO app_users (email, password_hash, full_name, role)
     VALUES (?, ?, ?, 'admin')"
);
$statement->execute([$email, password_hash($password, PASSWORD_DEFAULT), $fullName]);
$id = (int) db()->lastInsertId();

session_regenerate_id(true);
$_SESSION['user_id'] = $id;
$_SESSION['csrf'] = bin2hex(random_bytes(32));
audit($id, 'auth.initial_admin_created');

respond([
    'user' => ['id' => $id, 'email' => $email, 'fullName' => $fullName, 'role' => 'admin'],
    'csrfToken' => csrf_token(),
], 201);
