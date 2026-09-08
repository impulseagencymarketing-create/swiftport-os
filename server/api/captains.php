<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

ensure_schema();
$user = require_roles(['operations', 'admin']);
$pdo = db();
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS app_captain_contacts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        vessel_name VARCHAR(160) NOT NULL,
        captain_name VARCHAR(160) NOT NULL DEFAULT '',
        phone_e164 VARCHAR(24) NOT NULL,
        imo VARCHAR(12) NOT NULL DEFAULT '',
        mmsi VARCHAR(12) NOT NULL DEFAULT '',
        language VARCHAR(40) NOT NULL DEFAULT '',
        notes VARCHAR(500) NOT NULL DEFAULT '',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_captain_vessel_phone (vessel_name, phone_e164),
        INDEX idx_captain_vessel (vessel_name),
        INDEX idx_captain_imo (imo),
        INDEX idx_captain_mmsi (mmsi)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$seed = $pdo->prepare("INSERT IGNORE INTO app_captain_contacts (vessel_name, captain_name, phone_e164, imo, mmsi, language, notes, created_by) VALUES (?, '', ?, ?, ?, ?, ?, ?)");
$seed->execute(['ESKE', '+905345007830', '9479632', '249930000', 'Turco / Inglés', 'Contacto facilitado durante la operativa. Confirmar el nombre del capitán y actualizarlo cuando cambie el mando.', (int) $user['id']]);



$normalizePhone = static function (string $value): string {
    $digits = preg_replace('/\D+/', '', $value) ?? '';
    if (strlen($digits) < 8 || strlen($digits) > 15) respond(['error' => 'Indica el teléfono con prefijo internacional.'], 422);
    return '+' . $digits;
};
$contactPayload = static function (array $payload) use ($normalizePhone): array {
    $vessel = strtoupper(trim((string) ($payload['vesselName'] ?? '')));
    if ($vessel === '') respond(['error' => 'Indica el buque.'], 422);
    return [
        substr($vessel, 0, 160),
        substr(trim((string) ($payload['captainName'] ?? '')), 0, 160),
        $normalizePhone((string) ($payload['phone'] ?? '')),
        substr(preg_replace('/\D+/', '', (string) ($payload['imo'] ?? '')) ?? '', 0, 12),
        substr(preg_replace('/\D+/', '', (string) ($payload['mmsi'] ?? '')) ?? '', 0, 12),
        substr(trim((string) ($payload['language'] ?? '')), 0, 40),
        substr(trim((string) ($payload['notes'] ?? '')), 0, 500),
    ];
};
$serialize = static fn(array $row): array => [
    'id' => (int) $row['id'],
    'vesselName' => $row['vessel_name'],
    'captainName' => $row['captain_name'],
    'phone' => $row['phone_e164'],
    'imo' => $row['imo'],
    'mmsi' => $row['mmsi'],
    'language' => $row['language'],
    'notes' => $row['notes'],
    'active' => (bool) $row['active'],
    'updatedAt' => $row['updated_at'],
];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM app_captain_contacts WHERE active = 1 ORDER BY vessel_name, captain_name')->fetchAll();
    respond(['contacts' => array_map($serialize, $rows)]);
}

verify_csrf();
$payload = input();
if ($method === 'POST') {
    [$vessel, $captain, $phone, $imo, $mmsi, $language, $notes] = $contactPayload($payload);
    $statement = $pdo->prepare('INSERT INTO app_captain_contacts (vessel_name, captain_name, phone_e164, imo, mmsi, language, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    try {
        $statement->execute([$vessel, $captain, $phone, $imo, $mmsi, $language, $notes, (int) $user['id']]);
    } catch (PDOException $error) {
        if ((string) $error->getCode() === '23000') respond(['error' => 'Este teléfono ya está registrado para el buque.'], 409);
        throw $error;
    }
    audit((int) $user['id'], 'captains.create', ['vessel' => $vessel, 'imo' => $imo, 'mmsi' => $mmsi]);
} elseif ($method === 'PUT') {
    $id = (int) ($payload['id'] ?? 0);
    if ($id < 1) respond(['error' => 'Contacto inválido.'], 422);
    [$vessel, $captain, $phone, $imo, $mmsi, $language, $notes] = $contactPayload($payload);
    $statement = $pdo->prepare('UPDATE app_captain_contacts SET vessel_name=?, captain_name=?, phone_e164=?, imo=?, mmsi=?, language=?, notes=? WHERE id=? AND active=1');
    $statement->execute([$vessel, $captain, $phone, $imo, $mmsi, $language, $notes, $id]);
    audit((int) $user['id'], 'captains.update', ['contactId' => $id, 'vessel' => $vessel]);
} elseif ($method === 'DELETE') {
    $id = (int) ($payload['id'] ?? 0);
    if ($id < 1) respond(['error' => 'Contacto inválido.'], 422);
    $statement = $pdo->prepare('UPDATE app_captain_contacts SET active=0 WHERE id=?');
    $statement->execute([$id]);
    audit((int) $user['id'], 'captains.archive', ['contactId' => $id]);
} else {
    respond(['error' => 'Método no permitido.'], 405);
}

$rows = $pdo->query('SELECT * FROM app_captain_contacts WHERE active = 1 ORDER BY vessel_name, captain_name')->fetchAll();
respond(['ok' => true, 'contacts' => array_map($serialize, $rows)]);
