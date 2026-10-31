<?php
declare(strict_types=1);

function transport_waiting_normalize(mixed $value): array {
    if (!is_array($value)) throw new InvalidArgumentException('Revisa las horas de espera del transporte.');
    $read = static function(mixed $raw, float $max): float {
        if (!is_scalar($raw) && $raw !== null) throw new InvalidArgumentException('Espera o tarifa no válida.');
        $text = str_replace(',', '.', trim((string)($raw ?? '')));
        if ($text === '') return 0;
        if (!is_numeric($text)) throw new InvalidArgumentException('Espera o tarifa no válida.');
        $number = (float)$text;
        if (!is_finite($number) || $number < 0 || $number > $max || abs($number*100-round($number*100)) > 0.00001) throw new InvalidArgumentException('Revisa las horas y el precio de espera: máximo dos decimales y sin negativos.');
        return $number;
    };
    if (isset($value['reason']) && !is_string($value['reason'])) throw new InvalidArgumentException('Motivo de espera no válido.');
    return ['hours'=>$read($value['hours']??0,1000), 'rate'=>($value['rate']??'')===''?null:$read($value['rate'],1000000), 'reason'=>trim((string)($value['reason']??''))];
}

function transport_waiting_validate(array $data, array $stored): array {
    $old=[];foreach ($stored['transports']??[] as $t) $old[$t['id']??'']=$t;
    $waiting=[];
    foreach ($data['transports'] as &$t) {
        // Older clients omit the field. Removing a wait uses hours=0 explicitly.
        if (!array_key_exists('waiting',$t) && isset($old[$t['id']??'']['waiting'])) $t['waiting']=$old[$t['id']]['waiting'];
        if (array_key_exists('waiting',$t)) {
            $t['waiting']=transport_waiting_normalize($t['waiting']);
            if (strlen($t['waiting']['reason'])>8000) throw new InvalidArgumentException('El motivo de espera es demasiado largo.');
            $waiting[$t['id']]=$t['waiting'];
        }
    }
    unset($t);
    foreach ($data['calendarEvents']??[] as $index=>$event) {
        if (isset($waiting[$event['transporte']??''])) $data['calendarEvents'][$index]['waiting']=$waiting[$event['transporte']];
    }
    return $data;
}
