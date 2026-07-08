import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  Plus, X, PencilSimple, Airplane, Calendar, CheckCircle, Clock, XCircle, ArrowsClockwise
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import LeaveBalanceTable from "../components/LeaveBalanceTable";
import { getTherapistScheduleName } from "../scheduleConstants";

const STATUS = {
  pending: { label: "Approval Waiting", color: "#D4A64A", bg: "#FAF0D1", icon: <Clock size={14} weight="fill"/> },
  approved: { label: "Approved", color: "#3D4F35", bg: "#E5EBE1", icon: <CheckCircle size={14} weight="fill"/> },
  done: { label: "Done", color: "#5C6853", bg: "#EFEAE0", icon: <CheckCircle size={14} weight="fill"/> },
  rejected: { label: "Rejected", color: "#8B3A55", bg: "#FCE0E8", icon: <XCircle size={14} weight="fill"/> },
  cancelled: { label: "Cancelled", color: "#8B7B8B", bg: "#EFE8EC", icon: <XCircle size={14} weight="fill"/> },
};

const TYPE_PALETTE = {
  Annual: "#7A8A6A", Absence: "#C97B5C", Unpaid: "#C28E6A", Sickleave: "#9B7BAB", Permission: "#6BAA9B", Exam: "#7B96B5", Emergency: "#D49A60",
};

function diffDays(a, b) {
  if (!a || !b) return 0;
  const A = new Date(a); const B = new Date(b);
  if (isNaN(A) || isNaN(B)) return 0;
  return Math.max(1, Math.round((B - A) / 86400000) + 1);
}

function emptyLeave(therapistId = "") {
  const today = new Date().toISOString().slice(0, 10);
  return {
    therapist_id: therapistId, start_date: today, end_date: today,
    days: 1, leave_type: "Annual", status: "pending", notes: "",
  };
}

