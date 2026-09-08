const apiKey = process.env.AISSTREAM_API_KEY || '';
const cronToken = process.env.CRON_TOKEN || '';
const appUrl = (process.env.APP_URL || 'https://app.swiftportlogistic.com').replace(/\/$/, '');
const targetsEndpoint = process.env.TARGETS_ENDPOINT || '/api/ais/targets.php';
const waitMs = Math.max(10000, Math.min(70000, Number(process.env.AIS_WAIT_MS) || 70000));
const discordWebhook = process.env.DISCORD_WEBHOOK_URL || '';
const discordTestSnapshot = process.env.DISCORD_TEST_SNAPSHOT === 'true';
const sendDiscordSnapshots = async (targets, positions) => {
  if (!discordTestSnapshot || !discordWebhook) return;
  for (const target of targets) {
    const livePosition = positions.get(String(target.mmsi));
    const storedPosition = target.lastTracking && Number.isFinite(Number(target.lastTracking.latitude))
      && Number.isFinite(Number(target.lastTracking.longitude)) ? target.lastTracking : null;
    const position = livePosition || storedPosition;
    const signalLabel = livePosition ? 'Señal recibida ahora' : storedPosition ? 'Última señal guardada' : 'Sin posición disponible';
    const fields = [
      {name: 'Expediente', value: String(target.caseRef || '—'), inline: true},
      {name: 'Puerto', value: String(target.port || '—'), inline: true},
      {name: 'Transporte próximo', value: target.transportAt ? new Date(target.transportAt).toLocaleString('es-ES', {timeZone: 'Europe/Madrid'}) : 'Sin fecha', inline: true},
      {name: 'Velocidad AIS', value: position ? `${Number(position.speed || 0).toFixed(1)} kn` : 'Sin señal nueva', inline: true},
      {name: 'Rumbo', value: position ? `${Number(position.course || 0).toFixed(0)}°` : '—', inline: true},
      {name: 'Última señal', value: position ? new Date(position.timestamp || position.sourceTimestamp || position.receivedAt).toLocaleString('es-ES', {timeZone: 'Europe/Madrid'}) : 'Todavía no registrada', inline: true},
      {name: 'Origen', value: signalLabel, inline: true},
    ];
    const response = await fetch(discordWebhook, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'Swiftport AIS', content: '🧪 **PRUEBA · ESTADO ACTUAL**', allowed_mentions: {parse: []}, embeds: [{title: `🚢 ${target.vessel || 'BUQUE'}`, description: position ? `Expediente abierto con transporte cercano. ${signalLabel}.` : 'Expediente abierto con transporte cercano, pero todavía no existe ninguna posición registrada para este MMSI.', color: position ? 3447003 : 9807270, fields, footer: {text: 'Swiftport OS · Prueba manual, no es una alerta operativa'}, timestamp: new Date().toISOString()}]})});
    if (!response.ok) throw new Error(`Discord rechazó la prueba (${response.status}).`);
    await new Promise(resolve => setTimeout(resolve, 450));
  }
  console.log(`${targets.length} prueba(s) de buques enviadas a Discord.`);
};

if (!apiKey || !cronToken) {
  console.log('Seguimiento AIS pendiente de configurar; no se realiza ninguna consulta.');
  process.exit(0);
}

const headers = {'X-Cron-Token': cronToken, 'Content-Type': 'application/json'};
const targetResponse = await fetch(`${appUrl}${targetsEndpoint}`, {headers});
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
  }, waitMs);

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: [...targetByMmsi.keys()],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
    }));
  });

  socket.addEventListener('message', event => {
    let packet;
    try { packet = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8')); } catch { return; }
    if (packet?.error) {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`AISStream rechazó la suscripción: ${packet.error}`));
      return;
    }
    const metadata = packet.Metadata || packet.MetaData || {};
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
  await sendDiscordSnapshots(targets, latest);
  process.exit(process.env.RETRY_ON_EMPTY === '1' ? 10 : 0);
}

const updateResponse = await fetch(`${appUrl}/api/ais/update.php`, {
  method: 'POST',
  headers,
  body: JSON.stringify({positions}),
});
if (!updateResponse.ok) throw new Error(`No se pudieron guardar las posiciones (${updateResponse.status}).`);
const result = await updateResponse.json();
console.log(`${result.saved || 0} posición(es) AIS actualizadas.`);
await sendDiscordSnapshots(targets, latest);
