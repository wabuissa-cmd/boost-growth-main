import { ListChecks } from "@phosphor-icons/react";
import PageBanner from "./PageBanner";

export default function RequestsPageHeader({
  badge = "STAFF REQUESTS",
  title = "Staff Requests",
  subtitle,
  stats = [],
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) {
  const mappedTabs = tabs?.map((t) => ({
    ...t,
    icon: t.icon || <ListChecks size={14} weight={activeTab === t.id ? "fill" : "duotone"} />,
  }));

  return (
    <PageBanner
      title={title}
      subtitle={subtitle}
      eyebrow={badge}
      badge={(
        <span className="editorial-banner__icon-badge" aria-hidden>
          <ListChecks size={20} weight="duotone" />
        </span>
      )}
      stats={stats}
      tabs={mappedTabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      toolbar={toolbar}
      className={className}
    />
  );
}