export default function Leaves() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [filterTherapist, setFilterTherapist] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = async () => {
    const [l, b, t] = await Promise.all([
      api.get(`/leaves?year=${year}`),
      api.get(`/leaves/balance?year=${year}`),
      api.get("/therapists").catch(() => ({ data: [] })),
    ]);
    setLeaves(l.data); setBalances(b.data); setTherapists(t.data);
  };
  useEffect(() => { load(); }, [year]);

  // Auto-compute days when dates change in modal
  useEffect(() => {
    if (edit?.start_date && edit?.end_date) {
      const calc = diffDays(edit.start_date, edit.end_date);
      if (calc !== edit.days) setEdit(e => ({ ...e, days: calc }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit?.start_date, edit?.end_date]);

  const save = async () => {
    if (!edit.therapist_id) { alert("Select a therapist"); return; }
    if (edit.id) await api.put(`/leaves/${edit.id}`, edit);
    else await api.post("/leaves", edit);
    setEdit(null); load();
  };
  const setStatus = async (id, status) => {
    await api.put(`/leaves/${id}/status`, { status });
    if (status === "approved") {
      const l = leaves.find(x => x.id === id);
      if (l) alert(`Leave approved. ${l.days} day(s) deducted from ${l.therapist_name || "therapist"}'s balance.`);
    }
    load();
  };

  const filtered = useMemo(() => {
    let arr = [...leaves];
    if (filterTherapist) arr = arr.filter(l => l.therapist_id === filterTherapist);
    if (filterStatus) arr = arr.filter(l => l.status === filterStatus);
    return arr;
  }, [leaves, filterTherapist, filterStatus]);

  const myBalance = !isAdmin ? balances.find(b => b.therapist_id === user?.id) : null;

  return (
    <div>
      <PageBanner
        title={isAdmin ? "Leaves & Vacations" : "My Leaves"}
        subtitle={isAdmin ? "Track team vacations · approve requests · monitor balances" : "Your leave requests, balance, and approval status"}
        badge={(
          <>
            <select className="select text-[11px] border-0 bg-transparent min-h-0 h-7 py-0 max-w-[80px]" value={year} onChange={e => setYear(parseInt(e.target.value))} data-testid="leaves-year-select">
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button data-testid="add-leave-btn" onClick={() => setEdit(emptyLeave(isAdmin ? "" : user?.id))} className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0">
              <Plus size={13} /> {isAdmin ? "New Leave" : "Request Leave"}
            </button>
          </>
        )}
      />

      {/* My balance card (therapist) */}
      {!isAdmin && myBalance && (
        <div className="card p-6 mb-5" style={{ background: "linear-gradient(135deg, #6B8F71 0%, #3D5C44 55%, #2F4A35 100%)", borderColor: "transparent", color: "white" }}>
          <div className="text-xs tracking-[0.25em] font-bold opacity-90 mb-1">YOUR ANNUAL BALANCE — {year}</div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <div className="font-display text-5xl font-semibold">{myBalance.remaining}</div>
              <div className="text-sm opacity-90">days remaining</div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3 min-w-[200px]">
              <div className="bg-white/15 rounded-xl p-3"><div className="text-[10px] tracking-widest opacity-80">ALLOCATED</div><div className="text-2xl font-bold">{myBalance.allocated}</div></div>
              <div className="bg-white/15 rounded-xl p-3"><div className="text-[10px] tracking-widest opacity-80">USED</div><div className="text-2xl font-bold">{myBalance.used_annual}</div></div>
              <div className="bg-white/15 rounded-xl p-3"><div className="text-[10px] tracking-widest opacity-80">PENDING</div><div className="text-2xl font-bold">{myBalance.pending}</div></div>
            </div>
          </div>
        </div>
      )}

      {/* Admin: leave balance table only (no summary cards) */}
      {isAdmin && (
        <div className="mb-5">
          <LeaveBalanceTable year={year} onYearChange={setYear} showYearSelect={false} />
        </div>
      )}

      {isAdmin && (
        <>
          {/* Filters */}
          <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
            <select className="select text-sm" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
              <option value="">All therapists</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
            </select>
            <select className="select text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {(filterTherapist || filterStatus) && <button onClick={() => { setFilterTherapist(""); setFilterStatus(""); }} className="btn btn-ghost text-xs"><X size={12} /> Clear</button>}
            <span className="ml-auto text-xs" style={{ color: "#8B9E7A" }}>{filtered.length} leaves shown</span>
          </div>
        </>
      )}

      {/* Leaves table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#F0E9D8" }}>
            <tr>
              {isAdmin && <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Therapist</th>}
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Type</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Start</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>End</th>
              <th className="p-3 text-center font-bold" style={{ color: "#2C3625" }}>Days</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Status</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Notes</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="p-12 text-center" style={{ color: "#8B9E7A" }}>
                <Calendar size={36} weight="duotone" className="mx-auto mb-2 opacity-60" />
                No leaves recorded for {year}
              </td></tr>
            )}
            {filtered.map(l => {
              const st = STATUS[l.status] || STATUS.pending;
              return (
                <tr key={l.id} className="border-t border-[#E2DDD4] hover:bg-[#E5EBE1]/30 transition" data-testid={`leave-row-${l.id}`}>
                  {isAdmin && (
                    <td className="p-3 font-bold whitespace-nowrap" style={{ color: "#2C3625" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-bold shrink-0" style={{ background: l.therapist_color || "#7A8A6A" }}>{(l.therapist_name || "?").replace("Ms. ", "").charAt(0)}</div>
                        {l.therapist_name || "—"}
                      </div>
                    </td>
                  )}
                  <td className="p-3"><span className="pill text-[10px] px-2 py-0.5" style={{ background: `${TYPE_PALETTE[l.leave_type] || "#7A8A6A"}25`, color: TYPE_PALETTE[l.leave_type] || "#3D4F35" }}>{l.leave_type}</span></td>
                  <td className="p-3 text-xs" style={{ color: "#5C6853" }}>{l.start_date}</td>
                  <td className="p-3 text-xs" style={{ color: "#5C6853" }}>{l.end_date}</td>
                  <td className="p-3 text-center font-bold" style={{ color: "#2C3625" }}>{l.days}</td>
                  <td className="p-3">
                    <span className="pill text-[11px] px-2 py-0.5 inline-flex items-center gap-1" style={{ background: st.bg, color: st.color }}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "#8B9E7A" }}>{l.notes || "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {isAdmin && l.status === "pending" && (
                      <>
                        <button onClick={() => setStatus(l.id, "approved")} className="btn btn-ghost p-2" title="Approve" data-testid={`approve-${l.id}`} style={{ color: "#3D4F35" }}><CheckCircle size={16} weight="duotone" /></button>
                        <button onClick={() => setStatus(l.id, "rejected")} className="btn btn-ghost p-2" title="Reject" data-testid={`reject-${l.id}`} style={{ color: "#8B3A55" }}><XCircle size={16} weight="duotone" /></button>
                      </>
                    )}
                    {isAdmin && l.status === "approved" && (
                      <button onClick={() => setStatus(l.id, "done")} className="btn btn-ghost p-2" title="Mark Done" style={{ color: "#5C6853" }}><ArrowsClockwise size={16} /></button>
                    )}
                    <button onClick={() => setEdit({ ...l })} className="btn btn-ghost p-2"><PencilSimple size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && (
        <ModalBase
          title={edit.id ? "Edit Leave" : "Request Leave"}
          subtitle={edit.id && isAdmin ? "Review or update this leave request" : "Submit a leave or time-off request"}
          onClose={() => setEdit(null)}
          size="md"
          footer={
            <>
              <ModalBtnSecondary type="button" onClick={() => setEdit(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="leave-save-btn" type="button" onClick={save}>Save</ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Leave Details">
            {isAdmin && (
              <FormField label="Therapist">
                <select data-testid="leave-therapist-select" className="modal-input" value={edit.therapist_id} onChange={e => setEdit({ ...edit, therapist_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
                </select>
              </FormField>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Type">
                <select className="modal-input" value={edit.leave_type} onChange={e => setEdit({ ...edit, leave_type: e.target.value })}>
                  <option value="Annual">Annual Leave</option>
                  <option value="Sickleave">Sick Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                  <option value="Permission">Permission / Early Leave</option>
                  <option value="Absence">Absence</option>
                  <option value="Exam">Exam</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </FormField>
              <FormField label="Status">
                <select className="modal-input" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })} disabled={!isAdmin && edit.id}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FormField>
              <FormField label="Date from">
                <input data-testid="leave-start-input" type="date" className="modal-input" value={edit.start_date} onChange={e => setEdit({ ...edit, start_date: e.target.value })} />
              </FormField>
              <FormField label="Date to">
                <input data-testid="leave-end-input" type="date" className="modal-input" value={edit.end_date} onChange={e => setEdit({ ...edit, end_date: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Days" hint="Auto-calculated, editable">
              <input type="number" step="0.5" min="0.5" className="modal-input" value={edit.days} onChange={e => setEdit({ ...edit, days: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </FormSection>

          <FormSection title="Reason">
            <FormField label="Notes">
              <textarea className="modal-input" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
            </FormField>
            {isAdmin && (
              <FormField label="Admin note" hint="Reason for approval/rejection">
                <textarea className="modal-input" rows={2} placeholder="Reason for approval/rejection..." value={edit.admin_note || ""} onChange={e => setEdit({ ...edit, admin_note: e.target.value })} />
              </FormField>
            )}
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
