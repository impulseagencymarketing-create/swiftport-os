<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/_service.php';

ensure_schema();
$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    require_method('POST');
}

$cronToken = (string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');
$isCron = $cronToken !== '' && config('setup_token') !== ''
    && hash_equals(config('setup_token'), $cronToken);

if (!$isCron && !$isCli) {
    require_roles(['operations', 'admin']);
    verify_csrf();
}

$disabledSummary = [
    'processed' => 0,
    'review' => 0,
    'ignored' => 0,
    'errors' => 0,
    'disabled' => true,
    'message' => 'Lectura automática de correos desactivada temporalmente. Los expedientes deben crearse manualmente.',
];

if ($isCli) {
    echo json_encode(['ok' => true, 'summary' => $disabledSummary], JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
}

respond(['ok' => true, 'summary' => $disabledSummary]);

try {
    $summary = process_mailboxes(($isCron || $isCli) ? 'cron' : 'manual');
    if ($isCli) {
        echo json_encode(['ok' => true, 'summary' => $summary], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        exit(0);
    }
    respond(['ok' => true, 'summary' => $summary]);
} catch (Throwable $error) {
    if ($isCli) {
        fwrite(STDERR, $error->getMessage() . PHP_EOL);
        exit(1);
    }
    respond(['error' => $error->getMessage()], 500);
}
