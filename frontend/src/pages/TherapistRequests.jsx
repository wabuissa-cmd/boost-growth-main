import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  Plus, Package, Briefcase, ClockCounterClockwise, CalendarBlank,
  CheckCircle, XCircle, Hourglass, ChatCircleText, Clock, Lightning,
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import {
  LEAVE_STATUS, LEAVE_TYPES, diffDays, fmtDateRange, leaveStatusLabel, permissionPayLabel,
} from "../leaveUtils";

const STATUS_MAP = {
  pending: { label: "Pending", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  in_progress: { label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Clock size={14} weight="duotone"/>, color: "#A4BCCB" },
  approved: { label: "Approved", cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/>, color: "#B4C2A9" },
  rejected: { label: "Rejected", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/>, color: "#ECA6A6" },
  done: { label: "Completed", cls: "bg-[#7A8A6A] text-white border-[#7A8A6A]", icon: <CheckCircle size={14} weight="fill"/>, color: "#7A8A6A" },
};

const NEW_TYPES = [
  { id: "general", label: "General", icon: <Briefcase size={20} weight="duotone"/>, color: "#8B7BA8" },
  { id: "supplies", label: "Materials", icon: <Package size={20} weight="duotone"/>, color: "#D4A64A" },
  { id: "permission", label: "Permission (استئذان)", icon: <CalendarBlank size={20} weight="duotone"/>, color: "#6BAA9B" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#8B9E7A" },
  { id: "normal", label: "Normal", color: "#7A8A6A" },
  { id: "high", label: "High", color: "#D4A64A" },
  { id: "urgent", label: "Urgent", color: "#C97B5C" },
];

function emptyRequest() {
  return { title: "", description: "", request_type: "general", priority: "normal", extra_notes: "" };
}

function emptyPermission(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return { therapist_id: userId, start_date: today, end_date: today, days: 1, leave_type: "Permission", notes: "" };
}

function fmtContractPeriod(start, end) {
  if (!start || !end) return "";
  const f = (iso) => {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };
  return `${f(start)} – ${f(end)}`;
}

export default function TherapistRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [edit, setEdit] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [req, lv, bal] = await Promise.all([
      api.get("/requests"),
      api.get("/leaves"),
      api.get("/leaves/balance").catch(() => ({ data: [] })),
    ]);
    setRequests(req.data || []);
    setLeaves(lv.data || []);
    setBalance((bal.data || []).find(r => r.therapist_id === user?.id) || null);
  };

  useEffect(() => { load(); }, [user?.id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (edit.request_type === "permission") {
        await api.post("/leaves", {
          therapist_id: user.id,
          start_date: edit.start_date,
          end_date: edit.end_date,
          days: edit.days,
          leave_type: "Permission",
          notes: edit.notes || edit.description || null,
          status: "pending",
        });
      } else {
        await api.post("/requests", {
          title: edit.title,
          description: edit.description,
          request_type: edit.request_type,
          priority: edit.priority,
          extra_notes: edit.extra_notes,
        });
      }
      setEdit(null);
      setStep(1);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updatePermissionDates = (start, end) => {
    const days = Math.max(1, diffDays(start, end));
    setEdit(e => ({ ...e, start_date: start, end_date: end, days }));
  };

  const openNew = () => {
    setEdit({ ...emptyRequest(), ...emptyPermission(user?.id) });
    setStep(1);
  };

  const typeInfo = (id) => NEW_TYPES.find(t => t.id === id) || NEW_TYPES[0];
  const isPermission = edit?.request_type === "permission";

  return (
    <div>
      <PageBanner
        title="Request"
        subtitle="General requests · materials · permission · leave balance"
        badge={(
          <button data-testid="new-request-btn" onClick={openNew} className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0">
            <Plus size={13}/> New Request
          </button>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Left — general staff requests */}
        <section className="card p-4 min-h-[420px] flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#E8E4DE]">
            <h2 className="font-bold text-sm" style={{ color: "#2C3625" }}>General Requests</h2>
            <span className="text-xs pill bg-[#F0E9D8]" style={{ color: "#5C6853" }}>{requests.length}</span>
          </div>
          <p className="text-xs mb-3" style={{ color: "#8B9E7A" }}>Materials · general notes · other staff requests</p>
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[520px] pr-1">
            {requests.length === 0 && (
              <div className="p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>No requests yet</div>
            )}
            {requests.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              const tp = typeInfo(r.request_type === "supplies" ? "supplies" : "general");
              return (
                <div key={r.id} className="rounded-xl border border-[#E8E4DE] p-3 bg-[#FAFAF7]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`pill border text-[10px] ${st.cls}`}>{st.icon} {st.label}</span>
                    <span className="pill text-[10px]" style={{ background: `${tp.color}20`, color: tp.color }}>{tp.label}</span>
                  </div>
                  <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{r.title}</div>
                  {r.description && <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{r.description}</div>}
                  {r.admin_note && (
                    <div className="mt-2 text-xs p-2 rounded-lg bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>
                      <ChatCircleText size={12} className="inline mr-1"/> {r.admin_note}
                    </div>
                  )}
                  <div className="text-[10px] mt-1" style={{ color: "#8B9E7A" }}>
                    {new Date(r.created_at).toLocaleString("en-US")}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right — leave balance + leave requests */}
        <section className="card p-0 overflow-hidden min-h-[420px] flex flex-col">
          <div className="p-4 text-white" style={{ background: "linear-gradient(135deg, #7A8A6A 0%, #606E52 100%)" }}>
            <div className="text-[10px] tracking-[0.2em] font-bold opacity-90 mb-1">LEAVE BALANCE</div>
            {balance?.contract_period_start && (
              <div className="text-[10px] opacity-80 mb-2">
                Contract year · {fmtContractPeriod(balance.contract_period_start, balance.contract_period_end)}
              </div>
            )}
            {balance ? (
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <div className="font-display text-4xl font-semibold">{balance.remaining}</div>
                  <div className="text-sm opacity-90">days remaining</div>
                </div>
                <div className="grid grid-cols-3 gap-2 flex-1 min-w-[180px]">
                  <div className="bg-white/15 rounded-lg p-2 text-center">
                    <div className="text-[9px] opacity-80">ENTITLED</div>
                    <div className="text-lg font-bold">{balance.allocated}</div>
                  </div>
                  <div className="bg-white/15 rounded-lg p-2 text-center">
                    <div className="text-[9px] opacity-80">USED</div>
                    <div className="text-lg font-bold">{(balance.used_annual || 0) + (balance.used_permission || 0)}</div>
                  </div>
                  <div className="bg-white/15 rounded-lg p-2 text-center">
                    <div className="text-[9px] opacity-80">PENDING</div>
                    <div className="text-lg font-bold">{balance.pending || 0}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm opacity-90">Loading balance…</div>
            )}
          </div>

          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-bold text-sm" style={{ color: "#2C3625" }}>Leave Requests</h2>
              <span className="text-xs pill bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>{leaves.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px] pr-1">
              {leaves.length === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>No leave requests</div>
              )}
              {leaves.map(l => {
                const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
                const unpaid = permissionPayLabel(l);
                return (
                  <div key={l.id} className="rounded-xl border border-[#E8E4DE] p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="pill text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {leaveStatusLabel(l.status, true)}</span>
                      <span className="pill text-[10px]" style={{ background: `${tp.color}22`, color: tp.color }}>{tp.label}</span>
                      {unpaid && (
                        <span className="pill text-[10px] font-bold bg-[#F8EBE7] text-[#8A3F27] border border-[#ECA6A6]">{unpaid}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: "#2C3625" }}>
                      {fmtDateRange(l.start_date, l.end_date)} · {l.days} day{l.days !== 1 ? "s" : ""}
                    </div>
                    {l.notes && <div className="text-xs mt-1 italic" style={{ color: "#8B9E7A" }}>{l.notes}</div>}
                    {l.admin_note && (
                      <div className="mt-2 text-xs p-2 rounded-lg bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>{l.admin_note}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {edit && (
        <ModalBase
          title="New Request"
          subtitle={`Step ${step} of ${isPermission ? 2 : 3}`}
          onClose={() => { setEdit(null); setStep(1); }}
          size="md"
          footer={
            step === 1 ? (
              <ModalBtnPrimary type="button" onClick={() => setStep(isPermission ? 2 : 2)} disabled={!edit.request_type}>Next →</ModalBtnPrimary>
            ) : step === 2 && !isPermission ? (
              <>
                <ModalBtnSecondary type="button" onClick={() => setStep(1)}>← Back</ModalBtnSecondary>
                <ModalBtnPrimary type="button" onClick={() => setStep(3)} disabled={!edit.title}>Review →</ModalBtnPrimary>
              </>
            ) : (
              <>
                <ModalBtnSecondary type="button" onClick={() => setStep(1)}>← Back</ModalBtnSecondary>
                <ModalBtnPrimary data-testid="req-submit-btn" type="button" onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit"}
                </ModalBtnPrimary>
              </>
            )
          }
        >
          {step === 1 && (
            <FormSection title="Request type">
              <div className="grid grid-cols-1 gap-2">
                {NEW_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEdit({ ...edit, request_type: t.id, ...(t.id === "permission" ? emptyPermission(user?.id) : {}) })}
                    className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${edit.request_type === t.id ? "border-[#5C8A47] bg-[#E5EBE1]" : "border-[#DDD8D0]"}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${t.color}25`, color: t.color }}>{t.icon}</div>
                    <div className="font-bold text-sm" style={{ color: "#1C2617" }}>{t.label}</div>
                  </button>
                ))}
              </div>
            </FormSection>
          )}

          {step === 2 && isPermission && (
            <FormSection title="Permission details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date from">
                  <input type="date" className="modal-input" value={edit.start_date}
                    onChange={e => updatePermissionDates(e.target.value, edit.end_date)} />
                </FormField>
                <FormField label="Date to">
                  <input type="date" className="modal-input" value={edit.end_date}
                    onChange={e => updatePermissionDates(edit.start_date, e.target.value)} />
                </FormField>
              </div>
              <FormField label="Days">
                <input className="modal-input bg-[#F5F5F5]" readOnly value={edit.days} />
              </FormField>
              <FormField label="Note">
                <textarea className="modal-input" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Reason for permission…" />
              </FormField>
            </FormSection>
          )}

          {step === 2 && !isPermission && (
            <FormSection title="Details">
              <FormField label="Subject" required>
                <input data-testid="req-title" className="modal-input" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} />
              </FormField>
              <FormField label="Description">
                <textarea data-testid="req-description" className="modal-input" rows={4} value={edit.description || ""} onChange={e => setEdit({ ...edit, description: e.target.value })} />
              </FormField>
              <FormField label="Priority">
                <div className="flex gap-2 flex-wrap">
                  {PRIORITIES.map(p => (
                    <button key={p.id} type="button" onClick={() => setEdit({ ...edit, priority: p.id })}
                      className={`pill border-2 ${edit.priority === p.id ? "bg-[#E5EBE1]" : ""}`}
                      style={{ borderColor: edit.priority === p.id ? p.color : "#DDD8D0", color: p.color }}>
                      <Lightning size={12} /> {p.label}
                    </button>
                  ))}
                </div>
              </FormField>
            </FormSection>
          )}

          {step === 3 && !isPermission && (
            <FormSection title="Review">
              <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: "#F5F2ED" }}>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Type:</span><strong>{typeInfo(edit.request_type).label}</strong></div>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Title:</span><strong>{edit.title}</strong></div>
                {edit.description && <div><div style={{ color: "#9CA3AF" }}>Description:</div><div className="mt-1">{edit.description}</div></div>}
              </div>
            </FormSection>
          )}
        </ModalBase>
      )}
    </div>
  );
}
