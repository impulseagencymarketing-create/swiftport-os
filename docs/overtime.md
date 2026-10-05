# Overtime nocturno

Regla confirmada: 30 % sobre el precio completo del servicio si su intervalo, ampliado una hora después del fin, coincide con 20:00–08:00. Se usan horas locales registradas del servicio; no se convierte desde UTC ni se deducen horarios de la ETA. Un fin anterior al inicio se interpreta como el día siguiente. Un inicio/fin ausente, inválido o idéntico requiere revisión.

Ejemplos: 18:30–19:30 se evalúa hasta las 20:30 y tiene recargo; 08:00–09:00 no; 23:30–00:15 sí. Los intervalos son semiabiertos: finalizar exactamente a las 20:00 incluyendo el margen no supone tiempo dentro de la franja nocturna.

En líneas que agrupan transportes a igual precio unitario solo se recargan las unidades nocturnas. Si las unidades y los servicios no cuadran, se exige revisar el horario en lugar de repartir por suposición. El horario automático se obtiene de los transportes/calendario del mismo expediente; las demás líneas de servicio admiten inicio y fin propios en el editor. No se usa el horario de entrega para inventar el de una recepción anterior.

El recargo aparece separado como `OVERTIME 30 %`, hereda el IVA de la línea original y se recalcula al editar precio u horario. No se recargan la referencia, las mercancías de supply, almacenamiento, líneas de cancelación ni el recargo sobre sí mismo. Los documentos enviados, facturados, cobrados, archivados o con evidencia de Holded quedan fuera del recálculo. No se añaden reglas de festivos.

Los horarios pendientes o un overtime manual existente requieren revisión antes del envío. Los borradores sí se pueden guardar con pendientes. El servidor rechaza envíos desde versiones antiguas que no incluyen esta revisión, solicitando actualizar la app. No se modifica automáticamente ningún documento ya emitido en Holded.

Pruebas: `node --test tests/overtime.test.mjs`, `php tests/overtime-server.test.php` y `node tests/overtime-ui.mjs` con Vite local en el puerto 5184 y Playwright disponible mediante `PLAYWRIGHT_PACKAGE`. La prueba de UI utiliza datos ficticios, bloquea Holded y comprueba límites, recalculado, revisión pendiente, guardado y reapertura. La lectura/actualización de documentos reales no forma parte de estas pruebas.
