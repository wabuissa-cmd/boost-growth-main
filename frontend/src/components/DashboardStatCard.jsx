import { Link } from "react-router-dom";

export default function DashboardStatCard({
  icon,
  value,
  label,
  desc,
  variant = "default",
  to,
  testId,
}) {
  const cls = ["dash-stat-card", variant !== "default" ? variant : ""].filter(Boolean).join(" ");
  const inner = (
    <>
      {icon && (
        <div className="dash-stat-icon">{icon}</div>
      )}
      <div className="min-w-0">
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
        {desc && <div className="dash-stat-desc">{desc}</div>}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} data-testid={testId}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} data-testid={testId}>
      {inner}
    </div>
  );
}
