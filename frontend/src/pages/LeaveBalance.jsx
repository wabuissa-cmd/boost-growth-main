import { useEffect, useState } from "react";
import PageBanner from "../components/PageBanner";
import { useAuth, showAdminNav } from "../auth";
import api from "../api";
import LeaveBalanceTable from "../components/LeaveBalanceTable";

export default function LeaveBalance({ embedded = false }) {
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [leaves, setLeaves] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/leaves?year=${year}`);
    setLeaves(data || []);
  };
  useEffect(() => { if (isAdmin) load(); }, [year, isAdmin]);

  if (!isAdmin) {
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
        subtitle="Annual leave balances — HR overview"
        badge={(
          <select className="select text-[11px] max-w-[90px] min-h-0 h-7 py-0" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      />
      )}

      <LeaveBalanceTable year={year} leaves={leaves} showYearSelect={false} onRefresh={load} />
    </div>
  );
}
