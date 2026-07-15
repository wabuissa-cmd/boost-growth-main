import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { API, openAuthenticatedFile, localTodayISO } from "../api";
import { useAuth, showAdminNav, canManageLeaves, canHrReviewLeaves, isJenan } from "../auth";
import {
  Plus, X, CheckCircle, XCircle, FilePdf, UploadSimple, Eye, Trash,
  UserMinus, MagnifyingGlass, Export, CaretDown, CaretRight, FileText, PencilSimple
} from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import {
  LEAVE_STATUS, LEAVE_TYPES, DOC_TYPES, documentBadge, leaveRequiresDocument,
  ATTACHMENT_REQUIRED_MSG, isManagerReviewableLeave,
  diffDays, fmtDateRange, fmtLeaveSchedule, isActiveLeave, isHistoryLeave, exportLeavesCsv,
  scheduleImpactLabel, leavePayCategory, leaveStatusLabel, permissionPayLabel,
  isPendingLeaveStatus,
  selectableLeaveTypeEntries,
} from "../leaveUtils";
import { getPortalDisplayName, getTherapistScheduleName } from "../scheduleConstants";

function emptyLeave(therapistId = "") {
  const today = localTodayISO();
  return {
    therapist_id: therapistId, start_date: today, end_date: today,
    days: 1, leave_type: "Annual", status: "pending", notes: "",
  };
}

