import { useEffect, useState } from "react";
import api from "../api";
import { ArrowsClockwise, CloudArrowDown } from "@phosphor-icons/react";

/** Manager Hub leave table — synced from the shared vacations Google Sheet (one API call). */
export default function LeaveBalanceSheetGrid({ year }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState("");

  const load = async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/hr/leave-balance-grid", {
        params: { year, ...(refresh ? { refresh: true } : {}) },
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSyncedAt(new Date());
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Could not load leave sheet");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const syncToDb = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post("/hr/leave-balance-sync", null, {
        params: { year, refresh: true },
      });
      setSyncResult(data);
      await load(true);
    } catch (e) {
      alert(e.response?.data?.detail || e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs" style={{ color: "#8B9E7A" }}>
        <span>
          Synced from vacations sheet · {year}
          {syncedAt && !loading && (
            <> · updated {syncedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
          )}
          {syncResult?.updated != null && (
            <> · DB sync: {syncResult.updated} therapist(s)</>
          )}
        </span>
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost text-xs py-1 px-2" onClick={() => load(true)} disabled={loading || syncing}>
            <ArrowsClockwise size={14} className={loading ? "animate-spin" : ""}/> Refresh
          </button>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2" onClick={syncToDb} disabled={loading || syncing}>
            <CloudArrowDown size={14} className={syncing ? "animate-spin" : ""}/> {syncing ? "Syncing…" : "Sync to DB"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-3 text-sm rounded-[16px]" style={{ background: "#F8EBE7", color: "#8A3F27" }}>
          {error}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full text-sm mgr-leave-grid" style={{ minWidth: 880 }} data-testid="leave-balance-grid">
            <thead style={{ background: "#EDF4E8" }}>
              <tr style={{ color: "#2C5035" }}>
                <th className="p-3 text-left font-bold">Therapist</th>
                <th className="p-3 text-center font-bold">Annual (days)</th>
                <th className="p-3 text-center font-bold">Sick (days)</th>
                <th className="p-3 text-center font-bold">Permission (#)</th>
                <th className="p-3 text-center font-bold">Unpaid (days)</th>
                <th className="p-3 text-center font-bold">Remaining</th>
                <th className="p-3 text-left font-bold">Join date</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <div className="spinner mx-auto"/>
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center" style={{ color: "#8B9E7A" }}>No leave data for {year}</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.therapist_id || r.name} className="border-t border-[#E2DDD4] hover:bg-[#FAFAF7]">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0"
                        style={{ background: r.color || "#7A8A6A" }}
                      >
                        {(r.name || "?").replace(/^Ms\.?\s*/i, "").charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold" style={{ color: "#2C3625" }}>{r.name}</div>
                        <div className="text-[11px]" style={{ color: "#8B9E7A" }}>
                          {r.email || (r.employee_id ? `ID ${r.employee_id}` : "—")}
                          {!r.sheet_matched && r.therapist_id && (
                            <span className="ml-1 opacity-70">· not in sheet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center font-semibold" style={{ color: "#2C3625" }}>{r.annual_days ?? 0}</td>
                  <td className="p-3 text-center" style={{ color: "#5C6853" }}>{r.sick_days ?? 0}</td>
                  <td className="p-3 text-center" style={{ color: "#5C6853" }}>{r.permission_count ?? 0}</td>
                  <td className="p-3 text-center" style={{ color: "#5C6853" }}>{r.unpaid_days ?? 0}</td>
                  <td className="p-3 text-center font-bold" style={{ color: "#3D4F35" }}>{r.remaining ?? "—"}</td>
                  <td className="p-3 text-xs whitespace-nowrap" style={{ color: "#5C6853" }}>{r.join_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
