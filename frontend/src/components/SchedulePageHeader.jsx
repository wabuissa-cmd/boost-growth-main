const CELL_LEGEND = [
  { bg: "#E5EBE1", border: "#B8C8A8", label: "Session" },
  { bg: "#FAF0D1", border: "#E5C387", label: "Available" },
  { bg: "#F8EBE7", border: "#E8A898", label: "Cancelled" },
  { bg: "#F0EDE9", border: "#E8E4DE", label: "Empty" },
  { bg: "#EAF0F3", border: "#B8CCD8", label: "Leave / Break" },
];

/** Compact beige/white schedule header — stats, legend, and codes in one strip. */
export default function SchedulePageHeader({
  subtitle,
  badge,
  stats = [],
  serviceCodes = [],
  zoom = 100,
}) {
  return (
    <div className="rounded-2xl overflow-hidden mb-4 border border-[#E8E4DE] shadow-sm">
      <div
        className="px-4 py-2.5 flex items-start justify-between gap-3"
        style={{ background: "#F0E9D8" }}
      >
        <div className="min-w-0">
          <h1 className="ui-page-title m-0">Weekly Schedule</h1>
          {subtitle && <p className="ui-caption mt-0.5 mb-0">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      <div className="px-4 py-3 bg-white">
        {stats.length > 0 && (
          <div
            className="grid gap-2 mb-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
          >
            {stats.map(s => (
              <div
                key={s.label}
                className="rounded-xl px-2.5 py-2 min-w-0"
                style={{ background: "#FAFAF7", border: "1px solid #E8E4DE" }}
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

        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2.5"
          style={{ borderTop: "1px solid #E8E4DE" }}
        >
          <span className="ui-caption font-bold uppercase tracking-wide shrink-0" style={{ color: "#8B9E7A" }}>
            Legend
          </span>
          {CELL_LEGEND.map(it => (
            <span key={it.label} className="inline-flex items-center gap-1 ui-caption shrink-0">
              <span
                className="w-2.5 h-2.5 rounded border shrink-0"
                style={{ background: it.bg, borderColor: it.border }}
              />
              {it.label}
            </span>
          ))}
        </div>

        {(serviceCodes.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {serviceCodes.map(s => (
              <span key={s.id} className={`pill text-[10px] ${s.cls}`}>{s.short}</span>
            ))}
            <span
              className="pill text-[10px]"
              style={{ background: "#FFF4C4", color: "#6B5218", border: "1px solid #E8C572" }}
            >
              ✕ Therapist Cancel
            </span>
            <span
              className="pill text-[10px]"
              style={{ background: "#FCE0E8", color: "#8B3A55", border: "1px solid #E8A4BD" }}
            >
              ✕ Client Cancel
            </span>
          </div>
        )}

        <p className="ui-caption mt-2 mb-0">
          Each child has a unique color · Long-press on mobile for cell menu · Zoom {zoom}%
        </p>
      </div>
    </div>
  );
}
