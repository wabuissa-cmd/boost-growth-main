import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import api, { startOfWeek, toISODate, addDays } from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess, isHrOps, isJenan, canParentCancellationOps, isWalaaOps } from "../auth";
import {
  CalendarBlank, ClipboardText, UsersThree, ListChecks, Plant, ArrowRight,
  CheckCircle, Clock, XCircle, CalendarCheck, Heart,
  Leaf, FileText, WhatsappLogo,
} from "@phosphor-icons/react";
import { quoteOfTheDay } from "../data/quotes";
import DashboardStatCard from "../components/DashboardStatCard";
import CreativeSection from "../components/CreativeSection";
import TherapistWeekCalendar from "../components/TherapistWeekCalendar";
import PlatformUpdates from "../components/PlatformUpdates";
import AdminRemindersPanel, { buildAdminReminders } from "../components/AdminRemindersPanel";
import HrInboxPanel from "../components/HrInboxPanel";
import { saudiGreetingParts, saudiDateString } from "../saudiGreeting";
import { getTherapistScheduleName } from "../scheduleConstants";
import "../dashboardLayout.css";

const HERO_OPTIONS = [
  { id: "olive", src: null, label: "Green", style: "olive" },
  { id: "blocks", src: "/service-outdoor.jpg", label: "Building blocks", style: "image" },
  { id: "reading", src: "/service-home.jpg", label: "Reading story", style: "image" },
];

const LEGACY_HERO_MAP = {
  default: "olive",
  none: "olive",
  plain: "olive",
  home: "reading",
  school: "olive",
  outdoor: "blocks",
};

function heroStorageKey(user) {
  const uid = user?.id || user?.email;
  return uid ? `bg_hero_image_${uid}` : null;
}

function loadHeroPreference(user) {
  const key = heroStorageKey(user);
  if (!key) return "reading";
  try {
    const saved = localStorage.getItem(key);
    const mapped = LEGACY_HERO_MAP[saved] || saved;
    return HERO_OPTIONS.some(o => o.id === mapped) ? mapped : "reading";
  } catch {
    return "reading";
  }
}

