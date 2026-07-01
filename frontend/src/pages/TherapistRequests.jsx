import { useEffect, useState, useMemo } from "react";
import api from "../api";
import { useAuth, isJenan } from "../auth";
import {
  CalendarBlank, CheckCircle, XCircle, Hourglass, ChatCircleText, Clock,
  Paperclip, UploadSimple, Buildings, Briefcase, Heartbeat, Sun, ClockAfternoon,
  ListChecks, Info,
} from "@phosphor-icons/react";
import { FormSection, FormField } from "../components/Modal";
import RequestsPageHeader from "../components/RequestsPageHeader";
import PurchasesPanel from "../components/PurchasesPanel";
import "../clientInfoLayout.css";
import {
  LEAVE_STATUS, LEAVE_TYPES, diffDays, leaveStatusLabel, permissionPayLabel,
  permissionDaysFromTimes, addHoursToTime24, fmtLeaveSchedule,
  leaveRequiresDocument, ATTACHMENT_REQUIRED_MSG,
} from "../leaveUtils";

const WORKFLOW_FOOTER =
  "Your request goes first to your direct manager Ms. Jenan, then to HR. Your status will update on this page.";

const LEAVE_REQUEST_TYPES = [
  { id: "Annual", label: "Annual leave", icon: Sun, color: "#7A8A6A", needsFile: false },
  { id: "Unpaid", label: "Unpaid leave", icon: ClockAfternoon, color: "#C28E6A", needsFile: false },
  { id: "Sickleave", label: "Sick leave", icon: Heartbeat, color: "#9B7BAB", needsFile: true },
  { id: "Permission", label: "Permission", icon: CalendarBlank, color: "#6BAA9B", needsFile: true },
];

const GENERAL_REQUEST_TYPES = [
  { id: "companies", label: "Companies", icon: Buildings, color: "#6B8F71", needsDescription: false },
  { id: "other", label: "Other", icon: Briefcase, color: "#8B7BA8", needsDescription: true },
];

const GENERAL_TYPE_LABELS = Object.fromEntries(
  GENERAL_REQUEST_TYPES.map((t) => [t.id, { label: t.label, color: t.color }]),
);

const STATUS_MAP = {
  pending: { label: "Under Review", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/> },
  pending_manager: { label: "Direct Manager Review", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/> },
  pending_attachment: { label: "Awaiting Attachment", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <Paperclip size={14} weight="duotone"/> },
  pending_hr: { label: "HR Review", cls: "bg-[#F5EBE3] text-[#965132] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/> },
  in_progress: { label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Clock size={14} weight="duotone"/> },
  approved: { label: "Approved", cls: "bg-[#E5EBE1] text-[var(--brand-dark)] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/> },
  rejected: { label: "Rejected", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/> },
  done: { label: "Completed", cls: "bg-[var(--brand-sage)] text-white border-[var(--brand-sage)]", icon: <CheckCircle size={14} weight="fill"/> },
};

function leaveDocumentType(leaveType) {
  if (leaveType === "Sickleave") return "medical";
  if (leaveType === "Permission") return "appointment";
  return "other";
}

function emptyForm(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    selectedType: null,
    start_date: today,
    end_date: today,
    days: 1,
    start_time: "14:00",
    end_time: "15:00",
    notes: "",
    description: "",
    attachmentFile: null,
    therapist_id: userId,
  };
}

function fmtContractPeriod(start, end) {
  if (!start || !end) return "";
  const f = (iso) => {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };
  return `${f(start)} – ${f(end)}`;
}

function WorkflowFooter() {
  return (
    <div className="req-workflow-footer">
      <Info size={14} weight="duotone" className="shrink-0" />
      <p>{WORKFLOW_FOOTER}</p>
    </div>
  );
}

function TypeCard({ meta, active, onClick, testId }) {
  const Icon = meta.icon;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`req-type-card${active ? " active" : ""}`}
      style={{ "--type-color": meta.color }}
    >
      <span className="req-type-card-icon">
        <Icon size={17} weight="duotone" />
      </span>
      <span className="req-type-card-copy">
        <span className="req-type-card-label">{meta.label}</span>
      </span>
      {meta.needsFile && (
        <span className="req-type-card-badge" title="Attachment required">
          <Paperclip size={10} weight="bold" />
        </span>
      )}
    </button>
  );
}

