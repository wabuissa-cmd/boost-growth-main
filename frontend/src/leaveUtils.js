/** Leave management helpers — document badges, balance status, filters. */

export const LEAVE_STATUS = {
  pending: { label: "Pending", color: "#D4A64A", bg: "#FAF0D1", icon: "🟡" },
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

export const DOC_TYPES = [
  { id: "medical", label: "Medical Report (تقرير طبي)" },
  { id: "appointment", label: "Appointment Report (تقرير موعد)" },
  { id: "other", label: "Other" },
];

const DOC_REQUIRED_TYPES = new Set(["Sickleave", "Absence", "Permission"]);

export function leaveRequiresDocument(leaveType) {
  return DOC_REQUIRED_TYPES.has(leaveType);
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

export function isActiveLeave(l) {
  const st = l.status;
  if (st === "pending") return true;
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
  if (l.status === "pending") return false;
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
