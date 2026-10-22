<?php
declare(strict_types=1);

// No contact creation endpoint is used here. An unresolved customer must stop the export.
function holded_contact_normalize(string $value): string
{
    return preg_replace('/[^A-Z0-9]/', '', strtoupper(strtr($value, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N']))) ?? '';
}

function holded_contact_list(mixed $data): array
{
    if (!is_array($data)) throw new RuntimeException('Holded devolvió un listado de contactos no válido.');
    if (!empty($data['has_more']) || !empty($data['hasMore'])) throw new RuntimeException('Holded devolvió un listado incompleto. No se ha creado ningún contacto ni proforma.');
    foreach (['contacts','documents','items','data','results'] as $field) {
        if (isset($data[$field]) && is_array($data[$field]) && array_is_list($data[$field])) return array_values(array_filter($data[$field], 'is_array'));
    }
    if (array_is_list($data)) return array_values(array_filter($data, 'is_array'));
    throw new RuntimeException('No se pudo leer el listado de Holded. No se ha creado ningún contacto ni proforma.');
}

function holded_contact_get(string $apiKey, string $path): array
{
    $ch = curl_init('https://api.holded.com/api/invoicing/v1/' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>20, CURLOPT_CONNECTTIMEOUT=>8, CURLOPT_HTTPHEADER=>['Accept: application/json', 'key: '.$apiKey]]);
    $raw = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($raw === false || $status < 200 || $status >= 300) throw new RuntimeException('No se pudo verificar el contacto en Holded (HTTP '.$status.'). No se ha enviado la proforma.');
    try { $data=json_decode($raw,true,512,JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { throw new RuntimeException('Holded no devolvió datos válidos para verificar el contacto.'); }
    if (!is_array($data)) throw new RuntimeException('Contacto de Holded no verificable.');
    return $data;
}

function holded_invoice_contact_id(array $invoice): string
{
    $contact=$invoice['contact']??$invoice['contactId']??$invoice['contact_id']??'';
    return trim((string)(is_array($contact)?($contact['id']??$contact['_id']??''):$contact));
}

function holded_contact_candidates(array $contacts, string $clientName, string $fiscalName, string $taxId): array
{
    $tax=holded_contact_normalize($taxId);
    $names=array_filter(array_unique([holded_contact_normalize($clientName),holded_contact_normalize($fiscalName)]));
    $wrist=preg_match('/\bwrist\b/i',$clientName)===1;
    $matches=[];
    foreach ($contacts as $contact) {
        $id=trim((string)($contact['id']??''));
        if ($id==='' || !empty($contact['archived']) || !empty($contact['deleted'])) continue;
        $codes=array_filter([holded_contact_normalize((string)($contact['code']??'')),holded_contact_normalize((string)($contact['vatnumber']??$contact['vat_number']??''))]);
        // A supplied fiscal identifier is authoritative; never fall back to a different tax identity.
        if ($tax!=='') {
            if (in_array($tax,$codes,true)) $matches[$id]=$contact;
            continue;
        }
        $name=(string)($contact['name']??'');
        if (in_array(holded_contact_normalize($name),$names,true) || ($wrist && preg_match('/\bwrist\b/i',$name)===1)) $matches[$id]=$contact;
    }
    return $matches;
}

function holded_choose_contact(array $candidates, array $issuedInvoices): array
{
    if (!$candidates) throw new InvalidArgumentException('No se encontró un contacto existente en Holded para este cliente. Revisa su razón social y NIF en Clientes / Tarifas; no se creará un contacto nuevo.');
    if (count($candidates)===1) return ['contact'=>reset($candidates),'matchedBy'=>'existing-contact'];
    $history=[];
    foreach ($issuedInvoices as $invoice) {
        $id=holded_invoice_contact_id($invoice);
        $status=strtolower((string)($invoice['status']??''));
        if (!isset($candidates[$id]) || !empty($invoice['draft']) || !empty($invoice['isDraft']) || in_array($status,['draft','cancelled','canceled','deleted'],true)) continue;
        $number=trim((string)($invoice['docNumber']??$invoice['number']??''));
        if ($number==='') continue;
        $date=$invoice['date']??0;
        $timestamp=is_numeric($date)?(int)$date:(strtotime((string)$date)?:0);
        if ($timestamp<=0) continue;
        $history[]=['id'=>$id,'date'=>$timestamp,'number'=>$number];
    }
    usort($history,static fn($a,$b)=>$b['date']<=>$a['date']);
    if (!$history) throw new InvalidArgumentException('Hay varios contactos del cliente en Holded y no se puede identificar el usado en sus facturas emitidas. Revisa el NIF antes de enviar. No se ha creado ningún contacto.');
    $latest=$history[0];
    // Different tax identities are not duplicate contacts. Do not choose between legal entities by name.
    $taxes=[];
    foreach ($history as $entry) {
        $tax=holded_contact_normalize((string)($candidates[$entry['id']]['code']??''));
        if ($tax!=='') $taxes[$tax]=true;
        if ($entry['date']===$latest['date'] && $entry['id']!==$latest['id']) throw new InvalidArgumentException('Las últimas facturas usan distintos contactos en la misma fecha. Revisa el NIF del cliente antes de enviar.');
    }
    if (count($taxes)>1) throw new InvalidArgumentException('Las facturas del cliente corresponden a varios NIF en Holded. Indica el NIF correcto en Clientes / Tarifas antes de enviar.');
    return ['contact'=>$candidates[$latest['id']],'matchedBy'=>'latest-issued-invoice','invoiceNumber'=>$latest['number']];
}

function holded_resolve_contact(string $apiKey, string $clientName, string $fiscalName, string $taxId, ?callable $get=null): array
{
    $get??=static fn(string $path)=>holded_contact_get($apiKey,$path);
    $contacts=holded_contact_list($get('contacts'));
    $candidates=holded_contact_candidates($contacts,$clientName,$fiscalName,$taxId);
    $invoices=count($candidates)>1?holded_contact_list($get('documents/invoice?sort=created-desc')):[];
    return holded_choose_contact($candidates,$invoices);
}

function holded_existing_contact_request(array $request, array $resolution): array
{
    $id=trim((string)($resolution['contact']['id']??''));
    if ($id==='') throw new InvalidArgumentException('Falta el identificador del contacto verificado en Holded.');
    // contactName without contactId makes Holded create a contact. Never send the inline creation fields.
    unset($request['contactName'],$request['contactCode'],$request['contactEmail'],$request['contactAddress']);
    $request['contactId']=$id;
    return $request;
}
