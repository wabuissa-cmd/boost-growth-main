import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { startOfWeek, toISODate } from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess } from "../auth";
import {
  CalendarBlank, ClipboardText, UsersThree, ListChecks, Plant, ArrowRight, Sparkle,
  CheckCircle, Clock, XCircle, CalendarCheck, Warning, Receipt,
} from "@phosphor-icons/react";
import { quoteOfTheDay } from "../data/quotes";

export default function Home() {
  const { user } = useAuth();
  const isPortalAdminUser = showAdminNav(user);
  const opsAccess = hasOpsAccess(user);
  const [stats, setStats] = useState({
    clients: 0, therapists: 0, requests: 0,
    weekSessions: 0, weekHours: 0,
    completedThisWeek: 0, hoursThisWeek: 0, cancelledThisWeek: 0, todayUpcoming: 0,
  });
  const [pkgAlerts, setPkgAlerts] = useState({ critical: 0, low: 0 });
  const quote = quoteOfTheDay();

  useEffect(() => {
    (async () => {
      try {
        const weekISO = toISODate(startOfWeek(new Date()));
        const todayISO = new Date().toISOString().slice(0, 10);
        // Therapist day-of-week: 0=Sun..4=Thu
        const jsDow = new Date().getDay(); // 0=Sun..6=Sat
        const dayIdx = (jsDow + 1) % 7 === 0 ? 6 : (jsDow === 0 ? 0 : jsDow);
        const map = {0:0, 1:1, 2:2, 3:3, 4:4, 5:5, 6:6};
        const todayDayIdx = map[jsDow];

        const asList = (r) => (Array.isArray(r?.data) ? r.data : []);

        const [c, t, r, s, sess, pkg] = await Promise.all([
          cachedGet("/clients").catch(() => []),
          cachedGet("/therapists").catch(() => []),
          cachedGet("/requests").catch(() => []),
          cachedGet("/schedule", { params: { week_start: weekISO } }).catch(() => []),
          cachedGet("/sessions").catch(() => []),
          cachedGet("/clients/package-status").catch(() => []),
        ]);

        const clients = asList({ data: c });
        const therapists = asList({ data: t });
        const requests = asList({ data: r });
        const schedule = asList({ data: s });
        const sessions = asList({ data: sess });
        const pkgRows = asList({ data: pkg });
        setPkgAlerts({
          critical: pkgRows.filter(x => x.status === "critical" || x.status === "expired").length,
          low: pkgRows.filter(x => x.status === "low").length,
        });

        // Schedule cells for the displayed week, scoped to current user
        const myCells = isPortalAdminUser
          ? schedule
          : schedule.filter(x => x.therapist_id === user?.id);
        const real = myCells.filter(x => !["LEAVE", "BREAK", "AVC"].includes(x.service_code));
        const scheduledHours = real.reduce((acc, x) => acc + (x.duration || 1), 0);
        // Cancelled cells (this week, this user)
        const cancelledThisWeek = myCells.filter(x => x.state === "cancel_therapist" || x.state === "cancel_child").length;
        // Today's upcoming (this week, today's day index, this user)
        const todayUpcoming = real.filter(x => x.day === todayDayIdx).length;

        // Sessions logged via Attendance — completed in current week, by this user (if therapist)
        const weekStartDate = weekISO;
        const weekEndDate = toISODate(new Date(new Date(weekISO).getTime() + 7 * 24 * 3600 * 1000));
        const mySessions = isPortalAdminUser
          ? sessions
          : sessions.filter(x => (x.therapist_ids || []).includes(user?.id));
        const sessionsThisWeek = mySessions.filter(x =>
          x.session_date >= weekStartDate && x.session_date < weekEndDate
        );
        const completedThisWeek = sessionsThisWeek.filter(x => x.status === "Completed").length;
        const hoursThisWeek = sessionsThisWeek
          .filter(x => x.status === "Completed")
          .reduce((acc, x) => acc + (parseFloat(x.hours) || 0), 0);

        setStats({
          clients: clients.length, therapists: therapists.length,
          requests: requests.filter(x => x.status === "pending").length,
          weekSessions: real.length, weekHours: scheduledHours,
          completedThisWeek, hoursThisWeek, cancelledThisWeek, todayUpcoming,
        });
      } catch (_e) { /* ignore */ }
    })();
  }, [user?.id, isPortalAdminUser, user]);

  // Therapist-focused stat tiles
  const therapistTiles = [
    { icon: <CheckCircle size={26} weight="duotone" />, title: "Sessions Completed", desc: "This week", count: stats.completedThisWeek, color: "#E5EBE1", iconColor: "#3D4F35" },
    { icon: <Clock size={26} weight="duotone" />, title: "Total Hours", desc: "Delivered this week", count: `${stats.hoursThisWeek.toFixed(1)}h`, color: "#FAF0D1", iconColor: "#6B5218" },
    { icon: <XCircle size={26} weight="duotone" />, title: "Cancelled / Missed", desc: "Cells this week", count: stats.cancelledThisWeek, color: "#F8EBE7", iconColor: "#8A3F27" },
    { icon: <CalendarCheck size={26} weight="duotone" />, title: "Today's Upcoming", desc: "Sessions today", count: stats.todayUpcoming, color: "#EAF0F3", iconColor: "#375568" },
  ];

  const adminTiles = [
    { to: "/schedule", icon: <CalendarBlank size={26} weight="duotone" />, title: "This Week", desc: `${stats.weekHours}h scheduled across ${stats.weekSessions} sessions`, count: stats.weekSessions, color: "#E5EBE1", iconColor: "#3D4F35" },
    { to: "/attendance", icon: <ClipboardText size={26} weight="duotone" />, title: "Attendance", desc: "Daily preparation sheets", count: stats.clients, color: "#FAF0D1", iconColor: "#6B5218" },
    { to: "/clients", icon: <UsersThree size={26} weight="duotone" />, title: "Clients", desc: "Children portfolios", count: stats.clients, color: "#EAF0F3", iconColor: "#375568" },
    { to: "/requests", icon: <ListChecks size={26} weight="duotone" />, title: "Requests", desc: "Pending requests", count: stats.requests, color: "#F1ECF7", iconColor: "#4E3F70" },
  ];

  const quickLinks = isPortalAdminUser ? [
    { to: "/schedule", label: "Schedule", icon: <CalendarBlank size={18} weight="duotone"/> },
    { to: "/attendance", label: "Attendance", icon: <ClipboardText size={18} weight="duotone"/> },
    { to: "/requests", label: "Requests", icon: <ListChecks size={18} weight="duotone"/> },
    { to: "/clients", label: "Clients", icon: <UsersThree size={18} weight="duotone"/> },
  ] : [
    { to: "/schedule", label: "Schedule", icon: <CalendarBlank size={18} weight="duotone"/> },
    { to: "/attendance", label: "Attendance", icon: <ClipboardText size={18} weight="duotone"/> },
    { to: "/my-requests", label: "Request", icon: <ListChecks size={18} weight="duotone"/> },
  ];

  return (
    <div>
      {/* Hero banner — matches login page layout */}
      <div className="text-white py-8 sm:py-10 lg:py-14 px-5 sm:px-6 lg:px-10 mb-6 relative overflow-hidden rounded-2xl" style={{background: "linear-gradient(135deg, #7A8A6A 0%, #606E52 60%, #48543E 100%)", borderColor: "transparent"}}>
        <img src="/bg-logo.png" alt="" className="absolute opacity-10 pointer-events-none login-watermark"/>
        <div className="relative max-w-5xl">
          <div className="flex items-start gap-4 mb-4 sm:mb-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2 shrink-0 shadow-lg sm:hidden"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <img src="/bg-logo.png" alt="Boost Growth" className="w-full h-full object-contain"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] opacity-80 font-bold mb-2 flex items-center gap-2">
                <Sparkle size={14} weight="fill"/> STAFF PORTAL · WELCOME BACK
              </div>
              <h1 className="font-display text-2xl sm:text-3xl md:text-5xl font-semibold leading-[1.1]">
                Hello, {user?.name?.replace("Ms. ", "") || "Friend"}.
              </h1>
            </div>
          </div>
          <h2 className="font-display text-lg sm:text-2xl md:text-3xl mt-1 sm:mt-2 italic opacity-95">
            Each growth begins with <span className="text-[#F0D88A]">seeds.</span>
          </h2>
          <div className="opacity-90 mt-2 sm:mt-3 text-xs sm:text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

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

      {/* Stats - therapist gets personal stats; admin gets navigation tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger mb-6">
        {isPortalAdminUser
          ? adminTiles.map(t => (
              <Link key={t.to} to={t.to} className="card card-hover p-5 group" data-testid={`home-tile-${t.to.slice(1)}`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{background: t.color, color: t.iconColor}}>{t.icon}</div>
                <div className="text-3xl font-display font-semibold" style={{color: "#2C3625"}}>{t.count}</div>
                <div className="font-bold mt-1" style={{color: "#2C3625"}}>{t.title}</div>
                <div className="text-xs" style={{color: "#5C6853"}}>{t.desc}</div>
                <div className="text-sm flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition" style={{color: "#7A8A6A"}}>
                  <span>Open</span><ArrowRight size={14}/>
                </div>
              </Link>
            ))
          : therapistTiles.map((t, i) => (
              <div key={i} className="card p-5" data-testid={`therapist-stat-${i}`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{background: t.color, color: t.iconColor}}>{t.icon}</div>
                <div className="text-3xl font-display font-semibold" style={{color: "#2C3625"}}>{t.count}</div>
                <div className="font-bold mt-1" style={{color: "#2C3625"}}>{t.title}</div>
                <div className="text-xs" style={{color: "#5C6853"}}>{t.desc}</div>
              </div>
            ))
        }
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="ui-title-sm mb-3">Quick Links</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {quickLinks.map(l => (
              <Link key={l.label} to={l.to} className="btn btn-outline justify-start gap-2 min-h-[44px]">
                {l.icon}<span>{l.label}</span>
              </Link>
            ))}
          </div>
          {!isPortalAdminUser && (
            <Link to="/attendance" className="btn btn-primary w-full mt-3 min-h-[44px] justify-center gap-2">
              <ClipboardText size={18} weight="duotone"/> Log a session
            </Link>
          )}
        </div>
        {/* Daily Quote (rotates by day of year) */}
        <div className="card p-5 relative overflow-hidden" data-testid="daily-quote">
          <div className="absolute -top-3 -right-3 opacity-10"><Plant size={130} weight="duotone"/></div>
          <div className="text-[10px] tracking-[0.2em] font-bold mb-2 relative" style={{color: "#7A8A6A"}}>QUOTE OF THE DAY</div>
          <p className="text-base leading-relaxed relative italic" style={{color: "#2C3625"}}>"{quote.text}"</p>
          <div className="text-xs mt-3 relative" style={{color: "#8B9E7A"}}>— {quote.by}</div>
        </div>
      </div>
    </div>
  );
}
