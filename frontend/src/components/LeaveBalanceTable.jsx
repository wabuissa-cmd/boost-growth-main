import { useEffect, useState } from "react";
import api from "../api";
import { FloppyDisk, PencilSimple } from "@phosphor-icons/react";

/** Shared leave-balance table (therapist rows + edit balance). */
export default function LeaveBalanceTable({ year, onYearChange, showYearSelect = true }) {
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/leaves/balance?year=${year}`);
    setRows(data);
  };

  useEffect(() => { load(); }, [year]);

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
        <table className="w-full text-sm">
          <thead style={{ background: "#F0E9D8" }}>
            <tr style={{ color: "#2C3625" }}>
              <th className="p-3 text-left font-bold">Therapist</th>
              <th className="p-3 text-center font-bold">Leave Balance</th>
              <th className="p-3 text-center font-bold">Days Used (Annual)</th>
              <th className="p-3 text-center font-bold">Pending</th>
              <th className="p-3 text-center font-bold">Remaining</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center" style={{ color: "#8B9E7A" }}>No data</td></tr>
            )}
            {rows.map(r => {
              const isEditing = editing[r.therapist_id] !== undefined;
              return (
                <tr key={r.therapist_id} className="border-t border-[#E8E4DE]">
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
                  <td className="p-3 text-center">
                    {isEditing ? (
                      <input data-testid={`balance-input-${r.therapist_id}`} type="number" step="0.5" min="0"
                        className="input text-center mx-auto" style={{ maxWidth: 100 }}
                        value={editing[r.therapist_id]}
                        onChange={e => setEditing(s => ({ ...s, [r.therapist_id]: e.target.value }))} />
                    ) : (
                      <span className="font-bold text-lg" style={{ color: "#2C3625" }}>{r.allocated}</span>
                    )}
                  </td>
                  <td className="p-3 text-center" style={{ color: "#5C6853" }}>{r.used_annual}</td>
                  <td className="p-3 text-center" style={{ color: r.pending > 0 ? "#8B6918" : "#8B9E7A" }}>
                    {r.pending > 0 ? `⏳ ${r.pending}` : "—"}
                  </td>
                  <td className="p-3 text-center font-bold" style={{ color: r.remaining <= 3 ? "#8A3F27" : "#3D4F35" }}>
                    {r.remaining}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button data-testid={`save-balance-${r.therapist_id}`} onClick={() => saveBalance(r.therapist_id)}
                          disabled={saving === r.therapist_id} className="btn btn-primary text-xs">
                          {saving === r.therapist_id ? <span className="spinner" /> : <><FloppyDisk size={13} /> Save</>}
                        </button>
                        <button onClick={() => setEditing(s => { const n = { ...s }; delete n[r.therapist_id]; return n; })}
                          className="btn btn-ghost text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button data-testid={`edit-balance-${r.therapist_id}`}
                        onClick={() => setEditing(s => ({ ...s, [r.therapist_id]: r.allocated }))}
                        className="btn btn-outline text-xs"><PencilSimple size={13} /> Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
