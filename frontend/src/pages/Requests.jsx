import { useEffect, useState, useRef } from "react";
import api from "../api";
import { useAuth, showAdminNav, canEditStaffRequests, canManageLeaves } from "../auth";
import { Navigate } from "react-router-dom";
import { Plus, PencilSimple, Trash, X, ChatCircleText, CalendarBlank, Tag, Lightning, Clock, CheckCircle, XCircle, Hourglass, Spinner, Trophy, Briefcase, Calendar, Package, UploadSimple } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import { LEAVE_STATUS, LEAVE_TYPES, diffDays, fmtDateRange, permissionPayLabel } from "../leaveUtils";

const STATUS_MAP = {
  pending:    { label: "Pending",     cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  in_progress:{ label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Spinner size={14} weight="duotone"/>, color: "#A4BCCB" },
  approved:   { label: "Approved",    cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/>, color: "#B4C2A9" },
  rejected:   { label: "Rejected",    cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/>, color: "#ECA6A6" },
  done:       { label: "Completed",   cls: "bg-[#7A8A6A] text-white border-[#7A8A6A]",     icon: <CheckCircle size={14} weight="fill"/>, color: "#7A8A6A" },
};

const TYPES = [
  { id: "leave", label: "Time Off", icon: <Calendar size={20} weight="duotone"/>, color: "#A4BCCB" },
  { id: "supplies", label: "Supplies / Materials", icon: <Package size={20} weight="duotone"/>, color: "#D4A64A" },
  { id: "schedule_change", label: "Schedule Change", icon: <CalendarBlank size={20} weight="duotone"/>, color: "#7A8A6A" },
  { id: "reward", label: "Reward / Recognition", icon: <Trophy size={20} weight="duotone"/>, color: "#C97B5C" },
  { id: "general", label: "General", icon: <Briefcase size={20} weight="duotone"/>, color: "#8B7BA8" },
];

const REWARD_TYPES = [
  { id: "certificate", label: "Certificate of Appreciation" },
  { id: "monetary", label: "Monetary Bonus" },
  { id: "day_off", label: "Extra Day Off" },
  { id: "other", label: "Other" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#8B9E7A" },
  { id: "normal", label: "Normal", color: "#7A8A6A" },
  { id: "high", label: "High", color: "#D4A64A" },
  { id: "urgent", label: "Urgent", color: "#C97B5C" },
];

const LEAVE_FORM_TYPES = [
  { id: "Annual", label: "Annual" },
  { id: "Sickleave", label: "Sick" },
  { id: "Unpaid", label: "Unpaid" },
  { id: "Permission", label: "Permission" },
];

function emptyLeaveForm() {
  const today = new Date().toISOString().slice(0, 10);
  return { therapist_id: "", start_date: today, end_date: today, days: 1, leave_type: "Annual", notes: "" };
}

export default function Requests({ personal = false }) {
  const { user } = useAuth();
  const canManageReq = !personal && canEditStaffRequests(user);
  const leaveHr = !personal && canManageLeaves(user);
  const isPortalAdminUser = !personal && showAdminNav(user);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState(null);
  const [statusEdit, setStatusEdit] = useState(null);
  const [step, setStep] = useState(1);
  const [therapists, setTherapists] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [leaveModal, setLeaveModal] = useState(null);
  const [leaveDoc, setLeaveDoc] = useState(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const leaveFileRef = useRef(null);

  const load = async () => { const { data } = await api.get("/requests"); setItems(data); };
  const loadLeaves = async () => {
    const yr = new Date().getFullYear();
    const { data } = await api.get("/leaves", { params: { year: yr } });
    const sorted = [...(data || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    setRecentLeaves(sorted.slice(0, 10));
  };
  useEffect(() => {
    load();
    if (canManageReq) {
      api.get("/therapists").then(r => setTherapists(r.data || [])).catch(() => {});
    }
    if (leaveHr) loadLeaves();
  }, [canManageReq, leaveHr]);

  const submitNew = async () => {
    await api.post("/requests", edit);
    setEdit(null); setStep(1); load();
  };
  const updateStatus = async () => {
    await api.put(`/requests/${statusEdit.id}/status`, { status: statusEdit.status, admin_note: statusEdit.admin_note });
    setStatusEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete this request?")) return; await api.delete(`/requests/${id}`); load(); };
  const removeLeave = async (id) => { if (!window.confirm("Delete this leave request?")) return; await api.delete(`/leaves/${id}`); loadLeaves(); };

  const updateLeaveDates = (form, start, end) => {
    const days = Math.max(1, diffDays(start, end));
    return { ...form, start_date: start, end_date: end, days };
  };

  const submitLeave = async () => {
    if (!leaveModal?.therapist_id) { alert("Select a therapist"); return; }
    setLeaveSubmitting(true);
    try {
      const payload = {
        therapist_id: leaveModal.therapist_id,
        start_date: leaveModal.start_date,
        end_date: leaveModal.end_date,
        days: leaveModal.days,
        leave_type: leaveModal.leave_type,
        notes: leaveModal.notes || null,
        status: "pending",
      };
      const { data: created } = await api.post("/leaves", payload);
      if (leaveDoc && created?.id) {
        const fd = new FormData();
        fd.append("file", leaveDoc);
        fd.append("document_type", "other");
        await api.post(`/leaves/${created.id}/upload-document`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setLeaveModal(null);
      setLeaveDoc(null);
      loadLeaves();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const setLeaveStatus = async (leave, status, opts = {}) => {
    await api.put(`/leaves/${leave.id}/status`, {
      status,
      is_paid: opts.is_paid,
      deduct_balance: opts.deduct_balance,
    });
    loadLeaves();
  };

  const filtered = items
    .filter(r => r.request_type !== "leave")
    .filter(r => filter === "all" || r.status === filter);

  if (!personal && !canEditStaffRequests(user)) {
    return <Navigate to="/my-requests" replace/>;
  }

  return (
    <div>
      <PageBanner
        title={canManageReq ? "Staff Requests" : "My Requests"}
        subtitle={canManageReq ? "Materials, general & session-related requests" : "Submit and track your staff requests"}
        badge={(
          <>
            {leaveHr && isPortalAdminUser && (
              <button data-testid="submit-leave-btn" onClick={() => setLeaveModal(emptyLeaveForm())} className="btn btn-secondary text-[11px] px-2.5 py-1 min-h-0">
                <Plus size={13}/> Submit Leave Request
              </button>
            )}
          </>
        )}
        stats={[
          { label: "Total", n: items.length, color: "#2C3625" },
          { label: "Pending", n: items.filter(r => r.status === "pending").length, color: "#6B5218" },
          { label: "In progress", n: items.filter(r => r.status === "in_progress").length, color: "#375568" },
          { label: "Done", n: items.filter(r => r.status === "done").length, color: "#3D4F35" },
        ]}
      />

      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilter("all")} className={`pill ${filter==="all" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>All ({items.length})</button>
        {Object.entries(STATUS_MAP).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`pill border ${filter===k ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : v.cls}`}>{v.icon} {v.label} ({items.filter(r=>r.status===k).length})</button>
        ))}
      </div>

      <div className="space-y-3 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>No requests yet</div>}
        {filtered.map(r => {
          const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
          const tp = TYPES.find(t => t.id === r.request_type) || TYPES[4];
          return (
            <div key={r.id} className="card overflow-hidden">
              <div className="status-bar" style={{background: st.color}}/>
              <div className="p-5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background: `${tp.color}25`, color: tp.color}}>{tp.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`pill border ${st.cls}`}>{st.icon} {st.label}</span>
                      <span className="pill" style={{background: `${tp.color}20`, color: tp.color}}><Tag size={12}/> {tp.label}</span>
                      {r.priority && r.priority !== "normal" && (
                        <span className="pill" style={{background: `${PRIORITIES.find(p=>p.id===r.priority)?.color}20`, color: PRIORITIES.find(p=>p.id===r.priority)?.color}}>
                          <Lightning size={12}/> {PRIORITIES.find(p=>p.id===r.priority)?.label}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-lg" style={{color: "#2C3625"}}>{r.title}</div>
                    {r.description && <div className="text-sm mt-1 whitespace-pre-wrap" style={{color: "#5C6853"}}>{r.description}</div>}

                    <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
                      {(r.date_from || r.date_to) && (
                        <div className="flex items-center gap-2" style={{color: "#5C6853"}}>
                          <CalendarBlank size={16}/> {r.date_from || "?"} {r.date_to && `→ ${r.date_to}`}
                        </div>
                      )}
                      {r.reward_type && (
                        <div className="flex items-center gap-2" style={{color: "#5C6853"}}>
                          <Trophy size={16}/> {REWARD_TYPES.find(rw=>rw.id===r.reward_type)?.label || r.reward_type}
                        </div>
                      )}
                    </div>
                    {r.extra_notes && <div className="text-xs mt-2 italic" style={{color: "#8B9E7A"}}>"{r.extra_notes}"</div>}

                    {canManageReq && r.therapist_name && <div className="text-xs mt-3 flex items-center gap-1" style={{color: "#8B9E7A"}}>From: <strong style={{color: "#5C6853"}}>{r.therapist_name}</strong></div>}
                    <div className="text-[11px] mt-1 flex items-center gap-1" style={{color: "#8B9E7A"}}><Clock size={11}/> {new Date(r.created_at).toLocaleString('en-US')}</div>

                    {r.admin_note && (
                      <div className="mt-3 p-3 bg-[#E5EBE1] rounded-xl border border-[#B4C2A9]">
                        <div className="text-xs font-bold flex items-center gap-1 mb-1" style={{color: "#3D4F35"}}><ChatCircleText size={14}/> ADMIN RESPONSE</div>
                        <div className="text-sm" style={{color: "#2C3625"}}>{r.admin_note}</div>
                      </div>
                    )}

                    {/* Timeline */}
                    {r.timeline && r.timeline.length > 1 && (
                      <details className="mt-3">
                        <summary className="text-xs cursor-pointer hover:underline" style={{color: "#7A8A6A"}}>Activity timeline ({r.timeline.length})</summary>
                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-[#E5EBE1]">
                          {r.timeline.map((ev, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-bold" style={{color: "#2C3625"}}>{ev.event}</span>
                              <span style={{color: "#8B9E7A"}}> · {ev.by} · {new Date(ev.at).toLocaleString('en-US')}</span>
                              {ev.note && <div className="italic" style={{color: "#5C6853"}}>"{ev.note}"</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canManageReq && <button data-testid={`update-status-${r.id}`} onClick={() => setStatusEdit({...r})} className="btn btn-secondary"><PencilSimple size={16}/> Update</button>}
                    {isPortalAdminUser && (
                      <button onClick={() => remove(r.id)} className="btn btn-ghost p-2 text-red-700 min-w-[44px] min-h-[44px]" title="Delete request">
                        <Trash size={16}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {leaveHr && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: "#2C3625" }}>Recent Leave Requests</h2>
          <div className="space-y-2">
            {recentLeaves.length === 0 && (
              <div className="card p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>No leave requests yet</div>
            )}
            {recentLeaves.map(l => {
              const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
              const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
              return (
                <div key={l.id} className="card p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="pill text-xs font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                      <span className="pill text-xs" style={{ background: `${tp.color}20`, color: tp.color }}>{tp.label}</span>
                      {permissionPayLabel(l) && (
                        <span className="pill text-[10px] font-bold bg-[#F8EBE7] text-[#8A3F27]">{permissionPayLabel(l)}</span>
                      )}
                    </div>
                    <div className="font-bold" style={{ color: "#2C3625" }}>{l.therapist_name || "Therapist"}</div>
                    <div className="text-sm flex items-center gap-1 mt-0.5" style={{ color: "#5C6853" }}>
                      <CalendarBlank size={14}/> {fmtDateRange(l.start_date, l.end_date)} · {l.days} day{l.days !== 1 ? "s" : ""}
                    </div>
                    {l.notes && <div className="text-xs mt-1 italic" style={{ color: "#8B9E7A" }}>{l.notes}</div>}
                  </div>
                  {l.status === "pending" && l.leave_type === "Permission" && (
                    <>
                      <button type="button" onClick={() => setLeaveStatus(l, "approved", { is_paid: true, deduct_balance: true })} className="btn btn-primary text-xs py-1.5">
                        <CheckCircle size={14}/> Approve (Paid)
                      </button>
                      <button type="button" onClick={() => setLeaveStatus(l, "approved", { is_paid: false, deduct_balance: false })} className="btn btn-secondary text-xs py-1.5">
                        Approve (Unpaid)
                      </button>
                      <button type="button" onClick={() => setLeaveStatus(l, "rejected")} className="btn btn-outline text-xs py-1.5" style={{ color: "#8A3F27" }}>
                        <XCircle size={14}/> Reject
                      </button>
                    </>
                  )}
                  {l.status === "pending" && l.leave_type !== "Permission" && (
                    <>
                      <button type="button" onClick={() => setLeaveStatus(l, "approved")} className="btn btn-primary text-xs py-1.5">
                        <CheckCircle size={14}/> Approve
                      </button>
                      <button type="button" onClick={() => setLeaveStatus(l, "rejected")} className="btn btn-outline text-xs py-1.5" style={{ color: "#8A3F27" }}>
                        <XCircle size={14}/> Reject
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => removeLeave(l.id)} className="btn btn-ghost p-2 text-red-700 min-w-[44px] min-h-[44px]" title="Delete leave">
                    <Trash size={16}/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit Leave Request Modal */}
      {leaveModal && (
        <ModalBase
          title="Submit Leave Request"
          subtitle="Create a leave request on behalf of a therapist"
          onClose={() => { setLeaveModal(null); setLeaveDoc(null); }}
          size="md"
          footer={
            <>
              <ModalBtnSecondary type="button" onClick={() => { setLeaveModal(null); setLeaveDoc(null); }}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary type="button" data-testid="leave-submit-btn" onClick={submitLeave} disabled={leaveSubmitting}>
                {leaveSubmitting ? "Submitting..." : "Submit"}
              </ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Leave details">
            <FormField label="Therapist" required>
              <select className="modal-input" value={leaveModal.therapist_id} onChange={e => setLeaveModal({ ...leaveModal, therapist_id: e.target.value })}>
                <option value="">Select therapist...</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Type">
              <select className="modal-input" value={leaveModal.leave_type} onChange={e => setLeaveModal({ ...leaveModal, leave_type: e.target.value })}>
                {LEAVE_FORM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Date from">
                <input type="date" className="modal-input" value={leaveModal.start_date}
                  onChange={e => setLeaveModal(f => updateLeaveDates(f, e.target.value, f.end_date))} />
              </FormField>
              <FormField label="Date to">
                <input type="date" className="modal-input" value={leaveModal.end_date}
                  onChange={e => setLeaveModal(f => updateLeaveDates(f, f.start_date, e.target.value))} />
              </FormField>
            </div>
            <FormField label="Days">
              <input className="modal-input bg-[#F5F5F5]" readOnly value={leaveModal.days} />
            </FormField>
            <FormField label="Note">
              <textarea className="modal-input" rows={2} value={leaveModal.notes || ""} onChange={e => setLeaveModal({ ...leaveModal, notes: e.target.value })} />
            </FormField>
            <FormField label="Document (optional)">
              <input ref={leaveFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                onChange={e => setLeaveDoc(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => leaveFileRef.current?.click()} className="btn btn-outline text-sm">
                <UploadSimple size={16}/> {leaveDoc ? leaveDoc.name : "Upload Document"}
              </button>
            </FormField>
          </FormSection>
        </ModalBase>
      )}

      {/* New Request Modal — multi-step */}
      {edit && (
        <ModalBase
          title="New Request"
          subtitle={`Step ${step} of 3 · ${step === 1 ? "Choose type" : step === 2 ? "Provide details" : "Review & submit"}`}
          onClose={() => setEdit(null)}
          size="md"
          footer={
            step === 1 ? (
              <ModalBtnPrimary type="button" onClick={() => setStep(2)}>Next →</ModalBtnPrimary>
            ) : step === 2 ? (
              <>
                <ModalBtnSecondary type="button" onClick={() => setStep(1)}>← Back</ModalBtnSecondary>
                <ModalBtnPrimary type="button" onClick={() => setStep(3)} disabled={!edit.title}>Review →</ModalBtnPrimary>
              </>
            ) : (
              <>
                <ModalBtnSecondary type="button" onClick={() => setStep(2)}>← Back</ModalBtnSecondary>
                <ModalBtnPrimary data-testid="req-submit-btn" type="button" onClick={submitNew}>Submit Request 🌱</ModalBtnPrimary>
              </>
            )
          }
        >
          <div className="flex gap-1 -mt-2 mb-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: i <= step ? "#5C8A47" : "#EDE9E3" }} />
            ))}
          </div>

          {step === 1 && (
            <FormSection title="Request Details">
              <FormField label="Request type">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEdit({ ...edit, request_type: t.id })}
                      className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all hover:bg-[#E5EBE1]/30 ${edit.request_type === t.id ? "border-[#5C8A47] bg-[#E5EBE1]" : ""}`}
                      style={{ borderColor: edit.request_type === t.id ? "#5C8A47" : "#DDD8D0" }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${t.color}25`, color: t.color }}>{t.icon}</div>
                      <div className="font-bold text-sm" style={{ color: "#1C2617" }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Priority">
                <div className="flex gap-2 flex-wrap">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEdit({ ...edit, priority: p.id })}
                      className={`pill border-2 ${edit.priority === p.id ? "bg-[#E5EBE1]" : ""}`}
                      style={{ borderColor: edit.priority === p.id ? p.color : "#DDD8D0", color: p.color }}
                    >
                      <Lightning size={12} weight={edit.priority === p.id ? "fill" : "regular"} /> {p.label}
                    </button>
                  ))}
                </div>
              </FormField>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection title="Request Details">
              <FormField label="Subject" required>
                <input data-testid="req-title" className="modal-input" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="Brief title..." />
              </FormField>

              {edit.request_type === "leave" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="From">
                    <input type="date" className="modal-input" value={edit.date_from || ""} onChange={e => setEdit({ ...edit, date_from: e.target.value })} />
                  </FormField>
                  <FormField label="To">
                    <input type="date" className="modal-input" value={edit.date_to || ""} onChange={e => setEdit({ ...edit, date_to: e.target.value })} />
                  </FormField>
                </div>
              )}

              {edit.request_type === "schedule_change" && (
                <FormField label="Date affected">
                  <input type="date" className="modal-input" value={edit.date_from || ""} onChange={e => setEdit({ ...edit, date_from: e.target.value })} />
                </FormField>
              )}

              {edit.request_type === "reward" && (
                <FormField label="Reward type">
                  <select className="modal-input" value={edit.reward_type || ""} onChange={e => setEdit({ ...edit, reward_type: e.target.value })}>
                    <option value="">— Select —</option>
                    {REWARD_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </FormField>
              )}

              <FormField label="Description">
                <textarea data-testid="req-description" className="modal-input" rows={4} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} placeholder="Provide details..." />
              </FormField>

              <FormField label="Additional notes" hint="Optional">
                <textarea className="modal-input" rows={2} value={edit.extra_notes || ""} onChange={e => setEdit({ ...edit, extra_notes: e.target.value })} />
              </FormField>
            </FormSection>
          )}

          {step === 3 && (
            <FormSection title="Review">
              <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: "#F5F2ED" }}>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Type:</span><strong>{TYPES.find(t => t.id === edit.request_type)?.label}</strong></div>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Priority:</span><strong>{PRIORITIES.find(p => p.id === edit.priority)?.label}</strong></div>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Title:</span><strong>{edit.title}</strong></div>
                {edit.date_from && <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Date:</span><strong>{edit.date_from} {edit.date_to && `→ ${edit.date_to}`}</strong></div>}
                {edit.reward_type && <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Reward:</span><strong>{REWARD_TYPES.find(r => r.id === edit.reward_type)?.label}</strong></div>}
                {edit.description && <div><div style={{ color: "#9CA3AF" }}>Description:</div><div className="whitespace-pre-wrap mt-1">{edit.description}</div></div>}
              </div>
            </FormSection>
          )}
        </ModalBase>
      )}

      {/* Update status (admin) */}
      {statusEdit && (
        <ModalBase
          title={statusEdit.title || "Update Request"}
          subtitle={`${STATUS_MAP[statusEdit.status]?.label || statusEdit.status} · ${statusEdit.created_at ? new Date(statusEdit.created_at).toLocaleDateString("en-US") : ""}`}
          onClose={() => setStatusEdit(null)}
          size="md"
          footer={
            <>
              <ModalBtnSecondary type="button" onClick={() => setStatusEdit(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="status-save-btn" type="button" onClick={updateStatus}>Save & Notify</ModalBtnPrimary>
            </>
          }
        >
          <p className="text-sm -mt-2 mb-2" style={{ color: "#5C6853" }}>The therapist will be auto-notified.</p>

          <FormSection title="Request Details">
            {statusEdit.description && (
              <div className="text-sm rounded-xl p-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Description</div>
                <div style={{ color: "#1C2617" }}>{statusEdit.description}</div>
              </div>
            )}
            {statusEdit.timeline?.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#5C6853" }}>History</div>
                {statusEdit.timeline.map((ev, i) => (
                  <div key={i} className="text-xs py-2 border-b last:border-0" style={{ borderColor: "#EDE9E3" }}>
                    <span className="font-bold" style={{ color: "#1C2617" }}>{ev.event}</span>
                    <span style={{ color: "#9CA3AF" }}> · {ev.by} · {new Date(ev.at).toLocaleString("en-US")}</span>
                    {ev.note && <div className="italic mt-0.5" style={{ color: "#5C6853" }}>"{ev.note}"</div>}
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title="Status">
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusEdit({ ...statusEdit, status: k })}
                  className={`pill border-2 justify-start py-2 ${statusEdit.status === k ? "ring-2 ring-[#5C8A47]" : ""} ${v.cls}`}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <FormField label="Response / note" hint="Optional">
              <textarea className="modal-input" rows={3} value={statusEdit.admin_note || ""} onChange={e => setStatusEdit({ ...statusEdit, admin_note: e.target.value })} />
            </FormField>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
