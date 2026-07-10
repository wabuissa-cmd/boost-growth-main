import { ClipboardText, Warning, CheckCircle, UsersThree } from "@phosphor-icons/react";
import PageBanner from "./PageBanner";

export default function AttendancePageHeader({
  subtitle,
  stats = [],
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) {
  return (
    <PageBanner
      title="Session Preparation"
      subtitle={subtitle}
      eyebrow="SESSION PREP"
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
      className={`editorial-banner--attendance editorial-banner--compact-mobile ${className}`.trim()}
    />
  );
}

export const ATTENDANCE_FILTER_TABS = [
  { id: "all", label: "All clients", icon: <UsersThree size={14} weight="duotone" /> },
  { id: "urgent", label: "Urgent", icon: <Warning size={14} weight="duotone" /> },
  { id: "warning", label: "Warning", icon: <Warning size={14} weight="duotone" /> },
  { id: "ok", label: "On track", icon: <CheckCircle size={14} weight="duotone" /> },
];
