import { addDays, toISODate } from "./api";
import { findClientForScheduleCell, isScheduleClientLogCell, normScheduleName, scheduleCellChildName } from "./scheduleUtils";

const LOGGED_PREP_STATUSES = new Set(["Completed", "Cancelled", "No Show", "No Service"]);

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
  if (tid && cid && date && slot) {
    keys.push(`slot:${tid}|${cid}|${date}|${slot}`);
  }
  if (tid && cid && date && rec.client_name) {
    keys.push(`name:${tid}|${normScheduleName(rec.client_name)}|${date}`);
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

/** Logged sessions → therapist + client + date keys (primary source of truth). */
export function buildSessionPrepLookup(sessions, weekStartISO, weekEndISO) {
  const set = new Set();
  for (const s of sessions || []) {
    const date = (s.session_date || "").slice(0, 10);
    if (!date || date < weekStartISO || date > weekEndISO) continue;
    if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
    const cid = s.client_id;
    if (!cid) continue;
    for (const tid of s.therapist_ids || []) {
      set.add(`mark:${tid}|${cid}|${date}`);
    }
  }
  return set;
}

export function mergePrepLookups(...lookups) {
  const set = new Set();
  for (const l of lookups) {
    if (!l) continue;
    if (l instanceof Set) {
      for (const k of l) set.add(k);
    }
  }
  return set;
}

export function prepKeysForCell(cell, therapistId, day, weekStart, clientId, clientName) {
  if (!cell || !clientId) return [];
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const keys = [];
  if (cell.id) keys.push(`cell:${cell.id}`);
  keys.push(`mark:${therapistId}|${clientId}|${sessionDate}`);
  const slot = (cell.time_slot || "").trim();
  if (slot) keys.push(`slot:${therapistId}|${clientId}|${sessionDate}|${slot}`);
  if (clientName) keys.push(`name:${therapistId}|${normScheduleName(clientName)}|${sessionDate}`);
  return keys;
}

function prepRecordMatchesCell(rec, cell, therapistId, sessionDate, childName, client) {
  if (!rec || rec.therapist_id !== therapistId) return false;
  if ((rec.session_date || "").slice(0, 10) !== sessionDate) return false;
  if (rec.schedule_cell_id && cell?.id && rec.schedule_cell_id === cell.id) return true;
  if (client && rec.client_id === client.id) return true;
  if (rec.client_name && childName) {
    const a = normScheduleName(rec.client_name);
    const b = normScheduleName(childName);
    if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
    const af = a.split(/\s+/)[0];
    const bf = b.split(/\s+/)[0];
    if (af && bf && af === bf) return true;
  }
  return false;
}

function sessionMatchesCell(sessions, cell, therapistId, sessionDate, client, clients = []) {
  if (!sessions?.length) return false;
  for (const s of sessions) {
    if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
    if ((s.session_date || "").slice(0, 10) !== sessionDate) continue;
    if (!(s.therapist_ids || []).includes(therapistId)) continue;
    if (client?.id && s.client_id === client.id) return true;
  }
  if (!client) {
    const childName = scheduleCellChildName(cell);
    if (!childName) return false;
    const bf = normScheduleName(childName).split(/\s+/)[0];
    if (!bf || bf.length < 3) return false;
    for (const s of sessions) {
      if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
      if ((s.session_date || "").slice(0, 10) !== sessionDate) continue;
      if (!(s.therapist_ids || []).includes(therapistId)) continue;
      const sc = clients.find((c) => c.id === s.client_id);
      if (!sc) continue;
      const cf = normScheduleName(sc.name || "").split(/\s+/)[0];
      if (cf && cf === bf) return true;
    }
  }
  return false;
}

export function isCellPrepComplete(
  prepLookup,
  cell,
  therapistId,
  day,
  weekStart,
  clients,
  preparations = [],
  weekSessions = [],
) {
  if (!cell) return false;
  if (!isScheduleClientLogCell(cell)) return false;

  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  if (cell.id && prepLookup.has(`cell:${cell.id}`)) return true;

  if (client) {
    const keys = prepKeysForCell(cell, therapistId, day, weekStart, client.id, client.name);
    if (keys.some((k) => prepLookup.has(k))) return true;
    if (sessionMatchesCell(weekSessions, cell, therapistId, sessionDate, client, clients)) return true;
  } else if (sessionMatchesCell(weekSessions, cell, therapistId, sessionDate, null, clients)) {
    return true;
  }

  for (const rec of preparations || []) {
    if (prepRecordMatchesCell(rec, cell, therapistId, sessionDate, childName, client)) return true;
  }
  return false;
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
