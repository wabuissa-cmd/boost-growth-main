/** Fallback when /purchases/categories fails or is slow — keep in sync with backend PURCHASE_CATEGORIES. */
export const DEFAULT_PURCHASE_CATEGORIES = [
  "Events & Celebrations",
  "Training & Workshops",
  "Catering & Hospitality",
  "Supplies & Materials",
  "Services",
  "Transportations",
  "Software & Subscriptions",
  "Marketing & Media",
  "Decoration",
  "Miscellaneous",
];

export function parsePurchaseNumber(v) {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function sumLineItems(lines) {
  if (!Array.isArray(lines) || !lines.length) return null;
  let sum = 0;
  let any = false;
  for (const li of lines) {
    const t = li?.total != null ? Number(li.total) : null;
    if (t != null && Number.isFinite(t)) {
      sum += t;
      any = true;
      continue;
    }
    const qty = parsePurchaseNumber(li?.qty) ?? 1;
    const unit = parsePurchaseNumber(li?.unit_price);
    if (unit != null) {
      sum += qty * unit;
      any = true;
    }
  }
  return any ? sum : null;
}

export function computePurchaseTotal(p) {
  if (!p) return null;
  const direct = parsePurchaseNumber(p.total);
  if (direct != null) return direct;
  const fromDisplay = parsePurchaseNumber(p.total_display);
  if (fromDisplay != null) return fromDisplay;
  const fromLines = sumLineItems(p.line_items);
  if (fromLines != null) return fromLines;
  const qty = parsePurchaseNumber(p.qty) ?? 1;
  const unit = parsePurchaseNumber(p.unit_price);
  if (unit != null) return qty * unit;
  return null;
}

export function formatPurchaseTotal(p) {
  const n = computePurchaseTotal(p);
  if (n != null) return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} SR`;
  if (p?.total_display) return String(p.total_display);
  return "—";
}
