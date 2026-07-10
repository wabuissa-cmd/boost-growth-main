import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { ChartBar, Users, Clock, CheckCircle, Warning, Trophy, TrendUp } from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import DashboardStatCard from "../components/DashboardStatCard";
import CreativeSection from "../components/CreativeSection";
import { DonutChart, BarChart } from "../components/SimpleChart";
import "../dashboardLayout.css";

export default function Reports({ embedded = false }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/reports/dashboard").then(({ data: d }) => setData(d)).catch(() => {});
  }, []);

  const donutSegments = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    const completed = t.completed_sessions || 0;
    const open = Math.max(0, (t.sessions || 0) - completed);
    const urgent = t.urgent_clients || 0;
    return [
      { label: "Completed", value: completed, color: "#7A8A6A" },
      { label: "Other", value: open, color: "#D4A64A" },
      { label: "Urgent clients", value: urgent, color: "#C97B5C" },
    ].filter(s => s.value > 0);
  }, [data]);

  const barItems = useMemo(() => {
    if (!data?.per_therapist) return [];
    return [...data.per_therapist]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
      .map((pt, i) => ({
        label: pt.name.replace(/^Ms\.?\s*/i, "").split(" ")[0],
        value: Math.round(pt.hours * 10) / 10,
        gold: i === 0,
      }));
  }, [data]);

  if (!data) return <div className="card p-12 text-center rounded-[22px]"><div className="spinner mx-auto"/></div>;

  const t = data.totals;
  const tiles = [
    { label: "Therapists", value: t.therapists, variant: "sage", icon: <Users size={20} weight="duotone" style={{ color: "#606E52" }} /> },
    { label: "Clients", value: t.clients, icon: <Users size={20} weight="duotone" style={{ color: "#375568" }} /> },
    { label: "Sessions", value: t.sessions, icon: <CheckCircle size={20} weight="duotone" style={{ color: "#4E3F70" }} /> },
    { label: "Hours Delivered", value: `${t.total_hours}h`, variant: "gold", icon: <Clock size={20} weight="duotone" style={{ color: "#6B5218" }} /> },
    { label: "Open Requests", value: t.open_requests, icon: <Warning size={20} weight="duotone" style={{ color: "#8A3F27" }} /> },
    { label: "Urgent Clients", value: t.urgent_clients, variant: "dark", icon: <Warning size={20} weight="fill" style={{ color: "#FCE0E8" }} /> },
    { label: "Warning Clients", value: t.warning_clients, variant: "gold", icon: <Warning size={20} weight="duotone" style={{ color: "#6B5218" }} /> },
    { label: "Therapist Cancels", value: t.schedule_cancel_therapist, icon: <Warning size={20} weight="duotone" style={{ color: "#8B3A55" }} /> },
  ];

  return (
    <div className="portal-page-shell page-enter">
      {!embedded && (
      <PageBanner
        title="Reports & Analytics"
        subtitle="Real-time overview of your center's performance and package health"
        eyebrow="OPERATIONS DASHBOARD"
        badge={(
          <span className="editorial-banner__icon-badge" aria-hidden>
            <TrendUp size={20} weight="duotone" />
          </span>
        )}
        stats={[
          { label: "Therapists", n: t.therapists, color: "#2C3625" },
          { label: "Clients", n: t.clients, color: "#3D4F35" },
          { label: "Hours", n: `${t.total_hours}h`, color: "#6B5218" },
          { label: "Urgent", n: t.urgent_clients, color: "#8A3F27" },
        ]}
        className=""
      />
      )}

      <section className="portal-content-panel portal-page-body">
      <div className="reports-stat-grid stagger">
        {tiles.map(x => (
          <DashboardStatCard
            key={x.label}
            variant={x.variant || "default"}
            value={x.value}
            label={x.label}
            icon={<div className="dash-stat-icon" style={{ background: x.variant === "dark" ? "rgba(255,255,255,0.15)" : "#FAFAF7" }}>{x.icon}</div>}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="reports-panel">
          <div className="reports-panel-head">
            <ChartBar size={20} weight="duotone" style={{ color: "#7A8A6A" }} />
            <span className="reports-panel-title">Session Overview</span>
          </div>
          <div className="reports-chart-wrap">
            <DonutChart segments={donutSegments.length ? donutSegments : [{ label: "—", value: 1, color: "#E2DDD4" }]} totalLabel="Sessions" />
            <div className="reports-legend">
              {donutSegments.map(seg => (
                <div key={seg.label} className="reports-legend-item">
                  <span className="reports-legend-dot" style={{ background: seg.color }} />
                  <span>{seg.label}: <strong>{seg.value}</strong></span>
                </div>
              ))}
              <div className="reports-legend-item">
                <span className="reports-legend-dot" style={{ background: "#EAF0F3" }} />
                <span>Child cancels: <strong>{t.schedule_cancel_child}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="reports-panel">
          <div className="reports-panel-head">
            <Trophy size={20} weight="duotone" style={{ color: "#D4A64A" }} />
            <span className="reports-panel-title">Hours by Therapist</span>
          </div>
          {barItems.length > 0 ? (
            <BarChart items={barItems} />
          ) : (
            <p className="text-sm text-center py-8" style={{ color: "#8B9E7A" }}>No therapist data yet</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CreativeSection title="Per-Therapist Performance">
          <div className="reports-panel" style={{ padding: "0.75rem" }}>
            {data.per_therapist.sort((a, b) => b.completed - a.completed).map(pt => (
              <div key={pt.name} className="reports-row">
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shrink-0 text-sm" style={{ background: pt.color }}>
                  {pt.name.replace(/^Ms\.?\s*/i, "").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>{pt.name}</div>
                  <div className="text-xs flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5" style={{ color: "#5C6853" }}>
                    <span>{pt.completed} completed</span>
                    <span>{pt.cancelled} cancelled</span>
                    <span>{pt.no_show} no-show</span>
                    <span>{pt.hours.toFixed(1)}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CreativeSection>

        <CreativeSection title="Client Hours Status">
          <div className="reports-panel max-h-[520px] overflow-y-auto">
            {data.per_client.map(c => {
              const pct = Math.min(100, Math.round((c.used / c.pkg) * 100));
              const cls = c.status === "urgent" ? "#C97B5C" : c.status === "warning" ? "#D4A64A" : "#7A8A6A";
              return (
                <div key={c.id} className="reports-row flex-col !items-stretch">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-6 rounded-full shrink-0" style={{ background: c.color }} />
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>{c.name}</div>
                        <div className="text-[10px]" style={{ color: "#8B9E7A" }}>#{c.file_no}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold shrink-0" style={{ color: cls }}>{c.rem}/{c.pkg}h left</div>
                  </div>
                  <div className="h-1.5 bg-[#F0EDE9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cls }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CreativeSection>
      </div>
      </section>
    </div>
  );
}
