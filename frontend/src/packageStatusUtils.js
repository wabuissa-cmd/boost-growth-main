/** Package status badge / banner helpers (HS hours · SS weeks/sessions). */

export const PKG_STATUS_STYLE = {
  good:     { bg: "#E5EBE1", color: "#3D4F35", border: "#B8C8A8", icon: "🟢" },
  low:      { bg: "#FAF0D1", color: "#6B5218", border: "#E5C387", icon: "🟡" },
  critical: { bg: "#FCE0E8", color: "#8B3A55", border: "#E8A0B8", icon: "🔴", pulse: true },
  expired:  { bg: "#F0EDE9", color: "#8B9E7A", border: "#DDD8D0", icon: "⚫" },
  none:     { bg: "#F5F5F5", color: "#9CA3AF", border: "#E5E5E5", icon: "⚫" },
};

export const PKG_SORT_ORDER = { critical: 0, expired: 1, low: 2, good: 3, none: 4 };

export function pkgStatusStyle(status) {
  return PKG_STATUS_STYLE[status] || PKG_STATUS_STYLE.none;
}

export function formatPkgBadge(row) {
  if (!row || row.status === "none") return "No open invoice";
  if (row.service_type === "HS") {
    const pkg = row.package_size ?? 24;
    const rem = row.remaining ?? 0;
    return `${pkg}h · ${rem}h left`;
  }
  if (row.unit === "weeks") return row.label || `Wk ${row.current_week || "?"} of ${row.total_weeks || "?"}`;
  return row.label || `${row.remaining ?? 0} sessions left`;
}

export function formatPkgUsedRemaining(row) {
  if (!row || row.status === "none") return { used: "—", remaining: "—", pkg: "—" };
  if (row.service_type === "HS") {
    return {
      pkg: `${row.package_size}h`,
      used: `${row.used}h`,
      remaining: `${row.remaining}h`,
    };
  }
  if (row.unit === "weeks") {
    return {
      pkg: `${row.package_size} wks`,
      used: `${row.used} wks`,
      remaining: `${row.remaining} wk${row.remaining !== 1 ? "s" : ""}`,
    };
  }
  return {
    pkg: `${row.package_size} sess`,
    used: `${row.used}`,
    remaining: `${row.remaining}`,
  };
}

export function packageAlertMessage(row) {
  if (!row || !["critical", "low"].includes(row.status)) return null;
  if (row.service_type === "HS") {
    return {
      title: row.status === "critical" ? "Package Almost Finished" : "Package Running Low",
      body: `Only ${row.remaining}h remaining from ${row.package_size}h package`,
    };
  }
  if (row.unit === "weeks") {
    return {
      title: row.status === "critical" ? "Last Week of School Support Package" : "School Support Package Low",
      body: row.status === "critical"
        ? `Week ${row.current_week || row.total_weeks} of ${row.total_weeks} — Consider renewing`
        : `${row.remaining} week(s) remaining of ${row.package_size}-week package`,
    };
  }
  return {
    title: "School Support Sessions Low",
    body: `${row.remaining} of ${row.package_size} sessions remaining`,
  };
}
