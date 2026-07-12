import { addDays, toISODate } from "./api";
import { findClientForScheduleCell, isScheduleClientLogCell, normScheduleName, scheduleCellChildName } from "./scheduleUtils";
import { scheduleCellSessionTimes, slotToTime24 } from "./scheduleTimeUtils";

/** Only completed sessions count as prepared (green checkmark). */
const LOGGED_PREP_STATUSES = new Set(["Completed"]);
/** Sessions that bind a logged status to a schedule cell (incl. no attendance). */
const CELL_BOUND_SESSION_STATUSES = new Set(["Completed", "Cancelled", "No Show"]);
const ALLOW_FUTURE_PREP_BADGES = false;

/** Session statuses that show the red corner badge (no attendance). */
const NO_ATTENDANCE_SESSION_STATUSES = new Set(["No Show", "Cancelled"]);

function normalizeHm(hm) {
  if (hm == null || hm === "") return null;
  const fromSlot = slotToTime24(hm);
  if (fromSlot) return fromSlot;
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
  if (m) return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
  return null;
}

function timesMatchLoosely(a, b) {
  const na = normalizeHm(a);
  const nb = normalizeHm(b);
  return !!(na && nb && na === nb);
}

function hmToMinutes(hm) {
  const n = normalizeHm(hm);
  if (!n) return null;
  const [h, m] = n.split(":").map(Number);
  return h * 60 + m;
}

function sessionStartMatchesCell(session, cell) {
  if (!cell) return false;
  const { start_time: cellStart, end_time: cellEnd } = scheduleCellSessionTimes(cell, cell?.time_slot);
  if (!session?.start_time) {
    // No-show/cancelled without a logged time must not bind to every slot that day.
    if (session?.status && NO_ATTENDANCE_SESSION_STATUSES.has(session.status)) return false;
    return true;
  }
  if (!cellStart) return true;
  if (timesMatchLoosely(session.start_time, cellStart)) return true;
  const sessMin = hmToMinutes(session.start_time);
  const startMin = hmToMinutes(cellStart);
  const endMin = cellEnd ? hmToMinutes(cellEnd) : null;
  if (sessMin == null || startMin == null) return false;
  if (endMin != null && sessMin >= startMin && sessMin < endMin) return true;
  // Legacy sessions logged with AM mis-parse (03:30 vs cell 15:30)
  if (endMin != null) {
    const shifted = sessMin + 12 * 60;
    if (shifted >= startMin && shifted < endMin) return true;
  }
  return false;
}

function therapistIdsForPrep(tid, idAliases) {
  const ids = new Set();
  if (tid) ids.add(tid);
  const alts = idAliases?.get(tid);
  if (alts) alts.forEach((alt) => ids.add(alt));
  return [...ids];
}

function therapistIdsMatch(a, b, idAliases) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aIds = therapistIdsForPrep(a, idAliases);
  return aIds.includes(b);
}

function sessionIncludesTherapist(sessionTids, therapistId, idAliases) {
  for (const st of sessionTids || []) {
    if (therapistIdsMatch(st, therapistId, idAliases)) return true;
  }
  return false;
}

function scheduleCellSessionDate(cell, fallbackWeekStart) {
  const ws = (cell?.week_start || fallbackWeekStart || "").slice(0, 10);
  const day = cell?.day;
  if (!ws || day == null) return null;
  return toISODate(addDays(new Date(`${ws}T12:00:00`), day));
}

function isPrepSuppressed(suppressionLookup, therapistId, sessionDate, clientId, cell) {
  if (!suppressionLookup?.size) return false;
  if (cell?.id && suppressionLookup.has(`suppress:cell:${cell.id}`)) return true;
  if (!clientId) return false;
  if (cell?.id && suppressionLookup.has(`suppress:${therapistId}|${clientId}|${sessionDate}|${cell.id}`)) return true;
  if (suppressionLookup.has(`suppress:${therapistId}|${clientId}|${sessionDate}`)) return true;
  return false;
}

