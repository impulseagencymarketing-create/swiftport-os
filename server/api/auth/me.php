<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

require_method('GET');
ensure_schema();

$count = (int) db()->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
$user = current_user();

if ($user === null) {
    respond([
        'authenticated' => false,
        'setupRequired' => $count === 0,
    ], 401);
}

respond([
    'authenticated' => true,
    'user' => $user,
    'csrfToken' => csrf_token(),
]);
