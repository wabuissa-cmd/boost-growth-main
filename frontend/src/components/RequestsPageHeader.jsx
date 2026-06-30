import { Fragment } from "react";
import { ListChecks } from "@phosphor-icons/react";

function TabStepPill({ label, active, onClick, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`center-test-step requests-page-view-step${active ? " active" : ""}`}
      onClick={onClick}
    >
      <span className="center-test-step-num">
        <ListChecks size={14} weight={active ? "fill" : "duotone"} />
      </span>
      <span className="center-test-step-label">{label}</span>
    </button>
  );
}

export default function RequestsPageHeader({
  badge = "STAFF REQUESTS",
  title = "Staff Requests",
  subtitle,
  stats = [],
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) {
  return (
    <header className={`requests-page-header ${className}`.trim()}>
      <div className="requests-page-top-bar">
        <div className="requests-page-badge">{badge}</div>
      </div>

      {tabs?.length > 0 && onTabChange && (
        <div className="center-test-steps-bar requests-page-steps">
          {tabs.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <div className="center-test-step-line" />}
              <TabStepPill
                label={t.label}
                active={activeTab === t.id}
                onClick={() => onTabChange(t.id)}
                testId={t.testId || `req-tab-${t.id}`}
              />
            </Fragment>
          ))}
        </div>
      )}

      <div className="requests-page-hero card">
        <div className="requests-page-hero-row">
          <div className="requests-page-hero-icon">
            <ListChecks size={28} weight="duotone" />
          </div>
          <div className="requests-page-hero-copy min-w-0 flex-1">
            <h1 className="requests-page-title">{title}</h1>
            {subtitle && <p className="requests-page-subtitle">{subtitle}</p>}
            {stats.length > 0 && (
              <div className="requests-page-stats">
                {stats.map((s) => (
                  <div key={s.label} className="requests-page-stat">
                    <span className="requests-page-stat-val" style={{ color: s.color }}>{s.n}</span>
                    <span className="requests-page-stat-lbl">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {toolbar && <div className="requests-page-toolbar">{toolbar}</div>}
      </div>
    </header>
  );
}
