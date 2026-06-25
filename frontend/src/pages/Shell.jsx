import { useEffect, useState, useRef, Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth, showAdminNav, isClientLead, hasOpsAccess, canEditStaffRequests, canEditIntake, canManageLeaves, canHrReviewLeaves, isHrOps, showSystemAdmin, canImportData, isWalaaOps } from "../auth";
import api, { startOfWeek, toISODate } from "../api";
import { prefetch } from "../dataCache";
import {
  House, CalendarBlank,   ClipboardText, UsersThree, Receipt,
  Bell, SignOut,   ListChecks, Gear, UserList, List, X, ChartBar, UploadSimple, CaretDown, Folder, UserCircle,
  SidebarSimple, Rows, ShoppingBag, FileText, GraduationCap, Hourglass,
} from "@phosphor-icons/react";

import SidebarNav from "../components/SidebarNav";

const NAV_LAYOUT_KEY = "bg_nav_layout";
const SIDEBAR_COLLAPSED_KEY = "bg_sidebar_collapsed";

const ROUTE_PREFETCH = {
  "/home": () => {
    const weekISO = toISODate(startOfWeek(new Date()));
    prefetch("/clients");
    prefetch("/therapists");
    prefetch("/schedule", { week_start: weekISO });
  },
  "/schedule": () => {
    prefetch("/schedule", { week_start: toISODate(startOfWeek(new Date())) });
    prefetch("/clients");
    prefetch("/therapists");
  },
  "/attendance": () => {
    prefetch("/clients");
    prefetch("/clients/package-status");
    prefetch("/therapists");
  },
  "/billing": () => {
    prefetch("/billing/dashboard");
  },
  "/clients": () => {
    prefetch("/clients");
    prefetch("/therapists");
    prefetch("/clients/package-status");
  },
  "/waiting/intake": () => { prefetch("/intake"); },
  "/waiting/school": () => { prefetch("/intake"); },
};

function warmRoute(path) {
  ROUTE_PREFETCH[path]?.();
}

