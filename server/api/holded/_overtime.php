<?php
declare(strict_types=1);
function overtime_submission_error(array $invoice): ?string {
    if (($invoice['manualEdited'] ?? false) === true && ($invoice['manualPricingConfirmed'] ?? false) === true) {
        return null; // Finance explicitly reviewed the final rows, including any overtime.
    }
    if (($invoice['manualEdited'] ?? false) === true) return 'Confirma los importes manuales, incluido el overtime, antes de enviar.';
    if (($invoice['overtimePolicyVersion'] ?? '') !== 'night-30-margin-60-v1') {
        return 'Actualiza la aplicación y revisa el overtime del borrador antes de enviar a Holded.';
    }
    if (!is_array($invoice['overtimeReview'] ?? null)) return 'Falta revisar los horarios de overtime.';
    foreach ($invoice['overtimeReview'] as $review) {
        if (!is_array($review) || ($review['unknown'] ?? true) !== false) return 'Revisa los horarios pendientes de overtime antes de enviar a Holded.';
    }
    return null;
}
