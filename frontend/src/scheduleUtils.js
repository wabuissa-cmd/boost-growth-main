import { getChildColor } from "./childColors";
import { TIME_SLOTS, startOfWeek, addDays, toISODate } from "./api";
import { MAX_SCHEDULE_MERGE_SLOTS } from "./scheduleConstants";

const COMPLETED_SESSION = "Completed";

/** Most recent N calendar dates (≤ today) with completed sessions. */
export function recentCompletedSessionDates(sessions, limit = 3, asOf = new Date()) {
  const today = toISODate(asOf);
  const dates = new Set();
  for (const s of sessions || []) {
    if (s.status !== COMPLETED_SESSION) continue;
    const d = (s.session_date || "").slice(0, 10);
    if (d && d <= today) dates.add(d);
  }
  return [...dates].sort().reverse().slice(0, limit);
}

/** Map ISO dates to day indices (0=Sun … 4=Thu) within a displayed week. */
export function dayIndicesForDates(weekStart, dateISOs) {
  const want = new Set(dateISOs || []);
  const out = new Set();
  for (let d = 0; d < 5; d++) {
    if (want.has(toISODate(addDays(weekStart, d)))) out.add(d);
  }
  return out;
}

/** Sunday week_start for any ISO date. */
export function weekStartISOForDate(dateISO) {
  return toISODate(startOfWeek(new Date(`${dateISO}T12:00:00`)));
}

/** Normalize schedule day index (API may return number or string). */
export function scheduleSlotDay(day) {
  const n = Number(day);
  return Number.isFinite(n) ? n : day;
}

/** Stable lookup key for therapist + day + time slot. */
export function scheduleCellSlotKey(therapistId, day, timeSlot) {
  return `${therapistId}_${scheduleSlotDay(day)}_${(timeSlot || "").trim()}`;
}

/** Slots covered horizontally (supports 1.5h, 2.5h, …). */
export function durationSlotSpan(dur) {
  const d = parseFloat(dur) || 1;
  return Math.max(1, Math.ceil(d));
}

/** Meta blocks (Leave, Meeting, …) — full-day Leave uses duration ≥ slot count; Permission uses hourly slots. */
export function scheduleDisplaySpan(cell) {
  if (!cell) return 1;
  const code = cell.service_code;
  if (code === "LEAVE") {
    const dur = parseFloat(cell.duration) || 1;
    if (dur >= TIME_SLOTS.length) return TIME_SLOTS.length;
    return durationSlotSpan(dur);
  }
  if (code === "AVAILABLE") return 1;
  return durationSlotSpan(cell.duration);
}

/** Slot keys hidden because another cell spans over them. */
export function scheduleCoveredSlotKeys(cell) {
  if (!cell) return [];
  const startIdx = TIME_SLOTS.indexOf((cell.time_slot || "").trim());
  if (startIdx < 0) return [];
  const span = scheduleDisplaySpan(cell);
  const keys = [];
  for (let k = 1; k < span; k++) {
    const idx = startIdx + k;
    if (idx < TIME_SLOTS.length) {
      keys.push(scheduleCellSlotKey(cell.therapist_id, cell.day, TIME_SLOTS[idx]));
    }
  }
  return keys;
}

/** Session types that share one calm cell background (not per-child rainbow). */
export const CLIENT_SESSION_CODES = new Set(["SS", "HS", "OS"]);

/** Neutral session cell background — time-only grid (no shift bands). */
const SESSION_CELL_STYLE = { background: "#F5F7F2", borderColor: "#D8E0D0", color: "#2C3625" };

/** Legacy shift band styles — kept for imports; all map to neutral session tint. */
export const SHIFT_SESSION_STYLES = {
  1: { background: "#E8F2E4", borderColor: "#C5D8BC", color: "#2C3625" },
  2: { background: "#C5D8BC", borderColor: "#A8C49A", color: "#2C3625" },
  3: { background: "#A8B89A", borderColor: "#8A9A7A", color: "#2C3625" },
};

/** @deprecated Shift band headers removed from UI — kept for compatibility. */
export const SHIFT_BANDS = [];

