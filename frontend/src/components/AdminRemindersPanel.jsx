import { Link } from "react-router-dom";
import {
  Bell, ListChecks, Warning, Receipt, CalendarBlank, UsersThree,
  Folder, CheckCircle,
} from "@phosphor-icons/react";

const SEVERITY = {
  urgent: { border: "#E5C387", bg: "#FFFBF3", icon: "#965132" },
  warn: { border: "#E6C983", bg: "#FAF0D1", icon: "#6B5218" },
  info: { border: "#D4DEC8", bg: "#FAFCF8", icon: "#6B8F71" },
};

function ReminderRow({ item }) {
  const s = SEVERITY[item.severity] || SEVERITY.info;
  const Icon = item.icon || Bell;
  const inner = (
  <div
    className="flex items-start gap-2.5 p-3 rounded-xl border transition-colors hover:border-[#6B8F71]"
    style={{ borderColor: s.border, background: s.bg }}
  >
    <Icon size={20} weight="duotone" style={{ color: s.icon, flexShrink: 0, marginTop: 2 }} />
    <div className="min-w-0 flex-1">
      <div className="font-bold text-sm" style={{ color: "#2F4A35" }}>{item.title}</div>
      {item.detail && (
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "#5C6853" }}>{item.detail}</div>
      )}
    </div>
  </div>
  );
  if (item.to) {
    return <Link to={item.to} className="block no-underline text-inherit">{inner}</Link>;
  }
  return inner;
}

export default function AdminRemindersPanel({ items = [] }) {
  const urgent = items.filter(i => i.severity === "urgent").length;
  const total = items.length;

  return (
    <div className="card p-5 rounded-[22px] h-full flex flex-col" data-testid="admin-reminders">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="dash-section-title m-0 flex items-center gap-2">
          <Bell size={20} weight="duotone" style={{ color: "#6B8F71" }} />
          Admin Reminders
        </div>
        {total > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: urgent ? "#F0E0D4" : "#E5EBE1", color: urgent ? "#965132" : "#2F4A35" }}
          >
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
          <CheckCircle size={36} weight="duotone" style={{ color: "#6B8F71" }} />
          <div className="text-sm font-semibold" style={{ color: "#2F4A35" }}>All clear</div>
          <div className="text-xs" style={{ color: "#6B8270" }}>No pending reminders right now</div>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-0.5">
          {items.map((item, i) => (
            <ReminderRow key={item.id || i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function buildAdminReminders({
  notifications = [],
  pkgAlerts = {},
  pendingRequests = 0,
  billing = null,
  pendingLeaves = 0,
  newIntake = 0,
  excludeHr = false,
}) {
  const items = [];

  notifications.filter(n => !n.read).forEach((n) => {
    items.push({
      id: `notif-${n.id}`,
      severity: n.requires_acknowledgment && !n.acknowledged ? "urgent" : "info",
      icon: Bell,
      title: n.title || "Notification",
      detail: n.body || n.message,
      to: n.link || undefined,
    });
  });

  if (!excludeHr && pendingRequests > 0) {
    items.push({
      id: "requests",
      severity: "warn",
      icon: ListChecks,
      title: `${pendingRequests} staff request${pendingRequests > 1 ? "s" : ""} pending`,
      detail: "Review and approve staff submissions",
      to: "/staff-leave?tab=other",
    });
  }

  if (pkgAlerts.critical > 0) {
    items.push({
      id: "pkg-critical",
      severity: "urgent",
      icon: Warning,
      title: `${pkgAlerts.critical} package${pkgAlerts.critical > 1 ? "s" : ""} critical or expired`,
      detail: "Hours nearly exhausted — follow up with clients",
      to: "/clients",
    });
  }

  if (pkgAlerts.low > 0) {
    items.push({
      id: "pkg-low",
      severity: "warn",
      icon: Warning,
      title: `${pkgAlerts.low} package${pkgAlerts.low > 1 ? "s" : ""} running low`,
      detail: "Plan renewals before sessions run out",
      to: "/clients",
    });
  }

  if (billing?.summary?.unpaid > 0) {
    items.push({
      id: "billing-unpaid",
      severity: "urgent",
      icon: Receipt,
      title: `${billing.summary.unpaid} unpaid invoice${billing.summary.unpaid > 1 ? "s" : ""}`,
      detail: "Open Billing to record payments",
      to: "/billing",
    });
  }

  if (billing?.summary?.reminders_soon > 0) {
    items.push({
      id: "billing-reminder",
      severity: "warn",
      icon: Receipt,
      title: `${billing.summary.reminders_soon} payment reminder${billing.summary.reminders_soon > 1 ? "s" : ""} due soon`,
      detail: "Installment follow-ups in the next 2 days",
      to: "/billing",
    });
  }

  if (!excludeHr && pendingLeaves > 0) {
    items.push({
      id: "leaves",
      severity: "warn",
      icon: CalendarBlank,
      title: `${pendingLeaves} leave request${pendingLeaves > 1 ? "s" : ""} pending`,
      detail: "Review therapist leave submissions",
      to: "/staff-leave?tab=vacation",
    });
  }

  if (newIntake > 0) {
    items.push({
      id: "intake",
      severity: "info",
      icon: Folder,
      title: `${newIntake} new intake referral${newIntake > 1 ? "s" : ""}`,
      detail: "Pre-intake waiting for review",
      to: "/waiting/intake",
    });
  }

  const order = { urgent: 0, warn: 1, info: 2 };
  return items.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}
