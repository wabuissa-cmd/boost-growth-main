import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth, canEditStaffRequests, canManageLeaves, canHrReviewLeaves } from "../auth";
import PageBanner from "../components/PageBanner";
import Requests from "./Requests";
import LeaveRequests from "./LeaveRequests";
import LeaveBalance from "./LeaveBalance";

const TABS = [
  { id: "staff", label: "Staff Requests", testid: "tab-staff-requests" },
  { id: "leave-requests", label: "Leave Requests", testid: "tab-leave-requests" },
  { id: "balance", label: "Leave Balance", testid: "tab-leave-balance" },
];

export default function StaffLeave() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const showStaff = canEditStaffRequests(user);
  const showLeaveManager = canManageLeaves(user);
  const showHrLeave = canHrReviewLeaves(user);
  const showLeave = showLeaveManager || showHrLeave;

  const availableTabs = useMemo(
    () => TABS.filter(t => {
      if (t.id === "staff") return showStaff;
      if (t.id === "balance") return showLeaveManager;
      return showLeave;
    }),
    [showStaff, showLeave, showLeaveManager]
  );

  if (!showStaff && !showLeave) {
    return <Navigate to="/home" replace />;
  }

  const requested = searchParams.get("tab");
  const activeTab = availableTabs.some(t => t.id === requested)
    ? requested
    : availableTabs[0].id;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    if (id !== "leave-requests") next.delete("therapist");
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageBanner
        title="Staff & Leave"
        subtitle="Staff requests, leave approvals, and annual balances"
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

      {activeTab === "staff" && showStaff && <Requests embedded />}
      {activeTab === "leave-requests" && showLeave && <LeaveRequests embedded />}
      {activeTab === "balance" && showLeaveManager && <LeaveBalance embedded staffScope />}
    </div>
  );
}
