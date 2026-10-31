export const validCalendarDate=value=>{
  const date=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
};
export const validCalendarTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''));
export const calendarScheduleIncomplete=event=>!validCalendarDate(event?.fecha)||!validCalendarTime(event?.inicio)||['provisional','missing_date','missing_time'].includes(event?.scheduleStatus);
// Pending services have no calendar period until both date and start time are confirmed.
// Finished/cancelled services stay in their dated history, not in the persistent queue.
export function partitionCalendarSchedule(events,statusOf){
  const pending=[],dated=[];
  for(const event of events){
    if(statusOf(event)==='pending'&&calendarScheduleIncomplete(event))pending.push(event);
    else dated.push(event);
  }
  return {pending,dated};
}
export function calendarPendingLabel(event){
  if(!validCalendarDate(event?.fecha))return validCalendarTime(event?.inicio)?'FECHA POR CONFIRMAR':'FECHA Y HORA POR CONFIRMAR';
  return validCalendarTime(event?.inicio)?'HORARIO PROVISIONAL':'HORA POR CONFIRMAR';
}
export function manualCalendarSchedule(event){
  const confirmed=validCalendarDate(event?.fecha)&&validCalendarTime(event?.inicio);
  return {...event,scheduleSource:'manual',scheduleStatus:confirmed?'confirmed':validCalendarDate(event?.fecha)?'missing_time':'missing_date',scheduleNote:confirmed?'':'Pendiente de confirmar fecha y horario'};
}
