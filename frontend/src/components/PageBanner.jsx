/** Beige + white page header — shared template across portal pages. */
export default function PageBanner({ title, subtitle, badge, stats = [], children, toolbar }) {
  const hasBody = stats.length > 0 || children || toolbar;

  return (
    <div className="rounded-[1.25rem] mb-4 border border-[#E2DDD4] shadow-sm overflow-hidden">
      <div
        className="px-4 py-3 flex items-start justify-between gap-3"
        style={{ background: "linear-gradient(90deg, #F0E9D8 0%, #E5EBE1 100%)" }}
      >
        <div className="min-w-0">
          <h1 className="ui-page-title m-0">{title}</h1>
          {subtitle && <p className="ui-caption mt-0.5 mb-0">{subtitle}</p>}
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
                <div
                  key={s.label}
                  className="rounded-[14px] px-2.5 py-2 min-w-0"
                  style={{ background: "#FAFAF7", border: "1px solid #E2DDD4" }}
                >
                  <div className="text-[10px] tracking-widest font-bold truncate" style={{ color: "#8B9E7A" }}>
                    {s.label.toUpperCase()}
                  </div>
                  <div
                    className="text-base font-display font-semibold leading-tight mt-0.5 truncate"
                    style={{ color: s.color || "#2C3625" }}
                    title={String(s.n)}
                  >
                    {s.n}
                  </div>
                </div>
              ))}
            </div>
          )}

          {children && (
            <div className={stats.length > 0 ? "mt-3 pt-3 border-t border-[#E8E4DE]" : ""}>
              {children}
            </div>
          )}

          {toolbar && (
            <div className={stats.length > 0 || children ? "mt-3 pt-3 border-t border-[#E8E4DE]" : ""}>
              {toolbar}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
