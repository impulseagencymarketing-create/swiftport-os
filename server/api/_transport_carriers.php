<?php
declare(strict_types=1);

// Merge one directory entry; service assignments retain their IDs and history.
function transport_carrier_save(array $providers, array $input): array {
    $id = trim((string)($input['id'] ?? ''));
    $index = null;
    foreach ($providers as $i => $provider) if (($provider['id'] ?? '') === $id && $id !== '') { $index = $i; break; }
    if ($id !== '' && $index === null) throw new InvalidArgumentException('Este transportista ya no existe. Recarga el directorio.');
    $previous = $index !== null ? $providers[$index] : [];
    if ($index !== null && (int)($input['revision'] ?? 0) !== (int)($previous['revision'] ?? 0)) throw new InvalidArgumentException('Otro usuario ha actualizado este transportista. Recarga antes de editarlo.');
    $entry = $previous;
    foreach (['nombre'=>160,'contacto'=>200,'telefono'=>200,'email'=>200,'zona'=>200,'vehiculo'=>200,'notas'=>2000] as $key=>$max) {
        $value=$input[$key]??'';
        if (!is_string($value) || strlen($value)>$max*4) throw new InvalidArgumentException('Revisa la longitud del campo '.$key.'.');
        $entry[$key]=trim($value);
    }
    if ($entry['nombre']==='') throw new InvalidArgumentException('Indica el nombre del transportista.');
    $entry['tipo']=$input['tipo']??'empresa';
    if (!in_array($entry['tipo'],['empresa','persona'],true)) throw new InvalidArgumentException('Selecciona empresa o persona.');
    if ($entry['email']!=='' && !filter_var($entry['email'],FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Revisa el email.');
    foreach ($providers as $i=>$provider) {
        if ($i!==$index && strcasecmp(trim((string)($provider['nombre']??'')),$entry['nombre'])===0 && ($provider['tipo']??'empresa')===$entry['tipo']) throw new InvalidArgumentException('Ya existe un transportista con ese nombre y tipo. Busca también entre los inactivos.');
    }
    $entry['activo']=($input['activo']??true)!==false;
    $entry['id']=$id!==''?$id:'PRV-'.bin2hex(random_bytes(12));
    $entry['revision']=(int)($previous['revision']??0)+1;
    if ($index===null) $providers[]=$entry; else $providers[$index]=$entry;
    return ['providers'=>array_values($providers),'provider'=>$entry];
}

function preserve_transport_carriers(array $incoming, array $stored): array {
    if (!empty($stored['providerDirectoryManaged'])) {
        $incoming['providers']=$stored['providers']??[];
        $incoming['providerDirectoryManaged']=true;
    }
    return $incoming;
}
