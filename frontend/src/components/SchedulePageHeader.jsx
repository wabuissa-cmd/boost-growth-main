import { CalendarBlank, Table, GridFour } from "@phosphor-icons/react";
import PageBanner from "./PageBanner";
import { SCHEDULE_LEGEND_ITEMS } from "../scheduleConstants";

export function ScheduleLegendStrip({ className = "", compact = false, hint, show = true }) {
  if (show === false) return null;
  return (
    <div className={`schedule-legend-strip no-print ${className}`.trim()}>
      {!compact && <div className="schedule-page-section-label">Legend</div>}
      <div className="schedule-page-legend-items">
        {SCHEDULE_LEGEND_ITEMS.map((it) => (
          <span key={it.label} className="schedule-page-legend-item">
            <span className="schedule-page-legend-swatch" style={{ background: it.bg, borderColor: it.border }} />
            {it.label}
          </span>
        ))}
      </div>
      {!compact && (
        <p className="schedule-page-legend-hint">
          {hint || "Tap a session to log preparation · Long-press for menu · Times shown per hour slot"}
        </p>
      )}
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
  pageSettings,
}) {
  const stackedToolbar = toolbarPlacement === "outside";
  const sheetLabel = pageSettings?.sheet_tab_label || "Team schedule";
  const blocksLabel = pageSettings?.blocks_tab_label || "My schedule";
  const tabs = canSwitchView && onViewChange
    ? [
        { id: "sheet", label: sheetLabel, icon: <Table size={14} weight="duotone" />, testId: "view-sheet-btn" },
        { id: "blocks", label: blocksLabel, icon: <GridFour size={14} weight="duotone" />, testId: "view-blocks-btn" },
      ]
    : [];

  return (
    <header className={`schedule-page-header no-print ${className}`.trim()}>
      <PageBanner
        title={pageSettings?.page_title || "Weekly Schedule"}
        subtitle={subtitle}
        badge={badge || (
          <span className="editorial-banner__icon-badge" aria-hidden>
            <CalendarBlank size={20} weight="duotone" />
          </span>
        )}
        stats={stats}
        tabs={tabs}
        activeTab={view}
        onTabChange={onViewChange}
        toolbar={!stackedToolbar ? toolbar : undefined}
        className="editorial-banner--schedule-mobile"
      >
        <ScheduleLegendStrip
          compact
          show={pageSettings?.show_legend !== false}
          hint={pageSettings?.legend_hint}
        />
      </PageBanner>

      {toolbar && stackedToolbar && (
        <div className="schedule-toolbar-mobile-card card">{toolbar}</div>
      )}
    </header>
  );
}
