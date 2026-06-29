<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_name('swiftport_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

$configPath = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/swiftport-config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    echo json_encode(['error' => 'La aplicación todavía no está configurada.']);
    exit;
}

$config = require $configPath;
if (!is_array($config)) {
    http_response_code(503);
    echo json_encode(['error' => 'Configuración inválida.']);
    exit;
}

function config(string $key): string
{
    global $config;
    return (string) ($config[$key] ?? '');
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        config('db_host'),
        config('db_name')
    );
    $pdo = new PDO($dsn, config('db_user'), config('db_password'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        respond(['error' => 'Método no permitido.'], 405);
    }
}

function input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(['error' => 'Contenido JSON inválido.'], 400);
    }
    return $decoded;
}

function ensure_schema(): void
{
    $pdo = db();
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(120) NOT NULL,
            role ENUM('operations','finance','admin') NOT NULL DEFAULT 'operations',
            active TINYINT(1) NOT NULL DEFAULT 1,
            last_login_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_login_attempts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL,
            ip_address VARCHAR(64) NOT NULL,
            attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_attempts (email, ip_address, attempted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_audit_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            action VARCHAR(80) NOT NULL,
            details JSON NULL,
            ip_address VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_user (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_case_finance (
            case_ref VARCHAR(40) PRIMARY KEY,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_clients (
            code VARCHAR(40) PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            contact VARCHAR(190) NOT NULL,
            active_cases INT UNSIGNED NOT NULL DEFAULT 0,
            reception_rate VARCHAR(120) NOT NULL,
            storage_rate VARCHAR(120) NOT NULL,
            transport_rate VARCHAR(120) NOT NULL,
            surcharge_rate VARCHAR(120) NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_invoices (
            id VARCHAR(40) PRIMARY KEY,
            case_ref VARCHAR(40) NOT NULL,
            client_name VARCHAR(160) NOT NULL,
            concept VARCHAR(220) NOT NULL,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            status VARCHAR(40) NOT NULL,
            due_date VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_operational_state (
            id TINYINT UNSIGNED PRIMARY KEY,
            data JSON NOT NULL,
            updated_by BIGINT UNSIGNED NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    seed_demo_finance_data($pdo);
}

function seed_demo_finance_data(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM app_clients')->fetchColumn() === 0) {
        $pdo->exec(
            "INSERT INTO app_clients
                (code, name, contact, active_cases, reception_rate, storage_rate, transport_rate, surcharge_rate)
             VALUES
                ('CLI-0012', 'UME Shipping', 'ops@umeshipping.com', 12, '65 €', '7 días + 25 €/día', 'Por ruta', '+30%'),
                ('CLI-0028', 'Limani', 'spares@limani.gr', 7, '60 €', '7 días + 22 €/día', 'Por viaje', '+30%'),
                ('CLI-0034', 'A-Ships', 'agency@aships.com', 5, '55 €', 'Según acuerdo', 'Por puerto', '+25%'),
                ('CLI-0041', 'BlueWave Marine', 'supply@bluewave.no', 3, '72 €', '5 días + 28 €/día', 'Por ruta', '+35%')"
        );
    }
    if ((int) $pdo->query('SELECT COUNT(*) FROM app_invoices')->fetchColumn() === 0) {
        $pdo->exec(
            "INSERT INTO app_invoices
                (id, case_ref, client_name, concept, amount, status, due_date)
             VALUES
                ('FAC-2026-0188', 'SW-2026-0044', 'UME Shipping', 'Entrega a bordo + POD', 920, 'Lista', '29 Jul 2026'),
                ('BOR-2026-0094', 'SW-2026-0048', 'UME Shipping', 'Transporte + manipulación', 1280, 'Borrador', '—'),
                ('BOR-2026-0093', 'SW-2026-0047', 'Limani', 'Recepción + storage + T1', 860, 'Revisar', '—'),
                ('FAC-2026-0185', 'SW-2026-0042', 'A-Ships', 'Servicio urgente fuera de horario', 1485, 'Enviada', '24 Jul 2026')"
        );
    }
    if ((int) $pdo->query('SELECT COUNT(*) FROM app_case_finance')->fetchColumn() === 0) {
        $pdo->exec(
            "INSERT INTO app_case_finance (case_ref, amount) VALUES
                ('SW-2026-0048', 1280),
                ('SW-2026-0047', 860),
                ('SW-2026-0046', 640),
                ('SW-2026-0045', 1740),
                ('SW-2026-0044', 920)"
        );
    }
}

function public_user(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'fullName' => $row['full_name'],
        'role' => $row['role'],
    ];
}

function current_user(): ?array
{
    $id = (int) ($_SESSION['user_id'] ?? 0);
    if ($id < 1) {
        return null;
    }
    $statement = db()->prepare(
        'SELECT id, email, full_name, role FROM app_users WHERE id = ? AND active = 1'
    );
    $statement->execute([$id]);
    $user = $statement->fetch();
    if (!$user) {
        session_unset();
        return null;
    }
    return public_user($user);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf'];
}

function verify_csrf(): void
{
    $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sent === '' || !hash_equals(csrf_token(), $sent)) {
        respond(['error' => 'La sesión ha caducado. Recarga la página.'], 419);
    }
}

function require_auth(): array
{
    $user = current_user();
    if ($user === null) {
        respond(['error' => 'Debes iniciar sesión.'], 401);
    }
    return $user;
}

function require_roles(array $roles): array
{
    $user = require_auth();
    if (!in_array($user['role'], $roles, true)) {
        respond(['error' => 'No tienes permiso para realizar esta acción.'], 403);
    }
    return $user;
}

function audit(?int $userId, string $action, array $details = []): void
{
    $statement = db()->prepare(
        'INSERT INTO app_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)'
    );
    $statement->execute([
        $userId,
        $action,
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64),
    ]);
}
