import { useEffect, useState, useMemo } from "react";
import api, { API, openAuthenticatedFile } from "../api";
import { useAuth, isJenan } from "../auth";
import {
  Plus, Package, Briefcase, ClockCounterClockwise, CalendarBlank,
  CheckCircle, XCircle, Hourglass, ChatCircleText, Clock, Lightning,
  Paperclip, FileArrowDown, UploadSimple, FileText, Buildings,
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import "../clientInfoLayout.css";
import VerticalStepper from "../components/VerticalStepper";
import PurchasesPanel from "../components/PurchasesPanel";
import "../stepperLayout.css";
import {
  LEAVE_STATUS, LEAVE_TYPES, diffDays, fmtDateRange, leaveStatusLabel, permissionPayLabel,
  permissionDaysFromTimes, addHoursToTime24, fmtLeaveSchedule,
  leaveRequiresDocument, ATTACHMENT_REQUIRED_MSG,
  VACATION_LEAVE_TYPES, LEAVE_TAB_TYPES, selectableLeaveTypeEntries,
} from "../leaveUtils";

const STATUS_MAP = {
  pending: { label: "Under Review", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  pending_manager: { label: "Direct Manager Review", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  pending_attachment: { label: "Awaiting Attachment", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <Paperclip size={14} weight="duotone"/>, color: "#ECA6A6" },
  pending_hr: { label: "HR Review", cls: "bg-[#F5EBE3] text-[#965132] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#C28E6A" },
  in_progress: { label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Clock size={14} weight="duotone"/>, color: "#A4BCCB" },
  approved: { label: "Approved", cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/>, color: "#B4C2A9" },
  rejected: { label: "Rejected", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/>, color: "#ECA6A6" },
  done: { label: "Completed", cls: "bg-[#7A8A6A] text-white border-[#7A8A6A]", icon: <CheckCircle size={14} weight="fill"/>, color: "#7A8A6A" },
};

const REQUEST_TABS = [
  { id: "vacation", label: "Vacation applications" },
  { id: "leave", label: "Leave" },
  { id: "other", label: "Other applications" },
];

const OTHER_REQUEST_TYPES = [
  { id: "general", label: "General", icon: <Briefcase size={20} weight="duotone"/>, color: "#7A8A6A" },
  { id: "supplies", label: "Materials", icon: <Package size={20} weight="duotone"/>, color: "#D4A64A" },
  { id: "requirements", label: "Requirements", icon: <FileText size={20} weight="duotone"/>, color: "#7B96B5" },
  { id: "government", label: "Government / HR", icon: <Buildings size={20} weight="duotone"/>, color: "#6BAA9B" },
];

const LEAVE_FORM_TYPES = selectableLeaveTypeEntries().filter(([k]) => LEAVE_TAB_TYPES.includes(k));
const VACATION_FORM_TYPES = selectableLeaveTypeEntries().filter(([k]) => VACATION_LEAVE_TYPES.includes(k));

const PRIORITIES = [
  { id: "low", label: "Low", color: "#8B9E7A" },
  { id: "normal", label: "Normal", color: "#7A8A6A" },
  { id: "high", label: "High", color: "#D4A64A" },
  { id: "urgent", label: "Urgent", color: "#C97B5C" },
];

function emptyRequest() {
  return { title: "", description: "", request_type: "general", priority: "normal", extra_notes: "", attachmentFile: null, reportDate: "", includesReport: false };
}

function AttachmentRequiredBanner() {
  return (
    <div className="rounded-xl p-3 text-xs font-semibold border" style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
      {ATTACHMENT_REQUIRED_MSG}
    </div>
  );
}

function leaveDocumentType(leaveType) {
  if (leaveType === "Sickleave") return "medical";
  if (leaveType === "Permission") return "appointment";
  return "other";
}

function emptyPermission(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    therapist_id: userId,
    start_date: today,
    end_date: today,
    days: 0.125,
    leave_type: "Permission",
    start_time: "14:00",
    end_time: "15:00",
    notes: "",
  };
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
  const hidePurchases = isJenan(user);
  const [requests, setRequests] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [edit, setEdit] = useState(null);
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState("vacation");

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

  const [submitting, setSubmitting] = useState(false);

  const vacationLeaves = leaves.filter(l => VACATION_LEAVE_TYPES.includes(l.leave_type));
  const otherLeaves = leaves.filter(l => LEAVE_TAB_TYPES.includes(l.leave_type));

  const modalTypeOptions = useMemo(() => {
    if (activeTab === "vacation") {
      return [
        { id: "leave", label: "Annual vacation", icon: <ClockCounterClockwise size={20} weight="duotone"/>, color: "#7A8A6A" },
      ];
    }
    if (activeTab === "leave") {
      return [
        { id: "permission", label: "Permission", icon: <CalendarBlank size={20} weight="duotone"/>, color: "#6BAA9B" },
        { id: "leave", label: "Sick / unpaid leave", icon: <ClockCounterClockwise size={20} weight="duotone"/>, color: "#9B7BAB" },
      ];
    }
    return OTHER_REQUEST_TYPES;
  }, [activeTab]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (edit.request_type === "permission") {
        if (!edit.start_time || !edit.end_time) {
          alert("Please set start and end time for permission.");
          setSubmitting(false);
          return;
        }
        if (leaveRequiresDocument("Permission") && !edit.attachmentFile) {
          alert(`Please upload a supporting document. ${ATTACHMENT_REQUIRED_MSG}`);
          setSubmitting(false);
          return;
        }
        const { data: created } = await api.post("/leaves", {
          therapist_id: user.id,
          start_date: edit.start_date,
          end_date: edit.end_date,
          days: edit.days,
          leave_type: "Permission",
          start_time: edit.start_time,
          end_time: edit.end_time,
          notes: edit.notes || edit.description || null,
          status: "pending",
        });
        if (edit.attachmentFile && created?.id) {
          const fd = new FormData();
          fd.append("file", edit.attachmentFile);
          fd.append("document_type", leaveDocumentType("Permission"));
          await api.post(`/leaves/${created.id}/upload-document`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } else if (edit.request_type === "leave") {
        const leaveType = edit.leave_type || "Annual";
        if (leaveRequiresDocument(leaveType) && !edit.attachmentFile) {
          alert(`Please upload a supporting document. ${ATTACHMENT_REQUIRED_MSG}`);
          setSubmitting(false);
          return;
        }
        const { data: created } = await api.post("/leaves", {
          therapist_id: user.id,
          start_date: edit.start_date,
          end_date: edit.end_date,
          days: edit.days,
          leave_type: leaveType,
          notes: edit.notes || edit.description || null,
          status: "pending",
        });
        if (edit.attachmentFile && created?.id) {
          const fd = new FormData();
          fd.append("file", edit.attachmentFile);
          fd.append("document_type", leaveDocumentType(leaveType));
          await api.post(`/leaves/${created.id}/upload-document`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } else {
        if (edit.includesReport && !edit.attachmentFile) {
          alert(`Please upload a supporting document. ${ATTACHMENT_REQUIRED_MSG}`);
          setSubmitting(false);
          return;
        }
        const res = await api.post("/requests", {
          title: edit.title,
          description: edit.description,
          request_type: edit.request_type,
          priority: edit.priority,
          extra_notes: edit.extra_notes,
          requires_attachment: Boolean(edit.includesReport),
        });
        if (edit.attachmentFile && res.data?.id) {
          const fd = new FormData();
          fd.append("file", edit.attachmentFile);
          if (edit.reportDate) fd.append("report_date", edit.reportDate);
          await api.post(`/requests/${res.data.id}/attachment`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
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

  const updateLeaveDates = (start, end) => {
    const days = Math.max(1, diffDays(start, end));
    setEdit(e => ({ ...e, start_date: start, end_date: end, days }));
  };

  const updatePermissionDate = (date) => {
    const days = permissionDaysFromTimes(
      edit?.start_time,
      edit?.end_time,
      date,
      date,
    );
    setEdit(e => ({ ...e, start_date: date, end_date: date, days }));
  };

  const updatePermissionTimes = (startTime, endTime) => {
    const days = permissionDaysFromTimes(
      startTime,
      endTime,
      edit?.start_date || edit?.end_date,
      edit?.end_date || edit?.start_date,
    );
    setEdit(e => ({ ...e, start_time: startTime, end_time: endTime, days }));
  };

  const setPermissionDurationHours = (hours) => {
    const start = edit?.start_time || "14:00";
    updatePermissionTimes(start, addHoursToTime24(start, hours));
  };

  const openNew = () => {
    if (activeTab === "vacation") {
      setEdit({ ...emptyRequest(), ...emptyLeave(user?.id), request_type: "leave", leave_type: "Annual" });
    } else if (activeTab === "leave") {
      setEdit({ ...emptyRequest(), ...emptyPermission(user?.id), request_type: "permission" });
    } else {
      setEdit({ ...emptyRequest(), request_type: "general" });
    }
    setStep(1);
  };

  useEffect(() => { load(); }, [user?.id]);

  const typeInfo = (id) => {
    if (id === "attachment") {
      return { id: "attachment", label: "Report Attachment", color: "#7B96B5" };
    }
    if (id === "supplies") return OTHER_REQUEST_TYPES.find(t => t.id === "supplies");
    const other = OTHER_REQUEST_TYPES.find(t => t.id === id);
    if (other) return other;
    if (id === "permission") return { id: "permission", label: "Permission", color: "#6BAA9B" };
    if (id === "leave") return { id: "leave", label: "Leave", color: "#7A8A6A" };
    return OTHER_REQUEST_TYPES[0];
  };

  const isLeaveFlow = edit?.request_type === "permission" || edit?.request_type === "leave";

  const requestActions = (
    <div className="req-head-actions flex items-center gap-1.5 flex-wrap">
      <button data-testid="new-request-btn" onClick={openNew} className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0">
        <Plus size={13}/> New Request
      </button>
    </div>
  );

  return (
    <div>
      <PageBanner
        title="Request"
        subtitle="Vacation · leave · materials & HR applications"
        className="editorial-banner--compact-mobile"
      />

      <div className="intake-tabs mb-4">
        {REQUEST_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            data-testid={`req-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`intake-tab${activeTab === t.id ? " active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="req-split">
        <section className="req-panel-left">
          <div className="req-panel-head req-panel-head--actions">
            <div className="min-w-0">
              <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>
                {activeTab === "vacation" ? "Vacation applications" : activeTab === "leave" ? "Leave applications" : "Other applications"}
              </h2>
              <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>
                {activeTab === "vacation" ? "Annual leave · balance" : activeTab === "leave" ? "Sick · unpaid · permission" : "Materials · requirements · government · general"}
              </p>
            </div>
            {requestActions}
          </div>
          {(activeTab === "vacation" || activeTab === "leave") && (
          <>
          {activeTab === "vacation" && (
          <div className="req-leave-balance mx-3 mt-3">
            <div className="text-[10px] tracking-[0.2em] font-bold opacity-90 mb-2">LEAVE BALANCE</div>
            {balance?.contract_period_start && (
              <div className="text-[10px] opacity-85 mb-2.5">
                Contract · {fmtContractPeriod(balance.contract_period_start, balance.contract_period_end)}
              </div>
            )}
            {balance ? (
              <div className="req-leave-stat-grid req-leave-stat-grid--six">
                <div className="req-leave-stat-box">
                  <div className="req-leave-stat-val">{balance.remaining}</div>
                  <div className="req-leave-stat-lbl">Remaining paid</div>
                </div>
                <div className="req-leave-stat-box">
                  <div className="req-leave-stat-val">{balance.used_annual || 0}</div>
                  <div className="req-leave-stat-lbl">Annual used</div>
                </div>
                <div className="req-leave-stat-box">
                  <div className="req-leave-stat-val">{balance.permission_count ?? 0}</div>
                  <div className="req-leave-stat-lbl">Permission</div>
                </div>
                <div className="req-leave-stat-box">
                  <div className="req-leave-stat-val">{balance.used_unpaid || 0}</div>
                  <div className="req-leave-stat-lbl">Unpaid days</div>
                </div>
                <div className="req-leave-stat-box">
                  <div className="req-leave-stat-val">{balance.used_sick || 0}</div>
                  <div className="req-leave-stat-lbl">Sick leave</div>
                </div>
                <div className="req-leave-stat-box">
                  <div className="req-leave-stat-val">{balance.other_requests_count ?? 0}</div>
                  <div className="req-leave-stat-lbl">Other requests</div>
                </div>
              </div>
            ) : (
              <div className="text-sm opacity-90">Loading…</div>
            )}
          </div>
          )}
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>
              {activeTab === "vacation" ? "Annual vacation requests" : "Leave requests"}
            </h2>
          </div>
          <div className="req-panel-list">
            {(activeTab === "vacation" ? vacationLeaves : otherLeaves).length === 0 && (
              <div className="p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>No requests yet</div>
            )}
            {(activeTab === "vacation" ? vacationLeaves : otherLeaves).map(l => {
              const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
              const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
              const unpaid = permissionPayLabel(l);
              return (
                <div key={l.id} className="req-item">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="pill text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {leaveStatusLabel(l.status, true)}</span>
                    <span className="pill text-[10px]" style={{ background: `${tp.color}22`, color: tp.color }}>{tp.label}</span>
                    {unpaid && (
                      <span className="pill text-[10px] font-bold bg-[#F8EBE7] text-[#8A3F27] border border-[#ECA6A6]">{unpaid}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "#2C3625" }}>
                    {fmtLeaveSchedule(l)}
                  </div>
                  {l.notes && <div className="text-xs mt-1 italic" style={{ color: "#8B9E7A" }}>{l.notes}</div>}
                  {l.admin_note && (
                    <div className="mt-2 text-xs p-2 rounded-lg bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>{l.admin_note}</div>
                  )}
                </div>
              );
            })}
          </div>
          </>
          )}
          {activeTab === "other" && (
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
          )}
        </section>

        {!hidePurchases && activeTab === "other" && (
        <div className="req-sidebar-stack">
        <PurchasesPanel compact />
        </div>
        )}
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
                <ModalBtnPrimary type="button" onClick={() => setStep(3)} disabled={!edit.title || (edit.includesReport && !edit.attachmentFile)}>Review →</ModalBtnPrimary>
              </>
            ) : (
              <>
                <ModalBtnSecondary type="button" onClick={() => setStep(1)}>← Back</ModalBtnSecondary>
                <ModalBtnPrimary data-testid="req-submit-btn" type="button" onClick={submit} disabled={submitting || (isLeaveFlow && (
                  (edit.request_type === "permission" && !edit.attachmentFile) ||
                  (edit.request_type === "leave" && leaveRequiresDocument(edit.leave_type || "Annual") && !edit.attachmentFile)
                )) || (!isLeaveFlow && edit.includesReport && !edit.attachmentFile)}>
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
                {modalTypeOptions.map(t => (
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
              <FormField label="Date">
                <input type="date" className="modal-input" value={edit.start_date}
                  onChange={e => updatePermissionDate(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Start time" required>
                  <input type="time" className="modal-input" value={edit.start_time || ""}
                    onChange={e => updatePermissionTimes(e.target.value, edit.end_time)} />
                </FormField>
                <FormField label="End time" required>
                  <input type="time" className="modal-input" value={edit.end_time || ""}
                    onChange={e => updatePermissionTimes(edit.start_time, e.target.value)} />
                </FormField>
              </div>
              <FormField label="Quick duration">
                <div className="flex gap-2 flex-wrap">
                  {[1, 2].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setPermissionDurationHours(h)}
                      className="pill border text-xs px-3 py-1.5 border-[#DDD8D0] hover:border-[#5C8A47]"
                    >
                      {h} hour{h !== 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Duration">
                <input className="modal-input bg-[#F5F5F5]" readOnly value={edit.days < 1 ? `${Math.round(edit.days * 8 * 10) / 10} hours` : `${edit.days} day(s)`} />
              </FormField>
              <FormField label="Note">
                <textarea className="modal-input" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Reason for permission…" />
              </FormField>
              <AttachmentRequiredBanner />
              <FormField label="Supporting document" hint="PDF or image — required for permission" required>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
                  className="modal-input"
                  onChange={e => setEdit({ ...edit, attachmentFile: e.target.files?.[0] || null })}
                />
                {edit.attachmentFile && (
                  <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{edit.attachmentFile.name}</div>
                )}
              </FormField>
            </FormSection>
          )}

          {step === 2 && edit.request_type === "leave" && (
            <FormSection title="Leave details">
              <FormField label="Leave type">
                <select className="modal-input" value={edit.leave_type || "Annual"} onChange={e => setEdit({ ...edit, leave_type: e.target.value })}>
                  {(activeTab === "vacation" ? VACATION_FORM_TYPES : LEAVE_FORM_TYPES).map(([lt, meta]) => (
                    <option key={lt} value={lt}>{meta.label}</option>
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
              {leaveRequiresDocument(edit.leave_type || "Annual") && (
                <>
                  <AttachmentRequiredBanner />
                  <FormField label="Supporting document" hint="Medical report or supporting file — required" required>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
                      className="modal-input"
                      onChange={e => setEdit({ ...edit, attachmentFile: e.target.files?.[0] || null })}
                    />
                    {edit.attachmentFile && (
                      <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{edit.attachmentFile.name}</div>
                    )}
                  </FormField>
                </>
              )}
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
              <FormField label="Includes report or document?">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 accent-[#5C8A47]"
                    checked={Boolean(edit.includesReport)}
                    onChange={e => setEdit({ ...edit, includesReport: e.target.checked, attachmentFile: e.target.checked ? edit.attachmentFile : null })}
                  />
                  <span style={{ color: "#5C6853" }}>Yes — this request needs a supporting file</span>
                </label>
              </FormField>
              {edit.includesReport && <AttachmentRequiredBanner />}
              <FormField
                label={edit.includesReport ? "Supporting document" : "Attachment (optional)"}
                hint={edit.includesReport ? "PDF, image, or Word — required" : "PDF, image, or Word document"}
                required={edit.includesReport}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
                  className="modal-input"
                  onChange={e => setEdit({ ...edit, attachmentFile: e.target.files?.[0] || null })}
                />
                {edit.attachmentFile && (
                  <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{edit.attachmentFile.name}</div>
                )}
              </FormField>
              {edit.attachmentFile && (
                <FormField label="Report date (optional)" hint="When the attached report was dated">
                  <input
                    type="date"
                    className="modal-input"
                    value={edit.reportDate || ""}
                    onChange={e => setEdit({ ...edit, reportDate: e.target.value })}
                  />
                </FormField>
              )}
            </FormSection>
          )}

          {step === 3 && !isLeaveFlow && (
            <FormSection title="Review">
              <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: "#F5F2ED" }}>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Type:</span><strong>{typeInfo(edit.request_type).label}</strong></div>
                <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Title:</span><strong>{edit.title}</strong></div>
                {edit.description && <div><div style={{ color: "#9CA3AF" }}>Description:</div><div className="mt-1">{edit.description}</div></div>}
                {edit.attachmentFile && (
                  <div className="flex justify-between"><span style={{ color: "#9CA3AF" }}>Attachment:</span><strong>{edit.attachmentFile.name}</strong></div>
                )}
              </div>
            </FormSection>
          )}
            </div>
          </div>
        </ModalBase>
      )}
    </div>
  );
}