/** Strict match: therapist row + calendar date + client + slot time. */
export function sessionMatchesScheduleCellStrict(
  session,
  cell,
  therapistId,
  sessionDate,
  client,
  clients = [],
  idAliases = null,
) {
  if (!session || !cell) return false;
  if ((session.session_date || "").slice(0, 10) !== sessionDate) return false;
  if (!sessionIncludesTherapist(session.therapist_ids, therapistId, idAliases)) return false;
  if (!sessionStartMatchesCell(session, cell)) return false;
  if (client?.id) {
    if (session.client_id !== client.id) return false;
    return true;
  }
  const childName = scheduleCellChildName(cell);
  if (!childName) return false;
  return sessionClientMatchesCellName(session, childName, clients);
}

function addPrepSlotKeys(set, tid, cid, date, slot, idAliases) {
  if (!cid || !date || !slot) return;
  for (const id of therapistIdsForPrep(tid, idAliases)) {
    set.add(`slot:${id}|${cid}|${date}|${slot}`);
  }
}

/** @deprecated Badges are session-only; kept for legacy callers that still merge sets. */
export function prepRecordKeys(rec, idAliases = null) {
  const keys = [];
  if (rec.schedule_cell_id) keys.push(`cell:${rec.schedule_cell_id}`);
  const cid = rec.client_id;
  const date = (rec.session_date || "").slice(0, 10);
  const slot = (rec.time_slot || "").trim();
  if (!cid || !date || !slot) return keys;
  for (const tid of therapistIdsForPrep(rec.therapist_id, idAliases)) {
    keys.push(`slot:${tid}|${cid}|${date}|${slot}`);
  }
  return keys;
}

/** @deprecated Use buildSessionPrepLookup only — prep table rows no longer drive badges. */
export function buildPrepLookup(preparations, idAliases = null) {
  const set = new Set();
  for (const rec of preparations || []) {
    if (!rec?.session_id) continue;
    for (const k of prepRecordKeys(rec, idAliases)) set.add(k);
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

/** Map equivalent therapist ids (duplicate rows, user login id vs therapists table id). */
export function buildAllTherapistIdAliases(therapists = [], user = null) {
  const groups = [];
  const byEmail = new Map();
  const byKey = new Map();
  for (const t of therapists) {
    const email = (t.email || "").toLowerCase().trim();
    const key = (t.key || "").toLowerCase();
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, new Set());
      byEmail.get(email).add(t.id);
    }
    if (key) {
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key).add(t.id);
    }
  }
  for (const set of byEmail.values()) groups.push(set);
  for (const set of byKey.values()) groups.push(set);
  if (user?.id) {
    const related = new Set([user.id]);
    const email = (user.email || "").toLowerCase().trim();
    const key = (user.key || "").toLowerCase();
    if (email && byEmail.has(email)) byEmail.get(email).forEach((id) => related.add(id));
    if (key && byKey.has(key)) byKey.get(key).forEach((id) => related.add(id));
    groups.push(related);
  }
  const map = new Map();
  for (const group of groups) {
    const ids = [...group].filter(Boolean);
    for (const id of ids) {
      map.set(id, ids.filter((x) => x !== id));
    }
  }
  return map;
}

/** @deprecated use buildAllTherapistIdAliases */
export function therapistPrepIdAliases(selfTherapist, user) {
  return buildAllTherapistIdAliases(selfTherapist ? [selfTherapist] : [], user);
}

