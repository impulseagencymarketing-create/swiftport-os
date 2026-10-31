<?php
declare(strict_types=1);
require __DIR__.'/_bootstrap.php';
require __DIR__.'/_transport_carriers.php';
ensure_schema();
$user=require_roles(['operations','admin']);
require_method('POST');
verify_csrf();
$input=input();
if (!is_array($input['provider']??null)) respond(['error'=>'Transportista no válido.'],422);
$pdo=db();
try {
    $pdo->beginTransaction();
    $row=$pdo->query('SELECT data FROM app_operational_state WHERE id = 1 FOR UPDATE')->fetch();
    $data=$row?json_decode($row['data'],true,512,JSON_THROW_ON_ERROR):null;
    if (!is_array($data)) { $pdo->rollBack(); respond(['error'=>'Carga primero los datos operativos y vuelve a intentarlo.'],409); }
    $result=transport_carrier_save($data['providers']??[],$input['provider']);
    $data['providers']=$result['providers'];
    $data['providerDirectoryManaged']=true;
    $encoded=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    if (strlen($encoded)>6*1024*1024) { $pdo->rollBack(); respond(['error'=>'El directorio no se pudo guardar: límite de datos operativos alcanzado.'],413); }
    $statement=$pdo->prepare('UPDATE app_operational_state SET data=?, updated_by=? WHERE id=1');
    $statement->execute([$encoded,$user['id']]);
    audit((int)$user['id'],'transport_carrier.save',['providerId'=>$result['provider']['id'],'type'=>$result['provider']['tipo'],'active'=>$result['provider']['activo']]);
    $pdo->commit();
    respond(['ok'=>true]+$result);
} catch (InvalidArgumentException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(['error'=>$error->getMessage()],422);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(['error'=>'No se pudo guardar el transportista. Reintenta; el formulario conserva los datos.'],500);
}
