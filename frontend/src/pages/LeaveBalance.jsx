import { useEffect, useState } from "react";
import PageBanner from "../components/PageBanner";
import { Scales } from "@phosphor-icons/react";
import { useAuth, showAdminNav, canManageLeaves, canAccessManagerHub } from "../auth";
import api from "../api";
import LeaveBalanceTable from "../components/LeaveBalanceTable";
import LeaveBalanceSheetGrid from "../components/LeaveBalanceSheetGrid";

export default function LeaveBalance({ embedded = false, staffScope = false, hubEmbedded = false }) {
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const isLeaveManager = canManageLeaves(user);
  const hubManagerView = hubEmbedded && staffScope && canAccessManagerHub(user);
  const useStaffScope = staffScope || isLeaveManager;
  const useSheetGrid = (staffScope && isLeaveManager) || hubManagerView;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [leaves, setLeaves] = useState([]);

  const load = async () => {
    const params = { year };
    if (useStaffScope) params.scope = "staff";
    const { data } = await api.get("/leaves", { params });
    setLeaves(data || []);
  };
  useEffect(() => {
    if (useSheetGrid || (!isAdmin && !isLeaveManager)) return;
    load();
  }, [year, isAdmin, isLeaveManager, useSheetGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin && !isLeaveManager && !hubManagerView) {
    return (
      <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
        Admin only — submit leave requests from the Requests page.
      </div>
    );
  }

  return (
    <div>
      {!embedded && (
      <PageBanner
        title="Leave Balance"
        subtitle={useSheetGrid ? "All therapists — synced from vacations sheet" : "Annual leave balances — HR overview"}
        badge={(
          <select className="select text-[11px] max-w-[90px] min-h-0 h-7 py-0" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      />
      )}

      {embedded && hubEmbedded && (
        <div className={`flex flex-wrap items-center justify-between gap-2 mb-3${hubEmbedded ? " mgr-hub-balance-toolbar" : ""}`}>
          {hubEmbedded && (
            <div className="mgr-hub-panel-head mgr-hub-panel-head--compact min-w-0 flex-1 mb-0">
              <Scales size={22} weight="duotone" className="shrink-0" />
              <div>
                <h2>Leave Balance</h2>
                <p>Synced from vacations sheet · {year}</p>
              </div>
            </div>
          )}
          <select className="select text-[11px] max-w-[90px] min-h-0 h-7 py-0 shrink-0" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {useSheetGrid ? (
        <LeaveBalanceSheetGrid year={year} />
      ) : (
        <LeaveBalanceTable year={year} leaves={leaves} showYearSelect={false} onRefresh={load} staffScope={useStaffScope} />
      )}
    </div>
  );
}
