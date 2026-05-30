import { getChildColor, readable } from "./childColors";
import { TIME_SLOTS } from "./api";

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
    if (cc) return { background: cc, borderColor: cc, color: readable(cc) };
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

export function isSlotSelectable(therapistId, day, timeSlot, cellMap, coveredSet) {
  const key = `${therapistId}_${day}_${timeSlot}`;
  if (coveredSet.has(key)) return false;
  if (cellMap[key]) return false;
  return true;
}

/** Find cell occupying a slot (including merged span). */
/** Therapists excluded from schedule grid (still in admin/clients). */
export const SCHEDULE_HIDDEN_NAME_TOKENS = ["jenan", "walaa", "bodoor", "bodour", "diora", "asma"];

export function isHiddenFromSchedule(name) {
  const n = (name || "").toLowerCase();
  return SCHEDULE_HIDDEN_NAME_TOKENS.some(t => n.includes(t));
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
    const dur = c.duration || 1;
    return start <= idx && start + dur > idx;
  }) || null;
}
