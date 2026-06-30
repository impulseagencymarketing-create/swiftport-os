<?php
declare(strict_types=1);

function mail_decode_header_value(string $value): string
{
    $result = '';
    foreach (imap_mime_header_decode($value) as $part) {
        $charset = strtoupper((string) ($part->charset ?? 'UTF-8'));
        $text = (string) ($part->text ?? '');
        if (!in_array($charset, ['DEFAULT', 'UTF-8'], true)) {
            $text = mb_convert_encoding($text, 'UTF-8', $charset);
        }
        $result .= $text;
    }
    return trim($result);
}

function mail_decode_body(string $body, int $encoding): string
{
    if ($encoding === 3) {
        return (string) base64_decode($body, true);
    }
    return $encoding === 4 ? quoted_printable_decode($body) : $body;
}

function mail_part_charset(object $part): string
{
    foreach (array_merge($part->parameters ?? [], $part->dparameters ?? []) as $parameter) {
        if (strtolower((string) ($parameter->attribute ?? '')) === 'charset') {
            return (string) ($parameter->value ?? 'UTF-8');
        }
    }
    return 'UTF-8';
}

function mail_extract_text($imap, int $uid, object $part, string $partNumber = ''): string
{
    if (strtoupper((string) ($part->disposition ?? '')) === 'ATTACHMENT') {
        return '';
    }
    if (!empty($part->parts)) {
        $pieces = [];
        foreach ($part->parts as $index => $child) {
            $number = $partNumber === '' ? (string) ($index + 1) : $partNumber . '.' . ($index + 1);
            $pieces[] = mail_extract_text($imap, $uid, $child, $number);
        }
        return trim(implode("\n", array_filter($pieces)));
    }
    if ((int) ($part->type ?? -1) !== 0) {
        return '';
    }
    $subtype = strtoupper((string) ($part->subtype ?? 'PLAIN'));
    if (!in_array($subtype, ['PLAIN', 'HTML'], true)) {
        return '';
    }
    $raw = $partNumber === ''
        ? imap_body($imap, $uid, FT_UID | FT_PEEK)
        : imap_fetchbody($imap, $uid, $partNumber, FT_UID | FT_PEEK);
    $text = mail_decode_body((string) $raw, (int) ($part->encoding ?? 0));
    $charset = mail_part_charset($part);
    if (strtoupper($charset) !== 'UTF-8') {
        $text = mb_convert_encoding($text, 'UTF-8', $charset);
    }
    if ($subtype === 'HTML') {
        $text = html_entity_decode(
            strip_tags(preg_replace('/<(br|\/p|\/div|\/li)>/i', "\n", $text)),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8'
        );
    }
    return trim(preg_replace("/[ \t]+\n/", "\n", $text));
}

function mail_sender(string $from): array
{
    $address = (imap_rfc822_parse_adrlist($from, '')[0] ?? null);
    if (!$address) {
        return ['', ''];
    }
    $email = !empty($address->mailbox) && !empty($address->host)
        ? strtolower((string) $address->mailbox . '@' . (string) $address->host)
        : '';
    return [mail_decode_header_value((string) ($address->personal ?? '')), $email];
}

function clean_extracted_value(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', rtrim($value, ". \t\n\r\0\x0B")));
}

function labeled_value(string $text, array $labels, int $limit = 70): string
{
    $escaped = array_map(static fn(string $label): string => preg_quote($label, '/'), $labels);
    $pattern = '/(?:^|[\r\n])\s*(?:' . implode('|', $escaped) . ')\s*[:\-]\s*([^\r\n,;]{2,' . $limit . '})/iu';
    if (preg_match($pattern, $text, $match)) {
        return clean_extracted_value($match[1]);
    }
    return '';
}

