export const expedientesIniciales = [
  {id:'SW-2026-0048', buque:'MONTE EXPRESS', cliente:'UME Shipping', puerto:'Algeciras', eta:'02 Jul · 08:00', estado:'En curso', prioridad:'Alta', conductor:'Moisés R.', servicios:['Transporte','Entrega a bordo','POD'], bultos:2, peso:'680 kg', importe:1280, progreso:72, siguiente:'Confirmar acceso al muelle', aduana:'Liberado'},
  {id:'SW-2026-0047', buque:'POLARIS MILA', cliente:'Limani', puerto:'Tarragona', eta:'01 Jul · 18:00', estado:'Bloqueado', prioridad:'Urgente', conductor:'Sin asignar', servicios:['Recepción','Storage','Aduanas'], bultos:4, peso:'1.240 kg', importe:860, progreso:38, siguiente:'Recibir autorización de Aduanas', aduana:'Pendiente'},
  {id:'SW-2026-0046', buque:'VIKING SEA', cliente:'A-Ships', puerto:'Barcelona', eta:'30 Jun · 11:00', estado:'Planificado', prioridad:'Media', conductor:'Javier S.', servicios:['Recogida aeropuerto','Transporte'], bultos:1, peso:'95 kg', importe:640, progreso:54, siguiente:'Recogida en BCN T1', aduana:'No aplica'},
  {id:'SW-2026-0045', buque:'ATLANTIC STAR', cliente:'BlueWave Marine', puerto:'Valencia', eta:'03 Jul · 06:30', estado:'Nuevo', prioridad:'Media', conductor:'Clara V.', servicios:['Recepción','Transporte','POD'], bultos:7, peso:'2.100 kg', importe:1740, progreso:18, siguiente:'Validar packing list', aduana:'Documentación'},
  {id:'SW-2026-0044', buque:'OCEAN BREEZE', cliente:'UME Shipping', puerto:'Bilbao', eta:'29 Jun · 21:00', estado:'Completado', prioridad:'Baja', conductor:'Andrés M.', servicios:['Entrega a bordo','POD'], bultos:3, peso:'420 kg', importe:920, progreso:100, siguiente:'Listo para facturar', aduana:'Liberado'}
];
export const movimientosAlmacen = [
  {ref:'ALM-318', expediente:'SW-2026-0047', buque:'POLARIS MILA', zona:'B-04', entrada:'29 Jun · 14:35', bultos:4, peso:'1.240 kg', dias:1, estado:'Retenido'},
  {ref:'ALM-317', expediente:'SW-2026-0048', buque:'MONTE EXPRESS', zona:'A-12', entrada:'29 Jun · 09:20', bultos:2, peso:'680 kg', dias:1, estado:'Preparado'},
  {ref:'ALM-315', expediente:'SW-2026-0045', buque:'ATLANTIC STAR', zona:'C-02', entrada:'27 Jun · 16:10', bultos:7, peso:'2.100 kg', dias:3, estado:'En stock'},
  {ref:'ALM-309', expediente:'SW-2026-0044', buque:'OCEAN BREEZE', zona:'SAL-01', entrada:'26 Jun · 08:15', bultos:3, peso:'420 kg', dias:0, estado:'Expedido'}
];
export const transportesIniciales = [
  {id:'TR-1042', expediente:'SW-2026-0046', ruta:'Aeropuerto BCN → Puerto Barcelona', hora:'Hoy · 09:15', conductor:'Javier S.', vehiculo:'7462 MRL', estado:'En ruta'},
  {id:'TR-1043', expediente:'SW-2026-0048', ruta:'Almacén Swiftport → Muelle Isla Verde', hora:'Mañana · 06:45', conductor:'Moisés R.', vehiculo:'2198 KPV', estado:'Asignado'},
  {id:'TR-1044', expediente:'SW-2026-0047', ruta:'Almacén Swiftport → Puerto Tarragona', hora:'Mañana · 15:30', conductor:'Sin asignar', vehiculo:'—', estado:'Sin asignar'},
  {id:'TR-1039', expediente:'SW-2026-0044', ruta:'Puerto Bilbao → Almacén cliente', hora:'Ayer · 20:10', conductor:'Andrés M.', vehiculo:'5031 LBD', estado:'Entregado'}
];
export const tramitesAduana = [
  {id:'AD-882', expediente:'SW-2026-0047', tipo:'T1', referencia:'T1ES0060218842', limite:'Hoy · 17:00', estado:'Pendiente', nota:'Falta autorización del consignatario'},
  {id:'AD-881', expediente:'SW-2026-0045', tipo:'DUA importación', referencia:'En preparación', limite:'02 Jul · 12:00', estado:'Documentación', nota:'Packing list recibido'},
  {id:'AD-879', expediente:'SW-2026-0048', tipo:'Levante', referencia:'CSV-81K2-P90', limite:'Completado', estado:'Liberado', nota:'Mercancía disponible'},
  {id:'AD-876', expediente:'SW-2026-0044', tipo:'T2L', referencia:'T2L-ES-9918', limite:'Completado', estado:'Liberado', nota:'Archivado en expediente'}
];
export const clientesIniciales = [
  {nombre:'UME Shipping', codigo:'CLI-0012', contacto:'ops@umeshipping.com', expedientes:12, recepcion:'65 €', storage:'7 días + 25 €/día', transporte:'Por ruta', recargo:'+30%', activo:true},
  {nombre:'Limani', codigo:'CLI-0028', contacto:'spares@limani.gr', expedientes:7, recepcion:'60 €', storage:'7 días + 22 €/día', transporte:'Por viaje', recargo:'+30%', activo:true},
  {nombre:'A-Ships', codigo:'CLI-0034', contacto:'agency@aships.com', expedientes:5, recepcion:'55 €', storage:'Según acuerdo', transporte:'Por puerto', recargo:'+25%', activo:true},
  {nombre:'BlueWave Marine', codigo:'CLI-0041', contacto:'supply@bluewave.no', expedientes:3, recepcion:'72 €', storage:'5 días + 28 €/día', transporte:'Por ruta', recargo:'+35%', activo:true}
];
export const facturasIniciales = [
  {id:'FAC-2026-0188', expediente:'SW-2026-0044', cliente:'UME Shipping', concepto:'Entrega a bordo + POD', importe:920, estado:'Lista', vencimiento:'29 Jul 2026'},
  {id:'BOR-2026-0094', expediente:'SW-2026-0048', cliente:'UME Shipping', concepto:'Transporte + manipulación', importe:1280, estado:'Borrador', vencimiento:'—'},
  {id:'BOR-2026-0093', expediente:'SW-2026-0047', cliente:'Limani', concepto:'Recepción + storage + T1', importe:860, estado:'Revisar', vencimiento:'—'},
  {id:'FAC-2026-0185', expediente:'SW-2026-0042', cliente:'A-Ships', concepto:'Servicio urgente fuera de horario', importe:1485, estado:'Enviada', vencimiento:'24 Jul 2026'}
];
export const timeline = [
  {hora:'09:12', titulo:'Solicitud recibida', detalle:'Email registrado en el expediente', estado:'done'},
  {hora:'09:30', titulo:'Expediente creado', detalle:'Servicios y tarifa aplicados', estado:'done'},
  {hora:'10:05', titulo:'Consignatario contactado', detalle:'Acceso al muelle solicitado', estado:'done'},
  {hora:'14:35', titulo:'Mercancía recibida', detalle:'2 bultos ubicados en A-12', estado:'done'},
  {hora:'06:45', titulo:'Transporte al puerto', detalle:'Planificado para mañana', estado:'next'},
  {hora:'—', titulo:'Entrega a bordo y POD', detalle:'Pendiente de ejecución', estado:'pending'}
];
