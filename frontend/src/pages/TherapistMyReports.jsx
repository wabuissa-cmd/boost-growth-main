import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cachedGet } from "../dataCache";
import { useAuth } from "../auth";
import { UsersThree, Warning, ClipboardText, CheckCircle } from "@phosphor-icons/react";
import DashboardStatCard from "../components/DashboardStatCard";
import PageBanner from "../components/PageBanner";
import { enrichClientForCardView } from "../attendanceUtils";
import "../dashboardLayout.css";

export default function TherapistMyReports() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [pkgRows, setPkgRows] = useState([]);
  const [sessions, setSessions] = useState([]);

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

  const alerts = enriched.filter(c => c.cardStatus === "urgent" || c.cardStatus === "warning").length;
  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = sessions.filter(s =>
    (s.therapist_ids || []).includes(user?.id) && s.session_date === today
  ).length;

  return (
    <div className="page-enter">
      <PageBanner
        title="My Report"
        subtitle="Your caseload, alerts & daily preparation at a glance"
      />
      <div className="dash-stat-row mb-4">
        <DashboardStatCard value={mine.length} label="My clients" icon={<UsersThree size={20} weight="fill" />} />
        <DashboardStatCard variant="gold" value={alerts} label="Need attention" icon={<Warning size={20} weight="fill" />} />
        <DashboardStatCard variant="sage" value={loggedToday} label="Logged today" icon={<CheckCircle size={20} weight="fill" />} />
        <DashboardStatCard to="/attendance" value={mine.length - loggedToday > 0 ? "—" : "✓"} label="Prep status" icon={<ClipboardText size={20} weight="fill" />} />
      </div>
      <div className="card p-4 rounded-[20px]">
        <div className="dash-section-title mb-3">Client overview</div>
        <div className="overflow-x-auto">
          <table className="intake-table w-full">
            <thead>
              <tr>
                <th>Client</th>
                <th>File</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(c => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td>#{c.file_no || "—"}</td>
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
                <tr><td colSpan={4} className="text-center py-8 text-sm" style={{ color: "#8B9E7A" }}>No assigned clients</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
