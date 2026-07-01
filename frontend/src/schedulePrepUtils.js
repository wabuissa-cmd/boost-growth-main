import { addDays, toISODate } from "./api";
import { findClientForScheduleCell, isScheduleClientLogCell, normScheduleName, scheduleCellChildName } from "./scheduleUtils";

/** Only completed sessions count as prepared (green checkmark). */
const LOGGED_PREP_STATUSES = new Set(["Completed"]);
const ALLOW_FUTURE_PREP_BADGES = false;

/** Build lookup keys for a prep record returned by the API. */
export function prepRecordKeys(rec, idAliases = null) {
  const keys = [];
  if (rec.schedule_cell_id) keys.push(`cell:${rec.schedule_cell_id}`);
  const cid = rec.client_id;
  const date = (rec.session_date || "").slice(0, 10);
  const slot = (rec.time_slot || "").trim();
  const label = rec.client_name || rec.child_name;
  for (const tid of therapistIdsForPrep(rec.therapist_id, idAliases)) {
    if (cid && date) keys.push(`mark:${tid}|${cid}|${date}`);
    if (cid && date && slot) keys.push(`slot:${tid}|${cid}|${date}|${slot}`);
    if (date && label) keys.push(`name:${tid}|${normScheduleName(label)}|${date}`);
  }
  return keys;
}

