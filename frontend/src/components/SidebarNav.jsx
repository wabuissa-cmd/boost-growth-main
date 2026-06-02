import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

function SidebarSection({ title, items, loc, defaultOpen = true, onItemHover, collapsed }) {
  const isActive = items.some(it => loc.pathname.startsWith(it.to));
  const [open, setOpen] = useState(defaultOpen || isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  if (!items.length) return null;

  if (collapsed) {
    return (
      <div className="sidebar-section-items">
        {items.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            data-testid={it.testid}
            end={it.to === "/home"}
            title={it.label}
            onMouseEnter={() => onItemHover?.(it.to)}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            {it.icon}
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      {title ? (
        <button
          type="button"
          className="sidebar-section-head"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <span>{title}</span>
          {open ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
        </button>
      ) : null}
      {(open || !title) && (
        <div className="sidebar-section-items">
          {items.map(it => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.testid}
              end={it.to === "/home"}
              onMouseEnter={() => onItemHover?.(it.to)}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              {it.icon}
              <span>{it.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SidebarNav({
  homeLink,
  operationsItems,
  personalItems,
  referralsItems,
  hrItems,
  adminItems,
  therapistOnly,
  loc,
  onItemHover,
  collapsed = false,
}) {
  const flatOps = therapistOnly;

  const renderLink = (it, end = false) => (
    <NavLink
      key={it.to}
      to={it.to}
      data-testid={it.testid}
      end={end}
      title={collapsed ? it.label : undefined}
      onMouseEnter={() => onItemHover?.(it.to)}
      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
    >
      {it.icon}
      {!collapsed && <span>{it.label}</span>}
    </NavLink>
  );

  return (
    <nav className="sidebar-nav flex flex-col gap-1 py-2">
      {homeLink && (
        <div className="sidebar-section-items px-2 mb-1">
          {renderLink(homeLink, true)}
        </div>
      )}

      {flatOps ? (
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-label">Operations</div>}
          <div className="sidebar-section-items">
            {operationsItems.map(it => renderLink(it))}
          </div>
        </div>
      ) : (
        <SidebarSection
          title="Operations"
          items={operationsItems}
          loc={loc}
          defaultOpen
          onItemHover={onItemHover}
          collapsed={collapsed}
        />
      )}

      {personalItems.length > 0 && (
        <SidebarSection
          title="Personal"
          items={personalItems}
          loc={loc}
          defaultOpen={therapistOnly}
          onItemHover={onItemHover}
          collapsed={collapsed}
        />
      )}

      <SidebarSection title="Referrals" items={referralsItems} loc={loc} onItemHover={onItemHover} collapsed={collapsed} />
      <SidebarSection title="HR" items={hrItems} loc={loc} defaultOpen={Boolean(hrItems.some(it => it.to === "/billing"))} onItemHover={onItemHover} collapsed={collapsed} />
      <SidebarSection title="Administration" items={adminItems} loc={loc} onItemHover={onItemHover} collapsed={collapsed} />
    </nav>
  );
}
