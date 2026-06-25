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
