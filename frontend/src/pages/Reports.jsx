import { useEffect, useState } from "react";
import api from "../api";
import { ChartBar, Users, Clock, CheckCircle, Warning, Trophy } from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";

export default function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/reports/dashboard").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) return <div className="card p-12 text-center"><div className="spinner mx-auto"/></div>;

  const t = data.totals;
  const tiles = [
    { label: "Therapists", value: t.therapists, icon: <Users size={20} weight="duotone"/>, bg: "#E5EBE1", color: "#3D4F35" },
    { label: "Clients", value: t.clients, icon: <Users size={20} weight="duotone"/>, bg: "#EAF0F3", color: "#375568" },
    { label: "Sessions", value: t.sessions, icon: <CheckCircle size={20} weight="duotone"/>, bg: "#F1ECF7", color: "#4E3F70" },
    { label: "Hours Delivered", value: `${t.total_hours}h`, icon: <Clock size={20} weight="duotone"/>, bg: "#FAF0D1", color: "#6B5218" },
    { label: "Open Requests", value: t.open_requests, icon: <Warning size={20} weight="duotone"/>, bg: "#F8EBE7", color: "#8A3F27" },
    { label: "🔴 Urgent Clients", value: t.urgent_clients, icon: <Warning size={20} weight="fill"/>, bg: "#FCE0E8", color: "#8B3A55" },
    { label: "🟡 Warning Clients", value: t.warning_clients, icon: <Warning size={20} weight="duotone"/>, bg: "#FFF4C4", color: "#6B5218" },
    { label: "Therapist Cancels (week)", value: t.schedule_cancel_therapist, icon: <Warning size={20} weight="duotone"/>, bg: "#FCE0E8", color: "#8B3A55" },
  ];

  return (
    <div>
      <PageBanner
        title="Reports & Analytics"
        subtitle="Real-time overview of your center's operations"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        {tiles.map(x => (
          <div key={x.label} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background: x.bg, color: x.color}}>{x.icon}</div>
              <div className="text-[10px] font-bold tracking-wider uppercase" style={{color: "#8B9E7A"}}>{x.label}</div>
            </div>
            <div className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Per-Therapist */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={20} weight="duotone" style={{color: "#D4A64A"}}/>
            <div className="font-bold" style={{color: "#2C3625"}}>Per-Therapist Performance</div>
          </div>
          <div className="space-y-2">
            {data.per_therapist.sort((a,b) => b.completed - a.completed).map(pt => (
              <div key={pt.name} className="flex items-center gap-3 p-3 rounded-xl border border-[#E2DDD4]">
                <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold shrink-0" style={{background: pt.color}}>
                  {pt.name.replace("Ms. ","").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{color: "#2C3625"}}>{pt.name}</div>
                  <div className="text-xs flex flex-wrap gap-2 mt-0.5" style={{color: "#5C6853"}}>
                    <span>✅ {pt.completed}</span>
                    <span>⚠️ {pt.cancelled} cancel</span>
                    <span>❌ {pt.no_show} no-show</span>
                    <span>⏱️ {pt.hours.toFixed(1)}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Client */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ChartBar size={20} weight="duotone" style={{color: "#7A8A6A"}}/>
            <div className="font-bold" style={{color: "#2C3625"}}>Client Hours Status</div>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {data.per_client.map(c => {
              const pct = Math.min(100, Math.round((c.used / c.pkg) * 100));
              const cls = c.status === "urgent" ? "#C97B5C" : c.status === "warning" ? "#D4A64A" : "#7A8A6A";
              const emoji = c.status === "urgent" ? "🔴" : c.status === "warning" ? "🟡" : "🟢";
              return (
                <div key={c.id} className="p-3 rounded-xl border border-[#E2DDD4]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-6 rounded-full" style={{background: c.color}}/>
                      <div>
                        <div className="font-bold text-sm" style={{color: "#2C3625"}}>{c.name}</div>
                        <div className="text-[10px]" style={{color: "#8B9E7A"}}>#{c.file_no}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold" style={{color: cls}}>{emoji} {c.rem}/{c.pkg}h</div>
                  </div>
                  <div className="h-1.5 bg-[#F0EDE9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width: `${pct}%`, background: cls}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