/** Legend colors — must match .evt-* in index.css */
export const SERVICE_CELL_COLORS = {
  // Sessions (SS/HS/OS): shift 1 default; grid uses SHIFT_SESSION_STYLES by time_slot.
  SS: { ...SESSION_CELL_STYLE },
  HS: { ...SESSION_CELL_STYLE },
  OS: { ...SESSION_CELL_STYLE },
  MEETING: { background: "#F1ECF7", borderColor: "#C9B8DE", color: "#4E3F70" },
  // Supervision: warm brown-beige — harmonizes with shift olive tints.
  SUPERVISION: { background: "#D8CFC0", borderColor: "#A89880", color: "#5C4A35" },
  OBSERVATION: { background: "#F4EDE3", borderColor: "#D5BFA0", color: "#6B5430" },
  AVC: { background: "#FFEAE0", borderColor: "#F0B89F", color: "#7A4123" },
  LEAVE: { background: "#D6E8F0", borderColor: "#8BB8CC", color: "#2D5068" },
  BREAK: { background: "#F5F5DC", borderColor: "#C9C09A", color: "#6B6038" },
};

export const META_SERVICE_CODES = new Set([
  "LEAVE", "BREAK", "AVC", "MEETING", "SUPERVISION", "OBSERVATION",
]);

export const MERGE_QUICK = [
  { id: "LEAVE", label: "Leave" },
  { id: "AVC", label: "AVC" },
  { id: "MEETING", label: "Meeting" },
  { id: "SUPERVISION", label: "Supervision" },
  { id: "AVAILABLE", label: "Available" },
];

export const SCHEDULE_COLOR_SWATCHES = [
  "#D6E8F0", "#D5A6BD", "#FCE5CD", "#D9D2E9", "#B4A7D6", "#EA9999",
  "#A2C4C9", "#F4CCCC", "#D0E0E3", "#FFF2CC", "#FFE599", "#B6D7A8",
  "#6FA8DC", "#E6B8AF", "#F9CB9C", "#CFE2F3",
];

export function normalizeServiceCode(raw) {
  return (raw || "").trim().toUpperCase();
}

export const SCHEDULE_CANCEL_STATES = new Set(["cancel_therapist", "cancel_child"]);

export function isScheduleCancelState(state) {
  return SCHEDULE_CANCEL_STATES.has(state);
}

/** True when a cell represents a client session (HS/SS/OS or named child). */
export function isScheduleSessionCell(cell) {
  if (!cell) return false;
  if (CLIENT_SESSION_CODES.has(normalizeServiceCode(cell.service_code))) return true;
  return !!scheduleCellChildName(cell);
}

function parseTimeSlotHour(timeSlot) {
  const s = (timeSlot || "").trim();
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ampm = (m[3] || "").toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return Number.isFinite(h) ? h : null;
}

/** Morning / afternoon / evening bands from slot start hour (8–12, 12–16, 16+). */
export function shiftForTimeSlot(timeSlot) {
  const h = parseTimeSlotHour(timeSlot);
  if (h === null) return 1;
  if (h < 12) return 1;
  if (h < 16) return 2;
  return 3;
}

export function shiftSessionStyle(timeSlot) {
  const sh = shiftForTimeSlot(timeSlot);
  return SHIFT_SESSION_STYLES[sh] || SHIFT_SESSION_STYLES[1];
}

/** Time-column header — uniform (no shift band dividers). */
export function shiftTimeHeaderStyle(_timeSlot, _slotIndex = -1) {
  return SESSION_CELL_STYLE;
}

/** Subtle per-child accent (beige/olive palette only) — not stored client rainbow colors. */
export function resolveClientScheduleColor(childName, _clients = [], timeSlot = null) {
  if (!childName) return null;
  return getChildColor(childName.trim(), shiftForTimeSlot(timeSlot));
}

function clientSessionBaseStyle(_serviceCode, timeSlot) {
  return { ...shiftSessionStyle(timeSlot) };
}

function childSessionAccentStyle(childName, timeSlot) {
  const accent = getChildColor(childName, shiftForTimeSlot(timeSlot));
  if (!accent) return {};
  return { borderLeft: `3px solid ${accent}` };
}

