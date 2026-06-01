import { useNavigate } from "react-router-dom";
import { pkgStatusStyle, formatPkgBadge } from "../packageStatusUtils";

export function PackageStatusBadge({ row, clientId, onClick, className = "" }) {
  const navigate = useNavigate();
  if (!row) return null;
  const st = pkgStatusStyle(row.status);
  const label = formatPkgBadge(row);
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(row);
    else if (clientId) navigate(`/attendance?client=${clientId}&service=${row.service_type || "HS"}`);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${row.service_type} package · ${row.status}${row.invoice_number ? ` · ${row.invoice_number}` : ""}`}
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${row.status === "critical" ? "pkg-badge-critical" : ""} ${className}`}
      style={{ background: st.bg, color: st.color, borderColor: st.border }}
    >
      {st.icon} {row.service_type} · {label}
    </button>
  );
}

export function PackageAlertBanner({ row, onNewInvoice, onViewDetails }) {
  if (!row || row.is_closed || !["critical", "low"].includes(row.status)) return null;
  const st = pkgStatusStyle(row.status);
  const isCritical = row.status === "critical";
  const title = row.service_type === "HS"
    ? (isCritical ? "Package Almost Finished" : "Package Running Low")
    : (isCritical ? "Last Week of School Support Package" : "School Support Package Low");
  let body = "";
  if (row.service_type === "HS") {
    body = `Only ${row.remaining}h remaining from ${row.package_size}h package`;
  } else if (row.unit === "weeks") {
    body = isCritical
      ? `Week ${row.current_week || row.total_weeks} of ${row.total_weeks} — Consider renewing`
      : `${row.remaining} week(s) remaining of ${row.package_size}-week package`;
  } else {
    body = `${row.remaining} of ${row.package_size} sessions remaining`;
  }
  return (
    <div className="mx-5 mt-3 mb-0 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 no-print"
      style={{ background: st.bg, borderColor: st.border, color: st.color }}>
      <div>
        <div className="font-bold text-sm flex items-center gap-1.5">⚠️ {title}</div>
        <div className="text-xs mt-0.5 opacity-90">{body}</div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {onNewInvoice && (
          <button type="button" onClick={onNewInvoice} className="btn btn-primary text-xs">Issue New Invoice</button>
        )}
        {onViewDetails && (
          <button type="button" onClick={onViewDetails} className="btn btn-outline text-xs">View Invoice Details</button>
        )}
      </div>
    </div>
  );
}
