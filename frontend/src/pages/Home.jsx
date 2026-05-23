import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { startOfWeek, toISODate } from "../api";
import { useAuth } from "../auth";
import {
  CalendarBlank, ClipboardText, UsersThree, ListChecks, Plant, ArrowRight, Sparkle,
  CheckCircle, Clock, XCircle, CalendarCheck
} from "@phosphor-icons/react";
import { quoteOfTheDay } from "../data/quotes";

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState({
    clients: 0, therapists: 0, requests: 0,
    weekSessions: 0, weekHours: 0,
    completedThisWeek: 0, hoursThisWeek: 0, cancelledThisWeek: 0, todayUpcoming: 0,
  });
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

        const [c, t, r, s, sess] = await Promise.all([
          api.get("/clients").catch(() => ({ data: [] })),
          api.get("/therapists").catch(() => ({ data: [] })),
          api.get("/requests").catch(() => ({ data: [] })),
          api.get("/schedule", { params: { week_start: weekISO } }).catch(() => ({ data: [] })),
          api.get("/sessions").catch(() => ({ data: [] })),
        ]);

        // Schedule cells for the displayed week, scoped to current user
        const myCells = isAdmin
          ? s.data
          : s.data.filter(x => x.therapist_id === user?.id);
        const real = myCells.filter(x => !["LEAVE", "BREAK", "AVC"].includes(x.service_code));
        const scheduledHours = real.reduce((acc, x) => acc + (x.duration || 1), 0);
        // Cancelled cells (this week, this user)
        const cancelledThisWeek = myCells.filter(x => x.state === "cancel_therapist" || x.state === "cancel_child").length;
        // Today's upcoming (this week, today's day index, this user)
        const todayUpcoming = real.filter(x => x.day === todayDayIdx).length;

        // Sessions logged via Attendance — completed in current week, by this user (if therapist)
        const weekStartDate = weekISO;
        const weekEndDate = toISODate(new Date(new Date(weekISO).getTime() + 7 * 24 * 3600 * 1000));
        const mySessions = isAdmin
          ? sess.data
          : sess.data.filter(x => (x.therapist_ids || []).includes(user?.id));
        const sessionsThisWeek = mySessions.filter(x =>
          x.session_date >= weekStartDate && x.session_date < weekEndDate
        );
        const completedThisWeek = sessionsThisWeek.filter(x => x.status === "Completed").length;
        const hoursThisWeek = sessionsThisWeek
          .filter(x => x.status === "Completed")
          .reduce((acc, x) => acc + (parseFloat(x.hours) || 0), 0);

        setStats({
          clients: c.data.length, therapists: t.data.length,
          requests: r.data.filter(x => x.status === "pending").length,
          weekSessions: real.length, weekHours: scheduledHours,
          completedThisWeek, hoursThisWeek, cancelledThisWeek, todayUpcoming,
        });
      } catch (_e) { /* ignore */ }
    })();
  }, [user?.id, isAdmin, user]);

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

  return (
    <div>
      {/* Hero banner */}
      <div className="card p-7 lg:p-10 mb-6 relative overflow-hidden text-white" style={{background: "linear-gradient(135deg, #7A8A6A 0%, #606E52 60%, #48543E 100%)", borderColor: "transparent"}}>
        <img src="/bg-logo.png" alt="" className="absolute opacity-10 pointer-events-none" style={{top: "-20px", right: "-20px", width: 220, animation: "leaf-float 8s ease-in-out infinite"}}/>
        <img src="/bg-logo.png" alt="" className="absolute opacity-10 pointer-events-none" style={{bottom: "-50px", right: "30%", width: 180, animation: "leaf-float 10s ease-in-out infinite", animationDelay: "3s"}}/>
        <div className="relative">
          <div className="text-xs tracking-[0.3em] opacity-80 font-bold mb-2 flex items-center gap-2"><Sparkle size={14} weight="fill"/> WELCOME BACK</div>
          <h1 className="font-display text-3xl md:text-5xl font-semibold leading-[1.1]">
            Hello, {user?.name?.replace("Ms. ", "") || "Friend"}.
          </h1>
          <h2 className="font-display text-2xl md:text-3xl mt-2 italic opacity-95">
            Each growth begins with <span className="text-[#F0D88A]">seeds.</span>
          </h2>
          <div className="opacity-90 mt-3 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      {/* Stats - therapist gets personal stats; admin gets navigation tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger mb-6">
        {isAdmin
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
          <div className="font-bold mb-3" style={{color: "#2C3625"}}>Quick Links</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📁 Client Files</a>
            <a href="https://drive.google.com/drive/folders/1jWRO97gDHK_TfmZhTqCqm0SdBc6_b5bE" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">💼 HR</a>
            <a href="https://drive.google.com/drive/folders/11VQQ-o1QoDQV-ktygB1tlnRmqCs3mxAb" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📜 Policies</a>
            <a href="https://boost-growthsa.com" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌱 Website</a>
          </div>
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
