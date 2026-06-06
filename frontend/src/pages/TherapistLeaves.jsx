import { useState } from "react";
import { useAuth } from "../auth";
import LeaveBalanceTable from "../components/LeaveBalanceTable";
import PageBanner from "../components/PageBanner";

export default function TherapistLeaves() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  if (!isAdmin) return <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>Admin only</div>;

  return (
    <div>
      <PageBanner
        title="Therapist Leaves"
        subtitle="Annual leave balances & usage per therapist"
        toolbar={(
          <select className="select max-w-[120px]" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      />
      <LeaveBalanceTable year={year} showYearSelect={false} />
    </div>
  );
}
