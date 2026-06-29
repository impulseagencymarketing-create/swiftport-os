<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

require_method('POST');
ensure_schema();
$data = input();
$email = strtolower(trim((string) ($data['email'] ?? '')));
$password = (string) ($data['password'] ?? '');
$ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64);

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    respond(['error' => 'Email o contraseña incorrectos.'], 422);
}

$cleanup = db()->prepare('DELETE FROM app_login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)');
$cleanup->execute();
$attempts = db()->prepare(
    'SELECT COUNT(*) FROM app_login_attempts
     WHERE email = ? AND ip_address = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'
);
$attempts->execute([$email, $ip]);
if ((int) $attempts->fetchColumn() >= 5) {
    respond(['error' => 'Demasiados intentos. Espera 15 minutos.'], 429);
}

$statement = db()->prepare(
    'SELECT id, email, password_hash, full_name, role FROM app_users WHERE email = ? AND active = 1'
);
$statement->execute([$email]);
$row = $statement->fetch();

if (!$row || !password_verify($password, $row['password_hash'])) {
    $record = db()->prepare(
        'INSERT INTO app_login_attempts (email, ip_address) VALUES (?, ?)'
    );
    $record->execute([$email, $ip]);
    usleep(350000);
    respond(['error' => 'Email o contraseña incorrectos.'], 401);
}

db()->prepare('DELETE FROM app_login_attempts WHERE email = ? AND ip_address = ?')->execute([$email, $ip]);
db()->prepare('UPDATE app_users SET last_login_at = NOW() WHERE id = ?')->execute([$row['id']]);
session_regenerate_id(true);
$_SESSION['user_id'] = (int) $row['id'];
$_SESSION['csrf'] = bin2hex(random_bytes(32));
audit((int) $row['id'], 'auth.login');

respond([
    'user' => public_user($row),
    'csrfToken' => csrf_token(),
]);
