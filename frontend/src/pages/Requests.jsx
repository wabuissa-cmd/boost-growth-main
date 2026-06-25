import { useEffect, useState, useRef } from "react";
import api from "../api";
import { useAuth, showAdminNav, canEditStaffRequests, canManageLeaves, canHrReviewLeaves, isJenan, isWalaaOps } from "../auth";
import { Navigate } from "react-router-dom";
import { Plus, PencilSimple, Trash, X, ChatCircleText, CalendarBlank, Tag, Lightning, Clock, CheckCircle, XCircle, Hourglass, Spinner, Trophy, Briefcase, Calendar, Package, UploadSimple } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import { LEAVE_STATUS, LEAVE_TYPES, diffDays, fmtDateRange, permissionPayLabel } from "../leaveUtils";
import "../clientInfoLayout.css";

const STATUS_MAP = {
  pending:    { label: "Pending",     cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  pending_manager: { label: "Pending Manager", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  pending_hr: { label: "Pending HR", cls: "bg-[#F5EBE3] text-[#965132] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#C28E6A" },
  in_progress:{ label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Spinner size={14} weight="duotone"/>, color: "#A4BCCB" },
  approved:   { label: "Approved",    cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/>, color: "#B4C2A9" },
  rejected:   { label: "Rejected",    cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/>, color: "#ECA6A6" },
  done:       { label: "Completed",   cls: "bg-[#7A8A6A] text-white border-[#7A8A6A]",     icon: <CheckCircle size={14} weight="fill"/>, color: "#7A8A6A" },
};

const PENDING_MANAGER_STATUSES = new Set(["pending", "pending_manager"]);
const PENDING_HR_STATUS = "pending_hr";

function isPendingManagerStatus(status) {
  return PENDING_MANAGER_STATUSES.has(status);
}

function allowedStatusOptions(user, currentStatus) {
  const portalAdmin = showAdminNav(user);
  const manager = isJenan(user) && !portalAdmin;
  const hr = canHrReviewLeaves(user) && !portalAdmin;
  const effective = isPendingManagerStatus(currentStatus) ? "pending_manager" : currentStatus;

  if (portalAdmin || isWalaaOps(user)) {
    return Object.keys(STATUS_MAP);
  }
  if (manager && isPendingManagerStatus(effective)) {
    return ["pending_hr", "rejected"];
  }
  if (hr && effective === PENDING_HR_STATUS) {
    return ["approved", "rejected", "in_progress", "done"];
  }
  return Object.keys(STATUS_MAP);
}

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

export default function Requests({ personal = false, embedded = false }) {
  const { user } = useAuth();
  const canManageReq = !personal && canEditStaffRequests(user);
  const leaveHr = !personal && canManageLeaves(user);
  const hrReview = !personal && canHrReviewLeaves(user);
  const isPortalAdminUser = !personal && showAdminNav(user);
  const isManager = !personal && isJenan(user) && !isPortalAdminUser;
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
  const updateStatus = async (req, status, admin_note = null) => {
    await api.put(`/requests/${req.id}/status`, { status, admin_note: admin_note ?? req.admin_note });
    load();
  };
  const updateStatusFromModal = async () => {
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
    .filter(r => {
      if (filter === "all") return true;
      if (filter === "pending_manager") return isPendingManagerStatus(r.status);
      return r.status === filter;
    });

  if (!personal && !canEditStaffRequests(user)) {
    return <Navigate to="/my-requests" replace/>;
  }

  const pendingManagerCount = items.filter(r => isPendingManagerStatus(r.status)).length;
  const pendingHrCount = items.filter(r => r.status === PENDING_HR_STATUS).length;
  const pendingCount = pendingManagerCount + pendingHrCount;
  const inProgressCount = items.filter(r => r.status === "in_progress").length;
  const doneCount = items.filter(r => r.status === "done").length;

  return (
    <div>
      {!embedded && (
      <PageBanner
        title={canManageReq ? "Staff Requests" : "My Requests"}
        subtitle={canManageReq ? "Materials, general & session-related requests — leave tools on the right" : "Submit and track your staff requests"}
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
          { label: "Pending", n: pendingCount, color: "#6B5218" },
          { label: "Manager", n: pendingManagerCount, color: "#6B5218" },
          { label: "HR", n: pendingHrCount, color: "#965132" },
          { label: "In progress", n: inProgressCount, color: "#375568" },
          { label: "Done", n: doneCount, color: "#3D4F35" },
        ]}
      />
      )}

      <div className="req-split">
        <section className="req-panel-left">
          <div className="req-leave-balance mx-3 mt-3">
            <div className="text-[10px] tracking-[0.2em] font-bold opacity-90 mb-2">REQUEST OVERVIEW</div>
            <div className="req-leave-stat-grid">
              <div className="req-leave-stat-box">
                <div className="req-leave-stat-val">{items.length}</div>
                <div className="req-leave-stat-lbl">Total</div>
              </div>
              <div className="req-leave-stat-box">
                <div className="req-leave-stat-val">{pendingCount}</div>
                <div className="req-leave-stat-lbl">Pending</div>
              </div>
              <div className="req-leave-stat-box">
                <div className="req-leave-stat-val">{inProgressCount}</div>
                <div className="req-leave-stat-lbl">In progress</div>
              </div>
              <div className="req-leave-stat-box">
                <div className="req-leave-stat-val">{doneCount}</div>
                <div className="req-leave-stat-lbl">Done</div>
              </div>
            </div>
          </div>

          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Staff Requests</h2>
            <p className="text-xs mt-1 mb-2" style={{ color: "#8B9E7A" }}>Supplies · schedule changes · rewards · general</p>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilter("all")} className={`pill text-[10px] ${filter==="all" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>All ({items.length})</button>
              <button onClick={() => setFilter("pending_manager")} className={`pill text-[10px] border ${filter==="pending_manager" ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : STATUS_MAP.pending_manager.cls}`}>
                Manager ({pendingManagerCount})
              </button>
              <button onClick={() => setFilter("pending_hr")} className={`pill text-[10px] border ${filter==="pending_hr" ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : STATUS_MAP.pending_hr.cls}`}>
                HR ({pendingHrCount})
              </button>
              {["in_progress", "approved", "rejected", "done"].map(k => (
                <button key={k} onClick={() => setFilter(k)} className={`pill text-[10px] border ${filter===k ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : STATUS_MAP[k].cls}`}>
                  {STATUS_MAP[k].label} ({items.filter(r => r.status === k).length})
                </button>
              ))}
            </div>
          </div>

          <div className="req-panel-list">
            {filtered.length === 0 && <div className="p-8 text-center text-sm" style={{color: "#8B9E7A"}}>No requests yet</div>}
            {filtered.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              const tp = TYPES.find(t => t.id === r.request_type) || TYPES[4];
              return (
                <div key={r.id} className="req-item">
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{background: `${tp.color}25`, color: tp.color}}>{tp.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`pill border text-[10px] ${st.cls}`}>{st.icon} {st.label}</span>
                        <span className="pill text-[10px]" style={{background: `${tp.color}20`, color: tp.color}}>{tp.label}</span>
                        {r.priority && r.priority !== "normal" && (
                          <span className="pill text-[10px]" style={{background: `${PRIORITIES.find(p=>p.id===r.priority)?.color}20`, color: PRIORITIES.find(p=>p.id===r.priority)?.color}}>
                            {PRIORITIES.find(p=>p.id===r.priority)?.label}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm" style={{color: "#2C3625"}}>{r.title}</div>
                      {r.description && <div className="text-xs mt-0.5 line-clamp-2" style={{color: "#5C6853"}}>{r.description}</div>}
                      {canManageReq && r.therapist_name && (
                        <div className="text-[10px] mt-1" style={{color: "#8B9E7A"}}>From <strong style={{color: "#5C6853"}}>{r.therapist_name}</strong></div>
                      )}
                      <div className="text-[10px] mt-0.5" style={{color: "#8B9E7A"}}>{new Date(r.created_at).toLocaleString('en-US')}</div>
                      {r.admin_note && (
                        <div className="mt-2 p-2 rounded-lg text-xs bg-[#E5EBE1]" style={{color: "#3D4F35"}}>{r.admin_note}</div>
                      )}
                      {canManageReq && isPendingManagerStatus(r.status) && isManager && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <button type="button" onClick={() => updateStatus(r, "pending_hr")} className="btn btn-primary text-[10px] py-1 px-2">
                            <CheckCircle size={12}/> Forward to HR
                          </button>
                          <button type="button" onClick={() => updateStatus(r, "rejected")} className="btn btn-outline text-[10px] py-1 px-2" style={{ color: "#8A3F27" }}>
                            <XCircle size={12}/> Reject
                          </button>
                        </div>
                      )}
                      {canManageReq && r.status === PENDING_HR_STATUS && hrReview && !isPortalAdminUser && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <button type="button" onClick={() => updateStatus(r, "approved")} className="btn btn-primary text-[10px] py-1 px-2">
                            <CheckCircle size={12}/> Approve
                          </button>
                          <button type="button" onClick={() => updateStatus(r, "rejected")} className="btn btn-outline text-[10px] py-1 px-2" style={{ color: "#8A3F27" }}>
                            <XCircle size={12}/> Reject
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {canManageReq && <button data-testid={`update-status-${r.id}`} onClick={() => setStatusEdit({...r})} className="btn btn-secondary text-[10px] py-1 px-2"><PencilSimple size={12}/></button>}
                      {isPortalAdminUser && (
                        <button onClick={() => remove(r.id)} className="btn btn-ghost p-1.5 text-red-700" title="Delete"><Trash size={14}/></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="req-panel-sidebar">
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Request Types</h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>What therapists can submit</p>
          </div>
          <div className="p-3 space-y-2">
            {TYPES.map(t => (
              <div key={t.id} className="flex items-start gap-2 text-xs">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${t.color}22`, color: t.color }}>{t.icon}</span>
                <div>
                  <div className="font-bold" style={{ color: "#2C3625" }}>{t.label}</div>
                  <div style={{ color: "#8B9E7A" }}>
                    {t.id === "supplies" && "Materials, toys, or classroom items"}
                    {t.id === "schedule_change" && "Session time or day adjustments"}
                    {t.id === "reward" && "Recognition or bonus requests"}
                    {t.id === "general" && "Other staff-related needs"}
                    {t.id === "leave" && "Routed via leave panel below"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {leaveHr && (
            <>
              <div className="req-panel-head border-t border-[#E2DDD4]">
                <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Recent Leave Requests</h2>
                <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>Approve or reject from here</p>
              </div>
              <div className="req-panel-list">
                {recentLeaves.length === 0 && (
                  <div className="p-6 text-center text-xs" style={{ color: "#8B9E7A" }}>No leave requests yet</div>
                )}
                {recentLeaves.map(l => {
                  const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                  const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
                  return (
                    <div key={l.id} className="req-item">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="pill text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                        <span className="pill text-[10px]" style={{ background: `${tp.color}20`, color: tp.color }}>{tp.label}</span>
                      </div>
                      <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{l.therapist_name || "Therapist"}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#5C6853" }}>
                        {fmtDateRange(l.start_date, l.end_date)} · {l.days} day{l.days !== 1 ? "s" : ""}
                      </div>
                      {(l.status === "pending" || l.status === "pending_manager") && isPortalAdminUser && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {l.leave_type === "Permission" ? (
                            <>
                              <button type="button" onClick={() => setLeaveStatus(l, "approved", { is_paid: true, deduct_balance: true })} className="btn btn-primary text-[10px] py-1 px-2">Paid</button>
                              <button type="button" onClick={() => setLeaveStatus(l, "approved", { is_paid: false, deduct_balance: false })} className="btn btn-secondary text-[10px] py-1 px-2">Unpaid</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setLeaveStatus(l, "approved")} className="btn btn-primary text-[10px] py-1 px-2">Approve</button>
                          )}
                          <button type="button" onClick={() => setLeaveStatus(l, "rejected")} className="btn btn-outline text-[10px] py-1 px-2" style={{ color: "#8A3F27" }}>Reject</button>
                        </div>
                      )}
                      <button type="button" onClick={() => removeLeave(l.id)} className="btn btn-ghost p-1 text-red-700 mt-1 text-[10px]" title="Delete">Delete</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      </div>

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
              <ModalBtnPrimary data-testid="status-save-btn" type="button" onClick={updateStatusFromModal}>Save & Notify</ModalBtnPrimary>
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
              {allowedStatusOptions(user, statusEdit.status).map(k => {
                const v = STATUS_MAP[k] || STATUS_MAP.pending;
                return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusEdit({ ...statusEdit, status: k })}
                  className={`pill border-2 justify-start py-2 ${statusEdit.status === k ? "ring-2 ring-[#5C8A47]" : ""} ${v.cls}`}
                >
                  {v.icon} {v.label}
                </button>
              );})}
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
