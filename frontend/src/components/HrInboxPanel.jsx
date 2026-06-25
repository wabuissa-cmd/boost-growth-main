import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { isHrOps, isJenan, showAdminNav, canParentCancellationOps, isWalaaOps, canAccessPurchases, hasOpsAccess } from "../auth";
import {
  Tray, CalendarBlank, ListChecks, ShoppingBag, Receipt, CheckCircle, WhatsappLogo,
} from "@phosphor-icons/react";

function InboxRow({ to, icon: Icon, label, count, testId }) {
  if (!count) return null;
  return (
    <Link
      to={to}
      data-testid={testId}
      className="flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors hover:border-[#6B8F71] no-underline text-inherit"
      style={{ borderColor: "#D4DEC8", background: "#FAFCF8" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={20} weight="duotone" style={{ color: "#6B8F71", flexShrink: 0 }} />
        <span className="font-semibold text-sm" style={{ color: "#2F4A35" }}>{label}</span>
      </div>
      <span
        className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
        style={{ background: "#F0E0D4", color: "#965132" }}
      >
        {count}
      </span>
    </Link>
  );
}

export default function HrInboxPanel({ user, coordinationOnly = false }) {
  const [inbox, setInbox] = useState(null);
  const portalAdmin = showAdminNav(user);
  const hrOps = isHrOps(user);
  const jenan = isJenan(user);
  const walaaOps = isWalaaOps(user);
  const parentCancelOps = canParentCancellationOps(user);

  useEffect(() => {
    if (!user || (!portalAdmin && !hrOps && !jenan && !parentCancelOps && !walaaOps)) return;
    api.get("/tracking/inbox")
      .then(r => setInbox(r.data || null))
      .catch(() => setInbox(null));
  }, [user?.id, portalAdmin, hrOps, jenan, parentCancelOps, walaaOps]);

  if (!inbox) return null;

  const rows = [];
  if (!coordinationOnly) {
    if (jenan || portalAdmin) {
      rows.push({
        to: "/staff-leave?tab=leave-requests",
        icon: CalendarBlank,
        label: "Leaves awaiting manager review",
        count: inbox.leaves_pending_manager,
        testId: "inbox-leaves-manager",
      });
    }
    if (hrOps || portalAdmin) {
      rows.push({
        to: "/staff-leave?tab=leave-requests",
        icon: CalendarBlank,
        label: "Leaves awaiting HR approval",
        count: inbox.leaves_pending_hr,
        testId: "inbox-leaves-hr",
      });
    }
    if (jenan || portalAdmin) {
      rows.push({
        to: "/staff-leave?tab=staff",
        icon: ListChecks,
        label: "Staff requests awaiting manager review",
        count: inbox.requests_pending_manager,
        testId: "inbox-requests-manager",
      });
    }
    if (hrOps || portalAdmin) {
      rows.push({
        to: "/staff-leave?tab=staff",
        icon: ListChecks,
        label: "Staff requests awaiting HR approval",
        count: inbox.requests_pending_hr,
        testId: "inbox-requests-hr",
      });
    }
  }
  if (canAccessPurchases(user)) {
    rows.push({
      to: "/purchases",
      icon: ShoppingBag,
      label: "Pending purchases",
      count: inbox.purchases_pending,
      testId: "inbox-purchases",
    });
  }
  if (hasOpsAccess(user)) {
    rows.push({
      to: "/billing",
      icon: Receipt,
      label: "Billing reminders soon",
      count: inbox.billing_reminders_soon,
      testId: "inbox-billing",
    });
  }
  if (parentCancelOps) {
    rows.push({
      to: "/schedule?parentCancel=1",
      icon: WhatsappLogo,
      label: "Parent cancellations (WhatsApp)",
      count: inbox.parent_cancellations_pending,
      testId: "inbox-parent-cancellations",
    });
  }

  const total = rows.reduce((n, r) => n + (r.count || 0), 0);

  const panelTitle = coordinationOnly ? "Coordination Inbox" : "HR Inbox";
  const emptyTitle = coordinationOnly ? "Coordination clear" : "Inbox clear";
  const emptyDetail = coordinationOnly
    ? "No pending coordination items right now"
    : "No pending HR items right now";

  return (
    <div className="card p-5 rounded-[22px] h-full flex flex-col" data-testid="hr-inbox-panel">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="dash-section-title m-0 flex items-center gap-2">
          <Tray size={20} weight="duotone" style={{ color: "#6B8F71" }} />
          {panelTitle}
        </div>
        {total > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#F0E0D4", color: "#965132" }}>
            {total}
          </span>
        )}
      </div>
      {total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
          <CheckCircle size={36} weight="duotone" style={{ color: "#6B8F71" }} />
          <div className="text-sm font-semibold" style={{ color: "#2F4A35" }}>{emptyTitle}</div>
          <div className="text-xs" style={{ color: "#6B8270" }}>{emptyDetail}</div>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-0.5">
          {rows.map(r => (
            <InboxRow key={r.testId} {...r} />
          ))}
        </div>
      )}
    </div>
  );
}
