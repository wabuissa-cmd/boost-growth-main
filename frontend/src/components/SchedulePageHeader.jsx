import PageBanner from "./PageBanner";
import { SCHEDULE_LEGEND_ITEMS } from "../scheduleConstants";

export default function SchedulePageHeader({ subtitle, badge, stats = [], toolbar, className = "" }) {
  return (
    <PageBanner title="Weekly Schedule" subtitle={subtitle} badge={badge} stats={stats} toolbar={toolbar} className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="ui-caption font-bold uppercase tracking-wide shrink-0" style={{ color: "#8B9E7A" }}>Legend</span>
        {SCHEDULE_LEGEND_ITEMS.map(it => (
          <span key={it.label} className="inline-flex items-center gap-1 ui-caption shrink-0">
            <span className="w-2.5 h-2.5 rounded border shrink-0" style={{ background: it.bg, borderColor: it.border }} />
            {it.label}
          </span>
        ))}
      </div>
      <p className="ui-caption mt-2 mb-0">Each child has a unique color · Tap a session cell to log attendance · Long-press for menu</p>
    </PageBanner>
  );
}