/** Logged sessions → exact schedule cell keys (therapist + date + slot + client). */
export function buildSessionPrepLookup(
  sessions,
  weekStartISO,
  weekEndISO,
  idAliases = null,
  suppressionLookup = null,
  cells = [],
  clients = [],
) {
  const set = new Set();
  for (const s of sessions || []) {
    const date = (s.session_date || "").slice(0, 10);
    if (!date || date < weekStartISO || date > weekEndISO) continue;
    if (!CELL_BOUND_SESSION_STATUSES.has(s.status)) continue;
    if (!s.client_id) continue;
    if (!cells.length) continue;
    for (const cell of cells) {
      if (!isScheduleClientLogCell(cell)) continue;
      const sessionDate = scheduleCellSessionDate(cell, weekStartISO);
      if (sessionDate !== date) continue;
      const childName = scheduleCellChildName(cell);
      const client = childName ? findClientForScheduleCell(childName, clients) : null;
      if (!sessionMatchesScheduleCellStrict(s, cell, cell.therapist_id, date, client, clients, idAliases)) {
        continue;
      }
      const tid = cell.therapist_id;
      if (!tid) continue;
      if (isPrepSuppressed(suppressionLookup, tid, date, s.client_id, cell)) continue;
      if (cell.id) set.add(`cell:${cell.id}`);
      const slot = (cell.time_slot || "").trim();
      if (slot) addPrepSlotKeys(set, tid, s.client_id, date, slot, idAliases);
    }
  }
  return set;
}

/** Optimistic badge keys after logging — session-backed, exact cell only. */
export function optimisticPrepKeysFromScheduleLog(scheduleContext, client, idAliases = null) {
  const set = new Set();
  if (!scheduleContext?.therapist_id || !client?.id) return set;
  const sessionDate = (scheduleContext.session_date || "").slice(0, 10);
  if (!sessionDate) return set;
  if (scheduleContext.schedule_cell_id) {
    set.add(`cell:${scheduleContext.schedule_cell_id}`);
  }
  const slot = (scheduleContext.time_slot || "").trim();
  if (slot) addPrepSlotKeys(set, scheduleContext.therapist_id, client.id, sessionDate, slot, idAliases);
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

export function prepKeysForCell(cell, therapistId, day, weekStart, clientId, clientName, idAliases = null) {
  if (!cell) return [];
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const keys = [];
  if (cell.id) keys.push(`cell:${cell.id}`);
  const slot = (cell.time_slot || "").trim();
  if (clientId && slot) {
    for (const tid of therapistIdsForPrep(therapistId, idAliases)) {
      keys.push(`slot:${tid}|${clientId}|${sessionDate}|${slot}`);
    }
  }
  return keys;
}

/** True when a schedule label refers to the same client as a session (multi-token names). */
export function scheduleNamesReferToSameClient(cellName, clientName, clients = []) {
  const resolved = findClientForScheduleCell(cellName, clients);
  if (resolved?.name) {
    return normScheduleName(resolved.name) === normScheduleName(clientName || "");
  }
  const cellNorm = normScheduleName(cellName || "");
  const clientNorm = normScheduleName(clientName || "");
  const cellTokens = cellNorm.split(/\s+/).filter(Boolean);
  const clientTokens = clientNorm.split(/\s+/).filter(Boolean);
  if (!cellTokens.length || !clientTokens.length) return false;
  if (cellTokens[0] !== clientTokens[0]) return false;
  if (cellTokens.length === 1) {
    const sameFirst = (clients || []).filter((c) => {
      const first = normScheduleName(c.name || "").split(/\s+/)[0];
      return first && first === cellTokens[0];
    });
    if (sameFirst.length === 1) return sameFirst[0].name === clientName;
    return false;
  }
  const suffixTokens = cellTokens.slice(1);
  if (suffixTokens.length === 1 && suffixTokens[0].length === 1) {
    const initial = suffixTokens[0];
    const second = clientTokens[1] || "";
    return second.startsWith(initial);
  }
  if (cellTokens.slice(1).every((t) => clientTokens.includes(t))) return true;
  const sameFirst = (clients || []).filter((c) => {
    const first = normScheduleName(c.name || "").split(/\s+/)[0];
    return first && first === cellTokens[0];
  });
  if (sameFirst.length === 1 && sameFirst[0].name === clientName) return true;
  return false;
}

function sessionClientMatchesCellName(session, cellName, clients = []) {
  if (!session?.client_id || !cellName) return false;
  const sc = clients.find((c) => c.id === session.client_id);
  if (!sc?.name) return false;
  return scheduleNamesReferToSameClient(cellName, sc.name, clients);
}

const ANY_LOGGED_SESSION_STATUSES = new Set([
  ...LOGGED_PREP_STATUSES,
  ...NO_ATTENDANCE_SESSION_STATUSES,
]);

/** Find any logged session for a schedule cell (strict match first, then same client/day/therapist). */
export function findExistingSessionForScheduleCell(
  sessions,
  cell,
  therapistId,
  sessionDate,
  client,
  clients = [],
  idAliases = null,
) {
  const strict = findSessionForCellByStatus(
    sessions, ANY_LOGGED_SESSION_STATUSES, cell, therapistId, sessionDate,
    client, clients, null, idAliases,
  );
  if (strict) return strict;
  const cid = client?.id;
  if (!cid) return null;
  for (const s of sessions || []) {
    if (!ANY_LOGGED_SESSION_STATUSES.has(s.status)) continue;
    if (s.client_id !== cid) continue;
    if ((s.session_date || "").slice(0, 10) !== sessionDate) continue;
    if (!sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases)) continue;
    return s;
  }
  return null;
}

