import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { startOfWeek, toISODate, addDays } from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess } from "../auth";
import {
  CalendarBlank, ClipboardText, UsersThree, ListChecks, Plant, ArrowRight,
  CheckCircle, Clock, XCircle, CalendarCheck, Warning, Receipt, ChartBar, Heart,
  Leaf, FileText,
} from "@phosphor-icons/react";
import { quoteOfTheDay } from "../data/quotes";
import DashboardStatCard from "../components/DashboardStatCard";
import CreativeSection from "../components/CreativeSection";
import TherapistWeekCalendar from "../components/TherapistWeekCalendar";
import PlatformUpdates from "../components/PlatformUpdates";
import "../dashboardLayout.css";

export default function Home() {
  const { user } = useAuth();
  const isPortalAdminUser = showAdminNav(user);
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

        const [c, t, r, s, sess, pkg, clos, ups] = await Promise.all([
          cachedGet("/clients").catch(() => []),
          cachedGet("/therapists").catch(() => []),
          cachedGet("/requests").catch(() => []),
          cachedGet("/schedule", { params: { week_start: weekISO } }).catch(() => []),
          cachedGet("/sessions").catch(() => []),
          cachedGet("/clients/package-status").catch(() => []),
          api.get("/schedule/closures", { params: { from_date: weekISO, to_date: weekEndISO } }).catch(() => ({ data: [] })),
          api.get("/center-updates").catch(() => ({ data: [] })),
        ]);

        const clientsList = asList({ data: c });
        const therapists = asList({ data: t });
        const requests = asList({ data: r });
        const schedule = asList({ data: s });
        const sessions = asList({ data: sess });
        const pkgRows = asList({ data: pkg });
        setClients(clientsList);
        setScheduleCells(schedule);
        setClosures(asList(clos));
        setUpdates(asList(ups));

        setPkgAlerts({
          critical: pkgRows.filter(x => x.status === "critical" || x.status === "expired").length,
          low: pkgRows.filter(x => x.status === "low").length,
        });

        const myCells = isPortalAdminUser
          ? schedule
          : schedule.filter(x => x.therapist_id === user?.id);
        const real = myCells.filter(x => !["LEAVE", "BREAK", "AVC"].includes(x.service_code));
        const scheduledHours = real.reduce((acc, x) => acc + (x.duration || 1), 0);
        const cancelledThisWeek = myCells.filter(x => x.state === "cancel_therapist" || x.state === "cancel_child").length;
        const todayUpcoming = todayDayIdx >= 0 ? real.filter(x => x.day === todayDayIdx).length : 0;

        const weekEndDate = toISODate(addDays(new Date(weekISO), 7));
        const mySessions = isPortalAdminUser
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
          requests: requests.filter(x => x.status === "pending").length,
          weekSessions: real.length, weekHours: scheduledHours,
          completedThisWeek, hoursThisWeek, cancelledThisWeek, todayUpcoming,
        });
      } catch (_e) { /* ignore */ }
    })();
  }, [user?.id, isPortalAdminUser, user, weekISO, weekEndISO]);

  useEffect(() => { if (!isPortalAdminUser) loadPersonal(); }, [weekISO, weekEndISO, isPortalAdminUser]);

  const displayName = user?.name?.replace(/^Ms\.?\s*/i, "") || "Friend";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const adminFeatures = [
    { to: "/schedule", icon: CalendarBlank, title: "Weekly Schedule", desc: "Plan sessions, manage closures, and publish the team calendar.", color: "rgba(168,201,172,0.35)", iconColor: "#5A7D64", featured: true },
    { to: "/attendance", icon: ClipboardText, title: "Session Preparation", desc: "Daily prep sheets, progress tracking, and session logging.", color: "rgba(168,201,172,0.22)", iconColor: "#4A6652" },
    { to: "/clients", icon: UsersThree, title: "Client Portfolios", desc: "Profiles, locations, packages, and progress reports.", color: "#fff", iconColor: "#6B9075" },
    { to: "/reports", icon: ChartBar, title: "Reports & Analytics", desc: "Center-wide performance, hours, and package health.", color: "#fff", iconColor: "#5A7D64" },
  ];

  const HeroBanner = ({ compact }) => (
    <header className="portal-hero">
      <div className="portal-hero-bg" style={{ backgroundImage: "url(/hero-boost-growth.jpg)" }} aria-hidden />
      <div className="portal-hero-overlay" aria-hidden />
      <div className="portal-hero-content">
        <div className="portal-hero-eyebrow">
          <Leaf size={14} weight="fill" /> Boost Growth · Staff Portal
        </div>
        <h1 className="portal-hero-title">
          {compact ? (
            <>Hello, <span className="portal-hero-accent">{displayName}</span></>
          ) : (
            <>Welcome back, <span className="portal-hero-accent">{displayName}</span></>
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
    </header>
  );

  const quickLinks = isPortalAdminUser ? [
    { to: "/schedule", label: "Schedule", icon: CalendarBlank },
    { to: "/attendance", label: "Attendance", icon: ClipboardText },
    { to: "/requests", label: "Requests", icon: ListChecks },
    { to: "/clients", label: "Clients", icon: UsersThree },
  ] : [
    { to: "/schedule", label: "Schedule", icon: CalendarBlank },
    { to: "/attendance", label: "Attendance", icon: ClipboardText },
    { to: "/my-requests", label: "Request", icon: ListChecks },
    { to: "/my-reports", label: "My Report", icon: FileText },
  ];

  return (
    <div className="page-enter">
      {isPortalAdminUser ? (
        <>
          <HeroBanner />

          {opsAccess && (pkgAlerts.critical > 0 || pkgAlerts.low > 0) && (
            <div className="card p-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-2" style={{ borderColor: "#E5C387", background: "#FFFBF3" }}>
              <div className="flex items-start gap-2">
                <Warning size={22} weight="duotone" style={{ color: "#6B5218" }} />
                <div>
                  <div className="ui-title-sm" style={{ color: "#6B5218" }}>Package attention needed</div>
                  <div className="ui-caption mt-0.5">
                    {pkgAlerts.critical > 0 && <span><strong>{pkgAlerts.critical}</strong> critical · </span>}
                    {pkgAlerts.low > 0 && <span><strong>{pkgAlerts.low}</strong> running low</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link to="/attendance" className="btn btn-primary text-xs min-h-[40px]">Open Attendance</Link>
                {opsAccess && <Link to="/billing" className="btn btn-outline text-xs min-h-[40px]"><Receipt size={14}/> Billing</Link>}
              </div>
            </div>
          )}

          <CreativeSection title="Explore the portal" subtitle="Tools to run the center with clarity and care">
            <div className="home-feature-grid stagger">
              {adminFeatures.map(f => (
                <Link key={f.to} to={f.to} className={`home-feature-card${f.featured ? " featured" : ""}`} data-testid={`home-feature-${f.to.slice(1)}`}>
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

          <CreativeSection title="This week at a glance">
            <div className="dash-stat-row stagger mb-4">
              <DashboardStatCard to="/schedule" variant="sage" value={stats.weekSessions} label="Sessions scheduled" desc={`${stats.weekHours}h total`} icon={<CalendarBlank size={22} weight="fill" style={{ color: "#4A6652", background: "rgba(168,201,172,0.4)", borderRadius: 14, padding: 8 }} />} testId="home-tile-schedule" />
              <DashboardStatCard to="/clients" value={stats.clients} label="Active clients" icon={<UsersThree size={22} weight="fill" style={{ color: "#6B9075", background: "#F2F6F0", borderRadius: 14, padding: 8 }} />} testId="home-tile-clients" />
              <DashboardStatCard to="/requests" variant="gold" value={stats.requests} label="Pending requests" icon={<ListChecks size={22} weight="fill" style={{ color: "#6B5218", background: "#FAF0D1", borderRadius: 14, padding: 8 }} />} testId="home-tile-requests" />
              <DashboardStatCard to="/attendance" value={stats.therapists} label="Team therapists" icon={<Heart size={22} weight="fill" style={{ color: "#6B9075", background: "rgba(168,201,172,0.3)", borderRadius: 14, padding: 8 }} />} testId="home-tile-attendance" />
            </div>
          </CreativeSection>
        </>
      ) : (
        <>
          <HeroBanner compact />

          <div className="dash-stat-row stagger mb-4">
            <DashboardStatCard value={stats.completedThisWeek} label="Completed this week" desc="Sessions logged" icon={<CheckCircle size={22} weight="fill" style={{ color: "#6B9075", background: "rgba(168,201,172,0.3)", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-0" />
            <DashboardStatCard variant="gold" value={`${stats.hoursThisWeek.toFixed(1)}h`} label="Hours delivered" icon={<Clock size={22} weight="fill" style={{ color: "#6B5218", background: "#FAF0D1", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-1" />
            <DashboardStatCard value={stats.cancelledThisWeek} label="Cancelled / missed" icon={<XCircle size={22} weight="fill" style={{ color: "#8A3F27", background: "#F8EBE7", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-2" />
            <DashboardStatCard value={stats.todayUpcoming} label="Today's sessions" icon={<CalendarCheck size={22} weight="fill" style={{ color: "#4A6652", background: "#F2F6F0", borderRadius: 14, padding: 8 }} />} testId="therapist-stat-3" />
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

      {isPortalAdminUser && (
        <div className="mb-4 max-w-md">
          <PlatformUpdates items={updates} canPost onPosted={loadUpdates} />
        </div>
      )}

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
          {!isPortalAdminUser && (
            <Link to="/attendance" className="btn btn-primary w-full mt-3 min-h-[44px] justify-center gap-2 rounded-[14px]">
              <ClipboardText size={18} weight="duotone"/> Log a session
            </Link>
          )}
        </div>
        <div className="card p-5 relative overflow-hidden rounded-[22px]" data-testid="daily-quote">
          <div className="absolute -top-3 -right-3 opacity-10"><Plant size={130} weight="duotone"/></div>
          <div className="text-[10px] tracking-[0.2em] font-bold mb-2 relative" style={{color: "#7A8A6A"}}>QUOTE OF THE DAY</div>
          <p className="text-base leading-relaxed relative italic" style={{color: "#2C3625"}}>&ldquo;{quote.text}&rdquo;</p>
          <div className="text-xs mt-3 relative" style={{color: "#8B9E7A"}}>— {quote.by}</div>
        </div>
      </div>
    </div>
  );
}