export default function Home() {
  const { user } = useAuth();
  const isPortalAdminUser = showAdminNav(user);
  const hrOps = isHrOps(user);
  const jenan = isJenan(user);
  const walaaOps = isWalaaOps(user);
  const parentCancelOps = canParentCancellationOps(user);
  const showOpsHome = isPortalAdminUser || hrOps || walaaOps;
  const showHrInbox = (isPortalAdminUser || hrOps || jenan) && !walaaOps;
  const showCoordinationInbox = walaaOps;
  const showInbox = showHrInbox || showCoordinationInbox || (parentCancelOps && !walaaOps);
  const opsAccess = hasOpsAccess(user);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [stats, setStats] = useState({
    clients: 0, therapists: 0, requests: 0,
    weekSessions: 0, weekHours: 0,
    completedThisWeek: 0, hoursThisWeek: 0, cancelledThisWeek: 0, todayUpcoming: 0,
  });
  const [pkgAlerts, setPkgAlerts] = useState({ critical: 0, low: 0 });
  const [scheduleCells, setScheduleCells] = useState([]);
  const [clients, setClients] = useState([]);
  const [closures, setClosures] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [heroImageId, setHeroImageId] = useState(() => loadHeroPreference(user));
  const [notifications, setNotifications] = useState([]);
  const [billingSummary, setBillingSummary] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [newIntake, setNewIntake] = useState(0);
  const [parentCancellationsPending, setParentCancellationsPending] = useState(0);

  useEffect(() => {
    setHeroImageId(loadHeroPreference(user));
  }, [user?.id, user?.email]);

  const selectHeroImage = (id) => {
    setHeroImageId(id);
    const key = heroStorageKey(user);
    if (!key) return;
    try { localStorage.setItem(key, id); } catch { /* ignore */ }
  };

  const heroOption = HERO_OPTIONS.find(o => o.id === heroImageId) || HERO_OPTIONS[0];
  const heroImage = heroOption.style === "image" ? heroOption.src : null;
  const heroStyle = heroOption.style || (heroImage ? "image" : "plain");
  const loadUpdates = () => api.get("/center-updates").then(r => setUpdates(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  const loadPersonal = () => api.get("/calendar/personal", { params: { from_date: weekISO, to_date: weekEndISO } })
    .then(r => setPersonalEvents(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  const quote = quoteOfTheDay();
  const weekISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, 6));

  useEffect(() => {
    (async () => {
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const jsDow = new Date().getDay();
        const todayDayIdx = jsDow <= 4 ? jsDow : -1;
        const asList = (r) => (Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []);

        const [c, t, r, s, sess, pkg, clos, ups, notifs, billing, leaves, intake] = await Promise.all([
          cachedGet("/clients").catch(() => []),
          cachedGet("/therapists").catch(() => []),
          cachedGet("/requests").catch(() => []),
          cachedGet("/schedule", { params: { week_start: weekISO } }).catch(() => []),
          cachedGet("/sessions").catch(() => []),
          cachedGet("/clients/package-status").catch(() => []),
          api.get("/schedule/closures", { params: { from_date: weekISO, to_date: weekEndISO } }).catch(() => ({ data: [] })),
          api.get("/center-updates").catch(() => ({ data: [] })),
          isPortalAdminUser || hrOps ? api.get("/notifications").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          (isPortalAdminUser || hrOps) && opsAccess ? api.get("/billing/dashboard").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          (isPortalAdminUser || hrOps) ? api.get("/leaves").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          (isPortalAdminUser || hrOps) ? api.get("/intake").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);

        const clientsList = asList({ data: c });
        const therapists = asList({ data: t });
        const requests = asList({ data: r });
        const schedule = asList({ data: s });
        const sessions = asList({ data: sess });
        const pkgRows = asList({ data: pkg });
        const leavesList = asList(leaves);
        const intakeList = asList(intake);
        setClients(clientsList);
        setScheduleCells(schedule);
        setClosures(asList(clos));
        setUpdates(asList(ups));
        setNotifications(asList(notifs));
        setBillingSummary(billing?.data || null);
        setPendingLeaves(leavesList.filter(l => l.status === "pending" || l.status === "pending_manager" || l.status === "pending_hr").length);
        setNewIntake(intakeList.filter(i => (i.status || "new") === "new").length);

        setPkgAlerts({
          critical: pkgRows.filter(x => x.status === "critical" || x.status === "expired").length,
          low: pkgRows.filter(x => x.status === "low").length,
        });

        const myCells = showOpsHome
          ? schedule
          : schedule.filter(x => x.therapist_id === user?.id);
        const real = myCells.filter(x => !["LEAVE", "BREAK", "AVC"].includes(x.service_code));
        const scheduledHours = real.reduce((acc, x) => acc + (x.duration || 1), 0);
        const cancelledThisWeek = myCells.filter(x => x.state === "cancel_therapist" || x.state === "cancel_child").length;
        const todayUpcoming = todayDayIdx >= 0 ? real.filter(x => x.day === todayDayIdx).length : 0;

        const weekEndDate = toISODate(addDays(new Date(weekISO), 7));
        const mySessions = showOpsHome
          ? sessions
          : sessions.filter(x => (x.therapist_ids || []).includes(user?.id));
        const sessionsThisWeek = mySessions.filter(x =>
          x.session_date >= weekISO && x.session_date < weekEndDate
        );
        const completedThisWeek = sessionsThisWeek.filter(x => x.status === "Completed").length;
        const hoursThisWeek = sessionsThisWeek
          .filter(x => x.status === "Completed")
          .reduce((acc, x) => acc + (parseFloat(x.hours) || 0), 0);

        setStats({
          clients: clientsList.length, therapists: therapists.length,
          requests: requests.filter(x => ["pending", "pending_manager", "pending_hr"].includes(x.status)).length,
          weekSessions: real.length, weekHours: scheduledHours,
          completedThisWeek, hoursThisWeek, cancelledThisWeek, todayUpcoming,
        });
      } catch (_e) { /* ignore */ }
    })();
  }, [user?.id, showOpsHome, user, weekISO, weekEndISO, opsAccess, hrOps]);

  const adminReminders = useMemo(
    () => buildAdminReminders({
      notifications,
      pkgAlerts,
      pendingRequests: stats.requests,
      billing: billingSummary,
      pendingLeaves,
      newIntake,
      excludeHr: walaaOps,
    }),
    [notifications, pkgAlerts, stats.requests, billingSummary, pendingLeaves, newIntake, walaaOps]
  );

  useEffect(() => { if (!showOpsHome) loadPersonal(); }, [weekISO, weekEndISO, showOpsHome]);

  useEffect(() => {
    if (!parentCancelOps) {
      setParentCancellationsPending(0);
      return;
    }
    api.get("/tracking/inbox")
      .then((r) => setParentCancellationsPending(r.data?.parent_cancellations_pending || 0))
      .catch(() => setParentCancellationsPending(0));
  }, [parentCancelOps, user?.id]);

  const displayName = getTherapistScheduleName({ name: user?.name, key: user?.key })
    || user?.name?.replace(/^Ms\.?\s*/i, "")
    || "Friend";
  const dateStr = showOpsHome
    ? saudiDateString()
    : new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const beigeCard = { color: "#F7F3EB", iconColor: "#2F4A35" };
  const adminFeatures = [
    { to: "/schedule", icon: CalendarBlank, title: "Weekly Schedule", desc: "Plan sessions, manage closures, and publish the team calendar.", ...beigeCard },
    { to: "/attendance", icon: ClipboardText, title: "Session Preparation", desc: "Daily prep sheets, progress tracking, and session logging.", ...beigeCard },
    { to: "/clients", icon: UsersThree, title: "Client Portfolios", desc: "Profiles, locations, packages, and progress reports.", ...beigeCard },
  ];

  const loc = useLocation();
  const adminHeroNav = [
    { to: "/home", label: "Home" },
    { to: "/schedule", label: "Schedule" },
    { to: "/clients", label: "Clients" },
    { to: "/waiting/intake", label: "Waiting" },
    { to: "/billing", label: "Billing" },
  ];

  const HeroBanner = ({ compact, greetingParts, showNav }) => (
    <header className={`portal-hero${heroStyle === "plain" ? " portal-hero-plain" : ""}${heroStyle === "olive" ? " portal-hero-olive" : ""}`}>
      {heroImage && (
        <>
          <div className="portal-hero-bg" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden />
          <div className="portal-hero-overlay" aria-hidden />
        </>
      )}
      {showNav && (
        <nav className="portal-hero-nav" aria-label="Quick navigation">
          {adminHeroNav.map(item => {
            const active = loc.pathname === item.to || (item.to !== "/home" && loc.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to} className={`portal-hero-nav-link${active ? " is-active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="portal-hero-picker" role="group" aria-label="Choose hero background">
        {HERO_OPTIONS.map(o => (
          <button
            key={o.id}
            type="button"
            className={`portal-hero-picker-btn${heroImageId === o.id ? " active" : ""}${o.style === "plain" ? " plain" : ""}${o.style === "olive" ? " olive" : ""}`}
            onClick={() => selectHeroImage(o.id)}
            aria-label={o.label}
            aria-pressed={heroImageId === o.id}
            title={o.label}
          >
            {o.style === "image" && o.src ? <img src={o.src} alt="" /> : o.style === "olive" ? <span className="portal-hero-picker-olive" aria-hidden /> : <span className="portal-hero-picker-plain" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="portal-hero-inner">
        <div className="portal-hero-content">
          <div className="portal-hero-eyebrow">
            <Leaf size={14} weight="fill" /> Boost Growth · Staff Portal
          </div>
          <h1 className="portal-hero-title">
            {greetingParts ? (
              <>
                <span className="portal-hero-greeting">{greetingParts.prefix}</span>
                {greetingParts.name && (
                  <>
                    {", "}
                    <span className="portal-hero-name">{greetingParts.name}</span>
                  </>
                )}
              </>
            ) : compact ? (
              <>
                <span className="portal-hero-greeting">Hello</span>
                {", "}
                <span className="portal-hero-name">{displayName}</span>
              </>
            ) : (
              <>
                <span className="portal-hero-greeting">Welcome back</span>
                {", "}
                <span className="portal-hero-name">{displayName}</span>
              </>
            )}
          </h1>
          <p className="portal-hero-lead">
            {compact
              ? "Your week at a glance — sessions, locations, and center updates in one calm place."
              : "Each growth begins with seeds — nurture every child's journey with care, preparation, and intention."}
          </p>
          <p className="portal-hero-date">{dateStr}</p>
          <div className="portal-hero-actions">
            <Link to="/attendance" className="portal-hero-btn primary">
              <ClipboardText size={18} weight="duotone" /> {compact ? "Log a session" : "Open Preparation"}
            </Link>
            <Link to="/schedule" className="portal-hero-btn outline">
              <CalendarBlank size={18} weight="duotone" /> View Schedule
            </Link>
          </div>
        </div>
        <div className="portal-hero-logo" aria-hidden>
          <img src="/bg-logo.png" alt="" />
        </div>
      </div>
    </header>
  );

  const quickLinks = [
    { to: "/schedule", label: "Schedule", icon: CalendarBlank },
    { to: "/attendance", label: "Attendance", icon: ClipboardText },
    { to: "/my-requests", label: "Request", icon: ListChecks },
    { to: "/my-reports", label: "My Report", icon: FileText },
  ];

  return (
    <div className="page-enter">
      {showOpsHome ? (
        <>
          <HeroBanner greetingParts={saudiGreetingParts(displayName)} showNav />

          {parentCancelOps && parentCancellationsPending > 0 && (
            <Link
              to="/schedule?parentCancel=1"
              className="card p-4 mb-4 flex items-center gap-3 rounded-[18px] no-underline text-inherit"
              style={{ background: "#FFFBF0", borderColor: "#E8C572" }}
              data-testid="home-parent-cancellations-alert"
            >
              <WhatsappLogo size={28} weight="fill" style={{ color: "#25D366", flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm" style={{ color: "#6B5218" }}>
                  {parentCancellationsPending} parent cancellation{parentCancellationsPending === 1 ? "" : "s"} need WhatsApp
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#8B6918" }}>
                  Send Arabic apology messages to parents after therapist session cancellations
                </div>
              </div>
              <ArrowRight size={18} style={{ color: "#8B6918", flexShrink: 0 }} />
            </Link>
          )}

          <CreativeSection title="Explore the portal" subtitle="Tools to run the center with clarity and care">
            <div className="home-feature-grid stagger">
              {adminFeatures.map(f => (
                <Link key={f.to} to={f.to} className="home-feature-card" data-testid={`home-feature-${f.to.slice(1)}`}>
                  <div className="home-feature-icon" style={{ background: f.color, color: f.iconColor }}>
                    <f.icon size={24} weight="duotone" />
                  </div>
                  <div className="home-feature-title">{f.title}</div>
                  <div className="home-feature-desc">{f.desc}</div>
                  <span className="home-feature-link">Open <ArrowRight size={14} /></span>
                </Link>
              ))}
            </div>
          </CreativeSection>

          <div className="home-admin-panels">
            <PlatformUpdates items={updates} canPost={isPortalAdminUser} onPosted={loadUpdates} />
            {showHrInbox && <HrInboxPanel user={user} />}
            {showCoordinationInbox && <HrInboxPanel user={user} coordinationOnly />}
            {(walaaOps || (!showHrInbox && !showCoordinationInbox)) && (
              <AdminRemindersPanel items={adminReminders} />
            )}
            {showHrInbox && isPortalAdminUser && <AdminRemindersPanel items={adminReminders} />}
          </div>

          <CreativeSection title="This week at a glance">
            <div className="dash-stat-row stagger mb-4">
              <DashboardStatCard to="/schedule" variant="sage" value={stats.weekSessions} label="Sessions scheduled" desc={`${stats.weekHours}h total`} icon={<CalendarBlank size={22} weight="duotone" style={{ color: "#2F4A35", background: "rgba(237,225,201,0.65)", borderRadius: 14, padding: 8 }} />} testId="home-tile-schedule" />
              <DashboardStatCard to="/clients" value={stats.clients} label="Active clients" icon={<UsersThree size={22} weight="duotone" style={{ color: "#6B8F71", background: "#F7F3EB", borderRadius: 14, padding: 8 }} />} testId="home-tile-clients" />
              {!walaaOps && (
                <DashboardStatCard to="/staff-leave?tab=staff" variant="gold" value={stats.requests} label="Pending requests" icon={<ListChecks size={22} weight="duotone" style={{ color: "#965132", background: "#F0E0D4", borderRadius: 14, padding: 8 }} />} testId="home-tile-requests" />
              )}
              <DashboardStatCard to="/attendance" value={stats.therapists} label="Team therapists" icon={<Heart size={22} weight="duotone" style={{ color: "#6B8F71", background: "rgba(237,225,201,0.5)", borderRadius: 14, padding: 8 }} />} testId="home-tile-attendance" />
            </div>
          </CreativeSection>
        </>
      ) : (
        <>
          <HeroBanner compact />

          {parentCancelOps && parentCancellationsPending > 0 && (
            <Link
              to="/schedule?parentCancel=1"
              className="card p-4 mb-4 flex items-center gap-3 rounded-[18px] no-underline text-inherit"
              style={{ background: "#FFFBF0", borderColor: "#E8C572" }}
              data-testid="home-parent-cancellations-alert"
            >
              <WhatsappLogo size={28} weight="fill" style={{ color: "#25D366", flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm" style={{ color: "#6B5218" }}>
                  {parentCancellationsPending} parent cancellation{parentCancellationsPending === 1 ? "" : "s"} need WhatsApp
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#8B6918" }}>
                  Tap to send parent apology messages
                </div>
              </div>
              <ArrowRight size={18} style={{ color: "#8B6918", flexShrink: 0 }} />
            </Link>
          )}

          {showInbox && (
            <div className="mb-4">
              <HrInboxPanel user={user} />
            </div>
          )}

          <div className="dash-stat-row stagger mb-4">
            <DashboardStatCard value={stats.completedThisWeek} label="Completed this week" desc="Sessions logged" icon={<CheckCircle size={22} weight="duotone" style={{ color: "#6B8F71", background: "rgba(237,225,201,0.5)", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-0" />
            <DashboardStatCard variant="sage" value={`${stats.hoursThisWeek.toFixed(1)}h`} label="Hours delivered" icon={<Clock size={22} weight="duotone" style={{ color: "#2F4A35", background: "rgba(107,143,113,0.15)", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-1" />
            <DashboardStatCard value={stats.cancelledThisWeek} label="Cancelled / missed" icon={<XCircle size={22} weight="duotone" style={{ color: "#8A3F27", background: "#F8EBE7", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-2" />
            <DashboardStatCard value={stats.todayUpcoming} label="Today's sessions" icon={<CalendarCheck size={22} weight="duotone" style={{ color: "#2F4A35", background: "#F7F3EB", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-3" />
          </div>

          <div className="grid lg:grid-cols-[1fr_260px] gap-4 mb-4">
            <PlatformUpdates items={updates} canPost={false} onPosted={loadUpdates} />
            <div className="card p-3 rounded-[18px]">
              <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#8B9E7A" }}>Week at a glance</div>
              <TherapistWeekCalendar
                compact
                editable
                weekStart={weekStart}
                onWeekChange={setWeekStart}
                cells={scheduleCells}
                clients={clients}
                closures={closures}
                personalEvents={personalEvents}
                onPersonalChange={loadPersonal}
                therapistId={user?.id}
              />
            </div>
          </div>
        </>
      )}

      {!showOpsHome && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5 rounded-[22px]">
            <div className="dash-section-title mb-3">Quick Links</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {quickLinks.map(l => (
                <Link key={l.label} to={l.to} className="btn btn-outline justify-start gap-2 min-h-[44px] rounded-[14px]">
                  <l.icon size={18} weight="duotone"/><span>{l.label}</span>
                </Link>
              ))}
            </div>
            <Link to="/attendance" className="btn btn-primary w-full mt-3 min-h-[44px] justify-center gap-2 rounded-[14px]">
              <ClipboardText size={18} weight="duotone"/> Log a session
            </Link>
          </div>
          <div className="card p-5 relative overflow-hidden rounded-[22px]" data-testid="daily-quote">
            <div className="absolute -top-3 -right-3 opacity-10"><Plant size={130} weight="duotone"/></div>
            <div className="text-[10px] tracking-[0.2em] font-bold mb-2 relative" style={{color: "#6B8F71"}}>QUOTE OF THE DAY</div>
            <p className="text-base leading-relaxed relative italic" style={{color: "#2C3625"}}>&ldquo;{quote.text}&rdquo;</p>
            <div className="text-xs mt-3 relative" style={{color: "#8B9E7A"}}>— {quote.by}</div>
          </div>
        </div>
      )}
    </div>
  );
}
