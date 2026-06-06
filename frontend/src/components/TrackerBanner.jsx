/** Green hero + dark stats strip — shared by Attendance & Schedule. */
export default function TrackerBanner({ title, subtitle, badge, stats = [], footer }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-5 shadow-sm border border-[#E2DDD4]">
      <div className="bg-sage-hero px-5 py-4 sm:py-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white m-0 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/80 text-sm sm:text-base mt-1.5 mb-0 max-w-2xl leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {stats.length > 0 && (
        <div
          className="grid divide-x divide-white/10"
          style={{
            background: "#606E52",
            gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {stats.map(s => (
            <div key={s.label} className="py-3 px-2 text-center min-w-0">
              <div
                className="text-lg sm:text-2xl font-bold leading-none truncate px-1"
                style={{ color: s.accent || "#fff" }}
                title={String(s.n)}
              >
                {s.n}
              </div>
              <div className="text-[10px] uppercase tracking-wider mt-1 font-bold text-white/50">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {footer && (
        <div className="px-4 sm:px-5 py-3" style={{ background: "#F6F4F0" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
