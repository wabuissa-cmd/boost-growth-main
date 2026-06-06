export function DonutChart({ segments, totalLabel = "Total", size = 140 }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;

  return (
    <div className="reports-donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F0EDE9" strokeWidth="14" />
        {segments.map((seg, i) => {
          const frac = seg.value / sum;
          const dash = frac * c;
          const el = (
            <circle
              key={seg.label || i}
              cx="60" cy="60" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="reports-donut-center">
        <div className="reports-donut-val">{sum}</div>
        <div className="reports-donut-lbl">{totalLabel}</div>
      </div>
    </div>
  );
}

export function BarChart({ items, maxValue }) {
  const max = maxValue || Math.max(...items.map(x => x.value), 1);
  return (
    <div className="reports-bar-chart">
      {items.map(item => (
        <div key={item.label} className="reports-bar-col" title={`${item.label}: ${item.value}`}>
          <div
            className={`reports-bar-fill${item.gold ? " gold" : ""}`}
            style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
          />
          <div className="reports-bar-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