export default function TherapistRequests() {
  const { user } = useAuth();
  const hidePurchases = isJenan(user);
  const [requests, setRequests] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [form, setForm] = useState(() => emptyForm(null));
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setPageError(null);
    try {
      const [req, lv, bal] = await Promise.all([
        api.get("/requests"),
        api.get("/leaves"),
        api.get("/leaves/balance").catch(() => ({ data: [] })),
      ]);
      setRequests(req.data || []);
      setLeaves(lv.data || []);
      setBalance((bal.data || []).find((r) => r.therapist_id === user?.id) || null);
    } catch (err) {
      setPageError(err?.response?.data?.detail || "Could not load your requests. Please try again.");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) setForm(emptyForm(user.id));
    load();
  }, [user?.id]);

  const isLeaveType = (t) => LEAVE_REQUEST_TYPES.some((lt) => lt.id === t);
  const isGeneralType = (t) => GENERAL_REQUEST_TYPES.some((gt) => gt.id === t);
  const selectedMeta = useMemo(() => {
    if (!form.selectedType) return null;
    return (
      LEAVE_REQUEST_TYPES.find((t) => t.id === form.selectedType)
      || GENERAL_REQUEST_TYPES.find((t) => t.id === form.selectedType)
      || null
    );
  }, [form.selectedType]);

  const selectType = (typeId) => {
    const today = new Date().toISOString().slice(0, 10);
    setForm((f) => ({
      ...emptyForm(user?.id),
      selectedType: typeId,
      therapist_id: user?.id,
      start_date: today,
      end_date: today,
      days: typeId === "Permission" ? 0.125 : 1,
      start_time: "14:00",
      end_time: "15:00",
    }));
  };

  const updateLeaveDates = (start, end) => {
    const days = Math.max(1, diffDays(start, end));
    setForm((f) => ({ ...f, start_date: start, end_date: end, days }));
  };

  const updatePermissionDate = (date) => {
    const days = permissionDaysFromTimes(form.start_time, form.end_time, date, date);
    setForm((f) => ({ ...f, start_date: date, end_date: date, days }));
  };

  const updatePermissionTimes = (startTime, endTime) => {
    const days = permissionDaysFromTimes(
      startTime,
      endTime,
      form.start_date || form.end_date,
      form.end_date || form.start_date,
    );
    setForm((f) => ({ ...f, start_time: startTime, end_time: endTime, days }));
  };

  const setPermissionDurationHours = (hours) => {
    const start = form.start_time || "14:00";
    updatePermissionTimes(start, addHoursToTime24(start, hours));
  };

  const canSubmit = useMemo(() => {
    if (!form.selectedType || submitting) return false;
    if (form.selectedType === "Permission") {
      if (!form.start_time || !form.end_time) return false;
      if (!form.attachmentFile) return false;
      return true;
    }
    if (isLeaveType(form.selectedType)) {
      if (leaveRequiresDocument(form.selectedType) && !form.attachmentFile) return false;
      return true;
    }
    if (form.selectedType === "other") {
      return Boolean((form.description || "").trim());
    }
    return true;
  }, [form, submitting]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const type = form.selectedType;
      if (type === "Permission") {
        const { data: created } = await api.post("/leaves", {
          therapist_id: user.id,
          start_date: form.start_date,
          end_date: form.end_date,
          days: form.days,
          leave_type: "Permission",
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes || null,
          status: "pending",
        });
        if (form.attachmentFile && created?.id) {
          const fd = new FormData();
          fd.append("file", form.attachmentFile);
          fd.append("document_type", leaveDocumentType("Permission"));
          await api.post(`/leaves/${created.id}/upload-document`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } else if (isLeaveType(type)) {
        const { data: created } = await api.post("/leaves", {
          therapist_id: user.id,
          start_date: form.start_date,
          end_date: form.end_date,
          days: form.days,
          leave_type: type,
          notes: form.notes || null,
          status: "pending",
        });
        if (form.attachmentFile && created?.id) {
          const fd = new FormData();
          fd.append("file", form.attachmentFile);
          fd.append("document_type", leaveDocumentType(type));
          await api.post(`/leaves/${created.id}/upload-document`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } else if (isGeneralType(type)) {
        const label = GENERAL_TYPE_LABELS[type];
        await api.post("/requests", {
          title: type === "companies" ? "Companies request" : "General request",
          description: form.description || form.notes || "",
          request_type: type,
          priority: "normal",
          extra_notes: form.notes || null,
        });
      }
      setForm(emptyForm(user?.id));
      await load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const historyItems = useMemo(() => {
    const leaveItems = leaves.map((l) => {
      const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "var(--brand-sage)" };
      const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
      return {
        key: `leave-${l.id}`,
        kind: "leave",
        title: LEAVE_REQUEST_TYPES.find((t) => t.id === l.leave_type)?.label || tp.label,
        subtitle: fmtLeaveSchedule(l),
        notes: l.notes,
        admin_note: l.admin_note,
        status: l.status,
        statusLabel: leaveStatusLabel(l.status, true),
        statusStyle: { background: st.bg, color: st.color },
        typeColor: tp.color,
        created_at: l.created_at,
        unpaid: permissionPayLabel(l),
      };
    });
    const reqItems = requests.map((r) => {
      const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
      const gl = GENERAL_TYPE_LABELS[r.request_type];
      const title = gl ? gl.label : (r.title || r.request_type);
      return {
        key: `req-${r.id}`,
        kind: "request",
        title,
        subtitle: r.description || r.title,
        notes: null,
        admin_note: r.admin_note,
        status: r.status,
        statusLabel: st.label,
        statusCls: st.cls,
        statusIcon: st.icon,
        typeColor: gl?.color || "#8B7BA8",
        created_at: r.created_at,
      };
    });
    return [...leaveItems, ...reqItems].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );
  }, [leaves, requests]);

  const pendingCount = historyItems.filter(
    (i) => ["pending", "pending_manager", "pending_hr", "pending_attachment", "in_progress"].includes(i.status),
  ).length;

  if (pageLoading && requests.length === 0 && leaves.length === 0 && !pageError) {
    return (
      <div className="requests-page" dir="ltr">
        <div className="requests-page-loading"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="requests-page" dir="ltr">
      <RequestsPageHeader
        badge="MY REQUESTS"
        title="My Requests"
        subtitle="Leave · general requests — one window for all your requests"
        stats={[
          { label: "Leave", n: leaves.length, color: "#2C3625" },
          { label: "General", n: requests.length, color: "#375568" },
          { label: "Pending", n: pendingCount, color: "var(--brand-dark)" },
        ]}
      />

      {pageError && (
        <div className="card requests-page-error" role="alert">{pageError}</div>
      )}

      <div className="req-my-requests-stack">
        {!hidePurchases && (
          <section className="req-my-requests-section req-my-requests-section--payment" aria-label="Payment requests">
            <PurchasesPanel compact />
          </section>
        )}

        <section className="req-my-requests-section req-my-requests-section--submit" aria-label="Submit request">
        <main className="req-unified-window card">
          <div className="req-unified-head">
            <ListChecks size={20} weight="duotone" className="shrink-0" />
            <div className="min-w-0">
              <h2 className="req-unified-title">Submit Request</h2>
              <p className="req-unified-sub">Choose a request type and fill in the details below</p>
            </div>
          </div>

          <div className="req-unified-body">
            {/* Section 1: Leave */}
            <section className="req-unified-section">
              <div className="req-unified-section-head">
                <span className="req-unified-section-num">1</span>
                <div>
                  <h3 className="req-unified-section-title">Leave</h3>
                  <p className="req-unified-section-desc">Annual · unpaid · sick · permission</p>
                </div>
              </div>

              {balance && (
                <div className="req-leave-balance req-leave-balance--inline">
                  {balance.contract_period_start && (
                    <div className="text-[10px] opacity-85 mb-2">
                      Contract · {fmtContractPeriod(balance.contract_period_start, balance.contract_period_end)}
                    </div>
                  )}
                  <div className="req-leave-stat-grid req-leave-stat-grid--six">
                    <div className="req-leave-stat-box">
                      <div className="req-leave-stat-val">{balance.remaining}</div>
                      <div className="req-leave-stat-lbl">Balance</div>
                    </div>
                    <div className="req-leave-stat-box">
                      <div className="req-leave-stat-val">{balance.used_annual || 0}</div>
                      <div className="req-leave-stat-lbl">Annual</div>
                    </div>
                    <div className="req-leave-stat-box">
                      <div className="req-leave-stat-val">{balance.permission_count ?? 0}</div>
                      <div className="req-leave-stat-lbl">Permission</div>
                    </div>
                    <div className="req-leave-stat-box">
                      <div className="req-leave-stat-val">{balance.used_unpaid || 0}</div>
                      <div className="req-leave-stat-lbl">Unpaid</div>
                    </div>
                    <div className="req-leave-stat-box">
                      <div className="req-leave-stat-val">{balance.used_sick || 0}</div>
                      <div className="req-leave-stat-lbl">Sick</div>
                    </div>
                    <div className="req-leave-stat-box">
                      <div className="req-leave-stat-val">{balance.other_requests_count ?? 0}</div>
                      <div className="req-leave-stat-lbl">Other</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="req-type-grid">
                {LEAVE_REQUEST_TYPES.map((t) => (
                  <TypeCard
                    key={t.id}
                    meta={t}
                    active={form.selectedType === t.id}
                    onClick={() => selectType(t.id)}
                    testId={`leave-type-${t.id}`}
                  />
                ))}
              </div>

              {isLeaveType(form.selectedType) && form.selectedType !== "Permission" && (
                <div className="req-unified-form">
                  <FormSection title={`${selectedMeta?.label} details`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="From">
                        <input
                          type="date"
                          className="modal-input"
                          value={form.start_date}
                          onChange={(e) => updateLeaveDates(e.target.value, form.end_date)}
                        />
                      </FormField>
                      <FormField label="To">
                        <input
                          type="date"
                          className="modal-input"
                          value={form.end_date}
                          onChange={(e) => updateLeaveDates(form.start_date, e.target.value)}
                        />
                      </FormField>
                    </div>
                    <FormField label="Days">
                      <input className="modal-input bg-[#F5F5F5]" readOnly value={form.days} />
                    </FormField>
                    <FormField label="Notes">
                      <textarea
                        className="modal-input"
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional notes…"
                      />
                    </FormField>
                    {leaveRequiresDocument(form.selectedType) && (
                      <>
                        <div className="rounded-xl p-3 text-xs font-semibold border" style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
                          {ATTACHMENT_REQUIRED_MSG}
                        </div>
                        <FormField label="Medical report" required hint="PDF or image — required">
                          <label className="req-file-upload">
                            <UploadSimple size={15} weight="duotone" />
                            <span>{form.attachmentFile ? form.attachmentFile.name : "Choose file"}</span>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
                              className="sr-only"
                              onChange={(e) => setForm((f) => ({ ...f, attachmentFile: e.target.files?.[0] || null }))}
                            />
                          </label>
                        </FormField>
                      </>
                    )}
                  </FormSection>
                  <WorkflowFooter />
                  <div className="req-unified-actions">
                    <button
                      type="button"
                      data-testid="req-submit-btn"
                      className="btn btn-primary"
                      disabled={!canSubmit}
                      onClick={submit}
                    >
                      {submitting ? "Submitting…" : "Submit leave request"}
                    </button>
                  </div>
                </div>
              )}

              {form.selectedType === "Permission" && (
                <div className="req-unified-form">
                  <FormSection title="Permission details">
                    <FormField label="Date">
                      <input
                        type="date"
                        className="modal-input"
                        value={form.start_date}
                        onChange={(e) => updatePermissionDate(e.target.value)}
                      />
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Start time" required>
                        <input
                          type="time"
                          className="modal-input"
                          value={form.start_time || ""}
                          onChange={(e) => updatePermissionTimes(e.target.value, form.end_time)}
                        />
                      </FormField>
                      <FormField label="End time" required>
                        <input
                          type="time"
                          className="modal-input"
                          value={form.end_time || ""}
                          onChange={(e) => updatePermissionTimes(form.start_time, e.target.value)}
                        />
                      </FormField>
                    </div>
                    <FormField label="Quick duration">
                      <div className="flex gap-2 flex-wrap">
                        {[1, 2].map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setPermissionDurationHours(h)}
                            className="pill border text-xs px-3 py-1.5 border-[#DDD8D0] hover:border-[var(--brand)]"
                          >
                            {h} hour{h !== 1 ? "s" : ""}
                          </button>
                        ))}
                      </div>
                    </FormField>
                    <FormField label="Duration">
                      <input
                        className="modal-input bg-[#F5F5F5]"
                        readOnly
                        value={form.days < 1 ? `${Math.round(form.days * 8 * 10) / 10} hours` : `${form.days} day(s)`}
                      />
                    </FormField>
                    <FormField label="Note">
                      <textarea
                        className="modal-input"
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Reason for permission…"
                      />
                    </FormField>
                    <div className="rounded-xl p-3 text-xs font-semibold border" style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
                      {ATTACHMENT_REQUIRED_MSG}
                    </div>
                    <FormField label="Supporting document" required hint="PDF or image — required">
                      <label className="req-file-upload">
                        <UploadSimple size={15} weight="duotone" />
                        <span>{form.attachmentFile ? form.attachmentFile.name : "Choose file"}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
                          className="sr-only"
                          onChange={(e) => setForm((f) => ({ ...f, attachmentFile: e.target.files?.[0] || null }))}
                        />
                      </label>
                    </FormField>
                  </FormSection>
                  <WorkflowFooter />
                  <div className="req-unified-actions">
                    <button
                      type="button"
                      data-testid="req-submit-btn"
                      className="btn btn-primary"
                      disabled={!canSubmit}
                      onClick={submit}
                    >
                      {submitting ? "Submitting…" : "Submit permission request"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <div className="req-unified-divider" />

            {/* Section 2: General */}
            <section className="req-unified-section">
              <div className="req-unified-section-head">
                <span className="req-unified-section-num">2</span>
                <div>
                  <h3 className="req-unified-section-title">General</h3>
                  <p className="req-unified-section-desc">Companies · other requests</p>
                </div>
              </div>

              <div className="req-type-grid req-type-grid--two">
                {GENERAL_REQUEST_TYPES.map((t) => (
                  <TypeCard
                    key={t.id}
                    meta={t}
                    active={form.selectedType === t.id}
                    onClick={() => selectType(t.id)}
                    testId={`general-type-${t.id}`}
                  />
                ))}
              </div>

              {isGeneralType(form.selectedType) && (
                <div className="req-unified-form">
                  <FormSection title={`${selectedMeta?.label} request`}>
                    {form.selectedType === "other" && (
                      <FormField label="Description" required hint="Describe your request in detail">
                        <textarea
                          data-testid="req-description"
                          className="modal-input"
                          rows={4}
                          value={form.description}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Enter request details here…"
                        />
                      </FormField>
                    )}
                    {form.selectedType === "companies" && (
                      <FormField label="Details" hint="Optional notes for companies request">
                        <textarea
                          className="modal-input"
                          rows={3}
                          value={form.description}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Company name, purpose, or other details…"
                        />
                      </FormField>
                    )}
                    <FormField label="Additional notes" hint="Optional">
                      <textarea
                        className="modal-input"
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </FormField>
                  </FormSection>
                  <WorkflowFooter />
                  <div className="req-unified-actions">
                    <button
                      type="button"
                      data-testid="req-submit-btn"
                      className="btn btn-primary"
                      disabled={!canSubmit}
                      onClick={submit}
                    >
                      {submitting ? "Submitting…" : "Submit general request"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* History */}
            <div className="req-unified-divider" />
            <section className="req-unified-section">
              <div className="req-unified-section-head">
                <span className="req-unified-section-num">☰</span>
                <div>
                  <h3 className="req-unified-section-title">My submitted requests</h3>
                  <p className="req-unified-section-desc">Track status updates here</p>
                </div>
              </div>

              <div className="req-panel-list req-panel-list--inline">
                {historyItems.length === 0 && (
                  <div className="requests-page-empty">
                    <div className="requests-page-empty-icon"><CalendarBlank size={22} weight="duotone" /></div>
                    <h3 className="requests-page-empty-title">No requests yet</h3>
                    <p className="requests-page-empty-text">Choose a type above to submit your first request.</p>
                  </div>
                )}
                {historyItems.map((item) => (
                  <div key={item.key} className="req-item">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {item.kind === "leave" ? (
                        <span className="pill text-[10px] font-bold" style={item.statusStyle}>
                          {item.statusLabel}
                        </span>
                      ) : (
                        <span className={`pill border text-[10px] ${item.statusCls}`}>
                          {item.statusIcon} {item.statusLabel}
                        </span>
                      )}
                      <span className="pill text-[10px]" style={{ background: `${item.typeColor}22`, color: item.typeColor }}>
                        {item.title}
                      </span>
                      {item.unpaid && (
                        <span className="pill text-[10px] font-bold bg-[#F8EBE7] text-[#8A3F27] border border-[#ECA6A6]">
                          {item.unpaid}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: "#2C3625" }}>
                      {item.kind === "leave" ? item.subtitle : item.title}
                    </div>
                    {(item.notes || (item.kind === "request" && item.subtitle)) && (
                      <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        {item.notes || item.subtitle}
                      </div>
                    )}
                    {item.admin_note && (
                      <div className="mt-2 text-xs p-2 rounded-lg bg-[#E5EBE1]" style={{ color: "var(--brand-dark)" }}>
                        <ChatCircleText size={12} className="inline mr-1" /> {item.admin_note}
                      </div>
                    )}
                    {item.created_at && (
                      <div className="text-[10px] mt-1" style={{ color: "var(--brand-sage)" }}>
                        {new Date(item.created_at).toLocaleString("en-US")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
        </section>
      </div>
    </div>
  );
}
