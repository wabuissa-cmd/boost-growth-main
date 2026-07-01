/** Fixed Jan–Jul month tabs for yearly purchase/payment views. */
export const YEAR_MONTH_TABS = [
  { key: "01", label: "January", short: "Jan" },
  { key: "02", label: "February", short: "Feb" },
  { key: "03", label: "March", short: "Mar" },
  { key: "04", label: "April", short: "Apr" },
  { key: "05", label: "May", short: "May" },
  { key: "06", label: "June", short: "Jun" },
  { key: "07", label: "July", short: "Jul" },
];

export function yearMonthTabs(year = new Date().getFullYear()) {
  return YEAR_MONTH_TABS.map((m) => ({
    value: `${year}-${m.key}`,
    label: m.label,
    short: m.short,
    caption: `${m.label} ${year}`,
  }));
}

export function monthKeyFromDate(iso) {
  return (iso || "").slice(0, 7);
}

/** YYYY-MM from purchase_month, else purchase_date, else reimbursement_date. */
export function purchaseMonthKey(p) {
  const direct = (p?.purchase_month || "").trim();
  if (direct.length >= 7) return direct.slice(0, 7);
  const fromDate = monthKeyFromDate(p?.purchase_date);
  if (fromDate.length >= 7) return fromDate;
  return monthKeyFromDate(p?.reimbursement_date);
}

/** Pick the calendar year that most purchases belong to (for Jan–Jul tabs). */
export function resolvePurchaseYear(items = []) {
  const counts = {};
  for (const p of items) {
    const key = purchaseMonthKey(p);
    const year = key.slice(0, 4);
    if (/^\d{4}$/.test(year)) counts[year] = (counts[year] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length) return Number(ranked[0][0]);
  return new Date().getFullYear();
}

/** "2026-05" → "May 2026" */
export function formatMonthValue(value) {
  if (!value) return "—";
  const [y, m] = String(value).split("-");
  const tab = YEAR_MONTH_TABS.find((t) => t.key === m);
  if (tab && y) return `${tab.label} ${y}`;
  return value;
}
