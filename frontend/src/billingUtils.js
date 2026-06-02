export function paymentStatusLabel(status) {
  const s = (status || "pending").toLowerCase();
  if (s === "complete" || s === "paid") return "Paid";
  if (s === "partial") return "Partial";
  return "Unpaid";
}

export function paymentStatusStyle(status) {
  const s = (status || "pending").toLowerCase();
  if (s === "complete" || s === "paid") {
    return { bg: "#E5EBE1", color: "#3D4F35", border: "#B8C8A8" };
  }
  if (s === "partial") {
    return { bg: "#FAF0D1", color: "#6B5218", border: "#E5C387" };
  }
  return { bg: "#F8EBE7", color: "#8A3F27", border: "#E8A898" };
}

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })} SAR`;
}
