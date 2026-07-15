import { ClipboardText, Warning, CheckCircle, UsersThree } from "@phosphor-icons/react";
import PageBanner from "./PageBanner";

const FILTER_ICONS = {
  all: UsersThree,
  urgent: Warning,
  warning: Warning,
  ok: CheckCircle,
};

export default function AttendancePageHeader({
  subtitle,
  stats = [],
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  className = "",
  pageSettings,
}) {
  return (
    <PageBanner
      title={pageSettings?.page_title || "Session Preparation"}
      subtitle={subtitle || pageSettings?.page_subtitle}
      eyebrow={pageSettings?.page_eyebrow || "SESSION PREP"}
      badge={(
        <span className="editorial-banner__icon-badge" aria-hidden>
          <ClipboardText size={20} weight="duotone" />
        </span>
      )}
      stats={stats}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      toolbar={toolbar}
      className={`editorial-banner--attendance ${className}`.trim()}
    />
  );
}

export const ATTENDANCE_FILTER_TABS = [
  { id: "all", label: "All clients", icon: <UsersThree size={14} weight="duotone" /> },
  { id: "urgent", label: "Urgent", icon: <Warning size={14} weight="duotone" /> },
  { id: "warning", label: "Warning", icon: <Warning size={14} weight="duotone" /> },
  { id: "ok", label: "On track", icon: <CheckCircle size={14} weight="duotone" /> },
];

/** Build filter tabs from page settings (keep fixed icons by id). */
export function buildAttendanceFilterTabs(pageSettings) {
  const raw = (pageSettings?.filter_tabs?.length ? pageSettings.filter_tabs : ATTENDANCE_FILTER_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    enabled: true,
  }))).filter((t) => t && t.enabled !== false);

  return raw.map((t) => {
    const Icon = FILTER_ICONS[t.id] || UsersThree;
    return {
      id: t.id,
      label: t.label,
      icon: <Icon size={14} weight="duotone" />,
    };
  });
}
