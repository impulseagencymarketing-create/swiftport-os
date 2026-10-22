<?php
declare(strict_types=1);
// Read-only support check: never creates or changes Holded documents or contacts.
$key = trim((string) getenv('HOLDED_API_KEY'));
if ($key === '') throw new RuntimeException('Falta la conexión de Holded.');
function read_holded(string $path): array {
    global $key;
    $ch = curl_init('https://api.holded.com/api/invoicing/v1/' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>30, CURLOPT_HTTPHEADER=>['Accept: application/json', 'key: '.$key]]);
    $raw = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($status < 200 || $status >= 300 || $raw === false) throw new RuntimeException('Consulta Holded HTTP '.$status);
    $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    foreach (['data','items','documents','contacts','results'] as $field) if (isset($data[$field]) && is_array($data[$field])) return $data[$field];
    if (!array_is_list($data)) throw new RuntimeException('Formato de listado no reconocido.');
    return $data;
}
$contacts = read_holded('contacts');
$matches = array_values(array_filter($contacts, static fn($c)=>preg_match('/\bwrist\b/i',(string)($c['name']??''))===1));
$ids = array_column($matches,'id');
$invoices = read_holded('documents/invoice?sort=created-desc');
$found = [];
foreach ($invoices as $row) {
    $contact = $row['contact'] ?? $row['contactId'] ?? '';
    $id = is_array($contact) ? ($contact['id']??'') : $contact;
    if (!in_array($id,$ids,true) && !preg_match('/\bwrist\b/i',(string)($row['contactName']??''))) continue;
    $found[] = ['id'=>$row['id']??'', 'number'=>$row['docNumber']??'', 'date'=>$row['date']??'', 'contactId'=>$id, 'contactName'=>$row['contactName']??'', 'status'=>$row['status']??null];
}
usort($found, static fn($a,$b)=>($b['date']??0)<=>($a['date']??0));
echo json_encode(['readOnly'=>true,'contactCount'=>count($contacts),'invoiceCount'=>count($invoices),'contactFields'=>array_keys($contacts[0]??[]),'invoiceFields'=>array_keys($invoices[0]??[]),'contacts'=>array_map(static fn($c)=>array_intersect_key($c,array_flip(['id','name','code','type'])),$matches),'recentInvoices'=>array_slice($found,0,12)],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;
