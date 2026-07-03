<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
$user = require_roles(['admin']);

function planning_text(string $value): string
{
    return trim(str_replace(
        ['\\n', '\\N', '\\,', '\\;', '\\\\'],
        ["\n", "\n", ',', ';', '\\'],
        $value
    ));
}

function planning_property(string $body, string $name): string
{
    if (!preg_match('/^' . preg_quote($name, '/') . '(?:;[^:]*)?:(.*)$/mi', $body, $match)) return '';
    return planning_text((string) $match[1]);
}

function planning_moment(string $raw): array
{
    $value = trim($raw);
    $zone = new DateTimeZone('Europe/Madrid');
    if (preg_match('/^\d{8}$/', $value)) {
        $date = DateTimeImmutable::createFromFormat('!Ymd', $value, $zone);
        return $date ? [$date->format('Y-m-d'), '', true] : ['', '', true];
    }
    if (preg_match('/^\d{8}T\d{6}Z$/', $value)) {
        $date = DateTimeImmutable::createFromFormat('!Ymd\THis\Z', $value, new DateTimeZone('UTC'));
        $date = $date ? $date->setTimezone($zone) : null;
        return $date ? [$date->format('Y-m-d'), $date->format('H:i'), false] : ['', '', false];
    }
    if (preg_match('/^\d{8}T\d{6}$/', $value)) {
        $date = DateTimeImmutable::createFromFormat('!Ymd\THis', $value, $zone);
        return $date ? [$date->format('Y-m-d'), $date->format('H:i'), false] : ['', '', false];
    }
    return ['', '', false];
}

function planning_type(string $title): string
{
    $value = mb_strtoupper($title);
    if (preg_match('/\b(?:REUNION|REUNIÓN|CITA|CORPUS|SAN JUAN|CUMPLE|BIRTHDAY)\b/u', $value)) return 'excluded';
    if (preg_match('/\b(?:RECEPTION|RECEPCION|RECEPCIÓN|RECIBIR)\b/u', $value)) return 'reception';
    if (preg_match('/\bMUESTRAS?\b/u', $value)) return 'samples';
    if (preg_match('/\b(?:RECOGER|RECOGIDA|BUSCAR|PICKUP|PICK UP)\b/u', $value)) return 'pickup';
    if (preg_match('/\b(?:AIRPORT|AEROPUERTO|HOTEL|PAX|TRIPULACION|TRIPULACIÓN)\b/u', $value)) return 'crew_transport';
    if (preg_match('/\b(?:DELIVERY|DELIVER|ENTREGAR|LLEVAR|LANDING)\b/u', $value)) return 'delivery';
    return 'operation';
}

function planning_parse_ics(string $content, string $fileName): array
{
    $content = preg_replace("/\r?\n[ \t]/", '', $content) ?? $content;
    $calendarName = planning_property($content, 'X-WR-CALNAME');
    preg_match_all('/BEGIN:VEVENT\r?\n(.*?)END:VEVENT/s', $content, $matches);
    $events = [];
    foreach ($matches[1] ?? [] as $body) {
        $startRaw = planning_property((string) $body, 'DTSTART');
        [$date, $start, $allDay] = planning_moment($startRaw);
        if ($date < '2026-06-01' || $date >= '2026-07-06') continue;
        $endRaw = planning_property((string) $body, 'DTEND');
        [, $end] = planning_moment($endRaw);
        $title = planning_property((string) $body, 'SUMMARY');
        if ($title === '') continue;
        $type = planning_type($title);
        $events[] = [
            'id' => hash('sha256', $fileName . '|' . planning_property((string) $body, 'UID') . '|' . $date . '|' . $title),
            'date' => $date,
            'start' => $start,
            'end' => $end,
            'allDay' => $allDay,
            'title' => $title,
            'description' => mb_substr(planning_property((string) $body, 'DESCRIPTION'), 0, 4000),
            'calendar' => $calendarName !== '' ? $calendarName : $fileName,
            'type' => $type,
            'operational' => $type !== 'excluded',
            'source' => 'google_calendar',
        ];
    }
    return $events;
}

function planning_read_upload(array $file): array
{
    $tmp = (string) ($file['tmp_name'] ?? '');
    $name = (string) ($file['name'] ?? 'calendar.ics');
    if ($tmp === '' || !is_uploaded_file($tmp)) throw new InvalidArgumentException('No se recibió el archivo de calendario.');
    if ((int) ($file['size'] ?? 0) > 15 * 1024 * 1024) throw new InvalidArgumentException('El calendario supera 15 MB.');
    $events = [];
    if (str_ends_with(mb_strtolower($name), '.zip')) {
        if (!class_exists('ZipArchive')) throw new RuntimeException('La extensión ZIP no está disponible en el servidor.');
        $zip = new ZipArchive();
        if ($zip->open($tmp) !== true) throw new InvalidArgumentException('No se pudo abrir el ZIP del calendario.');
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $entryName = (string) $zip->getNameIndex($index);
            if (!str_ends_with(mb_strtolower($entryName), '.ics')) continue;
            $content = $zip->getFromIndex($index);
            if (is_string($content)) $events = array_merge($events, planning_parse_ics($content, $entryName));
        }
        $zip->close();
    } elseif (str_ends_with(mb_strtolower($name), '.ics')) {
        $content = file_get_contents($tmp);
        if (!is_string($content)) throw new InvalidArgumentException('No se pudo leer el calendario.');
        $events = planning_parse_ics($content, $name);
    } else {
        throw new InvalidArgumentException('Sube un archivo .ics o el .zip exportado por Google Calendar.');
    }
    usort($events, static fn(array $left, array $right): int =>
        strcmp($left['date'] . $left['start'] . $left['title'], $right['date'] . $right['start'] . $right['title'])
    );
    return $events;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $row = db()->query('SELECT data, updated_at FROM app_planning_state WHERE id = 1')->fetch();
    $data = $row ? json_decode((string) $row['data'], true, 512, JSON_THROW_ON_ERROR) : [
        'referenceEvents' => [],
        'draftTasks' => [],
        'status' => 'empty',
    ];
    respond(['data' => $data, 'updatedAt' => $row['updated_at'] ?? null]);
}

require_method('POST');
verify_csrf();
$action = (string) ($_POST['action'] ?? '');
if ($action !== 'import_reference') respond(['error' => 'Acción de planificación no válida.'], 422);

try {
    $events = planning_read_upload($_FILES['calendar'] ?? []);
    $operational = array_values(array_filter($events, static fn(array $event): bool => !empty($event['operational'])));
    $excluded = array_values(array_filter($events, static fn(array $event): bool => empty($event['operational'])));
    $data = [
        'status' => 'reference_loaded',
        'period' => ['start' => '2026-06-01', 'end' => '2026-07-05'],
        'referenceEvents' => $operational,
        'excludedEvents' => $excluded,
        'draftTasks' => [],
        'importedAt' => date(DATE_ATOM),
        'sourceFile' => mb_substr((string) ($_FILES['calendar']['name'] ?? ''), 0, 255),
    ];
    $save = db()->prepare(
        'INSERT INTO app_planning_state (id, data, updated_by) VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)'
    );
    $save->execute([
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        $user['id'],
    ]);
    audit((int) $user['id'], 'planning.reference_imported', [
        'operationalEvents' => count($operational),
        'excludedEvents' => count($excluded),
    ]);
    respond([
        'ok' => true,
        'data' => $data,
        'summary' => ['operational' => count($operational), 'excluded' => count($excluded)],
    ]);
} catch (Throwable $error) {
    respond(['error' => $error->getMessage()], 422);
}
