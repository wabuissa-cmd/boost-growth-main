import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import api from "../api";
import { Scales } from "@phosphor-icons/react";
import LeaveBalanceTable from "../components/LeaveBalanceTable";

export default function LeaveBalance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2" style={{ color: "#2C3625" }}>
            <Scales size={28} weight="duotone" /> Leave Balance
          </h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>رصيد الإجازات — HR overview of annual balances</div>
        </div>
        <select className="select max-w-[120px]" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
          {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <LeaveBalanceTable year={year} leaves={leaves} showYearSelect={false} onRefresh={load} />
    </div>
  );
}