function findSessionForCellByStatus(
  sessions,
  statusSet,
  cell,
  therapistId,
  sessionDate,
  client,
  clients = [],
  suppressionLookup = null,
  idAliases = null,
) {
  if (!sessions?.length || !cell) return null;
  const cid = client?.id;
  if (cid && isPrepSuppressed(suppressionLookup, therapistId, sessionDate, cid, cell)) return null;

  for (const s of sessions) {
    if (!statusSet.has(s.status)) continue;
    if (sessionMatchesScheduleCellStrict(s, cell, therapistId, sessionDate, client, clients, idAliases)) {
      return s;
    }
  }
  return null;
}

function prepLookupMatchesCell(prepLookup, cell, therapistId, day, weekStart, clientId, idAliases = null) {
  if (!prepLookup?.size || !cell) return false;
  if (cell.id && prepLookup.has(`cell:${cell.id}`)) return true;
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const slot = (cell.time_slot || "").trim();
  if (clientId && slot) {
    for (const tid of therapistIdsForPrep(therapistId, idAliases)) {
      if (prepLookup.has(`slot:${tid}|${clientId}|${sessionDate}|${slot}`)) return true;
    }
  }
  return false;
}

/** True once the scheduled slot start time has passed (same calendar day). */
export function isScheduleSlotStarted(cell, sessionDate) {
  const today = toISODate(new Date());
  if (sessionDate > today) return false;
  if (sessionDate < today) return true;
  try {
    const { start_time: startTime } = scheduleCellSessionTimes(cell, cell?.time_slot);
    if (!startTime) return true;
    const [h, m] = startTime.split(":").map(Number);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    return now >= start;
  } catch {
    return true;
  }
}

/** True once the scheduled slot end time has passed (date + time, not just calendar day). */
export function isScheduleSlotEnded(cell, sessionDate) {
  const today = toISODate(new Date());
  if (sessionDate > today) return false;
  if (sessionDate < today) return true;
  try {
    const { end_time: endTime } = scheduleCellSessionTimes(cell, cell?.time_slot);
    if (!endTime) return false;
    const [h, m] = endTime.split(":").map(Number);
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    return now >= end;
  } catch {
    return false;
  }
}

