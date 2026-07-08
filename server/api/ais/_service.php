<?php
declare(strict_types=1);

function ais_port_coordinates(string $port): ?array
{
    $normalized = mb_strtoupper(trim($port));
    $ports = [
        'BARCELONA' => [41.3434, 2.1662],
        'TARRAGONA' => [41.0910, 1.2164],
        'VALENCIA' => [39.4482, -0.3161],
        'SAGUNTO' => [39.6425, -0.2145],
        'CASTELLON' => [39.9667, 0.0167],
        'CASTELLÓN' => [39.9667, 0.0167],
        'ALGECIRAS' => [36.1307, -5.4380],
        'BILBAO' => [43.3550, -3.0750],
    ];
    foreach ($ports as $name => $coordinates) {
        if (str_contains($normalized, $name)) return $coordinates;
    }
    return null;
}

function ais_distance_nm(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $earthRadiusNm = 3440.065;
    $latDelta = deg2rad($lat2 - $lat1);
    $lonDelta = deg2rad($lon2 - $lon1);
    $a = sin($latDelta / 2) ** 2
        + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lonDelta / 2) ** 2;
    return $earthRadiusNm * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function ais_course_difference(float $left, float $right): float
{
    $difference = abs(fmod($left - $right + 540, 360) - 180);
    return min(180, $difference);
}

function ais_bearing(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $lat1Rad = deg2rad($lat1);
    $lat2Rad = deg2rad($lat2);
    $deltaLon = deg2rad($lon2 - $lon1);
    $y = sin($deltaLon) * cos($lat2Rad);
    $x = cos($lat1Rad) * sin($lat2Rad) - sin($lat1Rad) * cos($lat2Rad) * cos($deltaLon);
    return fmod(rad2deg(atan2($y, $x)) + 360, 360);
}

function ais_operational_status(?float $distance, float $speed, int $navigationStatus, bool $approaching): string
{
    if ($distance !== null && $distance <= 3 && $navigationStatus === 5) return 'Atracado';
    if ($distance !== null && $distance <= 20 && $navigationStatus === 1) return 'En fondeo';
    if ($distance !== null && $distance <= 1.5 && $speed <= 0.5) return 'Atraque probable';
    if ($distance !== null && $distance <= 5) return 'En zona portuaria';
    if ($distance !== null && $distance <= 20) return 'Cerca del puerto';
    if ($distance !== null && $distance <= 50 && $speed >= 1 && $approaching) return 'Rumbo al puerto';
    return 'En navegación';
}

function ais_estimated_arrival(?float $distance, float $speed, string $timestamp): array
{
    if ($distance === null || $distance <= 0 || $speed < 2) {
        return ['at' => '', 'hours' => null, 'confidence' => 'sin calcular'];
    }
    $hours = $distance / $speed;
    if ($hours <= 0 || $hours > 24 * 14) {
        return ['at' => '', 'hours' => null, 'confidence' => 'sin calcular'];
    }
    try {
        $base = $timestamp !== '' ? new DateTimeImmutable($timestamp) : new DateTimeImmutable('now', new DateTimeZone('UTC'));
    } catch (Throwable) {
        $base = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }
    $minutes = max(1, (int) round($hours * 60));
    return [
        'at' => $base->modify('+' . $minutes . ' minutes')->format(DATE_ATOM),
        'hours' => round($hours, 1),
        'confidence' => $hours <= 36 ? 'media' : 'baja',
    ];
}

function ais_operational_cases(): array
{
    $stateRow = db()->query('SELECT data FROM app_operational_state WHERE id = 1')->fetch();
    $state = $stateRow ? json_decode((string) $stateRow['data'], true) : [];
    $cases = [];
    foreach (is_array($state['cases'] ?? null) ? $state['cases'] : [] as $case) {
        if (is_array($case) && !empty($case['id'])) $cases[(string) $case['id']] = $case;
    }
    return $cases;
}

