<?php
declare(strict_types=1);

function requested_captain_contacts(): array
{
    return [
        ['LIBERTY', '+639087497690', 'Primer oficial (Chief mate). Teléfono facilitado por el usuario para contacto operativo por WhatsApp. Nombre pendiente de confirmar.'],
        ['SIRIOS CEMENT V', '+306973777717', 'Contacto operativo por WhatsApp facilitado por el usuario. Nombre y cargo pendientes de confirmar.'],
        ['SIRIOS CEMENT V', '+34624825124', 'Segundo contacto operativo por WhatsApp facilitado por el usuario. Nombre y cargo pendientes de confirmar.'],
    ];
}

function import_requested_captain_contacts(PDO $pdo, int $userId): void
{
    // The existing unique vessel/phone key makes repeated agenda loads safe.
    $insert = $pdo->prepare("INSERT IGNORE INTO app_captain_contacts (vessel_name, captain_name, phone_e164, imo, mmsi, language, notes, created_by) VALUES (?, '', ?, '', '', '', ?, ?)");
    foreach (requested_captain_contacts() as [$vessel, $phone, $notes]) {
        $insert->execute([$vessel, $phone, $notes, $userId]);
    }
}
