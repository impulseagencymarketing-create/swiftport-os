const apiKey = process.env.AISSTREAM_API_KEY || '';
const cronToken = process.env.CRON_TOKEN || '';
const appUrl = (process.env.APP_URL || 'https://app.swiftportlogistic.com').replace(/\/$/, '');

if (!apiKey || !cronToken) {
  console.log('Seguimiento AIS pendiente de configurar; no se realiza ninguna consulta.');
  process.exit(0);
}

const headers = {'X-Cron-Token': cronToken, 'Content-Type': 'application/json'};
const targetResponse = await fetch(`${appUrl}/api/ais/targets.php`, {headers});
if (!targetResponse.ok) throw new Error(`No se pudieron consultar los buques (${targetResponse.status}).`);
const {targets = []} = await targetResponse.json();
if (!targets.length) {
  console.log('No hay expedientes abiertos con MMSI.');
  process.exit(0);
}

const targetByMmsi = new Map();
for (const target of targets) {
  const key = String(target.mmsi);
  if (!targetByMmsi.has(key)) targetByMmsi.set(key, []);
  targetByMmsi.get(key).push(target);
}

const latest = new Map();
const socket = new WebSocket('wss://stream.aisstream.io/v0/stream');
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    socket.close();
    resolve();
  }, 70000);

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      Apikey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: [...targetByMmsi.keys()],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
    }));
  });

  socket.addEventListener('message', event => {
    let packet;
    try { packet = JSON.parse(event.data); } catch { return; }
    const metadata = packet.Metadata || {};
    const mmsi = String(metadata.MMSI || '');
    if (!targetByMmsi.has(mmsi)) return;
    const messageType = packet.MessageType || '';
    const report = packet.Message?.[messageType] || {};
    const latitude = Number(metadata.latitude ?? metadata.Latitude);
    const longitude = Number(metadata.longitude ?? metadata.Longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    latest.set(mmsi, {
      mmsi,
      latitude,
      longitude,
      speed: Number(report.Sog ?? report.SpeedOverGround ?? 0),
      course: Number(report.Cog ?? report.CourseOverGround ?? 0),
      heading: Number(report.TrueHeading ?? 0),
      navigationStatus: Number(report.NavigationalStatus ?? -1),
      timestamp: String(metadata.time_utc || metadata.TimeUTC || metadata.Timestamp || new Date().toISOString()),
    });
    if (latest.size >= targetByMmsi.size) {
      clearTimeout(timer);
      socket.close();
      resolve();
    }
  });

  socket.addEventListener('error', () => {
    clearTimeout(timer);
    reject(new Error('AISStream no respondió correctamente.'));
  });
  socket.addEventListener('close', () => {
    clearTimeout(timer);
    resolve();
  });
});

const positions = [];
for (const [mmsi, position] of latest) {
  for (const target of targetByMmsi.get(mmsi) || []) {
    positions.push({...position, caseRef: target.caseRef});
  }
}
if (!positions.length) {
  console.log(`Sin señal AIS nueva para ${targets.length} expediente(s).`);
  process.exit(0);
}

const updateResponse = await fetch(`${appUrl}/api/ais/update.php`, {
  method: 'POST',
  headers,
  body: JSON.stringify({positions}),
});
if (!updateResponse.ok) throw new Error(`No se pudieron guardar las posiciones (${updateResponse.status}).`);
const result = await updateResponse.json();
console.log(`${result.saved || 0} posición(es) AIS actualizadas.`);
