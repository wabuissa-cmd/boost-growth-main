import { Check } from "@phosphor-icons/react";

const TOOLTIP = "Preparation complete / تم التحضير";

export default function SchedulePrepBadge({ className = "" }) {
  return (
    <span
      className={`schedule-prep-badge ${className}`.trim()}
      title={TOOLTIP}
      aria-label={TOOLTIP}
      role="img"
    >
      <Check size={9} weight="bold" />
    </span>
  );
}
