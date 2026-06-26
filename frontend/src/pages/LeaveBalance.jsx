import { useEffect, useState } from "react";
import PageBanner from "../components/PageBanner";
import { useAuth, showAdminNav, canManageLeaves } from "../auth";
import api from "../api";
import LeaveBalanceTable from "../components/LeaveBalanceTable";
import LeaveBalanceSheetGrid from "../components/LeaveBalanceSheetGrid";

export default function LeaveBalance({ embedded = false, staffScope = false }) {
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const isLeaveManager = canManageLeaves(user);
  const useStaffScope = staffScope || isLeaveManager;
  const useSheetGrid = staffScope && isLeaveManager;
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

  if (!isAdmin && !isLeaveManager) {
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

      {embedded && useSheetGrid && (
        <div className="flex justify-end mb-3">
          <select className="select text-[11px] max-w-[90px] min-h-0 h-7 py-0" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
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
