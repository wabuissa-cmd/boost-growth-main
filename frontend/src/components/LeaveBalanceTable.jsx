import { useEffect, useState, Fragment } from "react";
import api from "../api";
import { FloppyDisk, PencilSimple, CaretDown, CaretRight } from "@phosphor-icons/react";
import { balanceHealthStatus, fmtDateRange, LEAVE_STATUS, LEAVE_TYPES } from "../leaveUtils";

/** HR leave balance table with expandable history per therapist. */
export default function LeaveBalanceTable({ year, onYearChange, showYearSelect = true, leaves = [], onRefresh }) {
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/leaves/balance?year=${year}`);
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
        <div className="flex justify-end mb-3">
          <select className="select max-w-[120px]" value={year} onChange={e => onYearChange(parseInt(e.target.value, 10))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 720 }}>
          <thead style={{ background: "#EDF4E8" }}>
            <tr style={{ color: "#2C5035" }}>
              <th className="p-3 w-8"></th>
              <th className="p-3 text-left font-bold">Therapist</th>
              <th className="p-3 text-left font-bold">Join Date</th>
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
                  <tr className="border-t border-[#E8E4DE] hover:bg-[#FAFAF7] cursor-pointer"
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
                          <div className="font-bold" style={{ color: "#2C3625" }}>{r.name}</div>
                          <div className="text-[11px]" style={{ color: "#8B9E7A" }}>{r.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#5C6853" }}>{r.join_date || "—"}</td>
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
                    <tr className="border-t border-[#E8E4DE]" style={{ background: "#FAFAF7" }}>
                      <td colSpan={8} className="p-4">
                        <div className="text-xs font-bold mb-2" style={{ color: "#5C6853" }}>Leave history — {r.name}</div>
                        <div className="space-y-1">
                          {hist.slice(0, 12).map(l => {
                            const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                            return (
                              <div key={l.id} className="flex items-center gap-3 text-xs py-1 border-b border-[#EDE9E3]">
                                <span className="w-28">{LEAVE_TYPES[l.leave_type]?.label || l.leave_type}</span>
                                <span className="flex-1">{fmtDateRange(l.start_date, l.end_date)} · {l.days}d</span>
                                <span className="pill text-[10px] px-2" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                              </div>
                            );
                          })}
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
