import { addDays, toISODate } from "./api";
import { findClientForScheduleCell, isScheduleClientLogCell } from "./scheduleUtils";

/** Build lookup keys for a prep record returned by the API. */
export function prepRecordKeys(rec) {
  const keys = [];
  if (rec.schedule_cell_id) keys.push(`cell:${rec.schedule_cell_id}`);
  const slot = (rec.time_slot || "").trim();
  keys.push(`slot:${rec.therapist_id}|${rec.client_id}|${rec.session_date}|${slot}`);
  return keys;
}

/** Map prep API rows to a Set of lookup keys. */
export function buildPrepLookup(preparations) {
  const set = new Set();
  for (const rec of preparations || []) {
    for (const k of prepRecordKeys(rec)) set.add(k);
  }
  return set;
}

export function prepKeysForCell(cell, therapistId, day, weekStart, clientId) {
  if (!cell || !clientId) return [];
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const keys = [];
  if (cell.id) keys.push(`cell:${cell.id}`);
  const slot = (cell.time_slot || "").trim();
  keys.push(`slot:${therapistId}|${clientId}|${sessionDate}|${slot}`);
  return keys;
}

export function isCellPrepComplete(prepLookup, cell, therapistId, day, weekStart, clients) {
  if (!isScheduleClientLogCell(cell)) return false;
  const client = findClientForScheduleCell(cell.child_name, clients);
  if (!client) return false;
  const keys = prepKeysForCell(cell, therapistId, day, weekStart, client.id);
  return keys.some((k) => prepLookup.has(k));
}

export function scheduleSlotFromCell(cell, therapistId, day, weekStart, clientId) {
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  return {
    therapist_id: therapistId,
    client_id: clientId,
    session_date: sessionDate,
    time_slot: cell?.time_slot || "",
    schedule_cell_id: cell?.id || null,
    week_start: weekStart,
    day,
  };
}
