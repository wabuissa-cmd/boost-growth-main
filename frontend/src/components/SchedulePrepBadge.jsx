import { Check } from "@phosphor-icons/react";

const TOOLTIP = "Preparation complete / تم التحضير";

export default function SchedulePrepBadge({ className = "", onClear, clearTitle = "Remove prep checkmark" }) {
  return (
    <span
      className={`schedule-prep-badge ${onClear ? "schedule-prep-badge--clickable" : ""} ${className}`.trim()}
      title={onClear ? clearTitle : TOOLTIP}
      aria-label={onClear ? clearTitle : TOOLTIP}
      role={onClear ? "button" : "img"}
      onClick={onClear ? (e) => { e.stopPropagation(); onClear(e); } : undefined}
    >
      <Check size={9} weight="bold" />
    </span>
  );
}
