import { Check, XCircle, X } from "@phosphor-icons/react";

const VARIANTS = {
  prep: {
    icon: Check,
    className: "schedule-status-badge--prep",
    title: "Preparation complete / تم التحضير",
  },
  no_show: {
    icon: XCircle,
    className: "schedule-status-badge--no-show",
    title: "No Show — session logged / لم يحضر",
  },
  therapist_cancel: {
    icon: X,
    className: "schedule-status-badge--therapist-cancel",
    title: "Therapist cancellation — cell locked for specialist / إلغاء المعالج",
  },
};

export default function SchedulePrepBadge({
  variant = "prep",
  className = "",
  onClear,
  clearTitle = "Remove prep checkmark",
}) {
  const cfg = VARIANTS[variant] || VARIANTS.prep;
  const Icon = cfg.icon;
  const clickable = variant === "prep" && onClear;

  return (
    <span
      className={`schedule-status-badge schedule-prep-badge ${cfg.className} ${clickable ? "schedule-prep-badge--clickable" : ""} ${className}`.trim()}
      title={clickable ? clearTitle : cfg.title}
      aria-label={clickable ? clearTitle : cfg.title}
      role={clickable ? "button" : "img"}
      onClick={clickable ? (e) => { e.stopPropagation(); onClear(e); } : undefined}
    >
      <Icon size={9} weight="bold" />
    </span>
  );
}