function normalize_date_value(string $value): string
{
    $value = mb_strtolower(trim($value));
    if (preg_match('/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/', $value, $match)) {
        return sprintf('%04d-%02d-%02d', $match[1], $match[2], $match[3]);
    }
    if (preg_match('/\b(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2}|\d{2})\b/', $value, $match)) {
        $year = strlen($match[3]) === 2 ? 2000 + (int) $match[3] : (int) $match[3];
        return sprintf('%04d-%02d-%02d', $year, $match[2], $match[1]);
    }
    $months = [
        'jan' => 1, 'january' => 1, 'ene' => 1, 'enero' => 1,
        'feb' => 2, 'february' => 2, 'febrero' => 2,
        'mar' => 3, 'march' => 3, 'marzo' => 3,
        'apr' => 4, 'april' => 4, 'abr' => 4, 'abril' => 4,
        'may' => 5, 'mayo' => 5,
        'jun' => 6, 'june' => 6, 'junio' => 6,
        'jul' => 7, 'july' => 7, 'julio' => 7,
        'aug' => 8, 'august' => 8, 'ago' => 8, 'agosto' => 8,
        'sep' => 9, 'september' => 9, 'septiembre' => 9,
        'oct' => 10, 'october' => 10, 'octubre' => 10,
        'nov' => 11, 'november' => 11, 'noviembre' => 11,
        'dec' => 12, 'december' => 12, 'dic' => 12, 'diciembre' => 12,
    ];
    if (preg_match('/\b(\d{1,2})\s+([a-záéíóú]+)\s+(20\d{2}|\d{2})\b/iu', $value, $match)) {
        $month = $months[mb_strtolower($match[2])] ?? 0;
        if ($month) {
            $year = strlen($match[3]) === 2 ? 2000 + (int) $match[3] : (int) $match[3];
            return sprintf('%04d-%02d-%02d', $year, $month, $match[1]);
        }
    }
    return '';
}

function labeled_date(string $text, array $labels): string
{
    $value = labeled_value($text, $labels, 60);
    return $value !== '' ? normalize_date_value($value) : '';
}

function labeled_time(string $text, array $labels): string
{
    $value = labeled_value($text, $labels, 40);
    if (preg_match('/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/', $value, $match)) {
        return sprintf('%02d:%02d', $match[1], $match[2]);
    }
    return '';
}

function date_after_keywords(string $text, array $keywords): string
{
    $escaped = array_map(static fn(string $value): string => preg_quote($value, '/'), $keywords);
    $datePattern = '((?:20\d{2}[-\/]\d{1,2}[-\/]\d{1,2})|(?:\d{1,2}[-\/]\d{1,2}[-\/](?:20\d{2}|\d{2}))|(?:\d{1,2}\s+[a-záéíóú]+\s+(?:20\d{2}|\d{2})))';
    if (preg_match('/(?:' . implode('|', $escaped) . ')[^\r\n]{0,45}?' . $datePattern . '/iu', $text, $match)) {
        return normalize_date_value($match[1]);
    }
    return '';
}

