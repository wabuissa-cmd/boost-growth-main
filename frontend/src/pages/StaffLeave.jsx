import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth, canEditStaffRequests, canManageLeaves, canHrReviewLeaves, isJenan, showAdminNav } from "../auth";
import PageBanner from "../components/PageBanner";
import Requests from "./Requests";
import LeaveRequests from "./LeaveRequests";
import LeaveBalance from "./LeaveBalance";
import { VACATION_LEAVE_TYPES, LEAVE_TAB_TYPES } from "../leaveUtils";

const TABS = [
  { id: "vacation", label: "Vacation applications", testid: "tab-vacation" },
  { id: "leave", label: "Leave", testid: "tab-leave" },
  { id: "other", label: "Other applications", testid: "tab-other" },
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
    <div>
      <PageBanner
        title="Staff & Leave"
        subtitle="Vacation · leave · materials & HR requests"
      />

      <div className="intake-tabs mb-4">
        {availableTabs.map(t => (
          <button
            key={t.id}
            type="button"
            data-testid={t.testid}
            onClick={() => setTab(t.id)}
            className={`intake-tab${activeTab === t.id ? " active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
    </div>
  );
}
