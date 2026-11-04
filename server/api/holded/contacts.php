<?php
declare(strict_types=1);
require dirname(__DIR__).'/_bootstrap.php';
require_once __DIR__.'/_contacts.php';
require_roles(['finance','admin']);
require_method('GET');
header('Cache-Control: no-store');
$apiKey=trim(config('holded_api_key'));
if ($apiKey==='') respond(['error'=>'Holded todavía no está configurado.'],503);
try {
    $contacts=[];
    foreach (holded_contact_list(holded_contact_get($apiKey,'contacts')) as $contact) {
        $option=holded_contact_option($contact);
        if ($option) $contacts[]=$option;
    }
    usort($contacts,static fn($a,$b)=>strcasecmp($a['name'],$b['name']));
    respond(['contacts'=>$contacts]);
} catch (RuntimeException $error) {
    respond(['error'=>$error->getMessage()],502);
}