function extract_local_service(array $email): array
{
    $text = $email['subject'] . "\n" . mb_substr($email['body'], 0, 40000);
    $lower = mb_strtolower($text);
    $reception = (bool) preg_match('/\b(recepci[oó]n|reception|receive|receiving|almac[eé]n|warehouse)\b/iu', $lower);
    $sampleService = (bool) preg_match('/\b(recoger|retirar|recolecci[oó]n|recogida|collect(?:ion)?|pick[\s-]?up)\b[^\r\n]{0,30}\b(muestras?|samples?|specimens?)\b|\b(muestras?|samples?|specimens?)\b[^\r\n]{0,30}\b(recoger|retirar|collect(?:ion)?|pick[\s-]?up)\b/iu', $lower);
    $transport = $sampleService || (bool) preg_match('/\b(transporte|transport|delivery|deliver|entrega|pickup|pick-up|recogida|recoger|retirar|collect|courier)\b/iu', $lower);
    $operational = $reception || $transport;
    $vessel = labeled_value($text, ['buque', 'vessel', 'ship', 'm/v', 'mv']);
    if ($vessel === '' && preg_match('/\b(?:m\/v|mv)\s+([a-z0-9][a-z0-9 .\'-]{2,50}?)(?=\s*(?:[-–—|]|\beta\b|\bat\b|\bin\b|$))/iu', $text, $match)) {
        $vessel = clean_extracted_value($match[1]);
    }
    if ($vessel === '' && preg_match('/\b(?:buque|vessel|ship)\s+(?:is\s+|es\s+)?([a-z0-9][a-z0-9 .\'-]{2,50}?)(?=\s*(?:[-–—,;|]|\beta\b|\bat\b|\bin\b|$))/iu', $text, $match)) {
        $vessel = clean_extracted_value($match[1]);
    }
    $eta = labeled_date($text, ['eta', 'estimated time of arrival']);
    if ($eta === '') {
        $eta = date_after_keywords($text, ['eta', 'estimated time of arrival', 'arrival']);
    }
    $port = labeled_value($text, ['puerto', 'port', 'port of call']);
    if ($port === '') {
        $knownPorts = ['Algeciras', 'Barcelona', 'Tarragona', 'Valencia', 'Bilbao', 'Cartagena', 'Huelva', 'Vigo', 'Las Palmas', 'Gibraltar', 'Ceuta', 'Málaga', 'Malaga', 'Cádiz', 'Cadiz'];
        foreach ($knownPorts as $knownPort) {
            if (preg_match('/\b' . preg_quote($knownPort, '/') . '\b/iu', $text)) {
                $port = $knownPort;
                break;
            }
        }
    }
    $client = labeled_value($text, ['cliente', 'client', 'customer', 'company']);
    if ($client === '') {
        $client = $email['sender_name'] ?: strstr($email['sender_email'], '@', true);
    }
    $receptionDate = labeled_date($text, ['fecha recepción', 'fecha de recepción', 'reception date', 'receiving date']);
    $transportDate = labeled_date($text, ['fecha transporte', 'fecha de transporte', 'transport date', 'delivery date', 'fecha entrega', 'fecha de entrega', 'pickup date']);
    if ($transportDate === '' && $sampleService) {
        $transportDate = date_after_keywords($text, ['recoger muestras', 'retirar muestras', 'recogida de muestras', 'sample collection', 'collect samples', 'samples pickup', 'pick up samples']);
    }
    if ($transportDate === '' && $sampleService && $eta !== '') {
        $transportDate = $eta;
    }
    $receptionTime = labeled_time($text, ['hora recepción', 'hora de recepción', 'reception time', 'receiving time']);
    $transportTime = labeled_time($text, ['hora transporte', 'hora de transporte', 'transport time', 'delivery time', 'hora entrega', 'pickup time']);
    $pickup = labeled_value($text, ['recogida', 'pickup', 'collect from', 'origen', 'origin']);
    $delivery = labeled_value($text, ['entrega', 'delivery', 'deliver to', 'destino', 'destination']);
    if ($pickup === '' && $sampleService && $vessel !== '') {
        $pickup = 'M/V ' . $vessel . ($port !== '' ? ' · ' . $port : '');
    }
    $cargo = labeled_value($text, ['mercancía', 'mercancia', 'cargo', 'goods', 'packages', 'bultos']);
    if ($cargo === '' && $sampleService) {
        $cargo = 'RECOGIDA DE MUESTRAS';
    }
    $priority = preg_match('/\b(urgente|urgent|asap|immediate)\b/iu', $lower) ? 'Urgente' : 'Media';
    $confidence = 0.15;
    $confidence += $operational ? 0.15 : 0;
    $confidence += $vessel !== '' ? 0.18 : 0;
    $confidence += $eta !== '' ? 0.14 : 0;
    $confidence += $port !== '' ? 0.14 : 0;
    $confidence += $client !== '' ? 0.08 : 0;
    $confidence += (!$reception || $receptionDate !== '') ? 0.08 : 0;
    $confidence += (!$transport || $transportDate !== '') ? 0.08 : 0;
    return [
        'is_service' => $operational,
        'confidence' => min(1, $confidence),
        'client' => clean_extracted_value((string) $client),
        'vessel' => mb_strtoupper(clean_extracted_value($vessel)),
        'eta' => $eta,
        'port' => mb_strtoupper(clean_extracted_value($port)),
        'priority' => $priority,
        'cargo_summary' => clean_extracted_value($cargo),
        'reception' => [
            'required' => $reception,
            'date' => $receptionDate,
            'time' => $receptionTime,
            'location' => labeled_value($text, ['lugar recepción', 'reception location', 'warehouse', 'almacén']),
        ],
        'transport' => [
            'required' => $transport,
            'date' => $transportDate,
            'time' => $transportTime,
            'pickup' => clean_extracted_value($pickup),
            'delivery' => clean_extracted_value($delivery),
        ],
    ];
}

