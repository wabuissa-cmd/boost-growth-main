import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Airplane, CalendarBlank, Package } from "@phosphor-icons/react";
import { useAuth, canEditStaffRequests, canManageLeaves, canHrReviewLeaves, isJenan, showAdminNav } from "../auth";
import PageBanner from "../components/PageBanner";
import Requests from "./Requests";
import LeaveRequests from "./LeaveRequests";
import LeaveBalance from "./LeaveBalance";
import { VACATION_LEAVE_TYPES, LEAVE_TAB_TYPES } from "../leaveUtils";

const TABS = [
  { id: "vacation", label: "Vacation", testid: "tab-vacation", icon: <Airplane size={14} weight="duotone" /> },
  { id: "leave", label: "Leave", testid: "tab-leave", icon: <CalendarBlank size={14} weight="duotone" /> },
  { id: "other", label: "Other requests", testid: "tab-other", icon: <Package size={14} weight="duotone" /> },
];

const TAB_ALIASES = {
  staff: "other",
  "leave-requests": "vacation",
  balance: "vacation",
};

export default function StaffLeave() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const showStaff = canEditStaffRequests(user);
  const showLeaveManager = canManageLeaves(user);
  const showHrLeave = canHrReviewLeaves(user);
  const showLeave = showLeaveManager || showHrLeave;

  const availableTabs = useMemo(
    () => TABS.filter(t => {
      if (t.id === "other") return showStaff;
      return showLeave;
    }),
    [showStaff, showLeave]
  );

  if (isJenan(user) && !showAdminNav(user)) {
    return <Navigate to="/manager" replace />;
  }

  if (!showStaff && !showLeave) {
    return <Navigate to="/home" replace />;
  }

  const requested = searchParams.get("tab");
  const normalized = TAB_ALIASES[requested] || requested;
  const activeTab = availableTabs.some(t => t.id === normalized)
    ? normalized
    : availableTabs[0].id;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    if (id !== "vacation" && id !== "leave") next.delete("therapist");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="portal-page-shell page-enter">
      <PageBanner
        title="Staff & Leave"
        subtitle="Vacation · leave · materials & HR requests"
        tabs={availableTabs.map((t) => ({ id: t.id, label: t.label, testId: t.testid, icon: t.icon }))}
        activeTab={activeTab}
        onTabChange={setTab}
      />

      <section className="portal-content-panel portal-page-body">
      {activeTab === "vacation" && showLeave && (
        <>
          {showLeaveManager && <LeaveBalance embedded staffScope />}
          <LeaveRequests embedded grievanceTypes={VACATION_LEAVE_TYPES} />
        </>
      )}
      {activeTab === "leave" && showLeave && (
        <LeaveRequests embedded grievanceTypes={LEAVE_TAB_TYPES} />
      )}
      {activeTab === "other" && showStaff && <Requests embedded />}
      </section>
    </div>
  );
}
