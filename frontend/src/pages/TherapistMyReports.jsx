import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cachedGet } from "../dataCache";
import { useAuth } from "../auth";
import { UsersThree, Warning, CheckCircle, CaretLeft, CaretRight, Clock } from "@phosphor-icons/react";
import DashboardStatCard from "../components/DashboardStatCard";
import PageBanner from "../components/PageBanner";
import { enrichClientForCardView } from "../attendanceUtils";
import "../dashboardLayout.css";

const PERIOD_TABS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function startOfWeekSunday(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function periodRange(period, anchorDate) {
  const anchor = new Date(`${anchorDate}T12:00:00`);
  if (period === "daily") {
    const iso = toISO(anchor);
    return { start: iso, end: iso, label: anchor.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
  }
  if (period === "weekly") {
    const start = startOfWeekSunday(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      start: toISO(start),
      end: toISO(end),
      label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    };
  }
  if (period === "yearly") {
    const y = anchor.getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
  }
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    start: toISO(start),
    end: toISO(end),
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

function shiftAnchor(period, anchorISO, delta) {
  const d = new Date(`${anchorISO}T12:00:00`);
  if (period === "daily") d.setDate(d.getDate() + delta);
  else if (period === "weekly") d.setDate(d.getDate() + delta * 7);
  else if (period === "yearly") d.setFullYear(d.getFullYear() + delta);
  else d.setMonth(d.getMonth() + delta);
  return toISO(d);
}

export default function TherapistMyReports() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [pkgRows, setPkgRows] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    Promise.all([
      cachedGet("/clients"),
      cachedGet("/clients/package-status").catch(() => []),
      cachedGet("/sessions").catch(() => []),
    ]).then(([c, p, s]) => {
      setClients(Array.isArray(c) ? c : []);
      setPkgRows(Array.isArray(p) ? p : []);
      setSessions(Array.isArray(s) ? s : []);
    });
  }, []);

  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);

  const mine = useMemo(
    () => clients.filter(c => c.main_therapist_id === user?.id),
    [clients, user?.id]
  );

  const enriched = useMemo(
    () => mine.map(c => enrichClientForCardView(c, pkgRows)),
    [mine, pkgRows]
  );

  const periodSessions = useMemo(() =>
    sessions.filter(s => {
      if (!(s.therapist_ids || []).includes(user?.id)) return false;
      if (s.status !== "Completed") return false;
      const d = (s.session_date || "").slice(0, 10);
      return d >= range.start && d <= range.end;
    }),
    [sessions, user?.id, range]
  );

  const hoursInPeriod = useMemo(() =>
    periodSessions.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0),
    [periodSessions]
  );

  const hoursByClient = useMemo(() => {
    const map = {};
    periodSessions.forEach(s => {
      const cid = s.client_id;
      map[cid] = (map[cid] || 0) + (parseFloat(s.hours) || 0);
    });
    return map;
  }, [periodSessions]);

  const alerts = enriched.filter(c => c.cardStatus === "urgent" || c.cardStatus === "warning").length;
  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = sessions.filter(s =>
    (s.therapist_ids || []).includes(user?.id) && s.session_date === today
  ).length;

  return (
    <div className="page-enter">
      <PageBanner
        title="My Report"
        subtitle="Your caseload, alerts & hours by period"
      />
      <div className="dash-stat-row mb-4">
        <DashboardStatCard value={mine.length} label="My clients" icon={<UsersThree size={20} weight="fill" />} />
        <DashboardStatCard variant="gold" value={alerts} label="Need attention" icon={<Warning size={20} weight="fill" />} />
        <DashboardStatCard variant="sage" value={loggedToday} label="Logged today" icon={<CheckCircle size={20} weight="fill" />} />
        <DashboardStatCard variant="dark" value={`${Math.round(hoursInPeriod * 10) / 10}h`} label={`Hours (${PERIOD_TABS.find(t => t.id === period)?.label})`} icon={<Clock size={20} weight="fill" />} />
      </div>

      <div className="card p-4 rounded-[20px] mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIOD_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPeriod(t.id)}
              className={`pill text-xs font-bold px-3 py-1.5 ${period === t.id ? "bg-[#7A8A6A] text-white" : "bg-[#F0EDE9] text-[#5C6853]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <button type="button" className="btn btn-ghost p-2" onClick={() => setAnchor(a => shiftAnchor(period, a, -1))} aria-label="Previous period">
            <CaretLeft size={18}/>
          </button>
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8B9E7A" }}>{PERIOD_TABS.find(t => t.id === period)?.label}</div>
            <div className="font-bold" style={{ color: "#2C3625" }}>{range.label}</div>
            <div className="text-xs mt-0.5" style={{ color: "#5C6853" }}>{periodSessions.length} sessions · {Math.round(hoursInPeriod * 10) / 10}h</div>
          </div>
          <button type="button" className="btn btn-ghost p-2" onClick={() => setAnchor(a => shiftAnchor(period, a, 1))} aria-label="Next period">
            <CaretRight size={18}/>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="intake-table w-full">
            <thead>
              <tr>
                <th>Client</th>
                <th>File</th>
                <th>Hours</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(c => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td>#{c.file_no || "—"}</td>
                  <td className="font-bold" style={{ color: "#375568" }}>
                    {Math.round((hoursByClient[c.id] || 0) * 10) / 10}h
                  </td>
                  <td>
                    <span className="pill text-[10px]" style={{
                      background: c.cardStatus === "urgent" ? "#FCE0E8" : c.cardStatus === "warning" ? "#FAF0D1" : "#E5EBE1",
                      color: c.cardStatus === "urgent" ? "#8B3A55" : c.cardStatus === "warning" ? "#6B5218" : "#3D4F35",
                    }}>
                      {c.cardStatus === "ok" ? "On track" : c.cardStatus}
                    </span>
                  </td>
                  <td>
                    <Link to="/attendance" className="text-xs font-bold" style={{ color: "#606E52" }}>Prepare →</Link>
                  </td>
                </tr>
              ))}
              {!enriched.length && (
                <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: "#8B9E7A" }}>No assigned clients</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