function service_review_reasons(array $data): array
{
    $reasons = [];
    if (empty($data['vessel'])) $reasons[] = 'Falta el buque';
    if (empty($data['eta'])) $reasons[] = 'Falta la ETA';
    if (empty($data['port'])) $reasons[] = 'Falta el puerto';
    $reception = !empty($data['reception']['required']);
    $transport = !empty($data['transport']['required']);
    if (!$reception && !$transport) $reasons[] = 'No se identifica un servicio';
    if ($reception && empty($data['reception']['date'])) $reasons[] = 'Falta la fecha de recepción';
    if ($transport && empty($data['transport']['date'])) $reasons[] = 'Falta la fecha de transporte';
    if ((float) ($data['confidence'] ?? 0) < 0.85) $reasons[] = 'Revisión manual recomendada';
    return $reasons;
}

function next_case_ref(array $cases): string
{
    $year = date('Y');
    $maximum = 0;
    foreach ($cases as $case) {
        if (preg_match('/^SW-' . $year . '-(\d+)$/', (string) ($case['id'] ?? ''), $match)) {
            $maximum = max($maximum, (int) $match[1]);
        }
    }
    return 'SW-' . $year . '-' . str_pad((string) ($maximum + 1), 4, '0', STR_PAD_LEFT);
}

function next_transport_ref(array $transports): string
{
    $maximum = 0;
    foreach ($transports as $transport) {
        if (preg_match('/(\d+)$/', (string) ($transport['id'] ?? ''), $match)) {
            $maximum = max($maximum, (int) $match[1]);
        }
    }
    return 'TR-' . str_pad((string) ($maximum + 1), 3, '0', STR_PAD_LEFT);
}

function plus_one_hour(string $time): string
{
    $time = preg_match('/^\d{2}:\d{2}$/', $time) ? $time : '09:00';
    return date('H:i', strtotime($time . ' +1 hour'));
}

