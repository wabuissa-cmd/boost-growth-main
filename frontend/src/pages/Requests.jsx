import { useEffect, useState, useRef, useMemo } from "react";
import api, { API, openAuthenticatedFile } from "../api";
import { useAuth, showAdminNav, canEditStaffRequests, canManageLeaves, canHrReviewLeaves, isJenan, showSystemAdmin, canAccessManagerHub } from "../auth";
import { Navigate } from "react-router-dom";
import { Plus, PencilSimple, X, ChatCircleText, CalendarBlank, Tag, Lightning, Clock, CheckCircle, XCircle, Hourglass, Spinner, Trophy, Briefcase, Package, UploadSimple, Eye, FileArrowDown, FileText, Buildings, ListChecks } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import RequestsPageHeader from "../components/RequestsPageHeader";
import { LEAVE_STATUS, LEAVE_TYPES, diffDays, fmtDateRange, permissionPayLabel, fmtLeaveSchedule, permissionDaysFromTimes, addHoursToTime24, leaveRequiresDocument } from "../leaveUtils";
import "../clientInfoLayout.css";
import { getTherapistScheduleName } from "../scheduleConstants";

const STATUS_MAP = {
  pending:    { label: "Pending",     cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  pending_manager: { label: "Pending Manager", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  pending_attachment: { label: "Awaiting Attachment", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <Hourglass size={14} weight="duotone"/>, color: "#ECA6A6" },
  pending_hr: { label: "Pending HR", cls: "bg-[#F5EBE3] text-[#965132] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#C28E6A" },
  in_progress:{ label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Spinner size={14} weight="duotone"/>, color: "#A4BCCB" },
  approved:   { label: "Approved",    cls: "bg-[#E5EBE1] text-[var(--brand-dark)] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/>, color: "#B4C2A9" },
  rejected:   { label: "Rejected",    cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/>, color: "#ECA6A6" },
  done:       { label: "Completed",   cls: "bg-[var(--brand-sage)] text-white border-[var(--brand-sage)]",     icon: <CheckCircle size={14} weight="fill"/>, color: "var(--brand-sage)" },
};

const PENDING_MANAGER_STATUSES = new Set(["pending", "pending_manager"]);
const PENDING_HR_STATUS = "pending_hr";
/** UI-only key for Jinan manager review — saved as pending_hr */
const MANAGER_APPROVE_KEY = "manager_approve";
const MANAGER_REJECT_KEY = "manager_reject";

const MANAGER_REVIEW_STATUS_MAP = {
  pending_manager: {
    label: "Pending",
    cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]",
    icon: <Hourglass size={14} weight="duotone"/>,
    color: "#E6C983",
  },
  [MANAGER_APPROVE_KEY]: {
    label: "Forward to HR",
    cls: "bg-[#E5EBE1] text-[var(--brand-dark)] border-[#B4C2A9]",
    icon: <CheckCircle size={14} weight="duotone"/>,
    color: "#B4C2A9",
  },
  in_progress: {
    label: "In progress",
    cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]",
    icon: <Clock size={14} weight="duotone" />,
    color: "#A4BCCB",
  },
  [MANAGER_REJECT_KEY]: {
    label: "Reject",
    cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]",
    icon: <XCircle size={14} weight="duotone" />,
    color: "#ECA6A6",
  },
};

function isPendingManagerStatus(status) {
  return PENDING_MANAGER_STATUSES.has(status);
}

function isOpenQueueStatus(status) {
  return isPendingManagerStatus(status) || status === PENDING_HR_STATUS || status === "pending_attachment";
}

function isManagerReviewableItem(item) {
  if (!item) return false;
  if (item._queueKind === "leave") {
    return isPendingManagerStatus(item.status) || item.status === "pending_attachment";
  }
  return isPendingManagerStatus(item.status) || item.status === "in_progress";
}

const MANAGER_REVIEW_OPTIONS = [MANAGER_APPROVE_KEY, "pending_manager", "in_progress", MANAGER_REJECT_KEY];

function managerReviewStatusOptions() {
  return MANAGER_REVIEW_OPTIONS;
}

function managerReviewInitialStatus(currentStatus) {
  if (currentStatus === "approved" || currentStatus === "done") return MANAGER_APPROVE_KEY;
  return "pending_manager";
}

/** Read-only highlight for manager status tracking (non-reviewable items). */
function managerTrackingStatusKey(status) {
  if (status === "rejected") return "rejected";
  if (status === "approved" || status === "done" || status === "pending_hr") return MANAGER_APPROVE_KEY;
  return "pending_manager";
}

function ManagerStatusGrid({ activeKey, readOnly = false, onSelect }) {
  return (
    <div
      className="grid grid-cols-2 gap-2 p-2 rounded-xl mb-3"
      style={{ background: "#FAFAF7", border: "1px solid #E2DDD4" }}
      role={readOnly ? "group" : "radiogroup"}
      aria-label={readOnly ? "Request status" : "Manager decision"}
    >
      {managerReviewStatusOptions().map((k) => {
        const v = MANAGER_REVIEW_STATUS_MAP[k];
        const active = activeKey === k;
        const Btn = readOnly ? "div" : "button";
        return (
          <Btn
            key={k}
            type={readOnly ? undefined : "button"}
            role={readOnly ? undefined : "radio"}
            aria-checked={readOnly ? undefined : active}
            data-testid={readOnly ? `track-status-${k}` : `manager-decision-${k}`}
            onClick={readOnly ? undefined : () => onSelect?.(k)}
            className="flex flex-col items-center justify-center gap-1 rounded-lg py-3 px-2 text-sm font-semibold transition"
            style={{
              background: active ? "#E5EBE1" : "#F5F5F0",
              color: active ? "#3D4F35" : "#5C6853",
              border: active ? "2px solid #3D4F35" : "1px solid #E2DDD4",
              boxShadow: active ? "0 1px 3px rgba(61,79,53,0.12)" : "none",
              cursor: readOnly ? "default" : "pointer",
            }}
          >
            <span style={{ color: active ? "#3D4F35" : "#8B9E7A" }}>{v.icon}</span>
            {v.label}
          </Btn>
        );
      })}
    </div>
  );
}

