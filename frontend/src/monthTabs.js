/** Fixed Jan–Jul month tabs for yearly purchase/payment views. */
export const YEAR_MONTH_TABS = [
  { key: "01", label: "Jan" },
  { key: "02", label: "Feb" },
  { key: "03", label: "Mar" },
  { key: "04", label: "Apr" },
  { key: "05", label: "May" },
  { key: "06", label: "Jun" },
  { key: "07", label: "Jul" },
];

export function yearMonthTabs(year = new Date().getFullYear()) {
  return YEAR_MONTH_TABS.map((m) => ({
    value: `${year}-${m.key}`,
    label: `${m.label} ${year}`,
    short: m.label,
  }));
}

export function monthKeyFromDate(iso) {
  return (iso || "").slice(0, 7);
}
