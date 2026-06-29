<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

require_method('POST');
ensure_schema();
$user = require_auth();
verify_csrf();
audit((int) $user['id'], 'auth.logout');

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], true);
}
session_destroy();
respond(['ok' => true]);