/** Corner badge on schedule cells: prep (green), no_show (red), therapist_cancel (yellow). Session history only. */
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
  idAliases = null,
) {
  void preparations;
  if (!cell || !isScheduleClientLogCell(cell)) return null;

  if (cell.state === "cancel_therapist") return "therapist_cancel";

  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  if (!ALLOW_FUTURE_PREP_BADGES) {
    const today = toISODate(new Date());
    if (sessionDate > today) return null;
  }
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  if (isPrepSuppressed(suppressionLookup, therapistId, sessionDate, client?.id, cell)) {
    return null;
  }

  const slotEnded = isScheduleSlotEnded(cell, sessionDate);
  const slotStarted = isScheduleSlotStarted(cell, sessionDate);

  const completed = findSessionForCellByStatus(
    weekSessions, LOGGED_PREP_STATUSES, cell, therapistId, sessionDate,
    client, clients, suppressionLookup, idAliases,
  );
  if (completed) return "prep";

  const noShowSession = findSessionForCellByStatus(
    weekSessions, NO_ATTENDANCE_SESSION_STATUSES, cell, therapistId, sessionDate,
    client, clients, suppressionLookup, idAliases,
  );
  if (noShowSession) return "no_show";

  if (cell.state === "cancel_child" && slotEnded && !completed) {
    return "no_show";
  }

  if (slotStarted && isCellPrepComplete(
    prepLookup, cell, therapistId, day, weekStart, clients,
    preparations, weekSessions, suppressionLookup, idAliases,
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
  idAliases = null,
) {
  void preparations;
  if (!cell) return false;
  if (!isScheduleClientLogCell(cell)) return false;

  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  if (isPrepSuppressed(suppressionLookup, therapistId, sessionDate, client?.id, cell)) {
    return false;
  }

  const completed = findSessionForCellByStatus(
    weekSessions, LOGGED_PREP_STATUSES, cell, therapistId, sessionDate,
    client, clients, suppressionLookup, idAliases,
  );
  if (completed) return true;

  const noShow = findSessionForCellByStatus(
    weekSessions, NO_ATTENDANCE_SESSION_STATUSES, cell, therapistId, sessionDate,
    client, clients, suppressionLookup, idAliases,
  );
  if (noShow) return false;

  if (cell.state === "cancel_child") return false;

  return prepLookupMatchesCell(prepLookup, cell, therapistId, day, weekStart, client?.id, idAliases);
}

/** Find session-backed prep metadata for a schedule cell (notes, session id). */
export function findPrepRecordForCell(
  cell,
  therapistId,
  day,
  weekStart,
  clients,
  preparations = [],
  idAliases = null,
  weekSessions = [],
) {
  if (!cell) return null;
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  const session = findSessionForCellByStatus(
    weekSessions,
    new Set([...LOGGED_PREP_STATUSES, ...NO_ATTENDANCE_SESSION_STATUSES]),
    cell,
    therapistId,
    sessionDate,
    client,
    clients,
    null,
    idAliases,
  );
  if (session) {
    const prep = (preparations || []).find(
      (r) => r.session_id === session.id
        || (r.client_id === session.client_id
          && (r.session_date || "").slice(0, 10) === sessionDate
          && r.schedule_cell_id === cell.id),
    );
    return {
      session_id: session.id,
      internal_note: prep?.internal_note || "",
      notes: session.note || prep?.notes || "",
    };
  }

  for (const rec of preparations || []) {
    if (!rec?.session_id) continue;
    const recDate = (rec.session_date || "").slice(0, 10);
    if (recDate !== sessionDate) continue;
    if (!therapistIdsMatch(rec.therapist_id, therapistId, idAliases)) continue;
    if (client?.id && rec.client_id && rec.client_id !== client.id) continue;
    if (rec.schedule_cell_id && cell.id && rec.schedule_cell_id === cell.id) return rec;
    const recSlot = (rec.time_slot || "").trim();
    const cellSlot = (cell.time_slot || "").trim();
    if (recSlot && cellSlot && timesMatchLoosely(recSlot, cellSlot)) return rec;
  }
  return null;
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
