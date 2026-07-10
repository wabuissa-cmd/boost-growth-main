import { useEffect, useState, useRef, Suspense, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, showAdminNav, isClientLead, isWalaaOps, isHrOps, canViewBilling, canAccessPurchases, purchasesNavLabel, canEditStaffRequests, canEditIntake, canManageLeaves, canHrReviewLeaves, showSystemAdmin, canImportData, showMyPortalNav, showMyReportsNav, showAcademicPortfolioNav, isJenan, canViewReports, canViewSupervisionCaseload, canAccessManagerHub, showTrainingTestsNav, profileRoleLabel } from "../auth";
import api, { startOfWeek, toISODate } from "../api";
import { prefetch, cachedGet } from "../dataCache";
import { getPortalDisplayName } from "../scheduleConstants";
import {
  House, CalendarBlank,   ClipboardText, UsersThree, Receipt,
  Bell, SignOut, ListChecks, Gear, UserList, List, X, ChartBar, UploadSimple, CaretDown, EnvelopeSimple,
  SidebarSimple, Rows, ShoppingBag, FileText, Hourglass, Eye, GraduationCap,
} from "@phosphor-icons/react";

import SidebarNav from "../components/SidebarNav";
import { notificationMeta } from "../notificationUi";

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
  "/supervision": () => {
    prefetch("/clients/supervision-caseload");
  },
  "/waiting": () => { prefetch("/intake"); },
  "/waiting/intake": () => { prefetch("/intake"); },
  "/waiting/school": () => { prefetch("/intake"); },
  "/admin/center-tests": () => { prefetch("/center-test/attempts"); },
  "/my-learning": () => { prefetch("/my-learning"); },
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
  const [therapists, setTherapists] = useState([]);
  const loc = useLocation();
  const navigate = useNavigate();
  const portalAdmin = showAdminNav(user);
  const hrOps = isHrOps(user);
  const walaaOps = isWalaaOps(user);
  const clientLead = isClientLead(user);
  const staffRequestsAccess = canEditStaffRequests(user);
  const leaveManager = canManageLeaves(user);
  const hrLeaveReview = canHrReviewLeaves(user);
  const jenanManager = isJenan(user);
  const intakeAccess = canEditIntake(user);
  const showMyPortal = showMyPortalNav(user);
  const showMyReports = showMyReportsNav(user);
  const showMyLearning = showAcademicPortfolioNav(user);
  const showBilling = canViewBilling(user);
  const profileRole = profileRoleLabel(user);

  const loadNotifs = async () => {
    try { const { data } = await api.get("/notifications"); setNotifs(data); } catch(_e) { /* ignore */ }
  };
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, [loc.pathname]);
  useEffect(() => { setMobileNav(false); setShowNotif(false); }, [loc.pathname]);
  useEffect(() => {
    if (!user) return;
    prefetch("/clients");
    prefetch("/therapists");
    cachedGet("/therapists").then((t) => setTherapists(Array.isArray(t) ? t : [])).catch(() => {});
  }, [user]);

  const portalDisplayName = useMemo(() => {
    const row = therapists.find(
      (t) => t.id === user?.id || (t.email || "").toLowerCase() === (user?.email || "").toLowerCase()
    );
    return getPortalDisplayName(user, row) || (user?.name || "").replace(/^Ms\.?\s*/i, "").trim() || user?.email || "";
  }, [user, therapists]);

  const avatarInitial = portalDisplayName.charAt(0) || "U";
  useEffect(() => { warmRoute(loc.pathname); }, [loc.pathname]);

  const unread = notifs.filter(n => !n.read).length;

  const baseLinks = [
    { to: "/home", icon: <House size={18} weight="duotone"/>, label: "Home", testid: "nav-home" },
  ];

  const myPortalItems = showMyPortal ? [
    { to: "/my-requests", label: jenanManager ? "My Requests" : "Request", testid: "nav-my-requests" },
    { to: "/my-performance", label: "Performance", testid: "nav-my-performance" },
    ...(showMyReports ? [{ to: "/my-reports", label: "My Report", testid: "nav-my-reports" }] : []),
    ...(showMyLearning ? [{ to: "/my-learning", label: "My Learning", testid: "nav-my-learning" }] : []),
  ] : [];

  const personalNavItems = myPortalItems.map(it => ({
    ...it,
    icon: it.to === "/my-reports"
      ? <FileText size={17} weight="duotone"/>
      : it.to === "/my-learning"
        ? <GraduationCap size={17} weight="duotone"/>
        : <ListChecks size={17} weight="duotone"/>,
  }));

  // ── Sidebar: Clinical · Client · Employee
  const clinicalItems = [
    { to: "/schedule", label: "Schedule", testid: "nav-schedule", icon: <CalendarBlank size={18} weight="duotone"/> },
    { to: "/attendance", label: "Session Preparation", testid: "nav-attendance", icon: <ClipboardText size={18} weight="duotone"/> },
    ...(canViewSupervisionCaseload(user)
      ? [{ to: "/supervision", label: "Supervision", testid: "nav-supervision", icon: <Eye size={18} weight="duotone"/> }]
      : []),
    ...(intakeAccess
      ? [{ to: "/waiting", label: "Waiting", testid: "nav-waiting", icon: <Hourglass size={17} weight="duotone"/> }]
      : []),
  ];

  const clientItems = [
    { to: "/clients", label: "Client Info", testid: "nav-clients", icon: <UsersThree size={18} weight="duotone"/> },
    ...(showBilling
      ? [{ to: "/billing", label: "Client Invoices", testid: "nav-billing", icon: <Receipt size={18} weight="duotone"/> }]
      : []),
  ];

  const employeeItems = [
    ...(jenanManager
      ? [{ to: "/manager", label: "Manager Hub", testid: "nav-manager-hub", icon: <ListChecks size={17} weight="duotone"/> }]
      : []),
    ...(canAccessManagerHub(user) && showSystemAdmin(user) && !jenanManager
      ? [{ to: "/manager", label: "Manager Hub (Jenan view)", testid: "nav-manager-hub-preview", icon: <ListChecks size={17} weight="duotone"/> }]
      : []),
    ...(!jenanManager && (staffRequestsAccess || leaveManager || hrLeaveReview)
      ? [{ to: "/staff-leave", label: "Staff & Leave", testid: "nav-staff-leave", icon: <ListChecks size={17} weight="duotone"/> }]
      : []),
    ...(canAccessPurchases(user)
      ? [{ to: "/purchases", label: purchasesNavLabel(user), testid: "nav-purchases", icon: <ShoppingBag size={17} weight="duotone"/> }]
      : []),
    ...(showTrainingTestsNav(user)
      ? [{ to: "/admin/center-tests", label: "Training Tests", testid: "nav-center-tests", icon: <FileText size={17} weight="duotone"/> }]
      : []),
    ...personalNavItems,
  ];

  const adminTools = [
    ...(canImportData(user)
      ? [{ to: "/import", label: "Import", testid: "nav-import", icon: <UploadSimple size={17} weight="duotone"/> }]
      : []),
    ...((hrOps || walaaOps || showSystemAdmin(user))
      ? [{ to: "/email-status", label: "Email Status", testid: "nav-email-status", icon: <EnvelopeSimple size={17} weight="duotone"/> }]
      : []),
    ...(showSystemAdmin(user)
      ? [
          { to: "/admin", label: "Admin", testid: "nav-admin", icon: <Gear size={17} weight="duotone"/> },
        ]
      : []),
    ...(canViewReports(user)
      ? [
          { to: "/reports", label: "Reports", testid: "nav-reports", icon: <ChartBar size={17} weight="duotone"/> },
        ]
      : []),
  ];

  const homeLink = baseLinks[0];

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

  const [notifyingTherapist, setNotifyingTherapist] = useState(null);
  const notifRef = useRef(null);
  useEffect(() => {
    if (!showNotif) return;
    const onDoc = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showNotif]);

  const markAllRead = async () => { await api.post("/notifications/read-all"); loadNotifs(); };
  const notifyTherapistFromAlert = async (nid, e) => {
    e?.stopPropagation();
    setNotifyingTherapist(nid);
    try {
      await api.post(`/notifications/${nid}/notify-therapist`);
      loadNotifs();
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not notify therapist");
    } finally {
      setNotifyingTherapist(null);
    }
  };
  const acknowledge = async (nid) => {
    await api.post(`/notifications/${nid}/acknowledge`);
    loadNotifs();
  };
  const openNotification = (n) => {
    setShowNotif(false);
    if (n.type === "leave_request" || n.type === "request_new") {
      navigate(canAccessManagerHub(user) ? "/manager?tab=staff" : "/staff-leave?tab=other");
      return;
    }
    if (n.type === "parent_cancel_pending") {
      navigate("/schedule?parentCancel=1");
      return;
    }
    if (n.type === "unprepared_session") {
      navigate("/attendance");
    }
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
                {avatarInitial}
              </div>
              <div className="sidebar-profile-name">{portalDisplayName}</div>
              <div className="sidebar-profile-role">{profileRole}</div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-1">
            <SidebarNav
              homeLink={{ ...homeLink, icon: <House size={17} weight="duotone"/> }}
              clinicalItems={clinicalItems}
              clientItems={clientItems}
              employeeItems={employeeItems}
              adminItems={adminTools}
              loc={loc}
              onItemHover={warmRoute}
              collapsed={sidebarCollapsed}
            />
          </div>
          <div className="sidebar-footer p-3 border-t">
            {sidebarCollapsed && (
              <div className="flex justify-center mb-2" title={portalDisplayName}>
                <div className="sidebar-profile-avatar w-8 h-8 text-xs"
                     style={{ background: user?.color || "#D4A64A" }}>
                  {avatarInitial}
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
              <NavDropdown testid="nav-clinical" label="Clinical" icon={<ClipboardText size={18} weight="duotone"/>}
                           items={clinicalItems} loc={loc} onItemHover={warmRoute}/>
              <NavDropdown testid="nav-client" label="Client" icon={<UsersThree size={18} weight="duotone"/>}
                           items={clientItems} loc={loc} onItemHover={warmRoute}/>
              {employeeItems.length > 0 && (
                <NavDropdown testid="nav-employee" label="Employee" icon={<UserList size={18} weight="duotone"/>}
                             items={employeeItems} loc={loc} onItemHover={warmRoute}/>
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
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                data-testid="notif-bell"
                onClick={() => setShowNotif((s) => !s)}
                className={`notif-bell-btn${showNotif ? " is-open" : ""}`}
                aria-expanded={showNotif}
                aria-haspopup="true"
              >
                <Bell size={20} weight="duotone" className="notif-bell-icon" />
                {unread > 0 && (
                  <span className="notif-bell-badge">{unread > 99 ? "99+" : unread}</span>
                )}
              </button>
              {showNotif && (
                <div className="notif-panel" role="dialog" aria-label="Notifications">
                  <div className="notif-panel-head">
                    <div className="font-bold text-sm" style={{ color: "var(--brand-dark)" }}>Notifications</div>
                    {unread > 0 && (
                      <button type="button" onClick={markAllRead} className="notif-panel-mark-read">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notif-panel-list">
                    {notifs.length === 0 && (
                      <div className="notif-panel-empty">
                        <Bell size={28} weight="duotone" className="notif-panel-empty-icon" />
                        <p>No notifications yet</p>
                      </div>
                    )}
                    {notifs.map((n) => {
                      const meta = notificationMeta(n.type);
                      const MetaIcon = meta.Icon;
                      return (
                        <div
                          key={n.id}
                          className={`notif-item${!n.read ? " is-unread" : ""}`}
                        >
                          <button
                            type="button"
                            className="notif-item-main"
                            onClick={() => openNotification(n)}
                          >
                            <span className="notif-item-icon" style={{ background: meta.bg, color: meta.color }}>
                              <MetaIcon size={18} weight="duotone" />
                            </span>
                            <span className="notif-item-body">
                              <span className="notif-item-title">{n.title}</span>
                              {n.actor_name && (
                                <span className="notif-item-actor">From {n.actor_name}</span>
                              )}
                              <span className="notif-item-message">{n.message}</span>
                              <span className="notif-item-time">
                                {new Date(n.created_at).toLocaleString("en-US")}
                              </span>
                            </span>
                          </button>
                          {(n.type === "unprepared_session" && n.therapist_id && (portalAdmin || walaaOps || clientLead))
                            || (n.requires_ack && !n.acknowledged) ? (
                            <div className="notif-item-actions">
                              {n.type === "unprepared_session" && n.therapist_id && (portalAdmin || walaaOps || clientLead) && (
                                <button
                                  type="button"
                                  onClick={(e) => notifyTherapistFromAlert(n.id, e)}
                                  disabled={notifyingTherapist === n.id || !!n.therapist_notified_at}
                                  className="btn btn-outline text-[10px] py-1 px-2"
                                >
                                  {n.therapist_notified_at ? "Therapist notified" : notifyingTherapist === n.id ? "Sending…" : "Notify therapist"}
                                </button>
                              )}
                              {n.requires_ack && !n.acknowledged && (
                                <button
                                  type="button"
                                  onClick={() => acknowledge(n.id)}
                                  className="btn btn-outline text-[10px] py-1 px-2"
                                >
                                  Received & Read
                                </button>
                              )}
                            </div>
                          ) : null}
                          {n.acknowledged && (
                            <div className="notif-item-acked">Acknowledged</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#E2DDD4]">
              {!useSidebar && (
              <>
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{background: user?.color || "#D4A64A"}}>
                {avatarInitial}
              </div>
              <div className="text-xs leading-tight">
                <div className="font-bold truncate max-w-[160px]" style={{color: "#2C3625"}}>{portalDisplayName}</div>
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
                clinicalItems={clinicalItems}
                clientItems={clientItems}
                employeeItems={employeeItems}
                adminItems={adminTools}
                loc={loc}
                onItemHover={warmRoute}
              />
              <div className="divider my-3"/>
              <button onClick={logout} className="sidebar-link w-full"><SignOut size={16}/> Sign out</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden app-main-scroll">
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
              {it.icon}
              <span>{it.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangePasswordModal() {
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const backToLogin = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };
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
        <div className="text-sm mb-1" style={{color: "#5C6853"}}>For security, please change the temporary password your admin set for you.</div>
        <div className="text-sm mb-4" style={{color: "#5C6853"}}>For security reasons, please set a new password before using the portal.</div>
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
        <button data-testid="cpw-back-login" type="button" disabled={busy} onClick={backToLogin}
                className="btn btn-ghost w-full mt-2 text-sm" style={{color: "#5C6853"}}>
          Back to login
        </button>
      </form>
    </div>
  );
}
