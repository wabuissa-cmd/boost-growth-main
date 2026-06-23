/** Editorial page header — integrated rounded banner with pill tabs. */
import "../editorialLayout.css";

export default function PageBanner({
  title,
  subtitle,
  badge,
  stats = [],
  children,
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  image,
  className = "",
  variant = "editorial",
}) {
  const hasPanel = stats.length > 0 || children || toolbar;
  const hasNav = tabs?.length > 0;

  if (variant === "classic") {
    const hasBody = stats.length > 0 || children || toolbar;
    return (
      <div className={`page-banner classic ${className}`.trim()}>
        <div className="page-banner-head px-4 py-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-banner-title m-0">{title}</h1>
            {subtitle && <p className="page-banner-subtitle mt-0.5 mb-0">{subtitle}</p>}
          </div>
          {badge && <div className="shrink-0 flex flex-wrap gap-1.5 justify-end">{badge}</div>}
        </div>
        {hasBody && (
          <div className="px-4 py-3 bg-white">
            {stats.length > 0 && (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
              >
                {stats.map(s => (
                  <div key={s.label} className="editorial-stat">
                    <div className="editorial-stat__label">{s.label}</div>
                    <div className="editorial-stat__value" style={{ color: s.color }}>{s.n}</div>
                  </div>
                ))}
              </div>
            )}
            {children && <div className={stats.length > 0 ? "mt-3 pt-3 border-t border-[#E2DDD4]" : ""}>{children}</div>}
            {toolbar && <div className={stats.length > 0 || children ? "mt-3 pt-3 border-t border-[#E2DDD4]" : ""}>{toolbar}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className={`editorial-banner${image ? " has-image" : ""} ${className}`.trim()}>
      {image && (
        <>
          <div className="editorial-banner__bg" style={{ backgroundImage: `url(${image})` }} aria-hidden />
          <div className="editorial-banner__scrim" aria-hidden />
        </>
      )}

      {hasNav && (
        <nav className="editorial-banner__nav" aria-label="Sections">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              data-testid={t.testId}
              className={`editorial-pill${activeTab === t.id ? " is-active" : ""}`}
              onClick={() => onTabChange?.(t.id)}
            >
              {t.icon}
              {t.label}
              {t.count != null ? ` (${t.count})` : ""}
            </button>
          ))}
        </nav>
      )}

      <div className="editorial-banner__head">
        <div className="editorial-banner__copy">
          <p className="editorial-banner__eyebrow">Boost Growth · Staff Portal</p>
          <h1 className="editorial-banner__title">{title}</h1>
          {subtitle && <p className="editorial-banner__subtitle">{subtitle}</p>}
        </div>
        {badge && <div className="editorial-banner__badge">{badge}</div>}
      </div>

      {hasPanel && (
        <div className="editorial-banner__panel">
          {stats.length > 0 && (
            <div
              className="editorial-banner__stats"
              style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
            >
              {stats.map(s => (
                <div key={s.label} className="editorial-stat">
                  <div className="editorial-stat__label">{s.label}</div>
                  <div className="editorial-stat__value" style={{ color: s.color || undefined }} title={String(s.n)}>
                    {s.n}
                  </div>
                </div>
              ))}
            </div>
          )}
          {toolbar && <div className="editorial-banner__toolbar">{toolbar}</div>}
          {children}
        </div>
      )}
    </section>
  );
}