/** Map prep API rows to a Set of lookup keys. */
export function buildPrepLookup(preparations, idAliases = null) {
  const set = new Set();
  for (const rec of preparations || []) {
    if (prepRecordIsNoShow(rec)) continue;
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

function isPrepSuppressed(suppressionLookup, therapistId, sessionDate, clientId, cell) {
  if (!suppressionLookup?.size) return false;
  if (cell?.id && suppressionLookup.has(`suppress:cell:${cell.id}`)) return true;
  if (!clientId) return false;
  if (cell?.id && suppressionLookup.has(`suppress:${therapistId}|${clientId}|${sessionDate}|${cell.id}`)) return true;
  if (suppressionLookup.has(`suppress:${therapistId}|${clientId}|${sessionDate}`)) return true;
  return false;
}

function therapistIdsForPrep(tid, idAliases) {
  const ids = new Set();
  if (tid) ids.add(tid);
  const alts = idAliases?.get(tid);
  if (alts) alts.forEach((alt) => ids.add(alt));
  return [...ids];
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

function addPrepMarkKeys(set, tid, cid, date, idAliases) {
  if (!cid || !date) return;
  for (const id of therapistIdsForPrep(tid, idAliases)) {
    set.add(`mark:${id}|${cid}|${date}`);
  }
}

function scheduleCellSessionDate(cell, fallbackWeekStart) {
  const ws = (cell?.week_start || fallbackWeekStart || "").slice(0, 10);
  const day = cell?.day;
  if (!ws || day == null) return null;
  return toISODate(addDays(new Date(`${ws}T12:00:00`), day));
}

/** Logged sessions → therapist + client + date keys; mirrors prep onto every schedule cell for that client+day. */
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
  const completedClientDates = new Set();
  for (const s of sessions || []) {
    const date = (s.session_date || "").slice(0, 10);
    if (!date || date < weekStartISO || date > weekEndISO) continue;
    if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
    const cid = s.client_id;
    if (!cid) continue;
    completedClientDates.add(`${cid}|${date}`);
    for (const tid of s.therapist_ids || []) {
      if (suppressionLookup?.has(`suppress:${tid}|${cid}|${date}`)) continue;
      addPrepMarkKeys(set, tid, cid, date, idAliases);
    }
  }
  if (cells.length && clients.length && completedClientDates.size) {
    for (const cell of cells) {
      if (!isScheduleClientLogCell(cell)) continue;
      const sessionDate = scheduleCellSessionDate(cell, weekStartISO);
      if (!sessionDate || sessionDate < weekStartISO || sessionDate > weekEndISO) continue;
      const childName = scheduleCellChildName(cell);
      const client = childName ? findClientForScheduleCell(childName, clients) : null;
      if (!client?.id || !completedClientDates.has(`${client.id}|${sessionDate}`)) continue;
      const tid = cell.therapist_id;
      if (!tid) continue;
      if (suppressionLookup?.has(`suppress:${tid}|${client.id}|${sessionDate}`)) continue;
      if (cell.id) set.add(`cell:${cell.id}`);
      addPrepMarkKeys(set, tid, client.id, sessionDate, idAliases);
    }
  }
  return set;
}

/** Immediately add prep badge keys after logging from a schedule cell (before API refresh). */
export function optimisticPrepKeysFromScheduleLog(scheduleContext, client, idAliases = null) {
  const set = new Set();
  if (!scheduleContext?.therapist_id || !client?.id) return set;
  const sessionDate = (scheduleContext.session_date || "").slice(0, 10);
  if (!sessionDate) return set;
  const rec = {
    therapist_id: scheduleContext.therapist_id,
    client_id: client.id,
    session_date: sessionDate,
    time_slot: scheduleContext.time_slot || "",
    schedule_cell_id: scheduleContext.schedule_cell_id || null,
    client_name: client.name,
  };
  for (const k of prepRecordKeys(rec, idAliases)) set.add(k);
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
  for (const tid of therapistIdsForPrep(therapistId, idAliases)) {
    if (clientId) keys.push(`mark:${tid}|${clientId}|${sessionDate}`);
    const slot = (cell.time_slot || "").trim();
    if (clientId && slot) keys.push(`slot:${tid}|${clientId}|${sessionDate}|${slot}`);
    const childFromCell = scheduleCellChildName(cell);
    const nameForKey = clientName || childFromCell;
    if (nameForKey) keys.push(`name:${tid}|${normScheduleName(nameForKey)}|${sessionDate}`);
  }
  return keys;
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

function dualSpecialistPrepMatch(rec, therapistId, sessionDate, client, weekSessions, idAliases) {
  if (!rec || !client?.id) return false;
  if ((rec.session_date || "").slice(0, 10) !== sessionDate) return false;
  if (rec.client_id && rec.client_id !== client.id) return false;
  const recTid = rec.therapist_id;
  if (!recTid || therapistIdsMatch(recTid, therapistId, idAliases)) return false;
  for (const s of weekSessions || []) {
    if ((s.session_date || "").slice(0, 10) !== sessionDate) continue;
    if (s.client_id !== client.id) continue;
    if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
    if (!sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases)) continue;
    if (!sessionIncludesTherapist(s.therapist_ids, recTid, idAliases)) continue;
    return true;
  }
  return false;
}

function dualSpecialistPrepFromRecords(rec, therapistId, sessionDate, client, preparations, idAliases) {
  if (!rec || !client?.id) return false;
  if ((rec.session_date || "").slice(0, 10) !== sessionDate) return false;
  if (rec.client_id !== client.id) return false;
  const recTid = rec.therapist_id;
  if (!recTid || therapistIdsMatch(recTid, therapistId, idAliases)) return false;
  for (const other of preparations || []) {
    if (other === rec) continue;
    if ((other.session_date || "").slice(0, 10) !== sessionDate) continue;
    if (other.client_id !== client.id) continue;
    if (!other.therapist_id) continue;
    if (!therapistIdsMatch(other.therapist_id, therapistId, idAliases)) continue;
    if (therapistIdsMatch(other.therapist_id, recTid, idAliases)) continue;
    return true;
  }
  return false;
}

function prepRecordCoversCell(
  rec, cell, therapistId, sessionDate, childName, client, idAliases, preparations, weekSessions,
) {
  if (prepRecordIsNoShow(rec)) return false;
  if (prepRecordMatchesCell(rec, cell, therapistId, sessionDate, childName, client, idAliases)) return true;
  if (dualSpecialistPrepMatch(rec, therapistId, sessionDate, client, weekSessions, idAliases)) return true;
  return dualSpecialistPrepFromRecords(rec, therapistId, sessionDate, client, preparations, idAliases);
}

function prepRecordMatchesCell(rec, cell, therapistId, sessionDate, childName, client, idAliases = null) {
  if (!rec || !therapistIdsMatch(rec.therapist_id, therapistId, idAliases)) return false;
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

function sessionMatchesCell(sessions, cell, therapistId, sessionDate, client, clients = [], suppressionLookup = null, idAliases = null) {
  if (!sessions?.length) return false;
  const cid = client?.id;
  if (cid && suppressionLookup?.has(`suppress:${therapistId}|${cid}|${sessionDate}`)) return false;
  if (cell?.id && suppressionLookup?.has(`suppress:cell:${cell.id}`)) return false;
  for (const s of sessions) {
    if (!LOGGED_PREP_STATUSES.has(s.status)) continue;
    if ((s.session_date || "").slice(0, 10) !== sessionDate) continue;
    if (!sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases)) continue;
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
      if (!sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases)) continue;
      const sc = clients.find((c) => c.id === s.client_id);
      if (!sc) continue;
      const cf = normScheduleName(sc.name || "").split(/\s+/)[0];
      if (cf && cf === bf) return true;
    }
  }
  return false;
}

