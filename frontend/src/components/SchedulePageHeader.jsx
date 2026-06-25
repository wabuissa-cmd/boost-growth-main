import PageBanner from "./PageBanner";
import { SCHEDULE_LEGEND_ITEMS } from "../scheduleConstants";

export function ScheduleLegendStrip({ className = "" }) {
  return (
    <div className={`schedule-legend-strip no-print ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="ui-caption font-bold uppercase tracking-wide shrink-0" style={{ color: "#8B9E7A", fontSize: "0.65rem" }}>Legend</span>
        {SCHEDULE_LEGEND_ITEMS.map(it => (
          <span key={it.label} className="inline-flex items-center gap-1 shrink-0" style={{ fontSize: "0.65rem", color: "#6B7A62" }}>
            <span className="w-2 h-2 rounded border shrink-0" style={{ background: it.bg, borderColor: it.border }} />
            {it.label}
          </span>
        ))}
      </div>
      <p className="mb-0 mt-1" style={{ fontSize: "0.65rem", color: "#8B9E7A" }}>
        Each child has a unique color · Tap a session cell to log attendance · Long-press for menu
      </p>
    </div>
  );
}

export default function SchedulePageHeader({ subtitle, badge, stats = [], toolbar, className = "" }) {
  return (
    <>
      <PageBanner
        title="Weekly Schedule"
        subtitle={subtitle}
        badge={badge}
        stats={stats}
        toolbar={toolbar}
        className={`editorial-banner--schedule-mobile ${className}`.trim()}
      />
      <ScheduleLegendStrip />
    </>
  );
}
