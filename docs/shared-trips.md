# Viajes compartidos

Calendario → **Transporte compartido / unir**. También se puede abrir un servicio
desde su expediente y pulsar **Compartir viaje con otro buque / unir transportes**.

- Cada parada selecciona un expediente y un servicio existente, o crea uno nuevo.
- El calendario, sus contadores y el HUB del conductor agrupan por `sharedTripId`.
- Los registros `transports` y `calendarEvents` siguen representando servicios por
  expediente: no son viajes físicos independientes cuando tienen el mismo ID de viaje.
- `sharedTripOrder` ordena las entregas. Cada servicio conserva su ID, estado,
  mercancía seleccionada, observaciones y referencias de facturación.
- Fecha, inicio, fin y conductor se editan para el viaje completo. Cancelar una
  entrega desde el expediente no cancela las demás. Un viaje solo está terminado
  cuando todas sus entregas están terminadas o canceladas.
- El precio de venta sigue en cada borrador, sin división automática. Facturas
  emitidas y borradores editados manualmente no se reescriben.
- Coste opcional: `sharedTripCost` es el total (no sumar sus copias en servicios).
  `sharedTripCostShare` es la parte del expediente. Solo las partes se proyectan en
  `gastos`, con IDs estables `TRIP-COST-{tripId}-{caseId}`. El reparto en céntimos
  preserva el total. Si existe un gasto escaneado/manual, no duplicarlo aquí.
- No hay disolución automática ni fusión por coincidencia de nombre/hora. El usuario
  selecciona explícitamente los servicios que corresponden al mismo viaje real.
- El servidor valida el vínculo, roles y horario común, y conserva los metadatos
  omitidos por clientes antiguos. El formulario espera confirmación del servidor.

Pruebas: `node --test tests/*.test.mjs`, `php tests/shared-trips.test.php` y
`tests/sharedTrips-ui.mjs` contra Vite en 127.0.0.1:5187 (APIs simuladas).