function DocumentSection({ leave, isAdmin, onRefresh, canUpload }) {
  const badge = documentBadge(leave);
  const inputRef = useRef(null);
  const [docType, setDocType] = useState(leave.document_type || "medical");
  const [uploading, setUploading] = useState(false);
  const hasFile = !!(leave.document_file_path || leave.document_url);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", docType);
      await api.post(`/leaves/${leave.id}/upload-document`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onRefresh();
    } catch (e) {
      alert("Upload failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async () => {
    if (!window.confirm("Remove this document?")) return;
    await api.delete(`/leaves/${leave.id}/document`);
    onRefresh();
  };

  const verifyDoc = async (verified) => {
    await api.put(`/leaves/${leave.id}/verify-document`, { verified });
    onRefresh();
  };

  const downloadUrl = `${API}/leaves/${leave.id}/document`;

  const viewDoc = async () => {
    try {
      await openAuthenticatedFile(downloadUrl, {
        errorMessage: "Could not open document. Please ask the therapist to re-upload it.",
      });
    } catch (e) {
      alert(e?.message || "Could not open document. Please ask the therapist to re-upload it.");
    }
  };

  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <span className="text-xs font-bold" style={{ color: "#5C6853" }}>📄 Documents</span>
        <span className="pill text-[10px] px-2 py-0.5 font-bold" style={{ background: badge.bg, color: badge.color }}>
          {badge.icon} {badge.label}
        </span>
      </div>
      {hasFile ? (
        <div className="flex items-center gap-2 flex-wrap">
          <FilePdf size={18} style={{ color: "#6B5430" }} />
          <span className="text-sm font-medium" style={{ color: "#2C3625" }}>
            ✓ {leave.document_file_name || "Document uploaded"}
          </span>
          <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs py-1" onClick={e => { e.preventDefault(); viewDoc(); }}>
            <Eye size={14} /> View
          </a>
          {(isAdmin || canUpload) && (
            <button type="button" onClick={removeDoc} className="btn btn-ghost text-xs py-1 text-red-700">
              <Trash size={14} /> Remove
            </button>
          )}
          {isAdmin && !leave.document_verified && (
            <button type="button" onClick={() => verifyDoc(true)} className="btn btn-primary text-xs py-1">
              Mark Verified
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs italic" style={{ color: "#8B9E7A" }}>No document uploaded</span>
          {canUpload && (
            <>
              <select className="select text-xs" value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
                className="btn btn-secondary text-xs py-1">
                {uploading ? <span className="spinner" /> : <><UploadSimple size={14} /> Upload Doc</>}
              </button>
            </>
          )}
          {isAdmin && leaveRequiresDocument(leave.leave_type) && (
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-outline text-xs py-1">
              Request Doc ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LeaveRequestCard({
  leave, user, onRefresh, onEdit, therapists, personal = false,
  leaveManager = false, hrReview = false, portalAdmin = false, isManager = false,
}) {
  const st = LEAVE_STATUS[leave.status] || LEAVE_STATUS.pending;
  const statusText = leaveStatusLabel(leave.status, personal);
  const tp = LEAVE_TYPES[leave.leave_type] || { label: leave.leave_type, color: "#7A8A6A" };
  const canUpload = leaveManager || portalAdmin || leave.therapist_id === user?.id;
  const canEditOwn = personal && leave.therapist_id === user?.id && isPendingLeaveStatus(leave.status);
  const [marking, setMarking] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const attachRef = useRef(null);
  const pendingManager = isManagerReviewableLeave(leave);
  const awaitingAttachment = leave.status === "pending_attachment"
    && leaveRequiresDocument(leave.leave_type);
  const pendingHr = leave.status === "pending_hr";
  const showAdminActions = leaveManager || hrReview || portalAdmin || isManager;
  // HR must explicitly choose approve/reject (avoid accidental default approvals).
  const [hrStatus, setHrStatus] = useState("");
  const [hrNote, setHrNote] = useState("");
  const [adjStart, setAdjStart] = useState("");
  const [adjEnd, setAdjEnd] = useState("");
  const [adjDays, setAdjDays] = useState("");
  const [adjStartTime, setAdjStartTime] = useState("");
  const [adjEndTime, setAdjEndTime] = useState("");
  const [hrValidation, setHrValidation] = useState("");
  const [adjDaysTouched, setAdjDaysTouched] = useState(false);
  const [adjTimesTouched, setAdjTimesTouched] = useState(false);

  const setStatus = async (status, opts = {}) => {
    try {
      const payload = {
        status,
        is_paid: opts.is_paid,
        deduct_balance: opts.deduct_balance,
        admin_note: opts.admin_note,
        adjusted_start_date: opts.adjusted_start_date,
        adjusted_end_date: opts.adjusted_end_date,
        adjusted_days: opts.adjusted_days,
        adjusted_start_time: opts.adjusted_start_time,
        adjusted_end_time: opts.adjusted_end_time,
      };
      if (isManager && !portalAdmin) {
        payload.notify_hr = true;
        payload.notify_therapist = false;
      }
      await api.put(`/leaves/${leave.id}/status`, payload);
      await onRefresh();
      if (opts.successMessage) alert(opts.successMessage);
    } catch (e) {
      alert("Action failed: " + (e.response?.data?.detail || e.message));
      throw e;
    }
  };

  const unpaidLabel = permissionPayLabel(leave);
  const portalName = useMemo(() => {
    if (!user) return "";
    const row = (therapists || []).find(
      (t) => t?.id === user?.id || ((t?.email || "").toLowerCase() === (user?.email || "").toLowerCase()),
    );
    return getPortalDisplayName(user, row) || user?.email || "";
  }, [user, therapists]);

  const markAbsent = async () => {
    const msg = `Mark ${leave.therapist_name || "therapist"} as absent on ${fmtDateRange(leave.start_date, leave.end_date)}?\n\nThis will automatically cancel all their sessions on these dates in the schedule.`;
    if (!window.confirm(msg)) return;
    setMarking(true);
    try {
      const { data } = await api.post(`/leaves/${leave.id}/mark-absent`, { cancel_sessions: true });
      alert(data.message || `Done. ${data.cancelled_sessions_count} sessions cancelled.`);
      onRefresh();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setMarking(false);
    }
  };

  const submitHrDecision = async (opts = {}) => {
    setHrValidation("");
    if (!hrStatus) {
      setHrValidation("Please choose Approved or Rejected before saving.");
      return;
    }
    setSavingDecision(true);
    try {
      const payload = {
        admin_note: (hrNote || "").trim() || undefined,
        adjusted_start_date: adjStart || undefined,
        adjusted_end_date: adjEnd || undefined,
        adjusted_days: adjDays === "" ? undefined : parseFloat(adjDays),
        adjusted_start_time: adjStartTime || undefined,
        adjusted_end_time: adjEndTime || undefined,
        successMessage: opts.successMessage || "Saved.",
      };
      await setStatus(hrStatus, {
        ...payload,
        is_paid: opts.is_paid,
        deduct_balance: opts.deduct_balance,
      });
    } finally {
      setSavingDecision(false);
    }
  };

  const saveHrDraft = async () => {
    setHrValidation("");
    setSavingDecision(true);
    try {
      const payload = {
        admin_note: (hrNote || "").trim() || undefined,
        adjusted_start_date: adjStart || undefined,
        adjusted_end_date: adjEnd || undefined,
        adjusted_days: adjDays === "" ? undefined : parseFloat(adjDays),
        adjusted_start_time: adjStartTime || undefined,
        adjusted_end_time: adjEndTime || undefined,
        successMessage: "Saved (Pending HR).",
      };
      await setStatus("pending_hr", payload);
    } finally {
      setSavingDecision(false);
    }
  };

  // Default HR adjustments to the original request.
  // Days auto-calc from the chosen adjusted date range unless HR manually overrides.
  // For Permission, also default start/end time; HR can override.
  useEffect(() => {
    if (!pendingHr || !hrReview || portalAdmin) return;
    setHrValidation("");
    setHrStatus("");
    setHrNote("");
    setAdjDaysTouched(false);
    setAdjTimesTouched(false);
    setAdjStart((leave.start_date || "").slice(0, 10));
    setAdjEnd((leave.end_date || "").slice(0, 10));
    const calc = diffDays((leave.start_date || "").slice(0, 10), (leave.end_date || "").slice(0, 10));
    setAdjDays(calc ? String(calc) : "");
    if ((leave.leave_type || "") === "Permission") {
      setAdjStartTime(leave.start_time || "");
      setAdjEndTime(leave.end_time || "");
    } else {
      setAdjStartTime("");
      setAdjEndTime("");
    }
  }, [leave.id, leave.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingHr || !hrReview || portalAdmin) return;
    if (!adjStart || !adjEnd) return;
    if (adjDaysTouched) return;
    const calc = diffDays(adjStart, adjEnd);
    setAdjDays(calc ? String(calc) : "");
  }, [adjStart, adjEnd, adjDaysTouched, pendingHr, hrReview, portalAdmin]);

  return (
    <div className="card p-5" data-testid={`leave-card-${leave.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-sm shrink-0"
            style={{ background: leave.therapist_color || "#7A8A6A" }}>
            {(leave.therapist_name || "?").replace("Ms. ", "").charAt(0)}
          </div>
          <div>
            <div className="font-bold text-lg" style={{ color: "#2C3625" }}>
              {leave.therapist_name || portalName || "—"}
            </div>
            <div className="text-sm" style={{ color: "#5C6853" }}>
              <span className="pill text-[10px] px-2 py-0.5 mr-1" style={{ background: `${tp.color}22`, color: tp.color }}>{tp.label}</span>
              · {fmtLeaveSchedule(leave)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-1">
            <span className="pill text-xs font-bold px-3 py-1" style={{ background: st.bg, color: st.color }}>
              {st.icon} {statusText.toUpperCase()}
            </span>
          {unpaidLabel && (
            <span className="pill text-[10px] font-bold px-2 py-0.5 bg-[#F8EBE7] text-[#8A3F27] border border-[#ECA6A6]">{unpaidLabel}</span>
          )}
          </div>
        </div>
      </div>

      <DocumentSection leave={leave} isAdmin={leaveManager || portalAdmin} onRefresh={onRefresh} canUpload={canUpload} />

      {awaitingAttachment && (
        <div className="mt-3 rounded-xl p-3 text-xs font-semibold border" style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
          {ATTACHMENT_REQUIRED_MSG}
        </div>
      )}

      {leave.notes && (
        <div className="mt-3 text-sm" style={{ color: "#5C6853" }}>
          <span className="font-bold">💬 Note:</span> {leave.notes}
        </div>
      )}

      {(leave.schedule_impact || []).length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setImpactOpen(o => !o)} className="text-xs font-bold flex items-center gap-1" style={{ color: "#5C6853" }}>
            {impactOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
            {scheduleImpactLabel(leave)}
          </button>
          {impactOpen && (
            <ul className="mt-1 text-xs space-y-0.5 pl-4" style={{ color: "#8B9E7A" }}>
              {(leave.schedule_impact || []).map((s, i) => (
                <li key={i}>{s.date} · {s.client_name} · {s.time_slot || "—"}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAdminActions && (
        <div className="flex gap-2 flex-wrap mt-4 pt-3 border-t border-[#E2DDD4]">
          {portalAdmin && pendingManager && leave.leave_type === "Permission" && (
            <>
              <button onClick={() => setStatus("approved", { is_paid: true, deduct_balance: true })} className="btn btn-primary text-xs" data-testid={`approve-${leave.id}`}>
                <CheckCircle size={14} /> Approve (Paid)
              </button>
              <button onClick={() => setStatus("approved", { is_paid: false, deduct_balance: false })} className="btn btn-secondary text-xs">
                <CheckCircle size={14} /> Approve (Unpaid)
              </button>
              <button onClick={() => setStatus("rejected")} className="btn btn-outline text-xs" data-testid={`reject-${leave.id}`}>
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {portalAdmin && pendingManager && leave.leave_type !== "Permission" && (
            <>
              <button onClick={() => setStatus("approved")} className="btn btn-primary text-xs" data-testid={`approve-${leave.id}`}>
                <CheckCircle size={14} /> Approve
              </button>
              <button onClick={() => setStatus("rejected")} className="btn btn-outline text-xs" data-testid={`reject-${leave.id}`}>
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {isManager && pendingManager && !portalAdmin && (
            <>
              <button onClick={() => setStatus("manager_approve")} className="btn btn-primary text-xs" data-testid={`approve-manager-${leave.id}`}>
                <CheckCircle size={14} /> Approve
              </button>
              <button onClick={() => setStatus("manager_reject")} className="btn btn-outline text-xs" data-testid={`reject-${leave.id}`}>
                <XCircle size={14} /> Reject
              </button>
              <p className="w-full text-[10px] mt-1" style={{ color: "#5C6853" }}>
                Approve/Reject forwards to HR automatically — HR notifies the therapist.
              </p>
            </>
          )}
          {hrReview && pendingHr && !portalAdmin && leave.leave_type === "Permission" && (
            <>
              <div className="w-full grid gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Status
                    <select className="select text-xs w-full mt-1" value={hrStatus} onChange={e => setHrStatus(e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust (from)
                    <input type="date" className="input text-xs w-full mt-1" value={adjStart} onChange={e => setAdjStart(e.target.value)} />
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust (to)
                    <input type="date" className="input text-xs w-full mt-1" value={adjEnd} onChange={e => setAdjEnd(e.target.value)} />
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust hours (start)
                    <input type="time" className="input text-xs w-full mt-1" value={adjStartTime} onChange={e => { setAdjTimesTouched(true); setAdjStartTime(e.target.value); }} />
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust hours (end)
                    <input type="time" className="input text-xs w-full mt-1" value={adjEndTime} onChange={e => { setAdjTimesTouched(true); setAdjEndTime(e.target.value); }} />
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust days
                    <input type="number" step="0.125" min="0" className="input text-xs w-full mt-1" value={adjDays} onChange={e => { setAdjDaysTouched(true); setAdjDays(e.target.value); }} />
                  </label>
                </div>
                {hrValidation && (
                  <div className="rounded-xl p-2 text-xs font-semibold border"
                    style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
                    {hrValidation}
                  </div>
                )}
                <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                  HR note (emailed to therapist)
                  <textarea className="input text-xs w-full mt-1" rows={2} placeholder="Optional note…"
                    value={hrNote} onChange={e => setHrNote(e.target.value)} />
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={savingDecision || !hrStatus}
                    onClick={() => submitHrDecision({ is_paid: true, deduct_balance: true, successMessage: "Saved (Paid)." })}
                    className="btn btn-primary text-xs"
                    data-testid={`approve-${leave.id}`}
                  >
                    <CheckCircle size={14} /> {savingDecision ? "Saving…" : "Save (Paid)"}
                  </button>
                  <button
                    type="button"
                    disabled={savingDecision || !hrStatus}
                    onClick={() => submitHrDecision({ is_paid: false, deduct_balance: false, successMessage: "Saved (Unpaid)." })}
                    className="btn btn-secondary text-xs"
                  >
                    <CheckCircle size={14} /> {savingDecision ? "Saving…" : "Save (Unpaid)"}
                  </button>
                  <button
                    type="button"
                    disabled={savingDecision}
                    onClick={saveHrDraft}
                    className="btn btn-outline text-xs"
                  >
                    {savingDecision ? "Saving…" : "Save as Pending"}
                  </button>
                </div>
              </div>
            </>
          )}
          {hrReview && pendingHr && !portalAdmin && leave.leave_type !== "Permission" && (
            <>
              <div className="w-full grid gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Status
                    <select className="select text-xs w-full mt-1" value={hrStatus} onChange={e => setHrStatus(e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust (from)
                    <input type="date" className="input text-xs w-full mt-1" value={adjStart} onChange={e => setAdjStart(e.target.value)} />
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust (to)
                    <input type="date" className="input text-xs w-full mt-1" value={adjEnd} onChange={e => setAdjEnd(e.target.value)} />
                  </label>
                  <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                    Adjust days
                    <input type="number" step="0.5" min="0" className="input text-xs w-full mt-1" value={adjDays} onChange={e => { setAdjDaysTouched(true); setAdjDays(e.target.value); }} />
                  </label>
                </div>
                {hrValidation && (
                  <div className="rounded-xl p-2 text-xs font-semibold border"
                    style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
                    {hrValidation}
                  </div>
                )}
                <label className="text-[11px] font-bold" style={{ color: "#5C6853" }}>
                  HR note (emailed to therapist)
                  <textarea className="input text-xs w-full mt-1" rows={2} placeholder="Optional note…"
                    value={hrNote} onChange={e => setHrNote(e.target.value)} />
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={savingDecision || !hrStatus}
                    onClick={() => submitHrDecision({ successMessage: "Saved." })}
                    className="btn btn-primary text-xs"
                    data-testid={`approve-${leave.id}`}
                  >
                    <CheckCircle size={14} /> {savingDecision ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={savingDecision}
                    onClick={saveHrDraft}
                    className="btn btn-outline text-xs"
                  >
                    {savingDecision ? "Saving…" : "Save as Pending"}
                  </button>
                </div>
              </div>
            </>
          )}
          {portalAdmin && pendingHr && (
            <>
              <button onClick={() => setStatus("approved")} className="btn btn-primary text-xs" data-testid={`approve-hr-${leave.id}`}>
                <CheckCircle size={14} /> Approve
              </button>
              <button onClick={() => setStatus("rejected")} className="btn btn-outline text-xs" data-testid={`reject-hr-${leave.id}`}>
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {leaveManager && (leave.status === "approved" || pendingManager || pendingHr) && leave.status !== "absent" && (
            <button onClick={markAbsent} disabled={marking} className="btn btn-secondary text-xs">
              <UserMinus size={14} /> {marking ? "Processing…" : "Mark as Absent"}
            </button>
          )}
          {(leaveManager || portalAdmin) && (
            <button onClick={() => onEdit(leave)} className="btn btn-ghost text-xs">Edit</button>
          )}
        </div>
      )}

      {personal && (
        <div className="flex gap-2 flex-wrap mt-4 pt-3 border-t border-[#E2DDD4]">
          {canEditOwn && (
            <button type="button" onClick={() => onEdit(leave)} className="btn btn-secondary text-xs">
              <PencilSimple size={14} /> Edit
            </button>
          )}
          {canUpload && (
            <>
              <input ref={attachRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("document_type", "medical");
                  try {
                    await api.post(`/leaves/${leave.id}/upload-document`, fd, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                    onRefresh();
                  } catch (err) {
                    alert("Upload failed: " + (err.response?.data?.detail || err.message));
                  }
                  e.target.value = "";
                }} />
              <button type="button" onClick={() => attachRef.current?.click()} className="btn btn-outline text-xs">
                <UploadSimple size={14} /> {leave.document_file_path ? "Add / Replace Attachment" : "Add Attachment"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MarkAbsenceModal({ therapists, onClose, onDone }) {
  const [form, setForm] = useState({
    therapist_id: "", date_from: localTodayISO(),
    date_to: localTodayISO(), leave_type: "Absence",
    notes: "", cancel_sessions: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (form.date_from && form.date_to) {
      const d = diffDays(form.date_from, form.date_to);
      if (d) setForm(f => ({ ...f, days: d }));
    }
  }, [form.date_from, form.date_to]);

  const submit = async () => {
    if (!form.therapist_id) { alert("Select a therapist"); return; }
    const t = therapists.find(x => x.id === form.therapist_id);
    const msg = form.cancel_sessions
      ? `Mark ${t?.name} absent ${fmtDateRange(form.date_from, form.date_to)} and cancel schedule sessions?`
      : `Mark ${t?.name} absent ${fmtDateRange(form.date_from, form.date_to)}?`;
    if (!window.confirm(msg)) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/leaves/mark-absence", form);
      alert(data.message || "Absence recorded.");
      onDone();
      onClose();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalBase title="Mark Absence" subtitle="Record absence without a prior request" onClose={onClose} size="md"
      footer={<>
        <ModalBtnSecondary onClick={onClose}>Cancel</ModalBtnSecondary>
        <ModalBtnPrimary onClick={submit} disabled={submitting}>{submitting ? "Saving…" : "Submit"}</ModalBtnPrimary>
      </>}>
      <FormSection title="Details">
        <FormField label="Therapist">
          <select className="modal-input" value={form.therapist_id} onChange={e => setForm({ ...form, therapist_id: e.target.value })}>
            <option value="">— Select —</option>
            {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date from">
            <input type="date" className="modal-input" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} />
          </FormField>
          <FormField label="Date to">
            <input type="date" className="modal-input" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Type">
          <select className="modal-input" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
            <option value="Absence">Absent</option>
            <option value="Permission">Permission</option>
          </select>
        </FormField>
        <FormField label="Note">
          <textarea className="modal-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.cancel_sessions} onChange={e => setForm({ ...form, cancel_sessions: e.target.checked })} />
          Cancel sessions in schedule (recommended)
        </label>
      </FormSection>
    </ModalBase>
  );
}

function HistoryTab({ leaves, therapists, isAdmin, onRefresh }) {
  const [filterTherapist, setFilterTherapist] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");
  const [impactId, setImpactId] = useState(null);

  const months = useMemo(() => {
    const set = new Set(leaves.map(l => (l.start_date || "").slice(0, 7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [leaves]);

  const filtered = useMemo(() => {
    let arr = leaves.filter(isHistoryLeave);
    if (filterTherapist) arr = arr.filter(l => l.therapist_id === filterTherapist);
    if (filterType) arr = arr.filter(l => l.leave_type === filterType);
    if (filterMonth) arr = arr.filter(l => (l.start_date || "").startsWith(filterMonth));
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(l =>
        (l.therapist_name || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q)
      );
    }
    return arr.sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  }, [leaves, filterTherapist, filterType, filterMonth, search]);

  return (
    <div>
      <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
        <select className="select text-sm" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
          <option value="">All Therapists</option>
          {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
        </select>
        <select className="select text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {Object.keys(LEAVE_TYPES).map(k => <option key={k} value={k}>{LEAVE_TYPES[k].label}</option>)}
        </select>
        <select className="select text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <MagnifyingGlass size={16} className="absolute left-2 top-2.5" style={{ color: "#8B9E7A" }} />
          <input className="input pl-8 text-sm" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => exportLeavesCsv(filtered)} className="btn btn-gold text-xs ml-auto">
          <Export size={14} /> Export to Excel
        </button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#F0E9D8" }}>
            <tr>
              <th className="p-3 text-left font-bold">Therapist</th>
              <th className="p-3 text-left font-bold">Type</th>
              <th className="p-3 text-left font-bold">Dates</th>
              <th className="p-3 text-center font-bold">Days</th>
              <th className="p-3 text-left font-bold">Status</th>
              <th className="p-3 text-left font-bold">Document</th>
              <th className="p-3 text-left font-bold">Schedule Impact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center" style={{ color: "#8B9E7A" }}>No history records</td></tr>
            )}
            {filtered.map(l => {
              const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
              const doc = documentBadge(l);
              const impact = scheduleImpactLabel(l);
              return (
                <tr key={l.id} className="border-t border-[#E2DDD4] hover:bg-[#FAFAF7]">
                  <td className="p-3 font-bold">{l.therapist_name || "—"}</td>
                  <td className="p-3">{LEAVE_TYPES[l.leave_type]?.label || l.leave_type}</td>
                  <td className="p-3 text-xs">{fmtDateRange(l.start_date, l.end_date)}</td>
                  <td className="p-3 text-center font-bold">{l.days}</td>
                  <td className="p-3">
                    <span className="pill text-[10px]" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-[10px]" style={{ color: doc.color }}>{doc.icon} {doc.label.split("—")[0].trim()}</span>
                  </td>
                  <td className="p-3">
                    {(l.schedule_impact || []).length > 0 ? (
                      <button type="button" className="text-xs underline" style={{ color: "#5C6853" }}
                        onClick={() => setImpactId(impactId === l.id ? null : l.id)}>
                        {impact}
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: "#8B9E7A" }}>{impact}</span>
                    )}
                    {impactId === l.id && (
                      <ul className="mt-1 text-[10px]" style={{ color: "#8B9E7A" }}>
                        {(l.schedule_impact || []).map((s, i) => (
                          <li key={i}>{s.date} · {s.client_name}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyLeavesTable({ leaves, user, onEdit, onRefresh, adminView = false }) {
  if (!leaves.length) {
    return (
      <div className="card p-10 text-center text-sm" style={{ color: "#8B9E7A" }}>
        No leave requests submitted yet.
      </div>
    );
  }
  return (
    <div className="card p-0 overflow-hidden">
      <div className="table-scroll overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#EFE8D2", borderBottom: "1px solid #C9BB91" }}>
              {["Type", "Pay Status", "Dates", "Days", "Status", "Document", "Actions"].map(h => (
                <th key={h} className="p-3 text-left font-bold text-xs" style={{ color: "#2C3625" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => {
              const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
              const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
              const badge = documentBadge(l);
              const canEdit = adminView || (l.therapist_id === user?.id && isPendingLeaveStatus(l.status));
              return (
                <tr key={l.id} className="border-b border-[#E2DDD4] hover:bg-[#FAFAF7]">
                  <td className="p-3">
                    <span className="pill text-[10px] px-2 py-0.5 font-bold" style={{ background: `${tp.color}22`, color: tp.color }}>{tp.label}</span>
                  </td>
                  <td className="p-3 font-medium" style={{ color: "#5C6853" }}>{leavePayCategory(l.leave_type)}</td>
                  <td className="p-3" style={{ color: "#2C3625" }}>{fmtDateRange(l.start_date, l.end_date)}</td>
                  <td className="p-3 font-bold" style={{ color: "#2C3625" }}>{l.days}</td>
                  <td className="p-3">
                    <span className="pill text-[10px] px-2 py-0.5 font-bold" style={{ background: st.bg, color: st.color }}>
                      {leaveStatusLabel(l.status, true)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs" style={{ color: badge.color }}>{badge.label}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {canEdit && (
                        <button type="button" onClick={() => onEdit(l)} className="btn btn-ghost text-xs py-1 px-2">Edit</button>
                      )}
                      {(l.therapist_id === user?.id || adminView) && (
                        <LeaveRowAttachButton leave={l} onRefresh={onRefresh} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveRowAttachButton({ leave, onRefresh }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          fd.append("document_type", "medical");
          try {
            await api.post(`/leaves/${leave.id}/upload-document`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            onRefresh();
          } catch (err) {
            alert("Upload failed: " + (err.response?.data?.detail || err.message));
          }
          e.target.value = "";
        }} />
      <button type="button" onClick={() => ref.current?.click()} className="btn btn-outline text-xs py-1 px-2">
        <UploadSimple size={12} /> {leave.document_file_path ? "Replace" : "Attach"}
      </button>
    </>
  );
}

export default function LeaveRequests({ personal = false, embedded = false, grievanceTypes = null, pageSettings = null }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const therapistFilter = personal ? user?.id : (searchParams.get("therapist") || null);
  const portalAdmin = !personal && showAdminNav(user);
  const leaveManager = !personal && canManageLeaves(user);
  const hrReview = !personal && canHrReviewLeaves(user);
  const isManager = !personal && isJenan(user) && !portalAdmin;
  const reviewerView = leaveManager || hrReview || isManager || portalAdmin;
  const [statusFilter, setStatusFilter] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("active");
  const [leaves, setLeaves] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [showMarkAbsence, setShowMarkAbsence] = useState(false);
  const [myBalance, setMyBalance] = useState(null);
  const [pendingDoc, setPendingDoc] = useState(null);
  const leaveFileRef = useRef(null);

  const load = async () => {
    const leaveParams = { year };
    const balanceParams = { year };
    if (isManager || leaveManager) {
      leaveParams.scope = "staff";
      balanceParams.scope = "staff";
    }
    const [l, t, b] = await Promise.all([
      api.get("/leaves", { params: leaveParams }),
      api.get("/therapists").catch(() => ({ data: [] })),
      api.get("/leaves/balance", { params: balanceParams }).catch(() => ({ data: [] })),
    ]);
    setLeaves(l.data);
    setTherapists(t.data);
    const balanceFor = personal ? user?.id : (searchParams.get("therapist") || null);
    if (balanceFor) {
      const row = (b.data || []).find(x => x.therapist_id === balanceFor) || null;
      setMyBalance(row);
    } else {
      setMyBalance(null);
    }
  };
  useEffect(() => { load(); }, [year, reviewerView, user?.id, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (edit?.start_date && edit?.end_date) {
      const calc = diffDays(edit.start_date, edit.end_date);
      if (calc !== edit.days) setEdit(e => ({ ...e, days: calc }));
    }
  }, [edit?.start_date, edit?.end_date]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeLeaves = useMemo(() =>
    leaves.filter(isActiveLeave).sort((a, b) => {
      const ap = isPendingLeaveStatus(a.status);
      const bp = isPendingLeaveStatus(b.status);
      if (ap && !bp) return -1;
      if (bp && !ap) return 1;
      return String(b.start_date).localeCompare(String(a.start_date));
    }),
    [leaves]
  );

  const save = async () => {
    if (!edit.therapist_id) { alert("Select a therapist"); return; }
    if (!edit.id && leaveRequiresDocument(edit.leave_type) && !pendingDoc) {
      alert(`Please upload a supporting document. ${ATTACHMENT_REQUIRED_MSG}`);
      return;
    }
    if (edit.id) {
      await api.put(`/leaves/${edit.id}`, edit);
    } else {
      const { data: created } = await api.post("/leaves", edit);
      if (pendingDoc && created?.id) {
        const fd = new FormData();
        fd.append("file", pendingDoc);
        fd.append("document_type", edit.leave_type === "Sickleave" ? "medical" : "other");
        await api.post(`/leaves/${created.id}/upload-document`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
    }
    setEdit(null);
    setPendingDoc(null);
    load();
  };

  const displayLeaves = useMemo(() => {
    let list = (reviewerView && !therapistFilter) ? activeLeaves : [...leaves];
    if (therapistFilter) {
      list = list.filter(l => l.therapist_id === therapistFilter);
    }
    if (isManager && !portalAdmin && !therapistFilter) {
      list = list.filter(l => l.status === "pending" || l.status === "pending_manager" || l.status === "pending_attachment");
    } else if (hrReview && !portalAdmin && !leaveManager && !therapistFilter) {
      list = list.filter(l => l.status === "pending_hr");
    }
    if (grievanceTypes?.length) {
      list = list.filter(l => grievanceTypes.includes(l.leave_type));
    }
    if (statusFilter) {
      list = list.filter(l => l.status === statusFilter);
    }
    return list.sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  }, [reviewerView, activeLeaves, leaves, therapistFilter, isManager, hrReview, portalAdmin, leaveManager, grievanceTypes, statusFilter]);

  const months = useMemo(() => {
    const set = new Set(displayLeaves.map(l => (l.start_date || "").slice(0, 7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [displayLeaves]);

  const activeFilteredLeaves = useMemo(() => {
    let list = [...displayLeaves];
    if (filterTherapist) list = list.filter(l => l.therapist_id === filterTherapist);
    if (filterType) list = list.filter(l => l.leave_type === filterType);
    if (filterMonth) list = list.filter(l => (l.start_date || "").startsWith(filterMonth));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.therapist_name || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q) ||
        (l.leave_type || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [displayLeaves, filterTherapist, filterType, filterMonth, search]);

  const selectedLeave = useMemo(
    () => activeFilteredLeaves.find(l => l.id === selectedId) || null,
    [activeFilteredLeaves, selectedId]
  );

  useEffect(() => {
    if (!reviewerView || tab !== "active") return;
    if (activeFilteredLeaves.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !activeFilteredLeaves.some(l => l.id === selectedId)) {
      setSelectedId(activeFilteredLeaves[0].id);
    }
  }, [reviewerView, tab, activeFilteredLeaves, selectedId]);

  const filteredTherapist = therapistFilter ? therapists.find(t => t.id === therapistFilter) : null;
  const therapistProfileView = Boolean(therapistFilter && reviewerView);

  return (
    <div>
      {!embedded && (
      <PageBanner
        title={therapistProfileView ? (filteredTherapist ? getTherapistScheduleName(filteredTherapist) : "Therapist Leaves") : (reviewerView ? "Leave Requests" : "My Leaves")}
        subtitle={therapistProfileView
          ? "Annual balance and full leave history"
          : reviewerView
            ? (filteredTherapist ? `Leave records for ${getTherapistScheduleName(filteredTherapist)}` : "Approve requests · track documents · mark absences")
            : "Annual balance · leave history · upload medical documents"}
        badge={(
          <>
            <select className="select text-[11px] max-w-[80px] min-h-0 h-7 py-0" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {leaveManager && !grievanceTypes && pageSettings?.show_mark_absence !== false && (
              <button type="button" onClick={() => setShowMarkAbsence(true)} className="btn btn-secondary text-[11px] px-2.5 py-1 min-h-0">
                <UserMinus size={13} /> {pageSettings?.mark_absence_label || "Mark Absence"}
              </button>
            )}
            {!grievanceTypes && pageSettings?.show_new_request_button !== false && (
            <button data-testid="add-leave-btn" onClick={() => setEdit(emptyLeave(leaveManager || portalAdmin ? "" : user?.id))} className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0">
              <Plus size={13} /> {reviewerView && (leaveManager || portalAdmin)
                ? (pageSettings?.new_request_label || "New Request")
                : (pageSettings?.request_leave_label || "Request Leave")}
            </button>
            )}
          </>
        )}
      />
      )}
      {therapistProfileView && (
        <Link to={embedded ? "/staff-leave?tab=vacation" : "/leave-balance"} className="text-xs font-bold mb-3 inline-block hover:underline" style={{ color: "#7A8A6A" }}>
          ← Back to Leave Balance
        </Link>
      )}

      {(personal || therapistFilter) && (
        <div className="card p-5 sm:p-6 mb-5" style={{ background: "linear-gradient(135deg, #6B8F71 0%, #3D5C44 55%, #2F4A35 100%)", borderColor: "transparent", color: "white" }}>
          <div className="text-xs tracking-[0.2em] font-bold opacity-90 mb-1">
            LEAVE BALANCE{filteredTherapist && !personal ? ` · ${getTherapistScheduleName(filteredTherapist)}` : ""}
          </div>
          {myBalance?.contract_period_start && (
            <div className="text-[10px] opacity-80 mb-2">
              Contract year · {myBalance.contract_period_start?.slice(0, 10)} – {myBalance.contract_period_end?.slice(0, 10)}
            </div>
          )}
          {myBalance ? (
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <div className="font-display text-4xl sm:text-5xl font-semibold">{myBalance.remaining}</div>
                <div className="text-sm opacity-90">days remaining</div>
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-w-[200px]">
                <div className="bg-white/15 rounded-xl p-3">
                  <div className="text-[9px] sm:text-[10px] tracking-widest opacity-80">ENTITLED</div>
                  <div className="text-xl sm:text-2xl font-bold">{myBalance.allocated}</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3">
                  <div className="text-[9px] sm:text-[10px] tracking-widest opacity-80">USED</div>
                  <div className="text-xl sm:text-2xl font-bold">{myBalance.used_annual}</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3">
                  <div className="text-[9px] sm:text-[10px] tracking-widest opacity-80">PENDING</div>
                  <div className="text-xl sm:text-2xl font-bold">{myBalance.pending}</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3">
                  <div className="text-[9px] sm:text-[10px] tracking-widest opacity-80">JOIN DATE</div>
                  <div className="text-sm sm:text-base font-bold mt-1">{myBalance.join_date || "—"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm opacity-80">Loading balance…</div>
          )}
        </div>
      )}

      {(personal || therapistProfileView) && (
        <div className="mb-5">
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: "#2C3625" }}>Leave History</h2>
          <MyLeavesTable
            leaves={displayLeaves}
            user={user}
            onEdit={setEdit}
            onRefresh={load}
            adminView={therapistProfileView}
          />
        </div>
      )}

      {embedded && reviewerView && !therapistProfileView && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {leaveManager && pageSettings?.show_mark_absence !== false && (
            <button type="button" onClick={() => setShowMarkAbsence(true)} className="btn btn-secondary text-xs">
              <UserMinus size={13} /> {pageSettings?.mark_absence_label || "Mark Absence"}
            </button>
          )}
          {pageSettings?.show_new_request_button !== false && (
            <button
              type="button"
              data-testid="add-leave-btn-embedded"
              onClick={() => setEdit(emptyLeave(leaveManager || portalAdmin ? "" : user?.id))}
              className="btn btn-primary text-xs"
            >
              <Plus size={13} /> {leaveManager || portalAdmin
                ? (pageSettings?.new_request_label || "New Request")
                : (pageSettings?.request_leave_label || "Request Leave")}
            </button>
          )}
        </div>
      )}

      {reviewerView && !therapistProfileView && (
        <div className="flex gap-2 mb-5 items-center flex-wrap">
          {[
            { id: "active", label: pageSettings?.active_requests_label || "Active Requests" },
            { id: "history", label: pageSettings?.history_label || "History" },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === t.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E2DDD4]"}`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: "#5C6853" }}>Status</span>
            <select className="select text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {Object.entries(LEAVE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(!reviewerView || tab === "active") && reviewerView && !therapistProfileView && (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
          <div className="card p-3 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <div className="relative flex-1 min-w-[160px]">
                <MagnifyingGlass size={16} className="absolute left-2 top-2.5" style={{ color: "#8B9E7A" }} />
                <input
                  className="input pl-8 text-sm"
                  placeholder={pageSettings?.search_placeholder || "Search therapist / notes / type…"}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {(search || filterTherapist || filterType || filterMonth) && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilterTherapist(""); setFilterType(""); setFilterMonth(""); }}
                  className="btn btn-ghost text-xs"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <select className="select text-xs" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
                <option value="">All Therapists</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
              </select>
              <select className="select text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {Object.keys(LEAVE_TYPES).map(k => <option key={k} value={k}>{LEAVE_TYPES[k]?.label || k}</option>)}
              </select>
              <select className="select text-xs" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="">All Months</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="text-xs font-semibold flex items-center justify-end pr-1" style={{ color: "#5C6853" }}>
                {activeFilteredLeaves.length} shown
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
              <div className="max-h-[70vh] overflow-y-auto">
                {activeFilteredLeaves.length === 0 && (
                  <div className="p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>
                    No requests match your filters
                  </div>
                )}
                {activeFilteredLeaves.map(l => {
                  const isSelected = l.id === selectedId;
                  const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                  const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "#7A8A6A" };
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedId(l.id)}
                      className="w-full text-left px-3 py-3 border-b last:border-b-0 transition"
                      style={{
                        borderColor: "#E2DDD4",
                        background: isSelected ? "#E5EBE1" : "transparent",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>
                            {l.therapist_name || "—"}
                          </div>
                          <div className="text-[11px] mt-0.5 truncate" style={{ color: "#5C6853" }}>
                            <span className="pill text-[10px] px-2 py-0.5 mr-1 font-bold" style={{ background: `${tp.color}22`, color: tp.color }}>
                              {tp.label}
                            </span>
                            {fmtLeaveSchedule(l)}
                          </div>
                          {l.notes && (
                            <div className="text-[11px] mt-1 truncate" style={{ color: "#8B9E7A" }}>
                              💬 {l.notes}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                          <span className="text-[10px] font-semibold" style={{ color: "#8B9E7A" }}>
                            {(l.start_date || "").slice(0, 10)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            {!selectedLeave ? (
              <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
                Select a request to review
              </div>
            ) : (
              <LeaveRequestCard
                key={selectedLeave.id}
                leave={selectedLeave}
                user={user}
                onRefresh={load}
                onEdit={setEdit}
                therapists={therapists}
                personal={personal}
                leaveManager={leaveManager}
                hrReview={hrReview}
                portalAdmin={portalAdmin}
                isManager={isManager}
              />
            )}
          </div>
        </div>
      )}

      {reviewerView && tab === "history" && !therapistProfileView && (
        <HistoryTab leaves={leaves} therapists={therapists} isAdmin={leaveManager || portalAdmin} onRefresh={load} />
      )}

      {edit && (
        <ModalBase title={edit.id ? "Edit Leave Request" : "Request Leave"} onClose={() => { setEdit(null); setPendingDoc(null); }} size="md"
          footer={<>
            <ModalBtnSecondary onClick={() => { setEdit(null); setPendingDoc(null); }}>Cancel</ModalBtnSecondary>
            <ModalBtnPrimary data-testid="leave-save-btn" onClick={save}>Submit</ModalBtnPrimary>
          </>}>
          <FormSection title="Leave Details">
            {leaveManager && (
              <FormField label="Therapist">
                <select data-testid="leave-therapist-select" className="modal-input" value={edit.therapist_id}
                  onChange={e => setEdit({ ...edit, therapist_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
                </select>
              </FormField>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Leave Type">
                <select className="modal-input" value={edit.leave_type} onChange={e => setEdit({ ...edit, leave_type: e.target.value })}>
                  {selectableLeaveTypeEntries(edit.leave_type).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FormField>
              <FormField label="Days">
                <input type="number" step="0.5" min="0.5" className="modal-input bg-[#F5F5F5]" readOnly value={edit.days} />
              </FormField>
              <FormField label="Date From">
                <input data-testid="leave-start-input" type="date" className="modal-input" value={edit.start_date}
                  onChange={e => setEdit({ ...edit, start_date: e.target.value })} />
              </FormField>
              <FormField label="Date To">
                <input data-testid="leave-end-input" type="date" className="modal-input" value={edit.end_date}
                  onChange={e => setEdit({ ...edit, end_date: e.target.value })} />
              </FormField>
            </div>
            {leaveManager && (
              <FormField label="Status">
                <select className="modal-input" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                  {Object.entries(LEAVE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Notes" hint="Optional">
              <textarea className="modal-input" rows={3} value={edit.notes || ""} placeholder="Reason or additional details…"
                onChange={e => setEdit({ ...edit, notes: e.target.value })} />
            </FormField>
            {!edit.id && (
              <FormField
                label={leaveRequiresDocument(edit.leave_type) ? "Supporting document" : "Attachment"}
                hint={leaveRequiresDocument(edit.leave_type) ? "Required — medical report, sick note, etc." : "Optional — medical report, sick note, etc."}
                required={leaveRequiresDocument(edit.leave_type)}
              >
                {leaveRequiresDocument(edit.leave_type) && (
                  <div className="rounded-xl p-3 mb-2 text-xs font-semibold border" style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
                    {ATTACHMENT_REQUIRED_MSG}
                  </div>
                )}
                <input ref={leaveFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                  onChange={e => setPendingDoc(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => leaveFileRef.current?.click()} className="btn btn-outline text-sm w-full justify-center">
                  <UploadSimple size={16} /> {pendingDoc ? pendingDoc.name : "Choose File"}
                </button>
              </FormField>
            )}
          </FormSection>
        </ModalBase>
      )}

      {showMarkAbsence && (
        <MarkAbsenceModal therapists={therapists} onClose={() => setShowMarkAbsence(false)} onDone={load} />
      )}
    </div>
  );
}
