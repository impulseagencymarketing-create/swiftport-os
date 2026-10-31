# Esperas por transporte

Calendario → editar servicio, Transportes → editar recorrido y cada parada de un viaje compartido permiten registrar `waiting: {hours, rate, reason}`. Horas decimales (1,5 = 90 minutos), sin redondeo a horas completas. Precio vacío es desconocido; cero es una decisión explícita de no cobrar. No se altera la duración del calendario automáticamente.

La espera pertenece al servicio de un expediente, no al viaje físico. En viajes compartidos el operador reparte las horas facturables entre las paradas sin duplicarlas. Cambiar conductor/horario no copia las esperas entre buques.

Los borradores nuevos proponen una línea WAITING TIME por servicio, con fecha, horario, ruta y motivo. Se usa el precio registrado o la tarifa de espera LIMANI existente; otros clientes requieren precio manual. Se conserva la política de overtime existente y WRIST lleva 21 % de IVA. No se duplican automáticamente esperas antiguas registradas a nivel de expediente.

En borradores ya guardados se muestra «Revisar horas de espera». Facturación puede incorporar/actualizar únicamente esa línea o marcar que no se factura / ya está incluida. Ningún otro concepto, kg, cantidad o precio manual se modifica. Se guarda una versión del origen revisado; cambios posteriores en horas, motivo, precio o ruta vuelven a avisar. Eliminar la línea manualmente registra esa decisión. Las facturas enviadas/cerradas no se modifican.

Antes de enviar a Holded se exige revisar las esperas pendientes y los precios desconocidos. La API también rechaza líneas con precio de espera pendiente. Los metadatos y decisiones se conservan en facturas conjuntas WRIST.

Guardado confirmado antes de cerrar formularios de espera; un error conserva los campos para reintentar. La API valida rangos y decimales y conserva esperas si un cliente antiguo omite el campo. Para retirarlas se guarda `hours: 0`.

Pruebas: `node --test tests/transportWaiting.test.mjs`, `php tests/transport-waiting.test.php` y `node tests/transportWaiting-ui.mjs` (Vite local 5187 y PLAYWRIGHT_PACKAGE configurado; APIs simuladas, sin cambios en producción).