function resolveManagerSaveStatus(status) {
  return status;
}

function allowedStatusOptions(user, currentStatus) {
  const portalAdmin = showAdminNav(user);
  const manager = isJenan(user) && !portalAdmin;
  const hr = canHrReviewLeaves(user) && !portalAdmin;
  const effective = isPendingManagerStatus(currentStatus) ? "pending_manager" : currentStatus;

  if (portalAdmin) {
    return Object.keys(STATUS_MAP);
  }
  if (manager && (effective === "in_progress" || isPendingManagerStatus(effective))) {
    return managerReviewStatusOptions();
  }
  if (hr && effective === PENDING_HR_STATUS) {
    return ["approved", "rejected", "in_progress", "done"];
  }
  return Object.keys(STATUS_MAP);
}

function managerWorkflowLabel(r) {
  if (r.status === "pending_hr") {
    if (r.manager_decision === "rejected") {
      return { label: "Manager rejected → HR", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]" };
    }
    return { label: "Forwarded to HR", cls: "bg-[#F5EBE3] text-[#965132] border-[#E6C983]" };
  }
  if (r.status === "rejected") {
    return { label: "Rejected", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]" };
  }
  const timeline = r.timeline || [];
  const managerTouched = timeline.some(ev =>
    ev.event === "pending_hr" || ev.event === "manager_rejected" || (ev.note && ev.event !== "submitted")
  );
  if (r.admin_note || managerTouched) {
    return { label: "Edited", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]" };
  }
  return null;
}

function fmtShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

async function viewProtectedFile(url) {
  try {
    await openAuthenticatedFile(url, {
      errorMessage: "Could not open attachment. Please ask the therapist to re-upload it.",
    });
  } catch (e) {
    alert(e?.message || "Could not open attachment. Please ask the therapist to re-upload it.");
  }
}

function requestAwaitingAttachment(r) {
  return r?.status === "pending_attachment" || (r?.requires_attachment && !r?.attachment_url);
}

function leaveAwaitingAttachment(leave) {
  if (!leave) return false;
  // Permission/استئذان is never blocked on attachment — even if legacy status is pending_attachment.
  if (!leaveRequiresDocument(leave.leave_type)) return false;
  return leave.status === "pending_attachment"
    || (!leave.document_file_path && !leave.document_url);
}

function normalizeLeaveStatus(status) {
  return status === "pending" ? "pending_manager" : status;
}

function leaveTherapistLabel(leave) {
  return (leave?.therapist_name || leave?.submitter_name || "").trim() || "—";
}

function normalizeLeaveForQueue(leave) {
  const tp = LEAVE_TYPES[leave.leave_type] || { label: leave.leave_type, color: "var(--brand-sage)" };
  const schedule = fmtLeaveSchedule(leave);
  const therapistLabel = leaveTherapistLabel(leave);
  return {
    _queueKind: "leave",
    leaveId: leave.id,
    id: leave.id,
    therapist_name: therapistLabel === "—" ? null : therapistLabel,
    request_type: "leave",
    leave_type: leave.leave_type,
    typeLabel: tp.label,
    typeColor: tp.color,
    title: tp.label,
    description: leave.notes ? `${schedule} — ${leave.notes}` : schedule,
    created_at: leave.created_at,
    status: normalizeLeaveStatus(leave.status),
    admin_note: leave.admin_note,
    manager_decision: leave.manager_decision,
    manager_note: leave.manager_note,
    timeline: leave.timeline,
    _leave: leave,
  };
}

function queueItemAwaitingAttachment(item) {
  if (item._queueKind === "leave") return leaveAwaitingAttachment(item._leave);
  return requestAwaitingAttachment(item);
}

const TYPES = [
  { id: "general", label: "General", icon: <Briefcase size={20} weight="duotone"/>, color: "#8B7BA8" },
  { id: "companies", label: "Companies", icon: <Buildings size={20} weight="duotone"/>, color: "#6B8F71" },
  { id: "other", label: "Other", icon: <ChatCircleText size={20} weight="duotone"/>, color: "#8B7BA8" },
  { id: "supplies", label: "Materials", icon: <Package size={20} weight="duotone"/>, color: "#D4A64A" },
  { id: "requirements", label: "Requirements", icon: <FileText size={20} weight="duotone"/>, color: "#7B96B5" },
  { id: "government", label: "Government / HR", icon: <Buildings size={20} weight="duotone"/>, color: "#6BAA9B" },
  { id: "schedule_change", label: "Schedule Change", icon: <CalendarBlank size={20} weight="duotone"/>, color: "var(--brand-sage)" },
  { id: "reward", label: "Reward / Recognition", icon: <Trophy size={20} weight="duotone"/>, color: "#C97B5C" },
];

const REWARD_TYPES = [
  { id: "certificate", label: "Certificate of Appreciation" },
  { id: "monetary", label: "Monetary Bonus" },
  { id: "day_off", label: "Extra Day Off" },
  { id: "other", label: "Other" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "var(--brand-sage)" },
  { id: "normal", label: "Normal", color: "var(--brand-sage)" },
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
  return {
    therapist_id: "",
    start_date: today,
    end_date: today,
    days: 1,
    leave_type: "Annual",
    start_time: "14:00",
    end_time: "15:00",
    notes: "",
  };
}

