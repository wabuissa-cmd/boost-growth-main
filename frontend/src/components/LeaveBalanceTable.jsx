import { useEffect, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { FloppyDisk, PencilSimple, CaretDown, CaretRight } from "@phosphor-icons/react";
import { balanceHealthStatus, fmtDateRange, LEAVE_STATUS, LEAVE_TYPES, leavePayCategory, leaveStatusLabel } from "../leaveUtils";

/** HR leave balance table with expandable history per therapist. */
export default function LeaveBalanceTable({ year, onYearChange, showYearSelect = true, leaves = [], onRefresh, staffScope = false }) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    const params = { year };
    if (staffScope) params.scope = "staff";
    const { data } = await api.get("/leaves/balance", { params });
    setRows(data);
    onRefresh && onRefresh();
  };

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBalance = async (tid) => {
    const v = parseFloat(editing[tid]);
    if (Number.isNaN(v) || v < 0) { alert("Enter a non-negative number"); return; }
    setSaving(tid);
    try {
      await api.put(`/therapists/${tid}/leave-balance`, { leave_balance: v });
      setEditing(e => { const n = { ...e }; delete n[tid]; return n; });
      await load();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    } finally { setSaving(null); }
  };

  const therapistLeaves = (tid) =>
    (leaves || [])
      .filter(l => l.therapist_id === tid)
      .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));

  return (
    <>
      {showYearSelect && onYearChange && (
        <div className="flex justify-end items-center gap-2 mb-3 text-xs" style={{ color: "#8B9E7A" }}>
          <span>Balances use each therapist&apos;s contract year (from join date)</span>
        </div>
      )}
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 720 }}>
          <thead style={{ background: "#EDF4E8" }}>
            <tr style={{ color: "#2C5035" }}>
              <th className="p-3 w-8"></th>
              <th className="p-3 text-left font-bold">Therapist</th>
              <th className="p-3 text-left font-bold">Contract Period</th>
              <th className="p-3 text-center font-bold">Total Entitled</th>
              <th className="p-3 text-center font-bold">Used</th>
              <th className="p-3 text-center font-bold">Remaining</th>
              <th className="p-3 text-center font-bold">Status</th>
              <th className="p-3 text-center font-bold">Edit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center" style={{ color: "#8B9E7A" }}>No data</td></tr>
            )}
            {rows.map(r => {
              const isEditing = editing[r.therapist_id] !== undefined;
              const isExp = expanded === r.therapist_id;
              const health = balanceHealthStatus(r.remaining, r.remaining <= 0 && r.used_annual > r.allocated);
              const hist = therapistLeaves(r.therapist_id);
              return (
                <Fragment key={r.therapist_id}>
                  <tr className="border-t border-[#E2DDD4] hover:bg-[#FAFAF7] cursor-pointer"
                    onClick={() => setExpanded(isExp ? null : r.therapist_id)}>
                    <td className="p-3 text-center" style={{ color: "#8B9E7A" }}>
                      {hist.length > 0 ? (isExp ? <CaretDown size={14} /> : <CaretRight size={14} />) : null}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs"
                          style={{ background: r.color || "#7A8A6A" }}>
                          {(r.name || "?").replace("Ms. ", "").charAt(0)}
                        </div>
                        <div>
                          <Link
                            to={user?.id === r.therapist_id ? "/my-requests" : `/leaves?therapist=${r.therapist_id}`}
                            onClick={e => e.stopPropagation()}
                            className="font-bold hover:underline"
                            style={{ color: "#2C3625" }}
                          >
                            {r.name}
                          </Link>
                          <div className="text-[11px]" style={{ color: "#8B9E7A" }}>{r.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#5C6853" }}>
                      {r.contract_period_start && r.contract_period_end
                        ? `${r.contract_period_start.slice(0, 10)} – ${r.contract_period_end.slice(0, 10)}`
                        : (r.join_date || "—")}
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input data-testid={`balance-input-${r.therapist_id}`} type="number" step="0.5" min="0"
                          className="input text-center mx-auto" style={{ maxWidth: 90 }}
                          value={editing[r.therapist_id]}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEditing(s => ({ ...s, [r.therapist_id]: e.target.value }))} />
                      ) : (
                        <span className="font-bold" style={{ color: "#2C3625" }}>{r.allocated}</span>
                      )}
                    </td>
                    <td className="p-3 text-center" style={{ color: "#5C6853" }}>{r.used_annual}</td>
                    <td className="p-3 text-center font-bold" style={{ color: health.key === "critical" ? "#8A3F27" : "#3D4F35" }}>
                      {r.remaining}
                    </td>
                    <td className="p-3 text-center">
                      <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ color: health.color, background: "#F5F5F5" }}>
                        {health.icon} {health.label}
                      </span>
                    </td>
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex justify-center gap-1">
                          <button data-testid={`save-balance-${r.therapist_id}`} onClick={() => saveBalance(r.therapist_id)}
                            disabled={saving === r.therapist_id} className="btn btn-primary text-xs p-1.5">
                            {saving === r.therapist_id ? <span className="spinner" /> : <FloppyDisk size={13} />}
                          </button>
                          <button onClick={() => setEditing(s => { const n = { ...s }; delete n[r.therapist_id]; return n; })}
                            className="btn btn-ghost text-xs p-1.5"><span className="text-xs">✕</span></button>
                        </div>
                      ) : (
                        <button data-testid={`edit-balance-${r.therapist_id}`}
                          onClick={() => setEditing(s => ({ ...s, [r.therapist_id]: r.allocated }))}
                          className="btn btn-ghost p-1.5" title="Edit balance">
                          <PencilSimple size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExp && hist.length > 0 && (
                    <tr className="border-t border-[#E2DDD4]" style={{ background: "#FAFAF7" }}>
                      <td colSpan={8} className="p-4">
                        <div className="text-xs font-bold mb-2" style={{ color: "#5C6853" }}>Leave history — {r.name}</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ color: "#8B9E7A" }}>
                                <th className="text-left py-1 pr-3">Type</th>
                                <th className="text-left py-1 pr-3">Pay</th>
                                <th className="text-left py-1 pr-3">Dates</th>
                                <th className="text-left py-1 pr-3">Days</th>
                                <th className="text-left py-1">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hist.map(l => {
                                const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                                return (
                                  <tr key={l.id} className="border-t border-[#EDE9E3]">
                                    <td className="py-1.5 pr-3">{LEAVE_TYPES[l.leave_type]?.label || l.leave_type}</td>
                                    <td className="py-1.5 pr-3">{leavePayCategory(l.leave_type)}</td>
                                    <td className="py-1.5 pr-3">{fmtDateRange(l.start_date, l.end_date)}</td>
                                    <td className="py-1.5 pr-3">{l.days}</td>
                                    <td className="py-1.5">
                                      <span className="pill text-[10px] px-2" style={{ background: st.bg, color: st.color }}>
                                        {leaveStatusLabel(l.status, false)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2">
                          <Link
                            to={user?.id === r.therapist_id ? "/my-requests" : `/leaves?therapist=${r.therapist_id}`}
                            className="text-xs font-bold hover:underline"
                            style={{ color: "#7A8A6A" }}
                          >
                            Open full leave page →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