function apply_service_email(int $mailId, array $data, ?int $userId = null): string
{
    $critical = array_filter(
        service_review_reasons($data),
        static fn(string $reason): bool => $reason !== 'Revisión manual recomendada'
    );
    if ($critical) {
        throw new InvalidArgumentException(implode('. ', $critical) . '.');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $mailStatement = $pdo->prepare('SELECT status, case_ref FROM app_mail_items WHERE id = ? FOR UPDATE');
        $mailStatement->execute([$mailId]);
        $mail = $mailStatement->fetch();
        if (!$mail) throw new RuntimeException('Correo no encontrado.');
        if ($mail['status'] === 'processed') {
            $pdo->commit();
            return (string) $mail['case_ref'];
        }
        $stateRow = $pdo->query('SELECT data FROM app_operational_state WHERE id = 1 FOR UPDATE')->fetch();
        $state = $stateRow ? json_decode($stateRow['data'], true, 512, JSON_THROW_ON_ERROR) : [];
        foreach (['cases', 'transports', 'warehouseEntries', 'customs', 'calendarEvents'] as $key) {
            $state[$key] = is_array($state[$key] ?? null) ? $state[$key] : [];
        }
        $caseRef = next_case_ref($state['cases']);
        $services = [];
        if (!empty($data['reception']['required'])) $services[] = 'Recepción';
        if (!empty($data['transport']['required'])) $services[] = 'Transporte';
        array_unshift($state['cases'], [
            'id' => $caseRef,
            'buque' => mb_strtoupper(trim((string) $data['vessel'])),
            'cliente' => trim((string) ($data['client'] ?: 'Por identificar')),
            'puerto' => mb_strtoupper(trim((string) $data['port'])),
            'eta' => (string) $data['eta'],
            'estado' => 'Nuevo',
            'prioridad' => (string) ($data['priority'] ?? 'Media'),
            'conductor' => 'Sin asignar',
            'servicios' => $services,
            'bultos' => 0,
            'peso' => 'Por registrar',
            'mercancias' => [],
            'progreso' => 10,
            'siguiente' => 'Validar trabajo recibido por email',
            'aduana' => 'Por revisar',
            'sourceEmailId' => $mailId,
            'timelineCustom' => [[
                'id' => 'EMAIL-' . $mailId,
                'hora' => date('H:i'),
                'titulo' => 'Servicio recibido por email',
                'detalle' => 'Importado automáticamente · Revisar planificación',
                'estado' => 'done',
            ]],
        ]);
        if (!empty($data['reception']['required'])) {
            $start = $data['reception']['time'] ?: '09:00';
            $state['calendarEvents'][] = [
                'id' => 'EV-MAIL-' . $mailId . '-R',
                'titulo' => $data['cargo_summary'] ?: 'Recepción de mercancía',
                'tipoServicio' => 'Recepción',
                'fecha' => $data['reception']['date'],
                'inicio' => $start,
                'fin' => plus_one_hour($start),
                'asignado' => 'Sin asignar',
                'expediente' => $caseRef,
                'transporte' => '',
                'color' => 'gray',
                'sourceEmailId' => $mailId,
            ];
        }
        if (!empty($data['transport']['required'])) {
            $transportRef = next_transport_ref($state['transports']);
            $start = $data['transport']['time'] ?: '09:00';
            $pickup = trim((string) $data['transport']['pickup']) ?: 'Origen por confirmar';
            $delivery = trim((string) ($data['transport']['delivery'] ?: $data['port'])) ?: 'Destino por confirmar';
            $route = $pickup . ' → ' . $delivery;
            $state['transports'][] = [
                'id' => $transportRef, 'expediente' => $caseRef, 'ruta' => $route,
                'hora' => $data['transport']['date'] . ' · ' . $start . '–' . plus_one_hour($start),
                'fecha' => $data['transport']['date'], 'inicio' => $start, 'fin' => plus_one_hour($start),
                'conductor' => 'Sin asignar', 'vehiculo' => 'Por asignar', 'estado' => 'Sin asignar',
                'sourceEmailId' => $mailId,
            ];
            $state['calendarEvents'][] = [
                'id' => 'EV-MAIL-' . $mailId . '-T', 'titulo' => $route, 'tipoServicio' => 'Transporte',
                'fecha' => $data['transport']['date'], 'inicio' => $start, 'fin' => plus_one_hour($start),
                'asignado' => 'Sin asignar', 'expediente' => $caseRef, 'transporte' => $transportRef,
                'color' => 'gray', 'sourceEmailId' => $mailId,
            ];
        }
        $encoded = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $save = $pdo->prepare(
            'INSERT INTO app_operational_state (id, data, updated_by) VALUES (1, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)'
        );
        $save->execute([$encoded, $userId]);
        $mark = $pdo->prepare(
            "UPDATE app_mail_items SET status = 'processed', extracted = ?, confidence = ?,
             review_reason = NULL, error_message = NULL, case_ref = ?, processed_at = NOW(),
             reviewed_by = ?, reviewed_at = IF(? IS NULL, reviewed_at, NOW()) WHERE id = ?"
        );
        $mark->execute([
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            (float) ($data['confidence'] ?? 1), $caseRef, $userId, $userId, $mailId,
        ]);
        $pdo->commit();
        return $caseRef;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function process_mailboxes(string $triggerType): array
{
    if (!function_exists('imap_open')) {
        throw new RuntimeException('La extensión PHP IMAP no está disponible.');
    }
    $pdo = db();
    if ((int) $pdo->query("SELECT GET_LOCK('swiftport_mail_processor', 2)")->fetchColumn() !== 1) {
        throw new RuntimeException('Ya hay otro procesamiento de correo en curso.');
    }
    try {
        $run = $pdo->prepare("INSERT INTO app_mail_runs (trigger_type, status) VALUES (?, 'running')");
        $run->execute([$triggerType]);
        $runId = (int) $pdo->lastInsertId();
        $summary = ['scanned' => 0, 'processed' => 0, 'review' => 0, 'ignored' => 0, 'errors' => 0];
        $accounts = [
            [config('info_email_user'), config('info_email_password')],
            [config('operations_email_user'), config('operations_email_password')],
        ];
        foreach ($accounts as [$username, $password]) {
            if ($username === '' || $password === '') {
                $summary['errors']++;
                continue;
            }
            $imap = @imap_open('{imap.hostinger.com:993/imap/ssl}INBOX', $username, $password, OP_READONLY, 1);
            if ($imap === false) {
                $summary['errors']++;
                imap_errors();
                continue;
            }
            $uids = imap_search($imap, 'SINCE "' . date('d-M-Y', strtotime('-14 days')) . '"', SE_UID) ?: [];
            rsort($uids, SORT_NUMERIC);
            foreach (array_slice($uids, 0, 30) as $uid) {
                $exists = $pdo->prepare('SELECT id FROM app_mail_items WHERE mailbox = ? AND imap_uid = ?');
                $exists->execute([$username, $uid]);
                if ($exists->fetchColumn()) continue;
                $overview = imap_fetch_overview($imap, (string) $uid, FT_UID)[0] ?? null;
                $structure = imap_fetchstructure($imap, $uid, FT_UID);
                if (!$overview || !$structure) continue;
                [$senderName, $senderEmail] = mail_sender((string) ($overview->from ?? ''));
                $subject = mail_decode_header_value((string) ($overview->subject ?? 'Sin asunto'));
                $body = mail_extract_text($imap, (int) $uid, $structure);
                $received = !empty($overview->date) && strtotime((string) $overview->date)
                    ? date('Y-m-d H:i:s', strtotime((string) $overview->date)) : null;
                $data = extract_local_service([
                    'subject' => $subject, 'body' => $body,
                    'sender_name' => $senderName, 'sender_email' => $senderEmail,
                ]);
                $reasons = service_review_reasons($data);
                $status = empty($data['is_service']) ? 'ignored' : ($reasons ? 'review' : 'review');
                $reason = empty($data['is_service'])
                    ? 'No se ha detectado una solicitud operativa'
                    : ($reasons ? implode('. ', $reasons) : 'Datos completos; pendiente de aprobación automática');
                $insert = $pdo->prepare(
                    'INSERT IGNORE INTO app_mail_items
                     (mailbox, imap_uid, message_id, received_at, sender_name, sender_email, subject, body,
                      status, confidence, extracted, review_reason, processed_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([
                    $username, $uid, mb_substr((string) ($overview->message_id ?? ''), 0, 255), $received,
                    mb_substr($senderName, 0, 190), mb_substr($senderEmail, 0, 190),
                    mb_substr($subject, 0, 500), mb_substr($body, 0, 100000), $status,
                    (float) $data['confidence'], json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    mb_substr($reason, 0, 800), $status === 'ignored' ? date('Y-m-d H:i:s') : null,
                ]);
                if ($insert->rowCount() < 1) continue;
                $mailId = (int) $pdo->lastInsertId();
                $summary['scanned']++;
                if ($status === 'ignored') {
                    $summary['ignored']++;
                } elseif (!$reasons && (float) $data['confidence'] >= 0.85) {
                    try {
                        apply_service_email($mailId, $data);
                        $summary['processed']++;
                    } catch (Throwable $error) {
                        $errorStatement = $pdo->prepare("UPDATE app_mail_items SET status = 'error', error_message = ? WHERE id = ?");
                        $errorStatement->execute([mb_substr($error->getMessage(), 0, 1000), $mailId]);
                        $summary['errors']++;
                    }
                } else {
                    $summary['review']++;
                }
            }
            imap_close($imap);
        }
        $finish = $pdo->prepare(
            "UPDATE app_mail_runs SET status = ?, scanned = ?, processed = ?, review_count = ?,
             ignored = ?, errors = ?, finished_at = NOW() WHERE id = ?"
        );
        $finish->execute([
            $summary['errors'] ? 'completed_with_errors' : 'completed',
            $summary['scanned'], $summary['processed'], $summary['review'],
            $summary['ignored'], $summary['errors'], $runId,
        ]);
        return $summary;
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('swiftport_mail_processor')");
    }
}