function ais_save_positions(array $positions): int
{
    if (count($positions) > 100) respond(['error' => 'Demasiadas posiciones.'], 422);

    $cases = ais_operational_cases();
    $upsert = db()->prepare(
        'INSERT INTO app_ais_positions (case_ref, mmsi, data) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE mmsi = VALUES(mmsi), data = VALUES(data), updated_at = CURRENT_TIMESTAMP'
    );
    $previousQuery = db()->prepare('SELECT data FROM app_ais_positions WHERE case_ref = ?');
    $saved = 0;
    foreach ($positions as $position) {
        if (!is_array($position)) continue;
        $caseRef = trim((string) ($position['caseRef'] ?? ''));
        $mmsi = preg_replace('/\D/', '', (string) ($position['mmsi'] ?? ''));
        $latitude = filter_var($position['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($position['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
        if (!isset($cases[$caseRef]) || strlen($mmsi) !== 9 || $latitude === false || $longitude === false) continue;
        if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) continue;
        $speed = max(0, (float) ($position['speed'] ?? 0));
        $course = round((float) ($position['course'] ?? 0), 1);
        $navigationStatus = (int) ($position['navigationStatus'] ?? -1);
        $portCoordinates = ais_port_coordinates((string) ($cases[$caseRef]['puerto'] ?? ''));
        $distance = $portCoordinates
            ? ais_distance_nm((float) $latitude, (float) $longitude, $portCoordinates[0], $portCoordinates[1])
            : null;
        $previousQuery->execute([$caseRef]);
        $previousRow = $previousQuery->fetch();
        $previous = $previousRow ? json_decode((string) $previousRow['data'], true) : [];
        if (!is_array($previous)) $previous = [];
        $previousDistance = isset($previous['distanceToPortNm']) && is_numeric($previous['distanceToPortNm'])
            ? (float) $previous['distanceToPortNm']
            : null;
        $bearing = $portCoordinates
            ? ais_bearing((float) $latitude, (float) $longitude, $portCoordinates[0], $portCoordinates[1])
            : null;
        $approaching = $distance !== null && (
            ($previousDistance !== null && $distance < $previousDistance - 0.2)
            || ($bearing !== null && ais_course_difference($course, $bearing) <= 50)
        );
        $status = ais_operational_status($distance, $speed, $navigationStatus, $approaching);
        $alertStatuses = ['Rumbo al puerto', 'Cerca del puerto', 'En zona portuaria', 'En fondeo', 'Atracado'];
        $statusChanged = $status !== (string) ($previous['status'] ?? '')
            || (empty($previous['alertKey']) && in_array($status, $alertStatuses, true));
        $alertKey = (string) ($previous['alertKey'] ?? '');
        $alertMessage = (string) ($previous['alertMessage'] ?? '');
        $statusChangedAt = (string) ($previous['statusChangedAt'] ?? '');
        if ($statusChanged) {
            $statusChangedAt = gmdate(DATE_ATOM);
            if (in_array($status, $alertStatuses, true)) {
                $alertKey = $caseRef . '-' . mb_strtolower(str_replace(' ', '-', $status)) . '-' . time();
                $distanceLabel = $distance === null ? '' : ' a ' . round($distance, 1) . ' mn del puerto';
                $alertMessage = trim((string) ($cases[$caseRef]['buque'] ?? 'El buque')) . ': ' . mb_strtolower($status) . $distanceLabel . '.';
            }
        }
        $sourceTimestamp = trim((string) ($position['timestamp'] ?? ''));
        $estimatedArrival = ais_estimated_arrival($distance, $speed, $sourceTimestamp);
        $tracking = [
            'mmsi' => $mmsi,
            'latitude' => round((float) $latitude, 6),
            'longitude' => round((float) $longitude, 6),
            'speed' => round($speed, 1),
            'course' => $course,
            'heading' => (int) ($position['heading'] ?? 0),
            'navigationStatus' => $navigationStatus,
            'distanceToPortNm' => $distance === null ? null : round($distance, 1),
            'status' => $status,
            'approachingPort' => $approaching,
            'estimatedArrivalAt' => $estimatedArrival['at'],
            'estimatedArrivalHours' => $estimatedArrival['hours'],
            'estimatedArrivalConfidence' => $estimatedArrival['confidence'],
            'alertKey' => $alertKey,
            'alertMessage' => $alertMessage,
            'statusChangedAt' => $statusChangedAt,
            'sourceTimestamp' => $sourceTimestamp,
            'receivedAt' => gmdate(DATE_ATOM),
            'source' => 'AISStream · prueba gratuita',
        ];
        $upsert->execute([
            $caseRef,
            $mmsi,
            json_encode($tracking, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        ]);
        $complete = db()->prepare(
            "UPDATE app_ais_refresh_requests
             SET status = 'completed', processed_at = CURRENT_TIMESTAMP
             WHERE case_ref = ?"
        );
        $complete->execute([$caseRef]);
        $saved++;
    }
    return $saved;
}

function ais_ws_read_exact($socket, int $length): string
{
    $data = '';
    while (strlen($data) < $length && !feof($socket)) {
        $chunk = fread($socket, $length - strlen($data));
        if ($chunk === false || $chunk === '') break;
        $data .= $chunk;
    }
    return $data;
}

function ais_ws_frame(string $payload, int $opcode = 1): string
{
    $length = strlen($payload);
    $header = chr(0x80 | ($opcode & 0x0f));
    if ($length <= 125) {
        $header .= chr(0x80 | $length);
    } elseif ($length <= 65535) {
        $header .= chr(0x80 | 126) . pack('n', $length);
    } else {
        $header .= chr(0x80 | 127) . pack('J', $length);
    }
    $mask = random_bytes(4);
    $masked = '';
    for ($index = 0; $index < $length; $index++) {
        $masked .= $payload[$index] ^ $mask[$index % 4];
    }
    return $header . $mask . $masked;
}

function ais_ws_read_frame($socket): ?array
{
    $header = ais_ws_read_exact($socket, 2);
    if (strlen($header) !== 2) return null;
    $first = ord($header[0]);
    $second = ord($header[1]);
    $opcode = $first & 0x0f;
    $masked = ($second & 0x80) !== 0;
    $length = $second & 0x7f;
    if ($length === 126) {
        $extended = ais_ws_read_exact($socket, 2);
        if (strlen($extended) !== 2) return null;
        $length = (int) unpack('nlength', $extended)['length'];
    } elseif ($length === 127) {
        $extended = ais_ws_read_exact($socket, 8);
        if (strlen($extended) !== 8) return null;
        $length = (int) unpack('Jlength', $extended)['length'];
    }
    if ($length > 1048576) throw new RuntimeException('Respuesta AIS demasiado grande.');
    $mask = $masked ? ais_ws_read_exact($socket, 4) : '';
    $payload = ais_ws_read_exact($socket, $length);
    if (strlen($payload) !== $length) return null;
    if ($masked) {
        $decoded = '';
        for ($index = 0; $index < $length; $index++) {
            $decoded .= $payload[$index] ^ $mask[$index % 4];
        }
        $payload = $decoded;
    }
    return ['opcode' => $opcode, 'payload' => $payload];
}

function ais_fetch_position(string $apiKey, string $mmsi, int $waitSeconds = 35): ?array
{
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'peer_name' => 'stream.aisstream.io',
            'SNI_enabled' => true,
        ],
    ]);
    $socket = @stream_socket_client(
        'ssl://stream.aisstream.io:443',
        $errorNumber,
        $errorMessage,
        10,
        STREAM_CLIENT_CONNECT,
        $context
    );
    if (!is_resource($socket)) {
        throw new RuntimeException('No se pudo conectar con AISStream.');
    }

    stream_set_timeout($socket, 5);
    $websocketKey = base64_encode(random_bytes(16));
    $request = "GET /v0/stream HTTP/1.1\r\n"
        . "Host: stream.aisstream.io\r\n"
        . "Upgrade: websocket\r\n"
        . "Connection: Upgrade\r\n"
        . "Sec-WebSocket-Key: {$websocketKey}\r\n"
        . "Sec-WebSocket-Version: 13\r\n"
        . "Origin: https://app.swiftportlogistic.com\r\n\r\n";
    fwrite($socket, $request);

    $responseHeaders = '';
    while (!feof($socket) && !str_contains($responseHeaders, "\r\n\r\n")) {
        $chunk = fgets($socket, 2048);
        if ($chunk === false) break;
        $responseHeaders .= $chunk;
        if (strlen($responseHeaders) > 16384) break;
    }
    if (!preg_match('/^HTTP\/1\.[01] 101\b/', $responseHeaders)) {
        fclose($socket);
        throw new RuntimeException('AISStream rechazó la conexión.');
    }

    $subscription = json_encode([
        'Apikey' => $apiKey,
        'BoundingBoxes' => [[[-90, -180], [90, 180]]],
        'FiltersShipMMSI' => [$mmsi],
        'FilterMessageTypes' => ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
    ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    fwrite($socket, ais_ws_frame($subscription));

    $deadline = microtime(true) + max(5, min(55, $waitSeconds));
    while (microtime(true) < $deadline && !feof($socket)) {
        $remaining = max(1, (int) ceil($deadline - microtime(true)));
        $read = [$socket];
        $write = null;
        $except = null;
        $ready = @stream_select($read, $write, $except, min(5, $remaining));
        if ($ready === false) break;
        if ($ready === 0) continue;
        $frame = ais_ws_read_frame($socket);
        if ($frame === null) continue;
        if ($frame['opcode'] === 9) {
            fwrite($socket, ais_ws_frame($frame['payload'], 10));
            continue;
        }
        if ($frame['opcode'] === 8) break;
        if ($frame['opcode'] !== 1) continue;
        $packet = json_decode($frame['payload'], true);
        if (!is_array($packet)) continue;
        $metadata = is_array($packet['Metadata'] ?? null) ? $packet['Metadata'] : [];
        if (preg_replace('/\D/', '', (string) ($metadata['MMSI'] ?? '')) !== $mmsi) continue;
        $messageType = (string) ($packet['MessageType'] ?? '');
        $message = is_array($packet['Message'] ?? null) ? $packet['Message'] : [];
        $report = is_array($message[$messageType] ?? null) ? $message[$messageType] : [];
        $latitude = filter_var($metadata['latitude'] ?? $metadata['Latitude'] ?? null, FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($metadata['longitude'] ?? $metadata['Longitude'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($latitude === false || $longitude === false) continue;
        fclose($socket);
        return [
            'mmsi' => $mmsi,
            'latitude' => (float) $latitude,
            'longitude' => (float) $longitude,
            'speed' => (float) ($report['Sog'] ?? $report['SpeedOverGround'] ?? 0),
            'course' => (float) ($report['Cog'] ?? $report['CourseOverGround'] ?? 0),
            'heading' => (int) ($report['TrueHeading'] ?? 0),
            'navigationStatus' => (int) ($report['NavigationalStatus'] ?? -1),
            'timestamp' => (string) ($metadata['time_utc'] ?? $metadata['TimeUTC'] ?? $metadata['Timestamp'] ?? gmdate(DATE_ATOM)),
        ];
    }

    fclose($socket);
    return null;
}
