/** Light sage strip with orange progress — ZenithHR-style billing overview */
export default function BillingProgressStrip({ summary, items = [] }) {
  const open = items.length;
  const unpaid = summary?.unpaid ?? 0;
  const partial = summary?.partial ?? 0;
  const reminders = summary?.reminders_soon ?? 0;

  const withPartial = partial;
  const pct = open > 0 ? Math.round((withPartial / open) * 100) : 100;
  const barPct = open > 0 ? Math.max(8, Math.round(((open - unpaid) / open) * 100)) : 100;

  return (
    <div className="billing-progress-strip rounded-xl overflow-hidden border border-[#E2DDD4]">
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 ui-text-sm" style={{ background: "var(--bg-warm)", color: "var(--brand-dark)" }}>
        <span><strong>{open}</strong> open invoices</span>
        <span style={{ color: "#8A3F27" }}><strong>{unpaid}</strong> unpaid</span>
        <span style={{ color: "#6B5218" }}><strong>{partial}</strong> partial</span>
        {reminders > 0 && (
          <span style={{ color: "#606E52" }}><strong>{reminders}</strong> reminders soon</span>
        )}
      </div>
      <div className="px-4 py-2.5" style={{ background: "#FAFAF7" }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="ui-caption font-semibold" style={{ color: "#5C6853" }}>
            Payment progress · {open - unpaid} of {open} clients with partial or settled status
          </span>
          <span className="ui-caption font-bold" style={{ color: "#6B5218" }}>{barPct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E2DDD4" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barPct}%`, background: "linear-gradient(90deg, #D4A64A, #E8C87A)" }}
          />
        </div>
        {partial > 0 && (
          <div className="ui-caption mt-1.5" style={{ color: "#8B9E7A" }}>
            {pct}% of open items on installment plans ({partial} partial)
          </div>
        )}
      </div>
    </div>
  );
}
