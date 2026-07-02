<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/_service.php';

ensure_schema();
require_roles(['operations', 'admin']);
require_method('GET');
$reconciliation = reconcile_existing_mail_threads(db());

$status = (string) ($_GET['status'] ?? 'all');
$allowed = ['all', 'review', 'processed', 'ignored', 'error'];
$status = in_array($status, $allowed, true) ? $status : 'all';
$sql = 'SELECT id, mailbox, received_at, sender_name, sender_email, subject, body, status,
               confidence, extracted, review_reason, error_message, case_ref, created_at, processed_at
        FROM app_mail_items';
$parameters = [];
if ($status !== 'all') {
    $sql .= ' WHERE status = ?';
    $parameters[] = $status;
}
$sql .= ' ORDER BY COALESCE(received_at, created_at) DESC LIMIT 100';
$statement = db()->prepare($sql);
$statement->execute($parameters);
$items = array_map(static function (array $row): array {
    $row['id'] = (int) $row['id'];
    $row['confidence'] = (float) $row['confidence'];
    $row['extracted'] = $row['extracted'] ? json_decode($row['extracted'], true) : null;
    return $row;
}, $statement->fetchAll());
$counts = ['review' => 0, 'processed' => 0, 'ignored' => 0, 'error' => 0];
foreach (db()->query('SELECT status, COUNT(*) total FROM app_mail_items GROUP BY status')->fetchAll() as $row) {
    $counts[$row['status']] = (int) $row['total'];
}
$lastRun = db()->query(
    'SELECT status, scanned, processed, review_count, ignored, errors, started_at, finished_at
     FROM app_mail_runs ORDER BY id DESC LIMIT 1'
)->fetch() ?: null;

respond(['items' => $items, 'counts' => $counts, 'lastRun' => $lastRun, 'reconciliation' => $reconciliation]);
