import { getChildColor, readable } from "./childColors";
import { TIME_SLOTS } from "./api";
import { MAX_SCHEDULE_MERGE_SLOTS } from "./scheduleConstants";

/** Slots covered horizontally (supports 1.5h, 2.5h, …). */
export function durationSlotSpan(dur) {
  const d = parseFloat(dur) || 1;
  return Math.max(1, Math.ceil(d));
}

/** Meta blocks (Leave, Meeting, …) — Leave spans the full day row; others use duration. */
export function scheduleDisplaySpan(cell) {
  if (!cell) return 1;
  const code = cell.service_code;
  if (code === "LEAVE") return TIME_SLOTS.length;
  if (code === "AVAILABLE") return 1;
  return durationSlotSpan(cell.duration);
}

/** Slot keys hidden because another cell spans over them. */
export function scheduleCoveredSlotKeys(cell) {
  if (!cell) return [];
  const startIdx = TIME_SLOTS.indexOf(cell.time_slot);
  if (startIdx < 0) return [];
  const span = scheduleDisplaySpan(cell);
  const keys = [];
  for (let k = 1; k < span; k++) {
    const idx = startIdx + k;
    if (idx < TIME_SLOTS.length) {
      keys.push(`${cell.therapist_id}_${cell.day}_${TIME_SLOTS[idx]}`);
    }
  }
  return keys;
}

function deepenHex(hex, factor = 0.82) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#") || hex.length < 7) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${[r, g, b].map(x => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0")).join("")}`;
}

/** Legend colors — must match .evt-* in index.css */
export const SERVICE_CELL_COLORS = {
  SS: { background: "#E5EBE1", borderColor: "#B4C2A9", color: "#3D4F35" },
  HS: { background: "#EAF0F3", borderColor: "#A4BCCB", color: "#375568" },
  OS: { background: "#FAF0D1", borderColor: "#E6C983", color: "#6B5218" },
  MEETING: { background: "#F1ECF7", borderColor: "#C9B8DE", color: "#4E3F70" },
  SUPERVISION: { background: "#E8F0E8", borderColor: "#A8C0A8", color: "#4A6B4A" },
  OBSERVATION: { background: "#F4EDE3", borderColor: "#D5BFA0", color: "#6B5430" },
  AVC: { background: "#FFEAE0", borderColor: "#F0B89F", color: "#7A4123" },
  LEAVE: { background: "#D9EAD3", borderColor: "#B6D7A8", color: "#3D5C3A" },
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
  "#D9EAD3", "#D5A6BD", "#FCE5CD", "#D9D2E9", "#B4A7D6", "#EA9999",
  "#A2C4C9", "#F4CCCC", "#D0E0E3", "#FFF2CC", "#FFE599", "#B6D7A8",
  "#6FA8DC", "#E6B8AF", "#F9CB9C", "#CFE2F3",
];

export function resolveClientScheduleColor(childName, clients = []) {
  if (!childName) return null;
  const trimmed = childName.trim();
  const client = clients.find(c => c.name === trimmed || trimmed.startsWith(c.name + " "));
  if (client?.schedule_color) return client.schedule_color;
  if (client?.color) return client.color;
  return getChildColor(trimmed);
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
  const code = cell.service_code;
  if (code === "LEAVE" && SERVICE_CELL_COLORS.LEAVE) {
    return { ...SERVICE_CELL_COLORS.LEAVE };
  }
  if (cell.color) {
    return { background: cell.color, borderColor: cell.color, color: readable(cell.color) };
  }
  if (META_SERVICE_CODES.has(code) || (!cell.child_name && code && SERVICE_CELL_COLORS[code])) {
    const s = SERVICE_CELL_COLORS[code];
    if (s) return { ...s };
  }
  if (cell.child_name) {
    const cc = resolveClientScheduleColor(cell.child_name, clients);
    if (cc) {
      const bg = deepenHex(cc, 0.78);
      return { background: bg, borderColor: deepenHex(cc, 0.65), color: readable(bg) };
    }
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
  const key = `${therapistId}_${day}_${timeSlot}`;
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

function normScheduleName(s) {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

const SCHEDULE_CHILD_NAME_ALIASES = {
  abdularahman: "abdulrahman",
  aljouhrah: "aljoharah",
  ameerah: "ameirah",
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

/** Effective child name on a schedule cell (child_name or parsed from note / label text). */
export function scheduleCellChildName(cell) {
  if (!cell) return null;
  const direct = (cell.child_name || "").trim();
  if (direct) return direct;

  const note = (cell.note || "").trim();
  if (!note) return null;
  if (META_SERVICE_CODES.has(cell.service_code)) return null;

  if (note.includes("|")) {
    const part = note.split("|", 1)[1]?.trim();
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

/** True when a schedule cell represents a client session that can be logged. */
export function isScheduleClientLogCell(cell) {
  if (!cell) return false;
  if (cell.state === "available" || cell.service_code === "AVAILABLE") return false;
  if (META_SERVICE_CODES.has(cell.service_code)) return false;
  return !!scheduleCellChildName(cell);
}

/** Primary label shown inside a schedule grid cell (preserves full Excel text when stored in note). */
export function scheduleCellDisplayLabel(cell, serviceShort) {
  if (!cell) return "";
  if (cell.note?.trim()) return cell.note.trim();
  const short = serviceShort || cell.service_code || "";
  if (cell.child_name?.trim()) {
    return `${short} | ${cell.child_name.trim()}`;
  }
  return short;
}

export function findCellAt(therapistId, day, timeSlot, cellMap, cells) {
  const key = `${therapistId}_${day}_${timeSlot}`;
  if (cellMap[key]) return cellMap[key];
  const idx = slotIndex(timeSlot, TIME_SLOTS);
  if (idx < 0) return null;
  return cells.find(c => {
    if (c.therapist_id !== therapistId || c.day !== day) return false;
    const start = slotIndex(c.time_slot, TIME_SLOTS);
    if (start < 0) return false;
    const dur = parseFloat(c.duration) || 1;
    return start <= idx && start + dur > idx;
  }) || null;
}