/** True when a schedule label refers to the same client as a session (multi-token names). */
function sessionClientMatchesCellName(session, cellName, clients = []) {
  if (!session?.client_id || !cellName) return false;
  const sc = clients.find((c) => c.id === session.client_id);
  if (!sc?.name) return false;
  return scheduleNamesReferToSameClient(cellName, sc.name, clients);
}

/** Match "Khalid" / "Khalid Ibrahim" / full client name on a schedule cell. */
export function scheduleNamesReferToSameClient(cellName, clientName, clients = []) {
  const cellNorm = normScheduleName(cellName || "");
  const clientNorm = normScheduleName(clientName || "");
  const cellTokens = cellNorm.split(/\s+/).filter(Boolean);
  const clientTokens = clientNorm.split(/\s+/).filter(Boolean);
  if (!cellTokens.length || !clientTokens.length) return false;
  if (cellTokens[0] !== clientTokens[0]) return false;
  if (cellTokens.length === 1) return true;
  if (clientNorm.startsWith(cellNorm) || cellNorm.startsWith(clientNorm)) return true;
  if (cellTokens.slice(1).every((t) => clientTokens.includes(t))) return true;
  const sameFirst = (clients || []).filter((c) => {
    const first = normScheduleName(c.name || "").split(/\s+/)[0];
    return first && first === cellTokens[0];
  });
  if (sameFirst.length === 1 && sameFirst[0].name === clientName) return true;
  return false;
}

function findCompletedSessionForCell(
  sessions, cell, therapistId, sessionDate, client, clients = [], suppressionLookup = null, idAliases = null,
) {
  if (!sessions?.length || !cell) return null;
  const cid = client?.id;
  if (cid && suppressionLookup?.has(`suppress:${therapistId}|${cid}|${sessionDate}`)) return null;
  if (cell?.id && suppressionLookup?.has(`suppress:cell:${cell.id}`)) return null;

  const childName = scheduleCellChildName(cell);
  const candidates = (sessions || []).filter((s) => {
    if ((s.session_date || "").slice(0, 10) !== sessionDate) return false;
    if (!LOGGED_PREP_STATUSES.has(s.status)) return false;
    return sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases);
  });
  if (!candidates.length) return null;

  if (client?.id) {
    const byClient = candidates.find((s) => s.client_id === client.id);
    if (byClient) return byClient;
  }
  if (!childName) return null;
  const byName = candidates.filter((s) => sessionClientMatchesCellName(s, childName, clients));
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    const onRow = byName.filter((s) => sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases));
    if (onRow.length === 1) return onRow[0];
  }
  return null;
}

function findNoShowSessionForCell(
  sessions, cell, therapistId, sessionDate, client, clients = [], suppressionLookup = null, idAliases = null,
) {
  if (!sessions?.length || !cell) return null;
  const cid = client?.id;
  if (cid && suppressionLookup?.has(`suppress:${therapistId}|${cid}|${sessionDate}`)) return null;
  if (cell?.id && suppressionLookup?.has(`suppress:cell:${cell.id}`)) return null;

  const childName = scheduleCellChildName(cell);
  const candidates = (sessions || []).filter((s) => {
    if ((s.session_date || "").slice(0, 10) !== sessionDate) return false;
    return NO_ATTENDANCE_SESSION_STATUSES.has(s.status);
  });
  if (!candidates.length) return null;

  if (client?.id) {
    const byClient = candidates.find((s) => s.client_id === client.id);
    if (byClient) return byClient;
  }

  if (!childName) return null;

  const byName = candidates.filter((s) => sessionClientMatchesCellName(s, childName, clients));
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    const onRow = byName.filter((s) => sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases));
    if (onRow.length === 1) return onRow[0];
    if (onRow.length > 1) return onRow[0];
  }

  const bf = normScheduleName(childName).split(/\s+/)[0];
  if (!bf || bf.length < 3) return null;
  const byFirst = candidates.filter((s) => {
    const sc = clients.find((c) => c.id === s.client_id);
    if (!sc) return false;
    const cf = normScheduleName(sc.name || "").split(/\s+/)[0];
    return cf && cf === bf;
  });
  if (byFirst.length === 1) return byFirst[0];
  if (byFirst.length > 1) {
    const onRow = byFirst.filter((s) => sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases));
    if (onRow.length === 1) return onRow[0];
  }
  return null;
}

