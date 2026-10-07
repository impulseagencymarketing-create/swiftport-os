<?php
declare(strict_types=1);

function invoice_document_dates(string $due, ?DateTimeImmutable $now = null): array
{
    $timezone = new DateTimeZone('Europe/Madrid');
    $today = ($now ?? new DateTimeImmutable('now', $timezone))->setTimezone($timezone)->setTime(0, 0);
    $due = trim($due);
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $due, $timezone);
    if (!$parsed || $parsed->format('Y-m-d') !== $due || $parsed < $today) $parsed = $today;
    return ['issueDate'=>$today->format('Y-m-d'), 'dueDate'=>$parsed->format('Y-m-d'), 'issueTimestamp'=>$today->getTimestamp(), 'dueTimestamp'=>$parsed->getTimestamp()];
}

function refresh_draft_due_date(array $invoice, ?DateTimeImmutable $now = null): array
{
    if (in_array($invoice['estado'] ?? '', ['Enviado a Holded','Facturado','Cobrado','Archivado'], true)
        || !empty($invoice['holdedId']) || !empty($invoice['holdedNumber']) || !empty($invoice['holdedAt']) || !empty($invoice['holdedStatus'])) return $invoice;
    $invoice['vencimiento'] = invoice_document_dates((string)($invoice['vencimiento'] ?? ''), $now)['dueDate'];
    return $invoice;
}
