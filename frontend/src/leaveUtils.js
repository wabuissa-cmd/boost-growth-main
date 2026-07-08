/** Leave management helpers — document badges, balance status, filters. */

export const LEAVE_STATUS = {
  pending: { label: "Pending", therapistLabel: "Under Review", color: "#D4A64A", bg: "#FAF0D1", icon: "🟡" },
  pending_manager: { label: "Pending Manager", therapistLabel: "Direct Manager Review", color: "#D4A64A", bg: "#FAF0D1", icon: "🟡" },
  pending_attachment: { label: "Awaiting Attachment", therapistLabel: "Awaiting Attachment", color: "#8A3F27", bg: "#F8EBE7", icon: "📎" },
  pending_hr: { label: "Pending HR", therapistLabel: "HR Review", color: "#C28E6A", bg: "#F5EBE3", icon: "🟠" },
  approved: { label: "Approved", color: "#3D4F35", bg: "#E5EBE1", icon: "🟢" },
  done: { label: "Done", color: "#5C6853", bg: "#EFEAE0", icon: "✓" },
  rejected: { label: "Rejected", color: "#8B3A55", bg: "#FCE0E8", icon: "✗" },
  cancelled: { label: "Cancelled", color: "#8B7B8B", bg: "#EFE8EC", icon: "—" },
  absent: { label: "Absent", color: "#8A3F27", bg: "#F8EBE7", icon: "⚫" },
};

export const LEAVE_TYPES = {
  Annual: { label: "Annual Leave", color: "#7A8A6A" },
  Sickleave: { label: "Sick Leave", color: "#9B7BAB" },
  Unpaid: { label: "Unpaid Leave", color: "#C28E6A" },
  Permission: { label: "Permission", color: "#6BAA9B" },
  Absence: { label: "Absence", color: "#C97B5C" },
  Exam: { label: "Exam", color: "#7B96B5" },
  Emergency: { label: "Emergency", color: "#D49A60" },
};

/** Leave types hidden from new-request UI (legacy DB rows may still use them). */
export const DEPRECATED_LEAVE_TYPES = new Set(["Exam", "Emergency"]);

export const VACATION_LEAVE_TYPES = ["Annual"];

export const LEAVE_TAB_TYPES = ["Sickleave", "Unpaid", "Permission", "Absence"];

export function selectableLeaveTypeEntries(currentType = null) {
  return Object.entries(LEAVE_TYPES).filter(([k]) => {
    if (DEPRECATED_LEAVE_TYPES.has(k)) return k === currentType;
    return true;
  });
}

export const DOC_TYPES = [
  { id: "medical", label: "Medical Report" },
  { id: "appointment", label: "Appointment Report" },
  { id: "other", label: "Other Document" },
];

// Permission (استئذان) attachments are optional (therapists may not have a file).
const DOC_REQUIRED_TYPES = new Set(["Sickleave", "Absence"]);
const PERMISSION_TYPE_ALIASES = new Set([
  "permission",
  "استئذان",
  "استيذان",
  "استذان",
  "اذن",
  "إذن",
  "early leave",
  "earlyleave",
]);

export const ATTACHMENT_REQUIRED_MSG = "Request will NOT be reviewed until file is uploaded.";

