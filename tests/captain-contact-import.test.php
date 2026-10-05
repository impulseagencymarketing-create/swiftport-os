<?php
declare(strict_types=1);
require __DIR__ . '/../server/api/_captain_contact_import.php';

function check_contact(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
final class ContactStatement extends PDOStatement {
    public function __construct(private ContactDatabase $database) {}
    public function execute(?array $params = null): bool {
        [$vessel, $phone, $notes, $userId] = $params;
        $key = $vessel . '|' . $phone;
        if (!isset($this->database->rows[$key])) $this->database->rows[$key] = compact('vessel','phone','notes','userId') + ['active'=>1];
        return true;
    }
}
final class ContactDatabase extends PDO {
    public array $rows = [];
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement|false {
        check_contact(str_starts_with($query, 'INSERT IGNORE INTO app_captain_contacts'), 'Import must not overwrite existing contacts');
        return new ContactStatement($this);
    }
}
$db = new ContactDatabase();
import_requested_captain_contacts($db, 42);
check_contact(count($db->rows) === 3, 'Three contacts must be imported');
foreach ([['LIBERTY','+639087497690'],['SIRIOS CEMENT V','+306973777717'],['SIRIOS CEMENT V','+34624825124']] as [$vessel,$phone]) {
    check_contact(isset($db->rows[$vessel.'|'.$phone]), 'Exact vessel and telephone required');
    check_contact((bool) preg_match('/^\+[1-9][0-9]{7,14}$/', $phone), 'Valid international phone required');
    check_contact($db->rows[$vessel.'|'.$phone]['userId'] === 42, 'Record creator required');
}
$key = 'LIBERTY|+639087497690';
$db->rows[$key]['notes'] = 'Updated by operator';
$db->rows[$key]['active'] = 0;
import_requested_captain_contacts($db, 99);
check_contact(count($db->rows) === 3, 'Reload must not duplicate contacts');
check_contact($db->rows[$key]['notes'] === 'Updated by operator', 'Preserve manual edits');
check_contact($db->rows[$key]['active'] === 0, 'Do not resurrect archived contacts');
$api = file_get_contents(__DIR__.'/../server/api/captains.php');
check_contact(strpos($api, 'require_roles') < strpos($api, 'import_requested_captain_contacts('), 'Import must remain behind authorization');
check_contact(strpos($api, 'import_requested_captain_contacts(') < strpos($api, "if (\$method === 'GET')"), 'Import before listing contacts');
echo "OK: exact phones, three contacts, repeat-safe import, preserved edits and archives, authenticated agenda integration\n";
