import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

function SidebarSection({ title, items, loc, defaultOpen = true, onItemHover }) {
  const isActive = items.some(it => loc.pathname.startsWith(it.to));
  const [open, setOpen] = useState(defaultOpen || isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  if (!items.length) return null;

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
  billingLink,
  personalItems,
  referralsItems,
  hrItems,
  adminItems,
  therapistOnly,
  loc,
  onItemHover,
}) {
  const flatOps = therapistOnly;

  return (
    <nav className="sidebar-nav flex flex-col gap-1 py-2">
      {homeLink && (
        <div className="sidebar-section-items px-2 mb-1">
          <NavLink
            to={homeLink.to}
            data-testid={homeLink.testid}
            end
            onMouseEnter={() => onItemHover?.(homeLink.to)}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            {homeLink.icon}
            <span>{homeLink.label}</span>
          </NavLink>
        </div>
      )}

      {flatOps ? (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Operations</div>
          <div className="sidebar-section-items">
            {operationsItems.map(it => (
              <NavLink
                key={it.to}
                to={it.to}
                data-testid={it.testid}
                onMouseEnter={() => onItemHover?.(it.to)}
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              >
                {it.icon}
                <span>{it.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ) : (
        <SidebarSection
          title="Operations"
          items={operationsItems}
          loc={loc}
          defaultOpen
          onItemHover={onItemHover}
        />
      )}

      {billingLink && (
        <div className="sidebar-section-items px-2">
          <NavLink
            to={billingLink.to}
            data-testid={billingLink.testid}
            onMouseEnter={() => onItemHover?.(billingLink.to)}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            {billingLink.icon}
            <span>{billingLink.label}</span>
          </NavLink>
        </div>
      )}

      {personalItems.length > 0 && (
        <SidebarSection
          title="Personal"
          items={personalItems}
          loc={loc}
          defaultOpen={therapistOnly}
          onItemHover={onItemHover}
        />
      )}

      <SidebarSection title="Referrals" items={referralsItems} loc={loc} onItemHover={onItemHover} />
      <SidebarSection title="HR" items={hrItems} loc={loc} onItemHover={onItemHover} />
      <SidebarSection title="Administration" items={adminItems} loc={loc} onItemHover={onItemHover} />
    </nav>
  );
}