export default function Requests({ personal = false, embedded = false, managerView = false, hubEmbedded = false }) {
  const { user } = useAuth();
  const canManageReq = !personal && canEditStaffRequests(user);
  const leaveHr = !personal && canManageLeaves(user);
  const hrReview = !personal && canHrReviewLeaves(user);
  const isPortalAdminUser = !personal && showAdminNav(user);
  const isManager = !personal && isJenan(user) && !isPortalAdminUser;
  const adminManagerPreview = managerView && isPortalAdminUser && showSystemAdmin(user);
  const inManagerReviewMode = managerView && (isManager || adminManagerPreview);
  const staffLabel = managerView ? "Therapists' Requests" : "Staff Requests";
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState(managerView ? "pending" : "all");
  const [edit, setEdit] = useState(null);
  const [statusEdit, setStatusEdit] = useState(null);
  const [step, setStep] = useState(1);
  const [therapists, setTherapists] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [staffLeaves, setStaffLeaves] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(!embedded);
  const [requestsError, setRequestsError] = useState(null);
  const [leaveModal, setLeaveModal] = useState(null);
  const [leaveDoc, setLeaveDoc] = useState(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const leaveFileRef = useRef(null);

  const useStaffScope = managerView || (canManageReq && !personal);

  const load = async () => {
    if (!embedded) setRequestsError(null);
    try {
      const { data } = await api.get("/requests", {
        params: useStaffScope ? { scope: "staff" } : {},
      });
      setItems(data);
    } catch (err) {
      if (!embedded) {
        setRequestsError(err?.response?.data?.detail || "Could not load requests. Please try again.");
      }
    } finally {
      if (!embedded) setRequestsLoading(false);
    }
  };
  const loadLeaves = async () => {
    const yr = new Date().getFullYear();
    const params = { year: yr };
    if (leaveHr || managerView) params.scope = "staff";
    const { data } = await api.get("/leaves", { params });
    const sorted = [...(data || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    if (managerView) setStaffLeaves(sorted);
    if (leaveHr) setRecentLeaves(sorted.slice(0, 10));
  };
  useEffect(() => {
    load();
    if (canManageReq) {
      api.get("/therapists").then(r => setTherapists(r.data || [])).catch(() => {});
    }
    if (leaveHr || managerView) loadLeaves();
  }, [canManageReq, leaveHr, managerView]);

  const submitNew = async () => {
    await api.post("/requests", edit);
    setEdit(null); setStep(1); load();
  };
  const updateStatus = async (req, status, admin_note = null) => {
    const payload = { status, admin_note: admin_note ?? req.admin_note };
    if (hrReview && !isPortalAdminUser) {
      payload.notify_therapist = true;
    }
    await api.put(`/requests/${req.id}/status`, payload);
    load();
  };
  const updateStatusFromModal = async (overrideStatus) => {
    const status = overrideStatus ?? statusEdit.status;
    const payload = { status, admin_note: statusEdit.admin_note };
    if (hrReview && !isPortalAdminUser && !inManagerReviewMode) {
      payload.notify_therapist = true;
    }
    await api.put(`/requests/${statusEdit.id}/status`, payload);
    setStatusEdit(null);
    load();
  };
  const resendDecisionEmail = async (req) => {
    try {
      await api.post(`/requests/${req.id}/resend-decision-email`);
      alert("Decision email sent to the staff member.");
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not send email.");
    }
  };

  const openManagerReview = (r) => {
    setStatusEdit({
      ...r,
      status: inManagerReviewMode ? managerReviewInitialStatus(r.status) : r.status,
      _managerReviewable: isManagerReviewableItem(r),
      notify_hr: true,
      notify_therapist: false,
    });
  };

  const closeStatusModal = () => {
    setStatusEdit(null);
  };

  const handleManagerStatusSave = async () => {
    if (!statusEdit) return;
    if (queueItemAwaitingAttachment(statusEdit)) {
      alert("This request is awaiting an attachment from the therapist and cannot be reviewed yet.");
      return;
    }
    if (statusEdit._queueKind === "leave") {
      const finalStatus = inManagerReviewMode
        ? resolveManagerSaveStatus(statusEdit.status)
        : statusEdit.status;
      const payload = {
        status: finalStatus,
        admin_note: statusEdit.admin_note,
      };
      if (inManagerReviewMode) {
        payload.notify_hr = !!statusEdit.notify_hr;
        payload.notify_therapist = !!statusEdit.notify_therapist;
      }
      await api.put(`/leaves/${statusEdit.leaveId}/status`, payload);
      setStatusEdit(null);
      loadLeaves();
      return;
    }
    const finalStatus = inManagerReviewMode
      ? resolveManagerSaveStatus(statusEdit.status)
      : statusEdit.status;
    const payload = {
      status: finalStatus,
      admin_note: statusEdit.admin_note,
    };
    if (inManagerReviewMode) {
      payload.notify_hr = true;
      payload.notify_therapist = false;
    }
    await api.put(`/requests/${statusEdit.id}/status`, payload);
    setStatusEdit(null);
    load();
  };

  const updateLeaveDates = (form, start, end) => {
    if (form.leave_type === "Permission") {
      const days = permissionDaysFromTimes(form.start_time, form.end_time, start, end);
      return { ...form, start_date: start, end_date: end, days };
    }
    const days = Math.max(1, diffDays(start, end));
    return { ...form, start_date: start, end_date: end, days };
  };

  const updateLeavePermissionTimes = (form, startTime, endTime) => {
    const days = permissionDaysFromTimes(
      startTime,
      endTime,
      form.start_date,
      form.end_date,
    );
    return { ...form, start_time: startTime, end_time: endTime, days };
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
      if (leaveModal.leave_type === "Permission") {
        if (!leaveModal.start_time || !leaveModal.end_time) {
          alert("Please set start and end time for permission.");
          setLeaveSubmitting(false);
          return;
        }
        payload.start_time = leaveModal.start_time;
        payload.end_time = leaveModal.end_time;
      }
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

  const queueItems = useMemo(() => {
    const staff = items.filter(r => r.request_type !== "leave");
    if (!managerView) return staff;
    const leaves = staffLeaves.map(normalizeLeaveForQueue);
    return [...staff, ...leaves].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [items, staffLeaves, managerView]);

  const filtered = queueItems.filter(r => {
    if (filter === "all") return true;
    if (filter === "pending") return isOpenQueueStatus(r.status);
    if (filter === "pending_manager") return isPendingManagerStatus(r.status);
    return r.status === filter;
  });

  const canViewManagerQueue = managerView && canAccessManagerHub(user);
  if (!personal && !canEditStaffRequests(user) && !canViewManagerQueue) {
    if (embedded && managerView) {
      return (
        <div className="card p-6 text-center text-sm" style={{ color: "#8B9E7A" }}>
          Manager queue access required.
        </div>
      );
    }
    return <Navigate to="/my-requests" replace/>;
  }

  const pendingManagerCount = queueItems.filter(r => isPendingManagerStatus(r.status)).length;
  const pendingHrCount = queueItems.filter(r => r.status === PENDING_HR_STATUS).length;
  const pendingAttachmentCount = queueItems.filter(r => r.status === "pending_attachment").length;
  const pendingCount = queueItems.filter(r => isOpenQueueStatus(r.status)).length;
  const inProgressCount = queueItems.filter(r => r.status === "in_progress").length;
  const doneCount = queueItems.filter(r => r.status === "done" || r.status === "approved").length;

  if (!embedded && requestsLoading && items.length === 0 && !requestsError) {
    return (
      <div className="requests-page" dir="ltr">
        <div className="requests-page-loading"><div className="spinner" /></div>
      </div>
    );
  }

  const pageShell = (
    <>
      {!embedded && (
        <RequestsPageHeader
          title={canManageReq ? "Staff Requests" : "My Requests"}
          subtitle={canManageReq
            ? "Materials, requirements, government letters & general applications"
            : "Submit and track your staff requests"}
          stats={[
            { label: "Total", n: queueItems.length, color: "#2C3625" },
            { label: "Pending", n: pendingCount, color: "#6B5218" },
            { label: "Manager", n: pendingManagerCount, color: "#6B5218" },
            { label: "HR", n: pendingHrCount, color: "#965132" },
            { label: "In progress", n: inProgressCount, color: "#375568" },
            { label: "Done", n: doneCount, color: "var(--brand-dark)" },
          ]}
          toolbar={leaveHr && isPortalAdminUser ? (
            <button data-testid="submit-leave-btn" type="button" onClick={() => setLeaveModal(emptyLeaveForm())} className="btn btn-secondary text-sm">
              <Plus size={16} /> Submit Leave Request
            </button>
          ) : null}
        />
      )}

      {!embedded && requestsError && (
        <div className="card requests-page-error" role="alert">{requestsError}</div>
      )}

      <div className={managerView ? "" : "req-split"}>
        <section className={managerView
          ? (hubEmbedded ? "mgr-hub-req-panel overflow-hidden" : "card portal-content-panel requests-page-panel overflow-hidden")
          : "req-panel-left card portal-content-panel requests-page-panel"}>
          {!embedded && (
            <div className="requests-page-panel-head px-3 pt-3 sm:px-4">
              <ListChecks size={22} weight="duotone" className="shrink-0" />
              <div className="min-w-0">
                <h2>{staffLabel}</h2>
                <p>{managerView ? "Leave · salary certificate · supplies · general — one queue" : "Materials · requirements · government · general"}</p>
              </div>
            </div>
          )}

          {embedded && (
          <div className={hubEmbedded ? "mgr-hub-stat-overview" : "req-leave-balance mx-3 mt-3"}>
            <div className={hubEmbedded ? "mgr-hub-section-label" : "requests-page-section-label"}>Request overview</div>
            <div className={hubEmbedded ? "mgr-hub-stat-grid" : "req-leave-stat-grid"}>
              <div className={hubEmbedded ? "mgr-hub-stat-box" : "req-leave-stat-box"}>
                <div className={hubEmbedded ? "mgr-hub-stat-val" : "req-leave-stat-val"}>{queueItems.length}</div>
                <div className={hubEmbedded ? "mgr-hub-stat-lbl" : "req-leave-stat-lbl"}>Total</div>
              </div>
              <div className={hubEmbedded ? "mgr-hub-stat-box" : "req-leave-stat-box"}>
                <div className={hubEmbedded ? "mgr-hub-stat-val" : "req-leave-stat-val"}>{pendingCount}</div>
                <div className={hubEmbedded ? "mgr-hub-stat-lbl" : "req-leave-stat-lbl"}>Pending</div>
              </div>
              <div className={hubEmbedded ? "mgr-hub-stat-box" : "req-leave-stat-box"}>
                <div className={hubEmbedded ? "mgr-hub-stat-val" : "req-leave-stat-val"}>{inProgressCount}</div>
                <div className={hubEmbedded ? "mgr-hub-stat-lbl" : "req-leave-stat-lbl"}>In progress</div>
              </div>
              <div className={hubEmbedded ? "mgr-hub-stat-box" : "req-leave-stat-box"}>
                <div className={hubEmbedded ? "mgr-hub-stat-val" : "req-leave-stat-val"}>{doneCount}</div>
                <div className={hubEmbedded ? "mgr-hub-stat-lbl" : "req-leave-stat-lbl"}>Done</div>
              </div>
            </div>
          </div>
          )}

          <div className={`req-panel-head${hubEmbedded ? " mgr-hub-req-filters" : ""}`}>
            {!embedded && (
              <div className="requests-page-section-label mb-2">Filter by status</div>
            )}
            {embedded && !hubEmbedded && (
              <>
                <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>{staffLabel}</h2>
                <p className="text-xs mt-1 mb-2" style={{ color: "var(--brand-sage)" }}>
                  {managerView ? "Leave · salary certificate · supplies · general — one queue" : "Materials · requirements · government · general"}
                </p>
              </>
            )}
            {hubEmbedded && (
              <div className="mgr-hub-section-label mb-2">Filter by status</div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilter("all")} className={`pill text-[10px] ${filter==="all" ? (hubEmbedded ? "mgr-hub-filter-active" : "bg-[var(--brand-sage)] text-white") : (hubEmbedded ? "mgr-hub-filter-idle" : "bg-[#F0E9D8]")}`}>All ({queueItems.length})</button>
              <button onClick={() => setFilter("pending")} className={`pill text-[10px] border ${filter==="pending" ? (hubEmbedded ? "mgr-hub-filter-active" : "bg-[var(--brand-sage)] text-white border-[var(--brand-sage)]") : STATUS_MAP.pending_manager.cls}`}>
                Pending ({pendingCount})
              </button>
              {["in_progress", "approved", "rejected", "done"].map(k => (
                <button key={k} onClick={() => setFilter(k)} className={`pill text-[10px] border ${filter===k ? (hubEmbedded ? "mgr-hub-filter-active" : "bg-[var(--brand-sage)] text-white border-[var(--brand-sage)]") : STATUS_MAP[k].cls}`}>
                  {STATUS_MAP[k].label} ({queueItems.filter(r => r.status === k).length})
                </button>
              ))}
            </div>
          </div>

          {managerView ? (
            <div className="overflow-x-auto">
              <table className="mgr-req-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Therapist</th>
                    <th>Type</th>
                    <th>Request</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Workflow</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="requests-page-empty">
                          <p className="requests-page-empty-text m-0">No requests match this filter yet.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map(r => {
                    const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                    const isLeave = r._queueKind === "leave";
                    const tp = isLeave
                      ? { label: r.typeLabel, color: r.typeColor }
                      : (TYPES.find(t => t.id === r.request_type) || TYPES[0]);
                    const wf = managerWorkflowLabel(r);
                    return (
                      <tr key={isLeave ? `leave-${r.id}` : r.id}>
                        <td className="font-semibold" style={{ color: "#2C3625" }}>{r.therapist_name || (isLeave ? leaveTherapistLabel(r._leave) : null) || "—"}</td>
                        <td>
                          <span className="pill text-[10px]" style={{ background: `${tp.color}20`, color: tp.color }}>{tp.label}</span>
                        </td>
                        <td>
                          <div className="font-semibold" style={{ color: "#2C3625" }}>{r.title}</div>
                          {r.description && <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--brand-sage)" }}>{r.description}</div>}
                        </td>
                        <td className="text-xs whitespace-nowrap" style={{ color: "var(--brand-sage)" }}>{fmtShortDate(r.created_at)}</td>
                        <td>
                          <span className={`pill border text-[10px] ${st.cls}`}>{st.icon} {st.label}</span>
                        </td>
                        <td>
                          {wf ? (
                            <span className={`pill border text-[10px] ${wf.cls}`}>{wf.label}</span>
                          ) : (
                            <span className="text-xs" style={{ color: "#C5CEBC" }}>—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              data-testid={`review-request-${isLeave ? "leave" : "staff"}-${r.id}`}
                              onClick={() => openManagerReview(r)}
                              className={`btn text-[11px] py-1.5 px-3 ${isManagerReviewableItem(r) ? "btn-primary" : "btn-secondary"}`}
                            >
                              <Eye size={13}/> {isManagerReviewableItem(r) ? "Review" : "View status"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <div className="req-panel-list">
            {filtered.length === 0 && (
              <div className="requests-page-empty">
                <div className="requests-page-empty-icon"><ListChecks size={28} weight="duotone" /></div>
                <h3 className="requests-page-empty-title">No requests yet</h3>
                <p className="requests-page-empty-text">New submissions from therapists will appear here.</p>
              </div>
            )}
            {filtered.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              const tp = TYPES.find(t => t.id === r.request_type) || TYPES[0];
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
                      {r.description && <div className="text-xs mt-0.5 line-clamp-2" style={{color: "var(--text-secondary)"}}>{r.description}</div>}
                      {canManageReq && r.therapist_name && (
                        <div className="text-[10px] mt-1" style={{color: "var(--brand-sage)"}}>From <strong style={{color: "var(--text-secondary)"}}>{r.therapist_name}</strong></div>
                      )}
                      <div className="text-[10px] mt-0.5" style={{color: "var(--brand-sage)"}}>{new Date(r.created_at).toLocaleString('en-US')}</div>
                      {r.admin_note && (
                        <div className="mt-2 p-2 rounded-lg text-xs bg-[#E5EBE1]" style={{color: "var(--brand-dark)"}}>{r.admin_note}</div>
                      )}
                      {r.manager_decision === "rejected" && r.status === PENDING_HR_STATUS && (
                        <div className="text-[10px] mt-1 font-semibold" style={{ color: "#8A3F27" }}>
                          Manager rejected{r.manager_note ? `: ${r.manager_note}` : ""}
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
                      {canManageReq && hrReview && !isPortalAdminUser && ["approved", "rejected", "done", "in_progress"].includes(r.status) && (
                        <div className="mt-2">
                          <button type="button" onClick={() => resendDecisionEmail(r)} className="btn btn-secondary text-[10px] py-1 px-2">
                            Resend decision email
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {canManageReq && <button data-testid={`update-status-${r.id}`} onClick={() => setStatusEdit({...r})} className="btn btn-secondary text-[10px] py-1 px-2"><PencilSimple size={12}/></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </section>

        {!managerView && (
        <aside className="req-panel-sidebar card requests-page-panel">
          <div className="requests-page-panel-head px-3 pt-3 sm:px-4">
            <Briefcase size={22} weight="duotone" className="shrink-0" />
            <div>
              <h2>Request Types</h2>
              <p>What therapists can submit</p>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {TYPES.map(t => (
              <div key={t.id} className="flex items-start gap-2 text-xs">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${t.color}22`, color: t.color }}>{t.icon}</span>
                <div>
                  <div className="font-bold" style={{ color: "#2C3625" }}>{t.label}</div>
                  <div style={{ color: "var(--brand-sage)" }}>
                    {t.id === "supplies" && "Materials, toys, or classroom items"}
                    {t.id === "requirements" && "Equipment, tools, or operational needs"}
                    {t.id === "government" && "Government letters, HR documents, or official paperwork"}
                    {t.id === "schedule_change" && "Session time or day adjustments"}
                    {t.id === "reward" && "Recognition or bonus requests"}
                    {t.id === "general" && "Other staff-related needs"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {leaveHr && (
            <>
              <div className="requests-page-panel-head px-3 pt-3 sm:px-4 border-t border-[#E2DDD4]">
                <CalendarBlank size={22} weight="duotone" className="shrink-0" />
                <div>
                  <h2>Recent Leave Requests</h2>
                  <p>Approve or reject from here</p>
                </div>
              </div>
              <div className="req-panel-list">
                {recentLeaves.length === 0 && (
                  <div className="requests-page-empty" style={{ padding: "1.5rem 1rem" }}>
                    <p className="requests-page-empty-text m-0">No leave requests yet.</p>
                  </div>
                )}
                {recentLeaves.map(l => {
                  const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                  const tp = LEAVE_TYPES[l.leave_type] || { label: l.leave_type, color: "var(--brand-sage)" };
                  return (
                    <div key={l.id} className="req-item">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="pill text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                        <span className="pill text-[10px]" style={{ background: `${tp.color}20`, color: tp.color }}>{tp.label}</span>
                      </div>
                      <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{l.therapist_name || "Therapist"}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {fmtLeaveSchedule(l)}
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
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>
        )}
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
                {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
              </select>
            </FormField>
            <FormField label="Type">
              <select className="modal-input" value={leaveModal.leave_type} onChange={e => {
                const leave_type = e.target.value;
                const next = { ...leaveModal, leave_type };
                if (leave_type === "Permission") {
                  next.start_date = leaveModal.start_date;
                  next.end_date = leaveModal.end_date;
                  next.days = permissionDaysFromTimes(
                    leaveModal.start_time || "14:00",
                    leaveModal.end_time || "15:00",
                    leaveModal.start_date,
                    leaveModal.end_date,
                  );
                } else {
                  next.days = Math.max(1, diffDays(leaveModal.start_date, leaveModal.end_date));
                }
                setLeaveModal(next);
              }}>
                {LEAVE_FORM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </FormField>
            {leaveModal.leave_type === "Permission" ? (
              <>
                <FormField label="Date">
                  <input type="date" className="modal-input" value={leaveModal.start_date}
                    onChange={e => setLeaveModal(f => updateLeaveDates({ ...f, end_date: e.target.value }, e.target.value, e.target.value))} />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Start time" required>
                    <input type="time" className="modal-input" value={leaveModal.start_time || ""}
                      onChange={e => setLeaveModal(f => updateLeavePermissionTimes(f, e.target.value, f.end_time))} />
                  </FormField>
                  <FormField label="End time" required>
                    <input type="time" className="modal-input" value={leaveModal.end_time || ""}
                      onChange={e => setLeaveModal(f => updateLeavePermissionTimes(f, f.start_time, e.target.value))} />
                  </FormField>
                </div>
                <FormField label="Quick duration">
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setLeaveModal(f => updateLeavePermissionTimes(
                          f,
                          f.start_time || "14:00",
                          addHoursToTime24(f.start_time || "14:00", h),
                        ))}
                        className="pill border text-xs px-3 py-1.5 border-[#DDD8D0]"
                      >
                        {h} hour{h !== 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </FormField>
              </>
            ) : (
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
            )}
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
                <UploadSimple size={16}/> {leaveDoc ? leaveDoc.name : "Upload Document (optional)"}
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
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: i <= step ? "var(--brand)" : "#EDE9E3" }} />
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
                      className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all hover:bg-[#E5EBE1]/30 ${edit.request_type === t.id ? "border-[var(--brand)] bg-[#E5EBE1]" : ""}`}
                      style={{ borderColor: edit.request_type === t.id ? "var(--brand)" : "#DDD8D0" }}
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

      {/* Update status / manager review */}
      {statusEdit && (
        <ModalBase
          title={
            managerView
              ? (statusEdit._managerReviewable ? "Review Request" : "Request Status")
              : (statusEdit.title || "Update Request")
          }
          subtitle={
            managerView
              ? statusEdit._queueKind === "leave"
                ? `${statusEdit.therapist_name || "Therapist"} · ${statusEdit.typeLabel || "Leave"} · ${fmtLeaveSchedule(statusEdit._leave || {})}`
                : `${statusEdit.therapist_name || "Therapist"} · ${TYPES.find(t => t.id === statusEdit.request_type)?.label || statusEdit.request_type}`
              : `${STATUS_MAP[statusEdit.status]?.label || statusEdit.status} · ${statusEdit.created_at ? new Date(statusEdit.created_at).toLocaleDateString("en-US") : ""}`
          }
          onClose={closeStatusModal}
          size="md"
          footer={
            inManagerReviewMode && (adminManagerPreview || statusEdit._managerReviewable) && !queueItemAwaitingAttachment(statusEdit) ? (
              <>
                <ModalBtnSecondary type="button" onClick={closeStatusModal}>Cancel</ModalBtnSecondary>
                <ModalBtnPrimary data-testid="status-save-btn" type="button" onClick={handleManagerStatusSave}>
                  Save decision
                </ModalBtnPrimary>
              </>
            ) : (
              <>
                <ModalBtnSecondary type="button" onClick={closeStatusModal}>{managerView ? "Close" : "Cancel"}</ModalBtnSecondary>
                {!managerView && (
                  <ModalBtnPrimary data-testid="status-save-btn" type="button" onClick={handleManagerStatusSave}>Save & Notify</ModalBtnPrimary>
                )}
              </>
            )
          }
        >
          <>
              {!managerView && (
                <p className="text-sm -mt-2 mb-2" style={{ color: "var(--text-secondary)" }}>The therapist will be auto-notified.</p>
              )}
              {managerView && statusEdit._managerReviewable && (
                <p className="text-sm -mt-2 mb-2" style={{ color: "var(--text-secondary)" }}>
                  Choose Approve, Pending, or Reject. Optionally notify HR for follow-up or notify the therapist directly.
                </p>
              )}
              {managerView && !statusEdit._managerReviewable && (
                <p className="text-sm -mt-2 mb-2" style={{ color: "var(--text-secondary)" }}>
                  Current decision status for this request. Further changes may be handled by HR.
                </p>
              )}
              {queueItemAwaitingAttachment(statusEdit) && (
                <div className="rounded-xl p-3 mb-3 text-xs font-semibold border" style={{ background: "#F8EBE7", borderColor: "#ECA6A6", color: "#8A3F27" }}>
                  Awaiting attachment — request will NOT be reviewed until the therapist uploads a file.
                </div>
              )}

              <FormSection title="Request Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                  {statusEdit.therapist_name && (
                    <div className="rounded-xl p-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-sage)" }}>Therapist</div>
                      <div className="font-semibold" style={{ color: "#2C3625" }}>{statusEdit.therapist_name}</div>
                    </div>
                  )}
                  <div className="rounded-xl p-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-sage)" }}>Type</div>
                    <div className="font-semibold" style={{ color: "#2C3625" }}>
                      {statusEdit._queueKind === "leave"
                        ? statusEdit.typeLabel
                        : (TYPES.find(t => t.id === statusEdit.request_type)?.label || statusEdit.request_type)}
                    </div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-sage)" }}>Submitted</div>
                    <div className="font-semibold" style={{ color: "#2C3625" }}>{fmtShortDate(statusEdit.created_at)}</div>
                  </div>
                  {statusEdit.priority && (
                    <div className="rounded-xl p-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-sage)" }}>Priority</div>
                      <div className="font-semibold" style={{ color: "#2C3625" }}>{PRIORITIES.find(p => p.id === statusEdit.priority)?.label || statusEdit.priority}</div>
                    </div>
                  )}
                  {(statusEdit.date_from || statusEdit.date_to) && (
                    <div className="rounded-xl p-3 sm:col-span-2" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-sage)" }}>Dates</div>
                      <div className="font-semibold" style={{ color: "#2C3625" }}>
                        {statusEdit.date_from || "—"}{statusEdit.date_to ? ` → ${statusEdit.date_to}` : ""}
                      </div>
                    </div>
                  )}
                </div>

                {statusEdit._queueKind === "leave" && statusEdit._leave && (
                  <div className="rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Schedule</div>
                    <div className="font-semibold" style={{ color: "#1C2617" }}>{fmtLeaveSchedule(statusEdit._leave)}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--brand-sage)" }}>{statusEdit._leave.days} day(s)</div>
                  </div>
                )}

                {statusEdit._queueKind !== "leave" && (
                <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Subject</div>
                  <div className="font-semibold" style={{ color: "#1C2617" }}>{statusEdit.title}</div>
                </div>
                )}

                {statusEdit._queueKind === "leave" && statusEdit._leave?.notes && (
                  <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Note</div>
                    <div style={{ color: "#1C2617" }}>{statusEdit._leave.notes}</div>
                  </div>
                )}

                {statusEdit._queueKind !== "leave" && statusEdit.description && (
                  <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Description</div>
                    <div style={{ color: "#1C2617" }}>{statusEdit.description}</div>
                  </div>
                )}

                {statusEdit.extra_notes && (
                  <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Additional notes</div>
                    <div style={{ color: "#1C2617" }}>{statusEdit.extra_notes}</div>
                  </div>
                )}

                {statusEdit.reward_type && (
                  <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Reward type</div>
                    <div style={{ color: "#1C2617" }}>{REWARD_TYPES.find(r => r.id === statusEdit.reward_type)?.label || statusEdit.reward_type}</div>
                  </div>
                )}

                {statusEdit._leave?.document_file_path && (
                  <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Attachment</div>
                    <button
                      type="button"
                      onClick={() => viewProtectedFile(`${API}/leaves/${statusEdit.leaveId}/document`)}
                      className="inline-flex items-center gap-1 font-semibold underline"
                      style={{ color: "var(--brand)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      <FileArrowDown size={14}/> View attachment (read-only)
                    </button>
                  </div>
                )}

                {statusEdit.attachment_url && (
                  <div className="text-sm rounded-xl p-3 mb-3" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>Attachment</div>
                    {statusEdit.report_date && (
                      <div className="text-xs mb-1" style={{ color: "var(--brand-sage)" }}>Report date: {fmtShortDate(statusEdit.report_date)}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => viewProtectedFile(`${API}/requests/${statusEdit.id}/attachment`)}
                      className="inline-flex items-center gap-1 font-semibold underline"
                      style={{ color: "var(--brand)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      <FileArrowDown size={14}/> View attachment (read-only)
                    </button>
                  </div>
                )}

                {statusEdit.timeline?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>History</div>
                    {statusEdit.timeline.map((ev, i) => (
                      <div key={i} className="text-xs py-2 border-b last:border-0" style={{ borderColor: "#EDE9E3" }}>
                        <span className="font-bold" style={{ color: "#1C2617" }}>{ev.event}</span>
                        <span style={{ color: "#9CA3AF" }}> · {ev.by} · {new Date(ev.at).toLocaleString("en-US")}</span>
                        {ev.note && <div className="italic mt-0.5" style={{ color: "var(--text-secondary)" }}>"{ev.note}"</div>}
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>

              {managerView && !statusEdit._managerReviewable && !queueItemAwaitingAttachment(statusEdit) && (
                <FormSection title="Status">
                  <ManagerStatusGrid
                    readOnly
                    activeKey={managerTrackingStatusKey(statusEdit.status)}
                  />
                  <div className="rounded-xl p-3 text-sm" style={{ background: "#F5F2ED", border: "1px solid #E2DDD4" }}>
                    <div className="flex justify-between gap-2">
                      <span style={{ color: "#9CA3AF" }}>Portal status</span>
                      <strong style={{ color: "#2C3625" }}>
                        {STATUS_MAP[statusEdit.status]?.label || statusEdit.status}
                      </strong>
                    </div>
                    {statusEdit.status === "pending_hr" && (
                      <div className="text-xs mt-2" style={{ color: "#6B5218" }}>
                        Forwarded to HR — awaiting HR decision.
                      </div>
                    )}
                  </div>
                </FormSection>
              )}

              {(!managerView || inManagerReviewMode && statusEdit._managerReviewable) && !queueItemAwaitingAttachment(statusEdit) && (
                <FormSection title={inManagerReviewMode ? "Your decision" : "Status"}>
                  {inManagerReviewMode ? (
                    <ManagerStatusGrid
                      activeKey={statusEdit.status}
                      onSelect={(k) => setStatusEdit({ ...statusEdit, status: k })}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {allowedStatusOptions(user, statusEdit.status).map(k => {
                        const v = STATUS_MAP[k] || STATUS_MAP.pending;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setStatusEdit({ ...statusEdit, status: k })}
                            className={`pill border-2 justify-start py-2 ${statusEdit.status === k ? "ring-2 ring-[var(--brand)]" : ""} ${v.cls}`}
                          >
                            {v.icon} {v.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <FormField
                    label={inManagerReviewMode ? "Manager note" : "Response / note"}
                    hint={inManagerReviewMode ? "Optional — include context for HR or therapist" : "Optional"}
                    required={false}
                  >
                    <textarea
                      className="modal-input"
                      rows={3}
                      value={statusEdit.admin_note || ""}
                      onChange={e => setStatusEdit({ ...statusEdit, admin_note: e.target.value })}
                      placeholder={inManagerReviewMode ? "Add notes if needed…" : ""}
                      style={inManagerReviewMode ? { background: "#FAFAF7", borderColor: "#E2DDD4" } : undefined}
                    />
                  </FormField>

                  {inManagerReviewMode && statusEdit._managerReviewable && (
                    <div
                      className="space-y-3 mt-3 pt-3 rounded-xl p-3"
                      style={{ borderTop: "1px solid #E2DDD4", background: "#FAFAF7" }}
                    >
                      <div className="text-xs" style={{ color: "#3D4F35" }}>
                        Manager step always forwards to HR. HR will send the final email to the therapist.
                      </div>
                    </div>
                  )}

                </FormSection>
              )}

              {inManagerReviewMode && !statusEdit._managerReviewable && statusEdit._queueKind !== "leave" && (
                <div className="text-sm rounded-xl p-3" style={{ background: "#FAF0D1", color: "#6B5218", border: "1px solid #E2DDD4" }}>
                  This request has been forwarded to HR. Further status changes are handled by HR.
                </div>
              )}

              {inManagerReviewMode && !statusEdit._managerReviewable && statusEdit._queueKind === "leave" && statusEdit.status === "pending_hr" && (
                <div className="text-sm rounded-xl p-3" style={{ background: "#FAF0D1", color: "#6B5218" }}>
                  This leave request has been forwarded to HR. Further status changes are handled by HR.
                </div>
              )}
          </>
        </ModalBase>
      )}
    </>
  );

  if (embedded) {
    return <div>{pageShell}</div>;
  }

  return (
    <div className="requests-page" dir="ltr">
      {pageShell}
    </div>
  );
}
