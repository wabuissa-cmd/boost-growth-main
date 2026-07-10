import { TIME_SLOTS } from "./api";
import { META_SERVICE_CODES, findClientForScheduleCell } from "./scheduleUtils";

// Kept export name for compatibility with existing imports.
export const DAYS_AR = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const GREETINGS = ["Good evening", "Hello", "Wishing you a great day"];
const SESSION_CODES = new Set(["SS", "HS", "OS"]);

function slotToTime24(slot) {
  if (!slot) return "08:00";
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return "08:00";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function addHoursToTime(time24, hours) {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function formatTimeArabic(time24) {
  const [h, m] = time24.split(":").map(Number);
  const isPM = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const suffix = isPM ? "PM" : "AM";
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("5")) return `966${digits}`;
  if (digits.length >= 9) return digits.startsWith("966") ? digits : `966${digits}`;
  return null;
}

export function buildWhatsAppUrl(phone, text) {
  const num = normalizeWhatsAppPhone(phone);
  if (!num || !text) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

function isParentMessageSession(cell) {
  if (!cell?.child_name?.trim()) return false;
  if (cell.state === "cancel_therapist" || cell.state === "cancel_child") return false;
  const code = cell.service_code;
  if (!code || code === "AVAILABLE") return false;
  if (META_SERVICE_CODES.has(code)) return false;
  return SESSION_CODES.has(code);
}

function isPrimarySessionCell(cell, cells) {
  const idx = TIME_SLOTS.indexOf(cell.time_slot);
  if (idx < 0) return true;
  return !cells.some((other) => {
    if (other === cell || other.id === cell.id) return false;
    if (other.therapist_id !== cell.therapist_id || other.day !== cell.day) return false;
    const start = TIME_SLOTS.indexOf(other.time_slot);
    if (start < 0 || start >= idx) return false;
    const dur = parseFloat(other.duration) || 1;
    return start + Math.ceil(dur) > idx;
  });
}

function sessionTimeLabel(cell, wrapParens = false) {
  if (cell.custom_time?.trim()) {
    const s = cell.custom_time.trim();
    return wrapParens ? `(${s})` : s;
  }
  const start = slotToTime24(cell.time_slot);
  const dur = parseFloat(cell.duration) || 1;
  const end = addHoursToTime(start, dur);
  const s = `${formatTimeArabic(start)} - ${formatTimeArabic(end)}`;
  return wrapParens ? `(${s})` : s;
}

function greetingForClient(clientId) {
  const s = String(clientId || "default");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i)) % GREETINGS.length;
  return GREETINGS[h];
}

function formatScheduleLines(sessions) {
  const byTime = new Map();
  sessions.forEach((s) => {
    if (!byTime.has(s.timeLabel)) byTime.set(s.timeLabel, new Set());
    byTime.get(s.timeLabel).add(s.day);
  });

  const lines = [];
  for (const [timeLabel, daysSet] of byTime) {
    const days = [...daysSet].sort((a, b) => a - b);
    const timePart = `at ${timeLabel}`;

    if (days.length === 5) {
      lines.push(`• Daily ${timePart}`);
    } else if (days.length === 1) {
      lines.push(`• ${DAYS_AR[days[0]]} ${timePart}`);
    } else {
      const dayNames = days.map((d) => DAYS_AR[d]).join(" and ");
      lines.push(`• ${dayNames} ${timePart}`);
    }
  }
  return lines;
}

/** WhatsApp message when a therapist cancels a session. */
export function buildTherapistCancellationMessage(cell, client, weekStart, therapistName) {
  const childName = (cell?.child_name || client?.name || "").trim();
  const childFirstName = childName.split(/\s+/)[0] || childName;
  const dayIdx = cell?.day ?? 0;
  const dayLabel = DAYS_AR[dayIdx] || DAYS_AR[0];
  const timeLabel = sessionTimeLabel(cell);
  return [
    "Hello,",
    "",
    `We apologize — ${childFirstName}'s session has been cancelled today due to an emergency.`,
    `Session time: ${dayLabel} — ${timeLabel}`,
    "",
    "Thank you for your understanding.",
    "",
    "Boost Growth Team",
  ].join("\n");
}

/** Build one WhatsApp-ready message per child with sessions in the week. */
export function buildParentMessages(cells, clients = []) {
  const seen = new Set();
  const byChild = new Map();

  cells.forEach((cell) => {
    if (!isParentMessageSession(cell) || !isPrimarySessionCell(cell, cells)) return;
    const dedupeKey = cell.id || `${cell.therapist_id}_${cell.day}_${cell.time_slot}_${cell.child_name}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const childName = cell.child_name.trim();
    const client = findClientForScheduleCell(childName, clients);
    const mapKey = client?.id || childName.toLowerCase();

    if (!byChild.has(mapKey)) {
      byChild.set(mapKey, {
        childName,
        client,
        parentName: client?.parent_name || null,
        phone: client?.parent_phone || client?.phone || null,
        sessions: [],
      });
    } else {
      const entry = byChild.get(mapKey);
      if (!entry.client && client) {
        entry.client = client;
        entry.parentName = client.parent_name || entry.parentName;
        entry.phone = client.parent_phone || client.phone || entry.phone;
      } else if (entry.client && client && !entry.phone) {
        entry.phone = client.parent_phone || client.phone || entry.phone;
        entry.parentName = entry.parentName || client.parent_name || null;
      }
    }
    byChild.get(mapKey).sessions.push({
      day: cell.day,
      timeLabel: sessionTimeLabel(cell, true),
      serviceCode: cell.service_code,
    });
  });

  const results = [];
  for (const entry of byChild.values()) {
    const firstName = entry.childName.split(/\s+/)[0];
    const scheduleLines = formatScheduleLines(entry.sessions);
    const greeting = greetingForClient(entry.client?.id || entry.childName);
    const message = [
      "Hello,",
      greeting,
      "",
      `Next week's schedule for (${firstName}):`,
      ...scheduleLines,
      "",
      "Boost Growth Team",
    ].join("\n");

    results.push({
      childName: entry.childName,
      parentName: entry.parentName,
      phone: entry.phone,
      message,
      whatsappUrl: buildWhatsAppUrl(entry.phone, message),
      sessionCount: entry.sessions.length,
    });
  }

  return results.sort((a, b) => a.childName.localeCompare(b.childName, "en"));
}