function prepRecordIsNoShow(rec) {
  const t = (rec?.marker_type || rec?.source || "").toLowerCase();
  return t === "no_show";
}

function findSessionForCell(sessions, cell, therapistId, sessionDate, client, clients = [], suppressionLookup = null, idAliases = null) {
  if (!sessions?.length) return null;
  const cid = client?.id;
  if (cid && suppressionLookup?.has(`suppress:${therapistId}|${cid}|${sessionDate}`)) return null;
  if (cell?.id && suppressionLookup?.has(`suppress:cell:${cell.id}`)) return null;

  const tryMatch = (s) => {
    if ((s.session_date || "").slice(0, 10) !== sessionDate) return false;
    if (!sessionIncludesTherapist(s.therapist_ids, therapistId, idAliases)) return false;
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
const NO_ATTENDANCE_SESSION_STATUSES = new Set(["No Show", "Cancelled"]);

function isCellPreparedMark(
  prepLookup,
  cell,
  therapistId,
  day,
  weekStart,
  clients,
  preparations = [],
  idAliases = null,
  weekSessions = [],
) {
  if (!cell || !isScheduleClientLogCell(cell)) return false;
  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  // Explicit prep marks (from prep-history / preparations API)
  if (cell.id && prepLookup?.has(`cell:${cell.id}`)) return true;
  const nameKeys = prepKeysForCell(cell, therapistId, day, weekStart, client?.id, client?.name || childName, idAliases);
  if (nameKeys.some((k) => prepLookup?.has(k))) return true;
  for (const rec of preparations || []) {
    if (prepRecordCoversCell(
      rec, cell, therapistId, sessionDate, childName, client, idAliases, preparations, weekSessions,
    )) return true;
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
  idAliases = null,
) {
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

  for (const rec of preparations || []) {
    if (!prepRecordIsNoShow(rec)) continue;
    if (prepRecordMatchesCell(rec, cell, therapistId, sessionDate, childName, client, idAliases)) {
      return "no_show";
    }
  }

  const noShowSession = findNoShowSessionForCell(
    weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup, idAliases,
  );
  if (noShowSession) return "no_show";

  if (cell.state === "cancel_child") {
    const completed = findCompletedSessionForCell(
      weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup, idAliases,
    );
    if (!completed) return "no_show";
  }

  if (isCellPrepComplete(
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
  if (!cell) return false;
  if (!isScheduleClientLogCell(cell)) return false;

  const sessionDate = toISODate(addDays(new Date(weekStart + "T12:00:00"), day));
  const childName = scheduleCellChildName(cell);
  const client = childName ? findClientForScheduleCell(childName, clients) : null;

  if (isPrepSuppressed(suppressionLookup, therapistId, sessionDate, client?.id, cell)) {
    return false;
  }

  const noShow = findNoShowSessionForCell(
    weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup, idAliases,
  );
  if (noShow) return false;

  if (cell.state === "cancel_child") return false;

  if (cell.id && prepLookup.has(`cell:${cell.id}`)) return true;

  const nameKeys = prepKeysForCell(cell, therapistId, day, weekStart, client?.id, client?.name || childName, idAliases);
  if (nameKeys.some((k) => prepLookup.has(k))) return true;

  if (client) {
    if (sessionMatchesCell(weekSessions, cell, therapistId, sessionDate, client, clients, suppressionLookup, idAliases)) return true;
  } else if (sessionMatchesCell(weekSessions, cell, therapistId, sessionDate, null, clients, suppressionLookup, idAliases)) {
    return true;
  }

  for (const rec of preparations || []) {
    if (prepRecordCoversCell(
      rec, cell, therapistId, sessionDate, childName, client, idAliases, preparations, weekSessions,
    )) return true;
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
