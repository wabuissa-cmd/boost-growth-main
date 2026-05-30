import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import api from "../api";
import { Scales } from "@phosphor-icons/react";
import LeaveBalanceTable from "../components/LeaveBalanceTable";
import { balanceHealthStatus, isOnLeaveNow } from "../leaveUtils";

export default function LeaveBalance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState([]);
  const [leaves, setLeaves] = useState([]);

  const load = async () => {
    const [b, l] = await Promise.all([
      api.get(`/leaves/balance?year=${year}`),
      api.get(`/leaves?year=${year}`),
    ]);
    setRows(b.data || []);
    setLeaves(l.data || []);
  };
  useEffect(() => { if (isAdmin) load(); }, [year, isAdmin]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activeStaff = rows.length;
    const lowBalance = rows.filter(r => r.remaining > 0 && r.remaining < 5).length;
    const onLeaveNow = new Set(
      leaves.filter(l => isOnLeaveNow(l, today)).map(l => l.therapist_id)
    ).size;
    return { activeStaff, lowBalance, onLeaveNow };
  }, [rows, leaves]);

  if (!isAdmin) {
    return (
      <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
        Admin only — view your requests under Leave Requests.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          { label: "Active Staff", value: stats.activeStaff, sub: "", color: "#3D4F35", bg: "#E5EBE1" },
          { label: "Low Balance", value: stats.lowBalance, sub: "< 5 days", color: "#6B5218", bg: "#FAF0D1" },
          { label: "On Leave Now", value: stats.onLeaveNow, sub: "", color: "#2C5035", bg: "#E0EBD8" },
        ].map(box => (
          <div key={box.label} className="card p-5 text-center" style={{ background: box.bg, borderColor: "transparent" }}>
            <div className="font-display text-4xl font-semibold" style={{ color: box.color }}>{box.value}</div>
            <div className="text-sm font-bold mt-1" style={{ color: box.color }}>{box.label}</div>
            {box.sub && <div className="text-xs opacity-80" style={{ color: box.color }}>{box.sub}</div>}
          </div>
        ))}
      </div>

      <LeaveBalanceTable year={year} leaves={leaves} showYearSelect={false} onRefresh={load} />
    </div>
  );
}
