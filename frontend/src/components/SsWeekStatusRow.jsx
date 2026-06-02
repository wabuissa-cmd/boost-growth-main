import { Check, Prohibit, PushPin } from "@phosphor-icons/react";

const STYLE = {
  Completed: { bg: "#E5EBE1", border: "#B8C8A8", color: "#3D4F35" },
  "In Progress": { bg: "#fff", border: "#7A8A6A", color: "#48543E" },
  "Not started": { bg: "#FAFAF7", border: "#E8E4DE", color: "#8B9E7A" },
  Skipped: { bg: "#F5F5F5", border: "#D0D0D0", color: "#8B9E7A" },
};

/** Clickable SS week boxes — admin can mark Skipped (holiday) or force Completed. */
export default function SsWeekStatusRow({
  weeks = [],
  editable = false,
  compact = false,
  onToggleOverride,
}) {
  if (!weeks.length) return null;

  return (
    <div className={`flex gap-1.5 ${compact ? "" : "mt-1.5"}`}>
      {weeks.map(w => {
        const st = STYLE[w.weekStatus] || STYLE["Not started"];
        const done = w.weekStatus === "Completed";
        const skipped = w.weekStatus === "Skipped";
        const active = w.weekStatus === "In Progress";
        const canEdit = editable && onToggleOverride && !w.invoiceLocked;

        return (
          <button
            key={w.weekNumber}
            type="button"
            disabled={!canEdit}
            title={
              w.manual
                ? `W${w.weekNumber} · manual ${w.weekStatus}`
                : `${w.weekStatus}${w.attended != null ? ` · ${w.attended}/${w.schoolDays || 5} days` : ""}`
            }
            onClick={() => canEdit && onToggleOverride(w.weekNumber, w.overrideKey)}
            className={`flex-1 min-w-0 aspect-square max-w-[52px] rounded-lg border-2 flex flex-col items-center justify-center text-[10px] font-bold transition ${canEdit ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
            style={{ background: st.bg, borderColor: st.border, color: st.color }}
          >
            {done && (w.manual ? <PushPin size={14} weight="fill" /> : <Check size={14} weight="bold" />)}
            {skipped && <Prohibit size={14} weight="bold" />}
            {!done && !skipped && (active ? `W${w.weekNumber}` : `W${w.weekNumber}`)}
          </button>
        );
      })}
    </div>
  );
}

export function SsWeekLegend({ compact = false }) {
  if (compact) {
    return (
      <p className="text-[10px] mb-2" style={{ color: "#8B9E7A" }}>
        Tap a week to cycle: Auto → Skipped (holiday) → Force complete → Auto
      </p>
    );
  }
  return null;
}