export function getCellStyle(cell, clients = []) {
  if (!cell) return {};
  if (cell.state === "available" || cell.service_code === "AVAILABLE") {
    return { background: "#FFFFFF", color: "#5C6853", borderColor: "#DDD8D0" };
  }
  if (cell.state === "cancel_therapist") {
    return { background: "#FFF4C4", color: "#6B5218", borderColor: "#E8C572" };
  }
  if (cell.state === "cancel_child") {
    return { background: "#FCE0E8", color: "#8B3A55", borderColor: "#E8A4BD" };
  }
  const code = normalizeServiceCode(cell.service_code);
  const timeSlot = (cell.time_slot || "").trim();
  if (code === "LEAVE" && SERVICE_CELL_COLORS.LEAVE) {
    return { ...SERVICE_CELL_COLORS.LEAVE };
  }
  if (META_SERVICE_CODES.has(code)) {
    const s = SERVICE_CELL_COLORS[code];
    if (s) return { ...s };
  }
  // SS/HS/OS always use shift tint below — do not pin to shift 1 via SERVICE_CELL_COLORS.
  const childName = scheduleCellChildName(cell);
  if (!CLIENT_SESSION_CODES.has(code) && !childName && code && SERVICE_CELL_COLORS[code]) {
    const s = SERVICE_CELL_COLORS[code];
    if (s) return { ...s };
  }

  const isClientSession = isScheduleSessionCell(cell);
  if (isClientSession && !META_SERVICE_CODES.has(code)) {
    const base = clientSessionBaseStyle(code, timeSlot);
    if (childName) {
      return { ...base, ...childSessionAccentStyle(childName, timeSlot) };
    }
    return base;
  }

  // Legacy DB rainbow fills — ignore; use shift band for any timed non-meta cell.
  if (timeSlot && code !== "AVAILABLE") {
    return { ...shiftSessionStyle(timeSlot) };
  }
  if (code && SERVICE_CELL_COLORS[code]) {
    return { ...SERVICE_CELL_COLORS[code] };
  }
  return {};
}

export function slotIndex(timeSlot, timeSlots) {
  return timeSlots.indexOf(timeSlot);
}

export function buildSlotRange(startSlot, endSlot, timeSlots) {
  const a = slotIndex(startSlot, timeSlots);
  const b = slotIndex(endSlot, timeSlots);
  if (a < 0 || b < 0) return [];
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return timeSlots.slice(lo, hi + 1);
}

/** Cap horizontal slot selection count when merging cells. */
export function clampMergeSlotCount(count) {
  const n = parseInt(count, 10) || 1;
  return Math.max(1, Math.min(n, MAX_SCHEDULE_MERGE_SLOTS));
}

/** Cap session duration (hours) to the max merge span. */
export function clampMergeDuration(dur) {
  const d = parseFloat(dur) || 1;
  return Math.max(0.5, Math.min(d, MAX_SCHEDULE_MERGE_SLOTS));
}

export function isSlotSelectable(therapistId, day, timeSlot, cellMap, coveredSet) {
  const key = scheduleCellSlotKey(therapistId, day, timeSlot);
  if (coveredSet.has(key)) return false;
  if (cellMap[key]) return false;
  return true;
}

/** Find cell occupying a slot (including merged span). */
/** Therapists excluded from schedule grid (still in admin/clients). */
export const SCHEDULE_HIDDEN_NAME_TOKENS = ["jenan", "walaa", "bodoor", "bodour", "diora", "asma"];

export function isHiddenFromSchedule(therapistOrName) {
  const t = typeof therapistOrName === "object" && therapistOrName !== null ? therapistOrName : null;
  if (t?.show_on_schedule === true) return false;
  if (t?.show_on_schedule === false) return true;
  const name = t ? (t.name || "") : String(therapistOrName || "");
  const n = name.toLowerCase();
  return SCHEDULE_HIDDEN_NAME_TOKENS.some(tok => n.includes(tok));
}

