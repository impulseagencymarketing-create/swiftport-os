<?php
declare(strict_types=1);
function overtime_submission_error(array $invoice): ?string {
    if (($invoice['overtimePolicyVersion'] ?? '') !== 'night-30-margin-60-v1') {
        return 'Actualiza la aplicación y revisa el overtime del borrador antes de enviar a Holded.';
    }
    if (!is_array($invoice['overtimeReview'] ?? null)) return 'Falta revisar los horarios de overtime.';
    foreach ($invoice['overtimeReview'] as $review) {
        if (!is_array($review) || ($review['unknown'] ?? true) !== false) return 'Revisa los horarios pendientes de overtime antes de enviar a Holded.';
    }
    return null;
}
