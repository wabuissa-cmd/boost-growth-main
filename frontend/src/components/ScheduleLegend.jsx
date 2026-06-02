export default function ScheduleLegend() {
  const items = [
    { bg: "#E5EBE1", border: "#B8C8A8", label: "Session" },
    { bg: "#FAF0D1", border: "#E5C387", label: "Available" },
    { bg: "#F8EBE7", border: "#E8A898", label: "Cancelled" },
    { bg: "#F0EDE9", border: "#E8E4DE", label: "Empty" },
    { bg: "#EAF0F3", border: "#B8CCD8", label: "Leave / Break" },
  ];
  return (
    <div className="schedule-legend flex flex-wrap items-center gap-3 px-1 py-2 mb-3">
      <span className="ui-caption font-bold uppercase tracking-wide" style={{ color: "#8B9E7A" }}>Legend</span>
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5 ui-caption">
          <span className="w-3 h-3 rounded border shrink-0" style={{ background: it.bg, borderColor: it.border }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
