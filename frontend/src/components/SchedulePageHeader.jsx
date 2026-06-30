import { CalendarBlank, Table, GridFour } from "@phosphor-icons/react";
import { SCHEDULE_LEGEND_ITEMS } from "../scheduleConstants";

function ViewStepPill({ label, icon: Icon, active, onClick, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`center-test-step schedule-page-view-step${active ? " active" : ""}`}
      onClick={onClick}
    >
      <span className="center-test-step-num">
        <Icon size={14} weight={active ? "fill" : "duotone"} />
      </span>
      <span className="center-test-step-label">{label}</span>
    </button>
  );
}

export function ScheduleLegendStrip({ className = "" }) {
  return (
    <div className={`schedule-page-legend no-print ${className}`.trim()}>
      <div className="schedule-page-section-label">Legend</div>
      <div className="schedule-page-legend-items">
        {SCHEDULE_LEGEND_ITEMS.map((it) => (
          <span key={it.label} className="schedule-page-legend-item">
            <span className="schedule-page-legend-swatch" style={{ background: it.bg, borderColor: it.border }} />
            {it.label}
          </span>
        ))}
      </div>
      <p className="schedule-page-legend-hint">
        Each child has a unique color · Tap a session cell to log attendance · Long-press for menu
      </p>
    </div>
  );
}

export default function SchedulePageHeader({
  subtitle,
  badge,
  stats = [],
  toolbar,
  className = "",
  toolbarPlacement = "inline",
  view = "blocks",
  onViewChange,
  canSwitchView = true,
}) {
  const stackedToolbar = toolbarPlacement === "outside";

  return (
    <header className={`schedule-page-header no-print ${className}`.trim()}>
      <div className="schedule-page-top-bar">
        <div className="schedule-page-badge">WEEKLY SCHEDULE</div>
        {badge && <div className="schedule-page-status-badge">{badge}</div>}
      </div>

      {canSwitchView && onViewChange && (
        <div className="center-test-steps-bar schedule-page-steps">
          <ViewStepPill
            label="Team schedule"
            icon={Table}
            active={view === "sheet"}
            onClick={() => onViewChange("sheet")}
            testId="view-sheet-btn"
          />
          <div className="center-test-step-line" />
          <ViewStepPill
            label="My schedule"
            icon={GridFour}
            active={view === "blocks"}
            onClick={() => onViewChange("blocks")}
            testId="view-blocks-btn"
          />
        </div>
      )}

      <div className="schedule-page-hero card">
        <div className="schedule-page-hero-row">
          <div className="schedule-page-hero-icon">
            <CalendarBlank size={28} weight="duotone" />
          </div>
          <div className="schedule-page-hero-copy min-w-0 flex-1">
            <h1 className="schedule-page-title">Weekly Schedule</h1>
            {subtitle && <p className="schedule-page-subtitle">{subtitle}</p>}
            {stats.length > 0 && (
              <div className="schedule-page-stats">
                {stats.map((s) => (
                  <div key={s.label} className="schedule-page-stat">
                    <span className="schedule-page-stat-val" style={{ color: s.color }}>{s.n}</span>
                    <span className="schedule-page-stat-lbl">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {toolbar && !stackedToolbar && (
          <div className="schedule-page-toolbar">{toolbar}</div>
        )}
      </div>

      {toolbar && stackedToolbar && (
        <div className="schedule-page-toolbar-card card">{toolbar}</div>
      )}

      <ScheduleLegendStrip />
    </header>
  );
}
