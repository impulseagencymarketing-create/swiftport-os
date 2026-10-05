<?php
declare(strict_types=1);
require __DIR__ . '/../server/api/holded/_overtime.php';
$valid=['overtimePolicyVersion'=>'night-30-margin-60-v1','overtimeReview'=>[['unknown'=>false]]];
if(overtime_submission_error($valid)!==null)throw new RuntimeException('Valid review rejected');
if(overtime_submission_error(['overtimePolicyVersion'=>'night-30-margin-60-v1','overtimeReview'=>[]])!==null)throw new RuntimeException('No service lines rejected');
foreach([[],['overtimePolicyVersion'=>'old'],['overtimePolicyVersion'=>'night-30-margin-60-v1'],array_replace($valid,['overtimeReview'=>[['unknown'=>true]]]),array_replace($valid,['overtimeReview'=>[['unknown'=>'false']]])] as $invalid) {
    if(overtime_submission_error($invalid)===null)throw new RuntimeException('Old/unreviewed invoice accepted');
}
echo "OK: overtime server submission guard\n";
if(overtime_submission_error(['manualEdited'=>true,'manualPricingConfirmed'=>true])!==null)throw new RuntimeException('Approved manual invoice rejected');
if(overtime_submission_error(['manualEdited'=>true,'manualPricingConfirmed'=>false])===null)throw new RuntimeException('Unreviewed manual invoice accepted');
echo "OK: explicit manual pricing review accepted, no silent overtime bypass\n";
