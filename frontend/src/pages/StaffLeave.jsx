import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Airplane, CalendarBlank, Package, GearSix } from "@phosphor-icons/react";
import { useAuth, canEditStaffRequests, canManageLeaves, canHrReviewLeaves, isJenan, showAdminNav, hasOpsAccess } from "../auth";
import PageBanner from "../components/PageBanner";
import StaffLeavePageControl from "../components/StaffLeavePageControl";
import {
  ModalBase, ModalBtnSecondary,
} from "../components/Modal";
import Requests from "./Requests";
import LeaveRequests from "./LeaveRequests";
import LeaveBalance from "./LeaveBalance";
import { VACATION_LEAVE_TYPES, LEAVE_TAB_TYPES } from "../leaveUtils";
import { cachedGet, invalidateCache } from "../dataCache";
import { mergeStaffLeavePageSettings } from "../pageSettings";

const TAB_ICONS = {
  vacation: Airplane,
  leave: CalendarBlank,
  other: Package,
};

const TAB_TESTIDS = {
  vacation: "tab-vacation",
  leave: "tab-leave",
  other: "tab-other",
};

const DEFAULT_TABS = [
  { id: "vacation", label: "Vacation", enabled: true },
  { id: "leave", label: "Leave", enabled: true },
  { id: "other", label: "Other requests", enabled: true },
];

const TAB_ALIASES = {
  staff: "other",
  "leave-requests": "vacation",
  balance: "vacation",
};

export default function StaffLeave() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSettings, setPageSettings] = useState(() => mergeStaffLeavePageSettings(null));
  const [pageControlOpen, setPageControlOpen] = useState(false);
  const showStaff = canEditStaffRequests(user);
  const showLeaveManager = canManageLeaves(user);
  const showHrLeave = canHrReviewLeaves(user);
  const showLeave = showLeaveManager || showHrLeave;
  const canEditPageSettings = showAdminNav(user) || hasOpsAccess(user) || showLeaveManager || showHrLeave;

  useEffect(() => {
    cachedGet("/page-settings/staff-leave")
      .then((s) => { if (s) setPageSettings(mergeStaffLeavePageSettings(s)); })
      .catch(() => {});
  }, []);

  const availableTabs = useMemo(() => {
    const configured = (pageSettings.tabs?.length ? pageSettings.tabs : DEFAULT_TABS)
      .filter((t) => t && t.enabled !== false);
    return configured
      .filter((t) => {
        if (t.id === "other") return showStaff;
        return showLeave;
      })
      .map((t) => {
        const Icon = TAB_ICONS[t.id] || Package;
        return {
          id: t.id,
          label: t.label,
          testid: TAB_TESTIDS[t.id] || `tab-${t.id}`,
          icon: <Icon size={14} weight="duotone" />,
        };
      });
  }, [pageSettings.tabs, showStaff, showLeave]);

  if (isJenan(user) && !showAdminNav(user)) {
    return <Navigate to="/manager" replace />;
  }

  if (!showStaff && !showLeave) {
    return <Navigate to="/home" replace />;
  }

  if (!availableTabs.length) {
    return (
      <div className="portal-page-shell page-enter">
        <div className="card p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>
          No Staff & Leave tabs are enabled for your account.
        </div>
      </div>
    );
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
        title={pageSettings.page_title || "Staff & Leave"}
        subtitle={pageSettings.page_subtitle || "Vacation · leave · materials & HR requests"}
        tabs={availableTabs.map((t) => ({ id: t.id, label: t.label, testId: t.testid, icon: t.icon }))}
        activeTab={activeTab}
        onTabChange={setTab}
        toolbar={canEditPageSettings ? (
          <button
            type="button"
            data-testid="staff-leave-page-settings-btn"
            className="btn btn-outline text-sm"
            onClick={() => setPageControlOpen(true)}
          >
            <GearSix size={16} weight="duotone" /> Page settings
          </button>
        ) : null}
      />

      <section className="portal-content-panel portal-page-body">
      {activeTab === "vacation" && showLeave && (
        <>
          {showLeaveManager && <LeaveBalance embedded staffScope />}
          <LeaveRequests embedded grievanceTypes={VACATION_LEAVE_TYPES} pageSettings={pageSettings} />
        </>
      )}
      {activeTab === "leave" && showLeave && (
        <LeaveRequests embedded grievanceTypes={LEAVE_TAB_TYPES} pageSettings={pageSettings} />
      )}
      {activeTab === "other" && showStaff && <Requests embedded pageSettings={pageSettings} />}
      </section>

      {pageControlOpen && (
        <ModalBase
          title="Staff & Leave page settings"
          subtitle="Self-serve control for this page"
          onClose={() => setPageControlOpen(false)}
          size="lg"
          footer={
            <ModalBtnSecondary type="button" onClick={() => setPageControlOpen(false)}>Close</ModalBtnSecondary>
          }
        >
          <StaffLeavePageControl
            compact
            onSaved={(s) => {
              setPageSettings(mergeStaffLeavePageSettings(s));
              invalidateCache("/page-settings/staff-leave");
            }}
          />
        </ModalBase>
      )}
    </div>
  );
}
