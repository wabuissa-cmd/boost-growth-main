import PageBanner from "./PageBanner";

const CELL_LEGEND = [
  { bg: "#E5EBE1", border: "#B8C8A8", label: "Session" },
  { bg: "#FAF0D1", border: "#E5C387", label: "Available" },
  { bg: "#F8EBE7", border: "#E8A898", label: "Cancelled" },
  { bg: "#F0EDE9", border: "#E8E4DE", label: "Empty" },
  { bg: "#EAF0F3", border: "#B8CCD8", label: "Leave / Break" },
];

/** Schedule page header — stats, legend, codes, and compact toolbar in one banner. */
export default function SchedulePageHeader({
  subtitle,
  badge,
  stats = [],
  serviceCodes = [],
  toolbar,
}) {
  return (
    <PageBanner
      title="Weekly Schedule"
      subtitle={subtitle}
      badge={badge}
      stats={stats}
      toolbar={toolbar}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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

      {serviceCodes.length > 0 && (
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
        Each child has a unique color · Long-press on mobile for cell menu
      </p>
    </PageBanner>
  );
}