export default function Shell() {
  const { user, logout } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [navLayout, setNavLayout] = useState(() => {
    try { return localStorage.getItem(NAV_LAYOUT_KEY) || "sidebar"; } catch { return "sidebar"; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const loc = useLocation();
  const portalAdmin = showAdminNav(user);
  const hrOps = isHrOps(user);
  const walaaOps = isWalaaOps(user);
  const clientLead = isClientLead(user);
  const staffRequestsAccess = canEditStaffRequests(user);
  const leaveManager = canManageLeaves(user);
  const hrLeaveReview = canHrReviewLeaves(user);
  const intakeAccess = canEditIntake(user);
  const showPersonal = !portalAdmin && !hrOps;
  const showBilling = hasOpsAccess(user);
  const therapistOnly = Boolean(user && !portalAdmin && !hrOps && !walaaOps);
  const profileRole = hrOps ? "HR" : walaaOps ? "Coordination" : portalAdmin ? "Admin" : "Therapist";

  const loadNotifs = async () => {
    try { const { data } = await api.get("/notifications"); setNotifs(data); } catch(_e) { /* ignore */ }
  };
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, [loc.pathname]);
  useEffect(() => { setMobileNav(false); setShowNotif(false); }, [loc.pathname]);
  useEffect(() => {
    if (!user) return;
    prefetch("/clients");
    prefetch("/therapists");
  }, [user]);
  useEffect(() => { warmRoute(loc.pathname); }, [loc.pathname]);

  const unread = notifs.filter(n => !n.read).length;

  // ── Grouped navigation
  const operationsItems = [
    { to: "/schedule", label: "Schedule", testid: "nav-schedule", icon: <CalendarBlank size={18} weight="duotone"/> },
    { to: "/attendance", label: "Session Preparation", testid: "nav-attendance", icon: <ClipboardText size={18} weight="duotone"/> },
    ...(showBilling ? [{ to: "/billing", label: "Billing & Payments", testid: "nav-billing", icon: <Receipt size={18} weight="duotone"/> }] : []),
    { to: "/clients", label: "Client Info", testid: "nav-clients", icon: <UsersThree size={18} weight="duotone"/> },
  ];

  const baseLinks = [
    { to: "/home", icon: <House size={18} weight="duotone"/>, label: "Home", testid: "nav-home" },
  ];

  const waitingItems = intakeAccess
    ? [
        { to: "/waiting/intake", label: "Intake Waiting", testid: "nav-intake-waiting", icon: <Hourglass size={17} weight="duotone"/> },
        { to: "/waiting/school", label: "School Waiting", testid: "nav-school-waiting", icon: <GraduationCap size={17} weight="duotone"/> },
      ]
    : [];

  // Personal portal dropdown (therapists + ops team; hidden for admin login)
  const myPortalItems = showPersonal ? [
    { to: "/my-requests", label: "Request", testid: "nav-my-requests" },
    { to: "/my-reports", label: "My Report", testid: "nav-my-reports" },
  ] : [];

  // HR — staff requests & leave tools (single page with tabs)
  const requestsItems = [];
  if (staffRequestsAccess || leaveManager || hrLeaveReview) {
    requestsItems.push({ to: "/staff-leave", label: "Staff & Leave", testid: "nav-staff-leave" });
  }

  const financeItems = [];
  if (portalAdmin || hrOps) {
    financeItems.push({ to: "/purchases", label: "Purchases", testid: "nav-purchases", icon: <ShoppingBag size={17} weight="duotone"/> });
  }

  // Admin tools — Import for client-lead team + HR; full admin suite for portal admin only
  const adminTools = [
    ...(canImportData(user)
      ? [{ to: "/import", label: "Import", testid: "nav-import", icon: <UploadSimple size={17} weight="duotone"/> }]
      : []),
    ...(showSystemAdmin(user)
      ? [
          { to: "/reports", label: "Reports", testid: "nav-reports", icon: <ChartBar size={17} weight="duotone"/> },
          { to: "/admin", label: "Admin", testid: "nav-admin", icon: <Gear size={17} weight="duotone"/> },
        ]
      : []),
  ];

  const hrDropdownItems = [...requestsItems];

  const financeDropdownItems = financeItems.map(it => ({
    to: it.to,
    label: it.label,
    testid: it.testid,
  }));

  const homeLink = baseLinks[0];
  const hrNavItems = (walaaOps ? [] : requestsItems).map(it => ({
    ...it,
    icon: <ListChecks size={17} weight="duotone"/>,
  }));

  const personalNavItems = myPortalItems.map(it => ({
    ...it,
    icon: it.to === "/my-reports"
      ? <FileText size={17} weight="duotone"/>
      : <ListChecks size={17} weight="duotone"/>,
  }));
  const waitingNavItems = waitingItems;

  const toggleNavLayout = () => {
    const next = navLayout === "sidebar" ? "top" : "sidebar";
    try { localStorage.setItem(NAV_LAYOUT_KEY, next); } catch { /* ignore */ }
    setNavLayout(next);
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const useSidebar = navLayout === "sidebar";

  const markAllRead = async () => { await api.post("/notifications/read-all"); loadNotifs(); };
  const acknowledge = async (nid) => {
    await api.post(`/notifications/${nid}/acknowledge`);
    loadNotifs();
  };

  return (
    <div className={`min-h-screen min-h-[100dvh] bg-organic ${useSidebar ? "app-shell-sidebar" : "flex flex-col"}`}>
      {useSidebar && (
        <aside className={`app-sidebar hidden lg:flex flex-col shrink-0${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`}>
          <NavLink to="/home" className="sidebar-brand" title={sidebarCollapsed ? "Boost Growth" : undefined}>
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center p-1.5 shrink-0 border border-white/20">
              <img src="/bg-logo.png" alt="BG" className="w-full h-full object-contain"/>
            </div>
            {!sidebarCollapsed && (
            <div>
              <div className="text-[13px] font-bold leading-tight text-white">Boost Growth</div>
              <div className="text-[9px] font-bold tracking-[0.18em] text-white/65">STAFF PORTAL</div>
            </div>
            )}
          </NavLink>
          {!sidebarCollapsed && (
            <div className="sidebar-profile">
              <div className="sidebar-profile-avatar" style={{ background: user?.color || "#D4A64A" }}>
                {user?.name?.replace("Ms. ", "").charAt(0) || "U"}
              </div>
              <div className="sidebar-profile-name">{user?.name?.replace("Ms. ", "") || user?.email}</div>
              <div className="sidebar-profile-role">{profileRole}</div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-1">
            <SidebarNav
              homeLink={{ ...homeLink, icon: <House size={17} weight="duotone"/> }}
              operationsItems={operationsItems}
              personalItems={personalNavItems}
              waitingItems={waitingNavItems}
              hrItems={hrNavItems}
              financeItems={financeItems}
              adminItems={adminTools}
              therapistOnly={therapistOnly}
              loc={loc}
              onItemHover={warmRoute}
              collapsed={sidebarCollapsed}
            />
          </div>
          <div className="sidebar-footer p-3 border-t">
            {sidebarCollapsed && (
              <div className="flex justify-center mb-2" title={user?.name || user?.email}>
                <div className="sidebar-profile-avatar w-8 h-8 text-xs"
                     style={{ background: user?.color || "#D4A64A" }}>
                  {user?.name?.replace("Ms. ", "").charAt(0) || "U"}
                </div>
              </div>
            )}
            <button type="button" onClick={logout} className="sidebar-link w-full text-[13px]" title={sidebarCollapsed ? "Sign out" : undefined}>
              <SignOut size={16}/>{!sidebarCollapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>
      )}

      <div className={`flex flex-col flex-1 min-w-0 ${useSidebar ? "app-main-column" : ""}`}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E2DDD4]">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="h-14 lg:h-16 flex items-center gap-3">
            {!useSidebar && (
            <NavLink to="/home" className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#7A8A6A] flex items-center justify-center p-1.5 shadow-sm">
                <img src="/bg-logo.png" alt="BG" className="w-full h-full object-contain"/>
              </div>
              <div className="block">
                <div className="text-[13px] sm:text-[15px] font-bold leading-tight" style={{color: "#2C3625"}}>BOOST GROWTH</div>
                <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.15em] sm:tracking-[0.2em]" style={{color: "#8B9E7A"}}>STAFF PORTAL</div>
              </div>
            </NavLink>
            )}

            {useSidebar && (
              <>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:inline-flex btn btn-ghost p-2 text-[#5C6853]"
                data-testid="sidebar-collapse-toggle"
              >
                <List size={20} weight="duotone"/>
              </button>
              <div className="hidden lg:block text-sm font-bold truncate" style={{ color: "#2C3625" }}>
                Staff Portal
              </div>
              </>
            )}

            {/* Desktop top nav (legacy layout) */}
            {!useSidebar && (
            <nav className="hidden lg:flex items-center gap-1 flex-1 ml-4">
              {baseLinks.map(l => (
                <NavLink key={l.to} to={l.to} data-testid={l.testid}
                         onMouseEnter={() => warmRoute(l.to)}
                         className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}>
                  {l.icon}<span>{l.label}</span>
                </NavLink>
              ))}
              {therapistOnly ? (
                operationsItems.map(l => (
                  <NavLink key={l.to} to={l.to} data-testid={l.testid}
                           onMouseEnter={() => warmRoute(l.to)}
                           className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}>
                    {l.icon}<span>{l.label}</span>
                  </NavLink>
                ))
              ) : (
                <NavDropdown testid="nav-operations" label="Operations" icon={<CalendarBlank size={18} weight="duotone"/>}
                             items={operationsItems} loc={loc} onItemHover={warmRoute}/>
              )}
              {hrDropdownItems.length > 0 && (
                <NavDropdown testid="nav-hr" label="HR" icon={<UsersThree size={18} weight="duotone"/>}
                             items={hrDropdownItems} loc={loc} onItemHover={warmRoute}/>
              )}
              {financeDropdownItems.length > 0 && (
                <NavDropdown testid="nav-finance" label="Finance" icon={<Receipt size={18} weight="duotone"/>}
                             items={financeDropdownItems} loc={loc} onItemHover={warmRoute}/>
              )}
              {myPortalItems.length > 0 && (
                <NavDropdown testid="nav-my-portal" label="Personal" icon={<UserCircle size={18} weight="duotone"/>}
                             items={myPortalItems} loc={loc} onItemHover={warmRoute}/>
              )}
              {waitingItems.length > 0 && (
                <NavDropdown testid="nav-waiting" label="Waiting" icon={<Hourglass size={18} weight="duotone"/>}
                             items={waitingItems} loc={loc} onItemHover={warmRoute}/>
              )}
              {adminTools.length > 0 && (
                <NavDropdown testid="nav-admin-tools" label="Administration" icon={<Gear size={18} weight="duotone"/>}
                             items={adminTools} loc={loc} onItemHover={warmRoute}/>
              )}
            </nav>
            )}

            <div className="flex-1 lg:hidden"/>

            <button
              type="button"
              onClick={toggleNavLayout}
              title={useSidebar ? "Switch to top navigation" : "Switch to sidebar navigation"}
              className="hidden lg:inline-flex btn btn-ghost p-2 text-[#5C6853]"
              data-testid="nav-layout-toggle"
            >
              {useSidebar ? <Rows size={20} weight="duotone"/> : <SidebarSimple size={20} weight="duotone"/>}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button data-testid="notif-bell" onClick={() => setShowNotif(s => !s)}
                      className="relative w-10 h-10 rounded-xl bg-[#F0E9D8] hover:bg-[#E5EBE1] flex items-center justify-center transition active:scale-95">
                <Bell size={20} weight="duotone" color="#606E52"/>
                {unread > 0 && <span className="absolute -top-1 -right-1 bg-[#C97B5C] text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{unread}</span>}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] card p-0 z-50">
                  <div className="flex items-center justify-between p-3 border-b border-[#E2DDD4]">
                    <div className="font-bold">Notifications</div>
                    {unread > 0 && <button onClick={markAllRead} className="text-xs hover:underline" style={{color: "#7A8A6A"}}>Mark all read</button>}
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto">
                    {notifs.length === 0 && <div className="p-8 text-center text-sm" style={{color: "#8B9E7A"}}>No notifications yet</div>}
                    {notifs.map(n => (
                      <div key={n.id} className={`p-3 border-b border-[#F0EDE9] text-sm transition ${!n.read ? "bg-[#E5EBE1]/40" : ""}`}>
                        <div className="font-bold" style={{color: "#2C3625"}}>{n.title}</div>
                        {n.actor_name && (
                          <div className="text-[10px] font-semibold mt-0.5" style={{color: "#7A8A6A"}}>From {n.actor_name}</div>
                        )}
                        <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>{n.message}</div>
                        <div className="text-[10px] mt-1" style={{color: "#8B9E7A"}}>{new Date(n.created_at).toLocaleString('en-US')}</div>
                        {n.requires_ack && !n.acknowledged && (
                          <button onClick={() => acknowledge(n.id)} className="btn btn-outline text-[10px] mt-2 py-1 px-2">✓ Received & Read</button>
                        )}
                        {n.acknowledged && (
                          <div className="text-[10px] mt-1 font-bold" style={{color: "#3D4F35"}}>✓ Acknowledged</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#E2DDD4]">
              {!useSidebar && (
              <>
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{background: user?.color || "#D4A64A"}}>
                {user?.name?.replace("Ms. ", "").charAt(0) || "U"}
              </div>
              <div className="text-xs leading-tight">
                <div className="font-bold truncate max-w-[120px]" style={{color: "#2C3625"}}>{user?.name?.replace("Ms. ", "") || user?.email}</div>
                <div style={{color: "#8B9E7A"}}>{profileRole}</div>
              </div>
              </>
              )}
              {useSidebar && (
                <button data-testid="logout-btn" onClick={logout} className="btn btn-ghost p-2 lg:hidden"><SignOut size={18}/></button>
              )}
              {!useSidebar && (
              <button data-testid="logout-btn" onClick={logout} className="btn btn-ghost p-2"><SignOut size={18}/></button>
              )}
            </div>

            {/* Mobile burger */}
            <button onClick={() => setMobileNav(true)} className="lg:hidden btn btn-ghost p-2"><List size={24}/></button>
          </div>
        </div>
      </header>

      {/* Mobile drawer — sidebar-style list */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 bg-black/40 modal-backdrop lg:hidden" onClick={() => setMobileNav(false)}>
          <div className="absolute left-0 top-0 h-full w-72 max-w-[88vw] shadow-2xl overflow-y-auto mobile-sidebar-panel" onClick={e=>e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between mobile-sidebar-panel-header">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center p-1.5 border border-white/20">
                  <img src="/bg-logo.png" alt="" className="w-full h-full object-contain"/>
                </div>
                <div className="font-bold text-sm text-white">Boost Growth</div>
              </div>
              <button onClick={() => setMobileNav(false)} className="sidebar-link p-2 min-w-[44px] min-h-[44px] justify-center"><X size={20}/></button>
            </div>
            <div className="p-2">
              <SidebarNav
                homeLink={{ ...homeLink, icon: <House size={17} weight="duotone"/> }}
                operationsItems={operationsItems}
                personalItems={personalNavItems}
                waitingItems={waitingNavItems}
                hrItems={hrNavItems}
                adminItems={adminTools}
                therapistOnly={therapistOnly}
                loc={loc}
                onItemHover={warmRoute}
              />
              <div className="divider my-3"/>
              <button onClick={logout} className="sidebar-link w-full"><SignOut size={16}/> Sign out</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 page-enter" key={loc.pathname}>
          <Suspense fallback={<div className="flex justify-center py-16"><div className="spinner" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      </div>
      {user?.must_change_password && <ChangePasswordModal />}
    </div>
  );
}

function NavDropdown({ testid, label, icon, items, loc, onItemHover }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const isActive = items.some(it => loc.pathname.startsWith(it.to));
  return (
    <div className="relative" ref={ref}>
      <button data-testid={testid} type="button" onClick={() => setOpen(o => !o)}
              className={`nav-link ${isActive ? "active" : ""}`}>
        {icon}<span>{label}</span><CaretDown size={12} weight="bold" className={`transition-transform ${open ? "rotate-180" : ""}`}/>
      </button>
      {open && (
        <div className="absolute left-0 mt-1 min-w-[220px] card p-1 z-50 flex flex-col">
          {items.map(it => (
            <NavLink key={it.to} to={it.to} data-testid={it.testid}
                     className={({isActive}) => `nav-link text-sm w-full ${isActive ? "active" : ""}`}
                     style={{ display: "flex" }}
                     onMouseEnter={() => onItemHover?.(it.to)}
                     onClick={() => setOpen(false)}>
              <span>{it.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangePasswordModal() {
  const { changePassword } = useAuth();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (newPwd.length < 6) { setErr("New password must be at least 6 characters"); return; }
    if (newPwd !== confirm) { setErr("Passwords do not match"); return; }
    setBusy(true);
    try { await changePassword(oldPwd, newPwd); }
    catch (ex) { setErr(ex.response?.data?.detail || ex.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 modal-backdrop flex items-center justify-center p-4 z-[100]">
      <form onSubmit={submit} className="card p-6 w-full max-w-md modal-card">
        <div className="font-display text-2xl mb-1" style={{color: "#2C3625"}}>Set a New Password</div>
        <div className="text-sm mb-4" style={{color: "#5C6853"}}>For security, please change the temporary password your admin set for you.</div>
        <label className="label">Current / Temporary password</label>
        <input data-testid="cpw-old" className="input mb-3" type="password" required autoFocus value={oldPwd} onChange={e=>setOldPwd(e.target.value)} />
        <label className="label">New password (min 6 characters)</label>
        <input data-testid="cpw-new" className="input mb-3" type="password" required value={newPwd} onChange={e=>setNewPwd(e.target.value)} />
        <label className="label">Confirm new password</label>
        <input data-testid="cpw-confirm" className="input mb-4" type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} />
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
        <button data-testid="cpw-submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? <span className="spinner"/> : "Update Password"}
        </button>
      </form>
    </div>
  );
}
