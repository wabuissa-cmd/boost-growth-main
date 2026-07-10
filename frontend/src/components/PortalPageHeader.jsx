import PageBanner from "./PageBanner";

/** Unified editorial banner — wraps PageBanner for portal pages (Client Info, Directory, Manager Hub, …). */
export default function PortalPageHeader({
  prefix: _prefix,
  badge,
  title,
  subtitle,
  icon: Icon,
  stats = [],
  toolbar,
  tabs,
  activeTab,
  onTabChange,
  className = "",
  children,
}) {
  const mappedTabs = tabs?.map((t) => ({
    ...t,
    icon: t.icon || null,
  }));

  return (
    <PageBanner
      title={title}
      subtitle={subtitle}
      eyebrow={badge}
      badge={Icon ? (
        <span className="editorial-banner__icon-badge" aria-hidden>
          <Icon size={20} weight="duotone" />
        </span>
      ) : null}
      stats={stats}
      tabs={mappedTabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      toolbar={toolbar}
      className={className}
    >
      {children}
    </PageBanner>
  );
}
