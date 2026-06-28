import { addDays, toISODate } from "./api";
import { findClientForScheduleCell, isScheduleClientLogCell, scheduleCellChildName } from "./scheduleUtils";

/** Build lookup keys for a prep record returned by the API. */
export function prepRecordKeys(rec) {
  const keys = [];
  if (rec.schedule_cell_id) keys.push(`cell:${rec.schedule_cell_id}`);
  const tid = rec.therapist_id;
  const cid = rec.client_id;
  const date = (rec.session_date || "").slice(0, 10);
  if (tid && cid && date) {
    keys.push(`mark:${tid}|${cid}|${date}`);
  }
  const slot = (rec.time_slot || "").trim();
  if (tid && cid && date) {
    keys.push(`slot:${tid}|${cid}|${date}|${slot}`);
  }
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
  keys.push(`mark:${therapistId}|${clientId}|${sessionDate}`);
  const slot = (cell.time_slot || "").trim();
  keys.push(`slot:${therapistId}|${clientId}|${sessionDate}|${slot}`);
  return keys;
}

export function isCellPrepComplete(prepLookup, cell, therapistId, day, weekStart, clients) {
  if (!cell) return false;
  if (cell.id && prepLookup.has(`cell:${cell.id}`)) return true;
  if (!isScheduleClientLogCell(cell)) return false;
  const client = findClientForScheduleCell(scheduleCellChildName(cell), clients);
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
