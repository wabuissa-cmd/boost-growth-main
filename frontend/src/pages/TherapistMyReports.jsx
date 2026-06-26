import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cachedGet } from "../dataCache";
import { useAuth } from "../auth";
import { UsersThree, Warning, ClipboardText, CheckCircle, CaretLeft, CaretRight, Clock } from "@phosphor-icons/react";
import DashboardStatCard from "../components/DashboardStatCard";
import PageBanner from "../components/PageBanner";
import { enrichClientForCardView } from "../attendanceUtils";
import "../dashboardLayout.css";

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function TherapistMyReports() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [pkgRows, setPkgRows] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

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

  const mine = useMemo(
    () => clients.filter(c => c.main_therapist_id === user?.id),
    [clients, user?.id]
  );

  const enriched = useMemo(
    () => mine.map(c => enrichClientForCardView(c, pkgRows)),
    [mine, pkgRows]
  );

  const monthSessions = useMemo(() =>
    sessions.filter(s =>
      (s.therapist_ids || []).includes(user?.id) &&
      (s.session_date || "").startsWith(month) &&
      s.status === "Completed"
    ),
    [sessions, user?.id, month]
  );

  const hoursThisMonth = useMemo(() =>
    monthSessions.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0),
    [monthSessions]
  );

  const hoursByClient = useMemo(() => {
    const map = {};
    monthSessions.forEach(s => {
      const cid = s.client_id;
      map[cid] = (map[cid] || 0) + (parseFloat(s.hours) || 0);
    });
    return map;
  }, [monthSessions]);

  const alerts = enriched.filter(c => c.cardStatus === "urgent" || c.cardStatus === "warning").length;
  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = sessions.filter(s =>
    (s.therapist_ids || []).includes(user?.id) && s.session_date === today
  ).length;

  return (
    <div className="page-enter">
      <PageBanner
        title="My Report"
        subtitle="Your caseload, alerts & monthly hours"
      />
      <div className="dash-stat-row mb-4">
        <DashboardStatCard value={mine.length} label="My clients" icon={<UsersThree size={20} weight="fill" />} />
        <DashboardStatCard variant="gold" value={alerts} label="Need attention" icon={<Warning size={20} weight="fill" />} />
        <DashboardStatCard variant="sage" value={loggedToday} label="Logged today" icon={<CheckCircle size={20} weight="fill" />} />
        <DashboardStatCard variant="dark" value={`${Math.round(hoursThisMonth * 10) / 10}h`} label="Hours this month" icon={<Clock size={20} weight="fill" />} />
      </div>

      <div className="card p-4 rounded-[20px] mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button type="button" className="btn btn-ghost p-2" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month">
            <CaretLeft size={18}/>
          </button>
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8B9E7A" }}>Month</div>
            <div className="font-bold" style={{ color: "#2C3625" }}>{monthLabel(month)}</div>
            <div className="text-xs mt-0.5" style={{ color: "#5C6853" }}>{monthSessions.length} sessions · {Math.round(hoursThisMonth * 10) / 10}h</div>
          </div>
          <button type="button" className="btn btn-ghost p-2" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month">
            <CaretRight size={18}/>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="intake-table w-full">
            <thead>
              <tr>
                <th>Client</th>
                <th>File</th>
                <th>Hours ({monthLabel(month).split(" ")[0]})</th>
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