/** Canonical leave type key — maps Arabic استئذان / informal aliases to Permission. */
export function canonicalLeaveType(leaveType) {
  const raw = String(leaveType || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (PERMISSION_TYPE_ALIASES.has(lower) || raw.includes("استئذان") || raw.includes("استيذان")) {
    return "Permission";
  }
  if (["sickleave", "sick", "sick leave", "sick-leave"].includes(lower)) return "Sickleave";
  if (lower === "absence") return "Absence";
  if (["annual", "annual leave"].includes(lower)) return "Annual";
  if (["unpaid", "unpaid leave"].includes(lower)) return "Unpaid";
  return raw;
}

export function leavePayCategory(leaveType) {
  return canonicalLeaveType(leaveType) === "Unpaid" ? "Unpaid" : "Paid";
}

/** Permission approved without balance deduction — show in leave list. */
export function permissionPayLabel(leave) {
  if (!leave || canonicalLeaveType(leave.leave_type) !== "Permission") return null;
  if (leave.is_paid === false) return "Unpaid";
  return null;
}

export function leaveStatusLabel(status, forTherapist = false) {
  const st = LEAVE_STATUS[status] || LEAVE_STATUS.pending;
  return forTherapist && st.therapistLabel ? st.therapistLabel : st.label;
}

/** Permission/استئذان never requires a document. */
export function leaveRequiresDocument(leaveType) {
  const canon = canonicalLeaveType(leaveType);
  if (canon === "Permission") return false;
  return DOC_REQUIRED_TYPES.has(canon);
}

export function documentBadge(leave) {
  const required = leaveRequiresDocument(leave.leave_type);
  const hasDoc = !!(leave.document_file_path || leave.document_url);
  if (!required) {
    return { key: "none", label: "No Document Needed", icon: "⚪", color: "#8B9E7A", bg: "#F5F5F5" };
  }
  if (!hasDoc) {
    return { key: "required", label: "Document Required — Not Uploaded", icon: "🔴", color: "#8A3F27", bg: "#F8EBE7" };
  }
  if (!leave.document_verified) {
    return { key: "pending", label: "Document Pending Review", icon: "🟡", color: "#6B5218", bg: "#FAF0D1" };
  }
  return { key: "verified", label: "Document Verified", icon: "🟢", color: "#3D4F35", bg: "#E5EBE1" };
}

export function balanceHealthStatus(remaining, onUnpaidLeave = false) {
  if (onUnpaidLeave || remaining <= 0) return { key: "unpaid", label: "Unpaid", icon: "⚫", color: "#5C6853" };
  if (remaining < 5) return { key: "critical", label: "Critical", icon: "🔴", color: "#8A3F27" };
  if (remaining <= 10) return { key: "low", label: "Low", icon: "🟡", color: "#6B5218" };
  return { key: "healthy", label: "Healthy", icon: "🟢", color: "#3D4F35" };
}

export function diffDays(a, b) {
  if (!a || !b) return 0;
  const A = new Date(`${a}T12:00:00`);
  const B = new Date(`${b}T12:00:00`);
  if (isNaN(A) || isNaN(B)) return 0;
  return Math.max(1, Math.round((B - A) / 86400000) + 1);
}

export function fmtDateRange(start, end) {
  if (!start) return "—";
  const fmt = (iso) => {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
  };
  if (!end || start === end) return fmt(start);
  return `${fmt(start)} → ${fmt(end)}`;
}

/** Parse "HH:MM" to minutes since midnight. */
export function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** Format 24h "14:00" for display. */
export function fmtTime24(t) {
  if (!t) return "";
  const mins = timeToMinutes(t);
  if (mins == null) return t;
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtTimeRange(startTime, endTime) {
  if (!startTime) return "";
  if (!endTime) return fmtTime24(startTime);
  return `${fmtTime24(startTime)} – ${fmtTime24(endTime)}`;
}

export function computePermissionHours(startTime, endTime) {
  const sm = timeToMinutes(startTime);
  const em = timeToMinutes(endTime);
  if (sm == null || em == null) return null;
  let diff = em - sm;
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

/** Work-day fraction for permission (8h day); min 1 hour. */
export function permissionDaysFromTimes(startTime, endTime, startDate, endDate) {
  const spanDays = diffDays(startDate, endDate);
  if (spanDays > 1) return spanDays;
  const hours = computePermissionHours(startTime, endTime);
  if (hours == null) return 1;
  return Math.max(0.125, Math.round((hours / 8) * 1000) / 1000);
}

export function addHoursToTime24(time, hours) {
  const mins = timeToMinutes(time);
  if (mins == null) return time;
  const total = (mins + Math.round(hours * 60)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtLeaveDuration(leave) {
  const days = parseFloat(leave?.days);
  if (!Number.isFinite(days)) return "";
  if (canonicalLeaveType(leave?.leave_type) === "Permission" && days < 1) {
    const hrs = Math.round(days * 8 * 10) / 10;
    return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
  }
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export function fmtLeaveSchedule(leave) {
  const range = fmtDateRange(leave?.start_date, leave?.end_date);
  const dur = fmtLeaveDuration(leave);
  if (canonicalLeaveType(leave?.leave_type) === "Permission" && leave?.start_time) {
    const timePart = fmtTimeRange(leave.start_time, leave.end_time);
    return `${range} · ${timePart}${dur ? ` · ${dur}` : ""}`;
  }
  return `${range}${dur ? ` · ${dur}` : ""}`;
}

export function isPendingLeaveStatus(status) {
  return status === "pending" || status === "pending_manager" || status === "pending_hr" || status === "pending_attachment";
}

export function isManagerReviewableLeave(leave) {
  if (!leave) return false;
  if (leave.status === "pending_attachment") return false;
  if (leaveRequiresDocument(leave.leave_type) && !(leave.document_file_path || leave.document_url)) return false;
  return leave.status === "pending" || leave.status === "pending_manager";
}

export function isActiveLeave(l) {
  const st = l.status;
  if (isPendingLeaveStatus(st)) return true;
  if (st === "approved" || st === "rejected") {
    const decided = l.decided_at || l.created_at || l.end_date;
    if (!decided) return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return new Date(String(decided).slice(0, 10)) >= cutoff;
  }
  return false;
}

export function isHistoryLeave(l) {
  if (isPendingLeaveStatus(l.status)) return false;
  if (["approved", "done", "absent"].includes(l.status)) return true;
  if (l.status === "rejected") return !isActiveLeave(l);
  return ["done", "cancelled", "absent"].includes(l.status);
}

export function isOnLeaveNow(l, todayIso) {
  const t = todayIso || new Date().toISOString().slice(0, 10);
  return ["approved", "done", "absent"].includes(l.status)
    && l.start_date <= t && l.end_date >= t;
}

export function scheduleImpactLabel(leave) {
  const impact = leave.schedule_impact || [];
  if (!impact.length) return leave.status === "absent" ? "No sessions affected" : "—";
  return `${impact.length} session${impact.length !== 1 ? "s" : ""} cancelled`;
}

export function exportLeavesCsv(rows, filename = "leave-history.csv") {
  const headers = ["Therapist", "Type", "Start", "End", "Days", "Status", "Document", "Schedule Impact", "Notes"];
  const lines = [headers.join(",")];
  for (const l of rows) {
    const doc = documentBadge(l);
    lines.push([
      `"${(l.therapist_name || "").replace(/"/g, '""')}"`,
      l.leave_type,
      l.start_date,
      l.end_date,
      l.days,
      l.status,
      `"${doc.label}"`,
      `"${scheduleImpactLabel(l)}"`,
      `"${(l.notes || "").replace(/"/g, '""')}"`,
    ].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
