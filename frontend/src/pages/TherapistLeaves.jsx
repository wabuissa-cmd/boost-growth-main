import { useState } from "react";
import { useAuth } from "../auth";
import { Airplane } from "@phosphor-icons/react";
import LeaveBalanceTable from "../components/LeaveBalanceTable";

export default function TherapistLeaves() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  if (!isAdmin) return <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>Admin only</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#2C3625" }}>
            <Airplane size={26} weight="duotone" className="inline mr-2" /> Therapist Leaves
          </h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>Annual leave balances & usage per therapist</div>
        </div>
        <select className="select max-w-[120px]" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
          {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <LeaveBalanceTable year={year} showYearSelect={false} />
    </div>
  );
}
