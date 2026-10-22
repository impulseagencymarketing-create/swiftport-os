<?php
require __DIR__.'/../server/api/_wrist_vat.php';
$invoice=['cliente'=>'Wrist Ship Supply','estado'=>'Borrador','manualEdited'=>true,'lines'=>[['item'=>'SPECIAL TRANSPORT','price'=>187.35,'units'=>2,'tax'=>'0%']],'observaciones'=>'Exención de IVA según ART 22 de la ley 37/1992 y 10.2 del real decreto ley 1624/92 de Diciembre'];
$out=apply_wrist_vat($invoice);
if($out['lines'][0]['tax']!=='21%'||$out['lines'][0]['price']!==187.35||$out['lines'][0]['units']!==2||$out['observaciones']!=='')throw new RuntimeException('VAT normalization failed');
foreach([['cliente'=>'Limani'],['estado'=>'Facturado'],['holdedId'=>'sent'],['groupedInto'=>'GRP-test']] as $patch){$old=array_merge($invoice,$patch);if(apply_wrist_vat($old)!==$old)throw new RuntimeException('Protected invoice changed');}
echo "OK: WRIST server VAT, preserved prices and closed documents\n";
