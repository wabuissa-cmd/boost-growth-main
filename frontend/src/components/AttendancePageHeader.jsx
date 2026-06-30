import { ClipboardText } from "@phosphor-icons/react";

export default function AttendancePageHeader({
  subtitle,
  stats = [],
  toolbar,
  className = "",
}) {
  return (
    <header className={`attendance-page-header ${className}`.trim()}>
      <div className="attendance-page-top-bar">
        <div className="attendance-page-badge">ATTENDANCE</div>
      </div>

      <div className="attendance-page-hero card">
        <div className="attendance-page-hero-row">
          <div className="attendance-page-hero-icon">
            <ClipboardText size={28} weight="duotone" />
          </div>
          <div className="attendance-page-hero-copy min-w-0 flex-1">
            <h1 className="attendance-page-title">Session Preparation</h1>
            {subtitle && <p className="attendance-page-subtitle">{subtitle}</p>}
            {stats.length > 0 && (
              <div className="attendance-page-stats">
                {stats.map((s) => (
                  <div key={s.label} className="attendance-page-stat">
                    <span className="attendance-page-stat-val" style={{ color: s.color }}>{s.n}</span>
                    <span className="attendance-page-stat-lbl">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {toolbar && <div className="attendance-page-toolbar">{toolbar}</div>}
      </div>
    </header>
  );
}
