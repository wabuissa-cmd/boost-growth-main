import { Fragment } from "react";

function TabStepPill({ label, active, onClick, testId, icon: Icon }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`center-test-step portal-page-view-step${active ? " active" : ""}`}
      onClick={onClick}
    >
      <span className="center-test-step-num">
        {Icon ? <Icon size={14} weight={active ? "fill" : "duotone"} /> : null}
      </span>
      <span className={`center-test-step-label${active ? " font-semibold" : ""}`}>{label}</span>
    </button>
  );
}

/** Reusable My Learning–style page header. `prefix` drives scoped CSS classes (e.g. clients-page-hero). */
export default function PortalPageHeader({
  prefix,
  badge,
  title,
  subtitle,
  icon: Icon,
  stats = [],
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) {
  const p = prefix;

  return (
    <header className={`${p}-page-header ${className}`.trim()}>
      <div className={`${p}-page-top-bar`}>
        <div className={`${p}-page-badge`}>{badge}</div>
      </div>

      {tabs?.length > 0 && onTabChange && (
        <div className={`center-test-steps-bar ${p}-page-steps`}>
          {tabs.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <div className="center-test-step-line" />}
              <TabStepPill
                label={t.count != null ? `${t.label} (${t.count})` : t.label}
                active={activeTab === t.id}
                onClick={() => onTabChange(t.id)}
                testId={t.testId || `${p}-tab-${t.id}`}
                icon={t.icon}
              />
            </Fragment>
          ))}
        </div>
      )}

      <div className={`${p}-page-hero card`}>
        <div className={`${p}-page-hero-row`}>
          {Icon && (
            <div className={`${p}-page-hero-icon`}>
              <Icon size={28} weight="duotone" />
            </div>
          )}
          <div className={`${p}-page-hero-copy min-w-0 flex-1`}>
            <h1 className={`${p}-page-title`}>{title}</h1>
            {subtitle && <p className={`${p}-page-subtitle`}>{subtitle}</p>}
            {stats.length > 0 && (
              <div className={`${p}-page-stats`}>
                {stats.map((s) => (
                  <div key={s.label} className={`${p}-page-stat`}>
                    <span className={`${p}-page-stat-val`} style={{ color: s.color }}>{s.n}</span>
                    <span className={`${p}-page-stat-lbl`}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {toolbar && <div className={`${p}-page-toolbar`}>{toolbar}</div>}
      </div>
    </header>
  );
}
