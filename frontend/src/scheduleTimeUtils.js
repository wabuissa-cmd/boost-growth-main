/** Parse schedule slot labels and cell metadata into 24h HH:MM session times. */

export function slotToTime24(slot) {
  if (!slot) return null;
  const m = String(slot).match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export function addHoursToTime(time24, hours) {
  if (!time24) return null;
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function minutesToTime24(totalMinutes) {
  const wrapped = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHmToMinutes(hm, refAmpm = "AM") {
  const raw = String(hm || "").trim().toUpperCase();
  if (!raw) return null;
  let m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h > 12) return h * 60 + mi;
    const ap = (m[3] || refAmpm).toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + mi;
  }
  m = raw.match(/^(\d{1,2})\s*(AM|PM)?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const ap = (m[2] || refAmpm).toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60;
  }
  return null;
}

function slotEndRefAmpm(timeSlot) {
  const parts = String(timeSlot || "").split(" - ");
  const endPart = (parts[1] || parts[0] || "").toUpperCase();
  return endPart.includes("PM") ? "PM" : "AM";
}

function parseCustomTimeRange(custom, anchorSlot) {
  const txt = String(custom || "").trim();
  if (!txt) return null;
  const m = txt.match(/(\d{1,2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}(?::\d{2})?)/);
  if (!m) return null;
  const ref = slotEndRefAmpm(anchorSlot);
  const startM = parseHmToMinutes(m[1], ref === "PM" ? "AM" : ref);
  let endM = parseHmToMinutes(m[2], "PM");
  if (startM == null || endM == null) return null;
  if (endM <= startM) endM += 12 * 60;
  return {
    start_time: minutesToTime24(startM),
    end_time: minutesToTime24(endM),
  };
}

/** Time range embedded in schedule note, e.g. "HS | Abdulaziz A (3:30-5:30)". */
export function parseTimeRangeFromScheduleNote(note, anchorSlot = "") {
  const txt = String(note || "").trim();
  if (!txt) return null;
  const paren = txt.match(/\(([^()]*\d{1,2}(?::\d{2})?\s*[-–]\s*\d{1,2}(?::\d{2})?[^()]*)\)\s*$/);
  if (!paren) return null;
  return parseCustomTimeRange(paren[1], anchorSlot);
}

/** Derive session start/end from a schedule cell (grid slot + duration or custom_time). */
export function scheduleCellSessionTimes(cell, clickedTimeSlot) {
  const anchorSlot = (cell?.time_slot || clickedTimeSlot || "").trim();
  const noteRange = parseTimeRangeFromScheduleNote(cell?.note, anchorSlot);
  if (noteRange?.start_time && noteRange?.end_time) {
    return {
      start_time: noteRange.start_time,
      end_time: noteRange.end_time,
      slot_start: noteRange.start_time,
      slot_end: noteRange.end_time,
    };
  }
  const customRange = parseCustomTimeRange(cell?.custom_time, anchorSlot);
  if (customRange?.start_time && customRange?.end_time) {
    return {
      start_time: customRange.start_time,
      end_time: customRange.end_time,
      slot_start: customRange.start_time,
      slot_end: customRange.end_time,
    };
  }
  const start = slotToTime24(anchorSlot || clickedTimeSlot) || "09:00";
  const dur = parseFloat(cell?.duration) || 1;
  const end = addHoursToTime(start, dur) || addHoursToTime(start, 1);
  return { start_time: start, end_time: end, slot_start: start, slot_end: end };
}

export function resolveLogSessionTimes({ session, prefill, scheduleContext }) {
  if (session?.start_time && session?.end_time) {
    return { start_time: session.start_time, end_time: session.end_time };
  }
  const start = prefill?.start_time
    || scheduleContext?.slot_start
    || scheduleContext?.start_time
    || null;
  const end = prefill?.end_time
    || scheduleContext?.slot_end
    || scheduleContext?.end_time
    || null;
  if (start && end) return { start_time: start, end_time: end };
  return { start_time: start || "09:00", end_time: end || "10:00" };
}
