import { addDays, toISODate } from "./api";
import { findClientForScheduleCell, isScheduleClientLogCell, normScheduleName, scheduleCellChildName } from "./scheduleUtils";

/** Only completed sessions count as prepared (green checkmark). */
const LOGGED_PREP_STATUSES = new Set(["Completed"]);

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
  const label = rec.client_name || rec.child_name;
  if (tid && date && label) {
    keys.push(`name:${tid}|${normScheduleName(label)}|${date}`);
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

/** Map suppression rows so badges stay hidden even when sessions exist. */
export function buildSuppressionLookup(suppressions) {
  const set = new Set();
  for (const s of suppressions || []) {
    const tid = s.therapist_id;
    const cid = s.client_id;
    const date = (s.session_date || "").slice(0, 10);
    if (!tid || !cid || !date) continue;
    const cellId = (s.schedule_cell_id || "").trim();
    if (cellId) {
      set.add(`suppress:cell:${cellId}`);
      set.add(`suppress:${tid}|${cid}|${date}|${cellId}`);
    } else {
      set.add(`suppress:${tid}|${cid}|${date}`);
    }
  }
  return set;
}

function isPrepSuppressed(suppressionLookup, therapistId, sessionDate, clientId, cell) {
  if (!suppressionLookup?.size) return false;
  if (cell?.id && suppressionLookup.has(`suppress:cell:${cell.id}`)) return true;
  if (!clientId) return false;
  if (cell?.id && suppressionLookup.has(`suppress:${therapistId}|${clientId}|${sessionDate}|${cell.id}`)) return true;
  if (suppressionLookup.has(`suppress:${therapistId}|${clientId}|${sessionDate}`)) return true;
  return false;
}

/** Map equivalent therapist ids (user login id vs therapists table id). */
export function therapistPrepIdAliases(selfTherapist, user) {
  const map = new Map();
  if (!selfTherapist?.id || !user?.id || selfTherapist.id === user.id) return map;
  map.set(selfTherapist.id, [user.id]);
  map.set(user.id, [selfTherapist.id]);
  return map;
}

function addPrepMarkKeys(set, tid, cid, date, idAliases) {
  if (!tid || !cid || !date) return;
  set.add(`mark:${tid}|${cid}|${date}`);
  const alts = idAliases?.get(tid);
  if (alts) {
    for (const alt of alts) set.add(`mark:${alt}|${cid}|${date}`);
  }
}

/** Logged sessions → therapist + client + date keys (primary source of truth). */
export function buildSessionPrepLookup(
  sessions,
  weekStartISO,
  weekEndISO,
  idAliases = null,
  suppressionLookup = null,
) {
  const set = new Set();
  for (const s of sessions || []) {
    const date = (s.session_date || "").slice(0, 10);
    if (!date || date < weekStartISO || date > weekEndISO) continue;
    if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
    const cid = s.client_id;
    if (!cid) continue;
    for (const tid of s.therapist_ids || []) {
      if (suppressionLookup?.has(`suppress:${tid}|${cid}|${date}`)) continue;
      addPrepMarkKeys(set, tid, cid, date, idAliases);
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
  if (!cell) return [];
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const keys = [];
  if (cell.id) keys.push(`cell:${cell.id}`);
  if (clientId) keys.push(`mark:${therapistId}|${clientId}|${sessionDate}`);
  const slot = (cell.time_slot || "").trim();
  if (clientId && slot) keys.push(`slot:${therapistId}|${clientId}|${sessionDate}|${slot}`);
  const childFromCell = scheduleCellChildName(cell);
  const nameForKey = clientName || childFromCell;
  if (nameForKey) keys.push(`name:${therapistId}|${normScheduleName(nameForKey)}|${sessionDate}`);
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

function sessionMatchesCell(sessions, cell, therapistId, sessionDate, client, clients = [], suppressionLookup = null) {
  if (!sessions?.length) return false;
  const cid = client?.id;
  if (cid && suppressionLookup?.has(`suppress:${therapistId}|${cid}|${sessionDate}`)) return false;
  if (cell?.id && suppressionLookup?.has(`suppress:cell:${cell.id}`)) return false;
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

function findSessionForCell(sessions, cell, therapistId, sessionDate, client, clients = [], suppressionLookup = null) {
  if (!sessions?.length) return null;
  const cid = client?.id;
  if (cid && suppressionLookup?.has(`suppress:${therapistId}|${cid}|${sessionDate}`)) return null;
  if (cell?.id && suppressionLookup?.has(`suppress:cell:${cell.id}`)) return null;

  const tryMatch = (s) => {
    if ((s.session_date || "").slice(0, 10) !== sessionDate) return false;
    if (!(s.therapist_ids || []).includes(therapistId)) return false;
    return true;
  };

  for (const s of sessions) {
    if (!tryMatch(s)) continue;
    if (client?.id && s.client_id === client.id) return s;
  }

  const childName = scheduleCellChildName(cell);
  if (!childName) return null;
  const bf = normScheduleName(childName).split(/\s+/)[0];
  if (!bf || bf.length < 3) return null;
  for (const s of sessions) {
    if (!tryMatch(s)) continue;
    const sc = clients.find((c) => c.id === s.client_id);
    if (!sc) continue;
    const cf = normScheduleName(sc.name || "").split(/\s+/)[0];
    if (cf && cf === bf) return s;
  }
  return null;
}

/** Session statuses that show the red corner badge (no attendance). */
const NO_ATTENDANCE_SESSION_STATUSES = new Set(["No Show"]);

function isCellPreparedMark(
  prepLookup,
  cell,
  therapistId,
  day,
  weekStart,
  clients,
  preparations = [],
) {
  if (!cell || !isScheduleClientLogCell(cell)) return false;
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  // Explicit prep marks (from prep-history / preparations API)
  if (cell.id && prepLookup?.has(`cell:${cell.id}`)) return true;
  const nameKeys = prepKeysForCell(cell, therapistId, day, weekStart, client?.id, client?.name || childName);
  if (nameKeys.some((k) => prepLookup?.has(k))) return true;
  for (const rec of preparations || []) {
    if (prepRecordMatchesCell(rec, cell, therapistId, sessionDate, childName, client)) return true;
  }
  return false;
}

/** Corner badge on schedule cells: prep (green), no_show (red), therapist_cancel (yellow). */
export function getCellStatusBadge(
  cell,
  therapistId,
  day,
  weekStart,
  clients,
  prepLookup,
  preparations = [],
  weekSessions = [],
  suppressionLookup = null,
) {
  if (!cell || !isScheduleClientLogCell(cell)) return null;

  if (cell.state === "cancel_therapist") return "therapist_cancel";

  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  if (isPrepSuppressed(suppressionLookup, therapistId, sessionDate, client?.id, cell)) {
    return null;
  }

  const session = findSessionForCell(
    weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup,
  );
  if (session && NO_ATTENDANCE_SESSION_STATUSES.has(session.status)) {
    // Only show "no_show" corner badge when the therapist explicitly marked prep for this cell.
    if (isCellPreparedMark(prepLookup, cell, therapistId, day, weekStart, clients, preparations)) {
      return "no_show";
    }
    return null;
  }

  // Client cancellation should not show the red corner badge by default.
  if (cell.state === "cancel_child") return null;

  if (isCellPrepComplete(
    prepLookup, cell, therapistId, day, weekStart, clients,
    preparations, weekSessions, suppressionLookup,
  )) {
    return "prep";
  }

  return null;
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
  suppressionLookup = null,
) {
  if (!cell) return false;
  if (!isScheduleClientLogCell(cell)) return false;

  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  if (isPrepSuppressed(suppressionLookup, therapistId, sessionDate, client?.id, cell)) {
    return false;
  }

  const session = findSessionForCell(
    weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup,
  );
  if (session && NO_ATTENDANCE_SESSION_STATUSES.has(session.status)) return false;

  if (cell.state === "cancel_child") return false;

  if (cell.id && prepLookup.has(`cell:${cell.id}`)) return true;

  const nameKeys = prepKeysForCell(cell, therapistId, day, weekStart, client?.id, client?.name || childName);
  if (nameKeys.some((k) => prepLookup.has(k))) return true;

  if (client) {
    if (sessionMatchesCell(weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup)) return true;
  } else if (sessionMatchesCell(weekSessions, cell, therapistId, sessionDate, null, clients, suppressionLookup)) {
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
