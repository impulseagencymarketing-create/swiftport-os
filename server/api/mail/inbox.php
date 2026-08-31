<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
require_roles(['operations', 'admin']);
require_method('GET');

$status = (string) ($_GET['status'] ?? 'all');
$allowedStatuses = ['all', 'review', 'processed', 'ignored', 'error'];
$status = in_array($status, $allowedStatuses, true) ? $status : 'all';

$link = (string) ($_GET['link'] ?? 'all');
$link = in_array($link, ['all', 'linked', 'unlinked'], true) ? $link : 'all';

$mailboxKey = (string) ($_GET['mailbox'] ?? 'all');
$mailboxAccounts = [
    'info' => config('info_email_user'),
    'operations' => config('operations_email_user'),
];
$mailbox = isset($mailboxAccounts[$mailboxKey]) ? $mailboxAccounts[$mailboxKey] : '';

$caseRef = mb_strtoupper(trim((string) ($_GET['case_ref'] ?? '')));
$caseRef = mb_substr($caseRef, 0, 40);

$where = [];
$parameters = [];
if ($status !== 'all') {
    $where[] = 'status = ?';
    $parameters[] = $status;
}
if ($link === 'linked') {
    $where[] = "case_ref IS NOT NULL AND case_ref <> ''";
} elseif ($link === 'unlinked') {
    $where[] = "(case_ref IS NULL OR case_ref = '')";
}
if ($mailbox !== '') {
    $where[] = 'mailbox = ?';
    $parameters[] = $mailbox;
}
if ($caseRef !== '') {
    $where[] = 'case_ref = ?';
    $parameters[] = $caseRef;
}

$sql = 'SELECT id, mailbox, received_at, sender_name, sender_email, subject, body, status,
               confidence, extracted, review_reason, error_message, case_ref, created_at, processed_at,
               reviewed_at
        FROM app_mail_items';
if ($where !== []) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY COALESCE(received_at, created_at) DESC LIMIT 200';

$statement = db()->prepare($sql);
$statement->execute($parameters);
$items = array_map(static function (array $row): array {
    $row['id'] = (int) $row['id'];
    $row['confidence'] = (float) $row['confidence'];
    $row['extracted'] = $row['extracted'] ? json_decode($row['extracted'], true) : null;
    return $row;
}, $statement->fetchAll());

$counts = ['review' => 0, 'processed' => 0, 'ignored' => 0, 'error' => 0, 'linked' => 0, 'unlinked' => 0, 'total' => 0];
foreach (db()->query('SELECT status, COUNT(*) total FROM app_mail_items GROUP BY status')->fetchAll() as $row) {
    $counts[$row['status']] = (int) $row['total'];
    $counts['total'] += (int) $row['total'];
}
$linkCounts = db()->query(
    "SELECT
        SUM(CASE WHEN case_ref IS NOT NULL AND case_ref <> '' THEN 1 ELSE 0 END) linked,
        SUM(CASE WHEN case_ref IS NULL OR case_ref = '' THEN 1 ELSE 0 END) unlinked
     FROM app_mail_items"
)->fetch() ?: [];
$counts['linked'] = (int) ($linkCounts['linked'] ?? 0);
$counts['unlinked'] = (int) ($linkCounts['unlinked'] ?? 0);

$mailboxCounts = ['info' => 0, 'operations' => 0];
foreach ($mailboxAccounts as $key => $account) {
    if ($account === '') continue;
    $mailboxStatement = db()->prepare('SELECT COUNT(*) FROM app_mail_items WHERE mailbox = ?');
    $mailboxStatement->execute([$account]);
    $mailboxCounts[$key] = (int) $mailboxStatement->fetchColumn();
}

$lastRun = db()->query(
    'SELECT status, scanned, processed, review_count, ignored, errors, started_at, finished_at
     FROM app_mail_runs ORDER BY id DESC LIMIT 1'
)->fetch() ?: null;

respond([
    'items' => $items,
    'counts' => $counts,
    'mailboxCounts' => $mailboxCounts,
    'lastRun' => $lastRun,
]);
