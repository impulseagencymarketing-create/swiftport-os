<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
require_roles(['admin']);

$limit = (int) ($_GET['limit'] ?? 200);
$limit = max(20, min(500, $limit));
$action = trim((string) ($_GET['action'] ?? ''));
$userId = (int) ($_GET['userId'] ?? 0);

$where = [];
$params = [];
if ($action !== '') {
    $where[] = 'log.action LIKE ?';
    $params[] = '%' . $action . '%';
}
if ($userId > 0) {
    $where[] = 'log.user_id = ?';
    $params[] = $userId;
}

$sql = 'SELECT log.id, log.user_id, log.action, log.details, log.ip_address, log.created_at,
               users.full_name, users.email
        FROM app_audit_log log
        LEFT JOIN app_users users ON users.id = log.user_id';
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY log.created_at DESC, log.id DESC LIMIT ' . $limit;

$statement = db()->prepare($sql);
$statement->execute($params);

$items = array_map(static function (array $row): array {
    $details = null;
    if (!empty($row['details'])) {
        $decoded = json_decode((string) $row['details'], true);
        $details = is_array($decoded) ? $decoded : null;
    }
    return [
        'id' => (int) $row['id'],
        'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
        'userName' => $row['full_name'] ?: 'Sistema',
        'email' => $row['email'] ?: '',
        'action' => $row['action'],
        'details' => $details,
        'ipAddress' => $row['ip_address'],
        'createdAt' => $row['created_at'],
    ];
}, $statement->fetchAll());

respond(['items' => $items]);
