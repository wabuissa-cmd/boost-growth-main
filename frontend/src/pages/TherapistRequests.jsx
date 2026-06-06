import { useEffect, useState } from "react";
import api, { API } from "../api";
import { useAuth } from "../auth";
import {
  Plus, Package, Briefcase, ClockCounterClockwise, CalendarBlank,
  CheckCircle, XCircle, Hourglass, ChatCircleText, Clock, Lightning,
  Paperclip, UploadSimple, FileArrowDown,
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import "../clientInfoLayout.css";
import VerticalStepper from "../components/VerticalStepper";
import "../stepperLayout.css";
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
  { id: "leave", label: "Leave Request", icon: <ClockCounterClockwise size={20} weight="duotone"/>, color: "#7A8A6A" },
  { id: "permission", label: "Permission", icon: <CalendarBlank size={20} weight="duotone"/>, color: "#6BAA9B" },
];

const LEAVE_REQUEST_TYPES = ["Annual", "Sickleave", "Unpaid", "Exam", "Emergency"];

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

function emptyLeave(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return { therapist_id: userId, start_date: today, end_date: today, days: 1, leave_type: "Annual", notes: "" };
}

function fmtContractPeriod(start, end) {
  if (!start || !end) return "";
  const f = (iso) => {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };
  return `${f(start)} – ${f(end)}`;
}

function fmtShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function TherapistRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [edit, setEdit] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadReportDate, setUploadReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);

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
      } else if (edit.request_type === "leave") {
        await api.post("/leaves", {
          therapist_id: user.id,
          start_date: edit.start_date,
          end_date: edit.end_date,
          days: edit.days,
          leave_type: edit.leave_type || "Annual",
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

  const submitUpload = async () => {
    if (!uploadFile) {
      alert("Please choose a file");
      return;
    }
    if (!uploadReportDate) {
      alert("Please choose the report date");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("report_date", uploadReportDate);
      await api.post("/requests/upload-attachment", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadReportDate(new Date().toISOString().slice(0, 10));
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const updateLeaveDates = (start, end) => {
    const days = Math.max(1, diffDays(start, end));
    setEdit(e => ({ ...e, start_date: start, end_date: end, days }));
  };

  const openNew = () => {
    setEdit({ ...emptyRequest(), ...emptyPermission(user?.id) });
    setStep(1);
  };

  const typeInfo = (id) => {
    if (id === "attachment") {
      return { id: "attachment", label: "Report Attachment", color: "#7B96B5" };
    }
    if (id === "supplies") return NEW_TYPES.find(t => t.id === "supplies");
    return NEW_TYPES.find(t => t.id === id) || NEW_TYPES[0];
  };

  const isLeaveFlow = edit?.request_type === "permission" || edit?.request_type === "leave";

  return (
    <div>
      <PageBanner
        title="Request"
        subtitle="General requests · materials · leave · permission · attachments"
        badge={(
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              data-testid="upload-attachment-btn"
              onClick={() => setUploadOpen(true)}
              className="btn btn-outline text-[11px] px-2.5 py-1 min-h-0"
            >
              <UploadSimple size={13}/> Upload Attachment
            </button>
            <button data-testid="new-request-btn" onClick={openNew} className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0">
              <Plus size={13}/> New Request
            </button>
          </div>
        )}
      />

      <div className="req-split">
        <section className="req-panel-left">
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>General Requests</h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>Materials · notes · attachments</p>
          </div>
          <div className="req-panel-list">
            {requests.length === 0 && (
              <div className="p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>No requests yet</div>
            )}
            {requests.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              const tp = typeInfo(r.request_type === "supplies" ? "supplies" : r.request_type);
              const isAttachment = r.request_type === "attachment";
              return (
                <div key={r.id} className="req-item">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`pill border text-[10px] ${st.cls}`}>{st.icon} {st.label}</span>
                    <span className="pill text-[10px]" style={{ background: `${tp.color}20`, color: tp.color }}>
                      {isAttachment ? <Paperclip size={10} className="inline mr-0.5"/> : null}
                      {tp.label}
                    </span>
                  </div>
                  <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{r.title}</div>
                  {isAttachment && (
                    <div className="text-xs mt-1 space-y-0.5" style={{ color: "#5C6853" }}>
                      <div>Report date: <strong>{fmtShortDate(r.report_date)}</strong></div>
                      <div>Uploaded: {new Date(r.created_at).toLocaleString("en-US")}</div>
                      {r.attachment_url && (
                        <a
                          href={`${API}/requests/${r.id}/attachment`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 font-semibold underline"
                          style={{ color: "#5C8A47" }}
                        >
                          <FileArrowDown size={12}/> View attachment
                        </a>
                      )}
                    </div>
                  )}
                  {!isAttachment && r.description && (
                    <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{r.description}</div>
                  )}
                  {r.admin_note && (
                    <div className="mt-2 text-xs p-2 rounded-lg bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>
                      <ChatCircleText size={12} className="inline mr-1"/> {r.admin_note}
                    </div>
                  )}
                  {!isAttachment && (
                    <div className="text-[10px] mt-1" style={{ color: "#8B9E7A" }}>
                      {new Date(r.created_at).toLocaleString("en-US")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="req-panel-right">
          <div className="req-leave-balance">
            <div className="text-[10px] tracking-[0.2em] font-bold opacity-90 mb-1">LEAVE BALANCE</div>
            {balance?.contract_period_start && (
              <div className="text-[10px] opacity-80 mb-2">
                Contract · {fmtContractPeriod(balance.contract_period_start, balance.contract_period_end)}
              </div>
            )}
            {balance ? (
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <div className="font-display text-3xl font-semibold">{balance.remaining}</div>
                  <div className="text-xs opacity-90">days left</div>
                </div>
                <div className="text-xs opacity-90">{balance.allocated} entitled · {(balance.used_annual || 0) + (balance.used_permission || 0)} used</div>
              </div>
            ) : (
              <div className="text-sm opacity-90">Loading…</div>
            )}
          </div>
          <div className="card p-4 flex-1 flex flex-col min-h-[360px]">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#E2DDD4]">
              <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Leave Requests</h2>
              <span className="text-xs pill bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>{leaves.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px]">
              {leaves.length === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>No leave requests</div>
              )}
              {leaves.map(l => {
                const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
                const unpaid = permissionPayLabel(l);
                return (
                  <div key={l.id} className="rounded-[1.25rem] border border-[#E2DDD4] p-3">
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
          subtitle={`Step ${step} of ${isLeaveFlow ? 2 : 3}`}
          onClose={() => { setEdit(null); setStep(1); }}
          size="md"
          footer={
            step === 1 ? (
              <ModalBtnPrimary type="button" onClick={() => setStep(2)} disabled={!edit.request_type}>Next →</ModalBtnPrimary>
            ) : step === 2 && !isLeaveFlow ? (
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
          <div className="req-modal-split">
            <VerticalStepper
              current={step}
              steps={isLeaveFlow
                ? [{ label: "Type", hint: "Choose request" }, { label: "Details", hint: "Dates & notes" }]
                : [{ label: "Type", hint: "Choose request" }, { label: "Details", hint: "Fill form" }, { label: "Review", hint: "Confirm" }]}
            />
            <div className="min-w-0">
          {step === 1 && (
            <FormSection title="Request type">
              <div className="grid grid-cols-1 gap-2">
                {NEW_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEdit({
                      ...edit,
                      request_type: t.id,
                      ...(t.id === "permission" ? emptyPermission(user?.id) : {}),
                      ...(t.id === "leave" ? emptyLeave(user?.id) : {}),
                    })}
                    className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${edit.request_type === t.id ? "border-[#5C8A47] bg-[#E5EBE1]" : "border-[#DDD8D0]"}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${t.color}25`, color: t.color }}>{t.icon}</div>
                    <div className="font-bold text-sm" style={{ color: "#1C2617" }}>{t.label}</div>
                  </button>
                ))}
              </div>
            </FormSection>
          )}

          {step === 2 && edit.request_type === "permission" && (
            <FormSection title="Permission details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date from">
                  <input type="date" className="modal-input" value={edit.start_date}
                    onChange={e => updateLeaveDates(e.target.value, edit.end_date)} />
                </FormField>
                <FormField label="Date to">
                  <input type="date" className="modal-input" value={edit.end_date}
                    onChange={e => updateLeaveDates(edit.start_date, e.target.value)} />
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

          {step === 2 && edit.request_type === "leave" && (
            <FormSection title="Leave details">
              <FormField label="Leave type">
                <select className="modal-input" value={edit.leave_type || "Annual"} onChange={e => setEdit({ ...edit, leave_type: e.target.value })}>
                  {LEAVE_REQUEST_TYPES.map(lt => (
                    <option key={lt} value={lt}>{LEAVE_TYPES[lt]?.label || lt}</option>
                  ))}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date from">
                  <input type="date" className="modal-input" value={edit.start_date}
                    onChange={e => updateLeaveDates(e.target.value, edit.end_date)} />
                </FormField>
                <FormField label="Date to">
                  <input type="date" className="modal-input" value={edit.end_date}
                    onChange={e => updateLeaveDates(edit.start_date, e.target.value)} />
                </FormField>
              </div>
              <FormField label="Days">
                <input className="modal-input bg-[#F5F5F5]" readOnly value={edit.days} />
              </FormField>
              <FormField label="Note">
                <textarea className="modal-input" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Additional notes…" />
              </FormField>
            </FormSection>
          )}

          {step === 2 && !isLeaveFlow && (
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

          {step === 3 && !isLeaveFlow && (
            <FormSection title="Review">
              <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: "#F5F2ED" }}>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Type:</span><strong>{typeInfo(edit.request_type).label}</strong></div>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Title:</span><strong>{edit.title}</strong></div>
                {edit.description && <div><div style={{ color: "#9CA3AF" }}>Description:</div><div className="mt-1">{edit.description}</div></div>}
              </div>
            </FormSection>
          )}
            </div>
          </div>
        </ModalBase>
      )}

      {uploadOpen && (
        <ModalBase
          title="Upload Attachment"
          subtitle="Submit a report file with its report date"
          onClose={() => { setUploadOpen(false); setUploadFile(null); }}
          size="md"
          footer={(
            <>
              <ModalBtnSecondary type="button" onClick={() => { setUploadOpen(false); setUploadFile(null); }}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary type="button" data-testid="upload-attachment-submit" onClick={submitUpload} disabled={uploading || !uploadFile}>
                {uploading ? "Uploading…" : "Submit"}
              </ModalBtnPrimary>
            </>
          )}
        >
          <FormSection title="Report file">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
              className="modal-input"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
            />
            {uploadFile && (
              <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{uploadFile.name}</div>
            )}
          </FormSection>
          <FormField label="Report date" hint="When the report was dated">
            <input
              type="date"
              className="modal-input"
              value={uploadReportDate}
              onChange={e => setUploadReportDate(e.target.value)}
            />
          </FormField>
        </ModalBase>
      )}
    </div>
  );
}