function therapistFirstName(name) {
  return (name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase() || "";
}

/** Map logged-in user to their therapist record (id may differ for client-lead admin logins). */
export function resolveSelfTherapist(user, therapists = []) {
  if (!user || !therapists.length) return null;
  const byId = therapists.find(t => t.id === user.id);
  if (byId) return byId;
  const email = (user.email || "").toLowerCase().trim();
  if (email) {
    const byEmail = therapists.find(t => (t.email || "").toLowerCase().trim() === email);
    if (byEmail) return byEmail;
  }
  const key = (user.key || "").toLowerCase();
  if (key) {
    const byKey = therapists.find(t => (t.key || "").toLowerCase() === key);
    if (byKey) return byKey;
  }
  const first = therapistFirstName(user.name);
  if (first) {
    const byName = therapists.find(t => therapistFirstName(t.name) === first);
    if (byName) return byName;
  }
  return null;
}

export function normScheduleName(s) {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

const SCHEDULE_CHILD_NAME_ALIASES = {
  abdularahman: "abdulrahman",
  aljouhrah: "aljoharah",
  ameerah: "ameirah",
  mohmmed: "mohammed",
  alaqeel: "alaqel",
};

function applyScheduleChildNameAliases(name) {
  const raw = (name || "").trim();
  if (!raw) return raw;
  const parts = raw.split(/\s+/);
  const first = parts[0].toLowerCase();
  if (SCHEDULE_CHILD_NAME_ALIASES[first]) {
    const fixed = SCHEDULE_CHILD_NAME_ALIASES[first];
    parts[0] = /^[A-Z]/.test(parts[0]) ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
    return parts.join(" ");
  }
  return raw;
}

const SCHEDULE_SHORT_LABEL_FILES = {
  "abdulaziz a": "024",
  "abdulaziz w": "040",
  "khalid": "072",
  "khalid ibrahim": "072",
  "mohammed alaqeel": "027",
  "mohammed alaqel": "027",
  "mohmmed alaqel": "027",
};

function lookupClientByLabel(label, clients = []) {
  const name = (label || "").trim();
  if (!name || !clients.length) return null;

  const shortKey = normScheduleName(name);
  if (SCHEDULE_SHORT_LABEL_FILES[shortKey]) {
    const fn = SCHEDULE_SHORT_LABEL_FILES[shortKey].padStart(3, "0");
    const byFile = clients.find(c => String(c.file_no || "").padStart(3, "0") === fn);
    if (byFile) return byFile;
  }

  let client = clients.find(c => (c.name || "").trim() === name);
  if (client) return client;

  const nameNorm = normScheduleName(name);
  client = clients.find(c => normScheduleName(c.name) === nameNorm);
  if (client) return client;

  const fileLead = name.match(/^(\d{2,3})\b/);
  if (fileLead) {
    const fn = fileLead[1].padStart(3, "0");
    client = clients.find(c => String(c.file_no || "").padStart(3, "0") === fn);
    if (client) return client;
  }
  const fileParen = name.match(/\((\d{2,3})\)/);
  if (fileParen) {
    const fn = fileParen[1].padStart(3, "0");
    client = clients.find(c => String(c.file_no || "").padStart(3, "0") === fn);
    if (client) return client;
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRe = new RegExp(`^${escaped}($|\\s)`, "i");
  client = clients.find(c => prefixRe.test((c.name || "").trim()));
  if (client) return client;

  for (const c of clients) {
    const cn = (c.name || "").trim();
    if (cn && (name === cn || name.startsWith(cn + " "))) return c;
  }

  const scheduleFirst = name.split(/\s+/)[0];
  if (scheduleFirst.length >= 3) {
    const firstLower = scheduleFirst.toLowerCase();
    const byFirst = clients.filter(c => {
      const cn = (c.name || "").trim();
      return cn && cn.split(/\s+/)[0]?.toLowerCase() === firstLower;
    });
    if (byFirst.length === 1) return byFirst[0];
    const withPhone = byFirst.filter(c => c.parent_phone || c.phone);
    if (withPhone.length === 1) return withPhone[0];
  }

  return null;
}

/** Match schedule cell child_name to a client (mirrors backend _find_client_by_schedule_child_name). */
export function findClientForScheduleCell(childName, clients = []) {
  const name = (childName || "").trim();
  if (!name || !clients.length) return null;

  let client = lookupClientByLabel(name, clients);
  if (client) return client;

  const aliased = applyScheduleChildNameAliases(name);
  if (aliased !== name) {
    client = lookupClientByLabel(aliased, clients);
    if (client) return client;
  }

  return null;
}

/** Parse child label from schedule cell note (mirrors grid display when note is set). */
export function parseChildNameFromScheduleNote(cell) {
  if (!cell) return null;
  const note = (cell.note || "").trim();
  if (!note) return null;
  if (META_SERVICE_CODES.has(cell.service_code)) return null;

  if (note.includes("|")) {
    const part = note.split("|").slice(1).join("|").trim();
    if (part) return part.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
  }

  const upper = note.toUpperCase();
  for (const prefix of ["HS", "SS", "OS"]) {
    if (upper.startsWith(prefix)) {
      const rest = note.slice(prefix.length).replace(/^[\s\-|:]+/, "").trim();
      if (rest) return rest.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
    }
  }

  if (!META_SERVICE_CODES.has(cell.service_code)) {
    return note.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
  }
  return null;
}

/** Split dual-child labels ("Lulu / Abdulrahman") into individual names. */
export function splitScheduleCellChildNames(label) {
  const s = (label || "").trim();
  if (!s) return [];
  if (!s.includes("/")) return [s];
  return s.split("/").map((p) => p.trim()).filter(Boolean);
}

/**
 * Effective child name for prep/logging — must match scheduleCellDisplayLabel priority
 * (note before child_name) so therapists prepare the child they see on the grid.
 */
export function scheduleCellChildName(cell) {
  if (!cell) return null;
  return parseChildNameFromScheduleNote(cell) || (cell.child_name || "").trim() || null;
}

/** Resolve which client a schedule cell refers to; flags dual-child ambiguity. */
export function resolveScheduleCellClient(cell, clients = []) {
  const childName = scheduleCellChildName(cell);
  if (!childName) return { client: null, childName: null, ambiguous: false, options: [] };

  const parts = splitScheduleCellChildNames(childName);
  if (parts.length === 1) {
    return {
      client: findClientForScheduleCell(parts[0], clients),
      childName: parts[0],
      ambiguous: false,
      options: parts,
    };
  }

  const matched = parts.map((p) => findClientForScheduleCell(p, clients)).filter(Boolean);
  const uniqueById = new Map(matched.map((c) => [c.id, c]));
  if (uniqueById.size === 1) {
    const client = [...uniqueById.values()][0];
    const part = parts.find((p) => {
      const c = findClientForScheduleCell(p, clients);
      return c?.id === client.id;
    });
    return { client, childName: part || parts[0], ambiguous: false, options: parts };
  }
  if (uniqueById.size > 1) {
    return { client: null, childName, ambiguous: true, options: parts };
  }
  return {
    client: findClientForScheduleCell(childName, clients),
    childName,
    ambiguous: false,
    options: parts,
  };
}

export function buildDefaultCellNote(serviceCode, childName) {
  const name = (childName || "").trim();
  if (!name) return "";
  const code = (serviceCode || "HS").trim();
  if (code === "HS" || code === "SS" || code === "OS") return `${code} | ${name}`;
  return name;
}

/** True when changing client should refresh the grid label automatically. */
export function shouldAutoUpdateCellNote(note, previousChildName, serviceCode) {
  const n = (note || "").trim();
  if (!n) return true;
  if (previousChildName) {
    const prevDefault = buildDefaultCellNote(serviceCode, previousChildName);
    if (n === prevDefault) return true;
  }
  return /^(HS|SS|OS)\s*\|\s*.+$/i.test(n);
}

/** True when a schedule cell represents a client session that can be logged. */
export function isScheduleClientLogCell(cell) {
  if (!cell) return false;
  if (cell.state === "available" || cell.service_code === "AVAILABLE") return false;
  if (META_SERVICE_CODES.has(cell.service_code)) return false;
  return !!scheduleCellChildName(cell);
}

/** Therapists cannot log/prepare on therapist-cancelled cells (admins still edit normally). */
export function canTherapistLogScheduleCell(cell) {
  if (!isScheduleClientLogCell(cell)) return false;
  if (cell.state === "cancel_therapist") return false;
  return true;
}

/** @deprecated use canTherapistLogScheduleCell */
export const canSpecialistLogScheduleCell = canTherapistLogScheduleCell;

/** Strip duplicated surname tokens (e.g. "Ahmed Al-Saud Al-Saud" → "Ahmed Al-Saud"). */
export function dedupeScheduleDisplayName(text) {
  const s = (text || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  const parts = s.split(" ");
  while (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()) {
    parts.pop();
  }
  const half = Math.floor(parts.length / 2);
  if (parts.length >= 4 && parts.length % 2 === 0) {
    const a = parts.slice(0, half).join(" ").toLowerCase();
    const b = parts.slice(half).join(" ").toLowerCase();
    if (a === b) return parts.slice(0, half).join(" ");
  }
  return parts.join(" ");
}

/** Show session window on merged cells (e.g. 1:00–3:00 PM for a 2h block). */
export function scheduleCellTimeRangeLabel(cell) {
  if (!cell) return null;
  if (cell.custom_time?.trim()) return cell.custom_time.trim();
  const dur = parseFloat(cell.duration) || 1;
  if (dur <= 1) return null;
  const anchor = (cell.time_slot || "").trim();
  const idx = slotIndex(anchor, TIME_SLOTS);
  if (idx < 0) return null;
  const start = anchor.split(" - ")[0]?.trim();
  const endIdx = Math.min(idx + Math.max(1, Math.ceil(dur)) - 1, TIME_SLOTS.length - 1);
  const end = TIME_SLOTS[endIdx]?.split(" - ")[1]?.trim();
  if (!start || !end) return null;
  return `${start} – ${end}`;
}

/** Primary label shown inside a schedule grid cell (preserves full Excel text when stored in note). */
export function scheduleCellDisplayLabel(cell, serviceShort) {
  if (!cell) return "";
  const formatDualNames = (raw) => {
    const s = (raw || "").trim();
    if (!s) return s;
    // Keep both names visible when the cell contains two children (e.g. "A / B" or "A/B").
    if (s.includes("/")) {
      const parts = s.split("/").map(p => dedupeScheduleDisplayName(p.trim())).filter(Boolean);
      return parts.join(" / ");
    }
    return dedupeScheduleDisplayName(s);
  };
  if (cell.note?.trim()) {
    const note = cell.note.trim();
    if (note.includes("|")) {
      const [head, ...rest] = note.split("|");
      const namePart = formatDualNames(rest.join("|").trim());
      return namePart ? `${head.trim()} | ${namePart}` : head.trim();
    }
    return formatDualNames(note);
  }
  const short = serviceShort || cell.service_code || "";
  if (cell.child_name?.trim()) {
    return `${short} | ${formatDualNames(cell.child_name.trim())}`;
  }
  return short;
}

/** Build API payload for PUT/POST /schedule from an existing cell row. */
export function buildScheduleCellPayload(cell, weekStartISO, overrides = {}) {
  return {
    therapist_id: cell.therapist_id,
    day: cell.day,
    time_slot: cell.time_slot,
    service_code: cell.service_code || "SS",
    child_name: cell.child_name || null,
    note: cell.note || null,
    cover_child_name: cell.cover_child_name || null,
    custom_time: cell.custom_time || null,
    state: cell.state || "normal",
    color: isScheduleSessionCell(cell) ? null : (cell.color || null),
    duration: cell.duration || 1,
    week_start: weekStartISO,
    ...overrides,
  };
}

export function findCellAt(therapistId, day, timeSlot, cellMap, cells) {
  const normDay = scheduleSlotDay(day);
  const slot = (timeSlot || "").trim();
  const key = scheduleCellSlotKey(therapistId, normDay, slot);
  if (cellMap[key]) return cellMap[key];
  const idx = slotIndex(slot, TIME_SLOTS);
  if (idx < 0) return null;
  return cells.find(c => {
    if (c.therapist_id !== therapistId || scheduleSlotDay(c.day) !== normDay) return false;
    const start = slotIndex((c.time_slot || "").trim(), TIME_SLOTS);
    if (start < 0) return false;
    const dur = parseFloat(c.duration) || 1;
    return start <= idx && start + dur > idx;
  }) || null;
}
