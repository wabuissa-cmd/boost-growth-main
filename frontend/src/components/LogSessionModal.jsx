import { useState } from "react";
import api, { toISODate, formatErr } from "../api";
import { invalidateCache } from "../dataCache";
import {
  resolveSessionTherapistIds,
  mergeSessionTherapistIds,
  buildSessionPayload,
} from "../attendanceUtils";
import { hasFullClientAccess, isHrOps } from "../auth";
import {
  CheckCircle, Warning, XCircle, Clock,
} from "@phosphor-icons/react";
import { resolveSelfTherapist } from "../scheduleUtils";
import { resolveLogSessionTimes } from "../scheduleTimeUtils";
import {
  ModalBase, ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";
import { getTherapistScheduleName } from "../scheduleConstants";

export { slotToTime24, addHoursToTime, scheduleCellSessionTimes } from "../scheduleTimeUtils";

const ALLOWED_SESSION_STATUSES = new Set(["Completed", "Cancelled", "No Show"]);

function normalizeSessionStatus(status) {
  if (!status || status === "No Service") return "Completed";
  return ALLOWED_SESSION_STATUSES.has(status) ? status : "Completed";
}

const STATUS_OPTS = [
  { id: "Completed", label: "Completed", icon: CheckCircle, color: "#3D4F35", bg: "#E5EBE1", border: "#B8C8A8" },
  { id: "Cancelled", label: "Cancelled", icon: Warning, color: "#6B5218", bg: "#FAF0D1", border: "#E5C387" },
  { id: "No Show", label: "No Show", icon: XCircle, color: "#8A3F27", bg: "#F8EBE7", border: "#E8A898" },
];

function computeHours(st, et) {
  if (!st || !et) return 0;
  const [h1, m1] = st.split(":").map(Number);
  const [h2, m2] = et.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return Math.round(diff / 30) / 2;
}

function FieldLabel({ children, required }) {
  return (
    <label className="log-session-label">
      {children}
      {required && <span className="log-session-required"> *</span>}
    </label>
  );
}

export default function LogSessionModal({
  client, therapists, currentUser, onClose, onSaved, session, prefill, scheduleContext,
}) {
  const defaultLoc = client?.locations?.[0];
  const initialSvc = prefill?.service_type || defaultLoc?.service || client?.service_type || "HS";
  const selfTherapistId = resolveSelfTherapist(currentUser, therapists)?.id;
  const canPickAnyDate = hasFullClientAccess(currentUser) || isHrOps(currentUser);
  const todayISO = toISODate(new Date());
  const [form, setForm] = useState(() => {
    if (session) {
      const st = session.status === "No Service" ? "Completed" : session.status;
      return {
        ...session,
        status: st,
        therapist_ids: [...new Set((session.therapist_ids || []).filter(Boolean))],
        note: session.note || "",
      };
    }
    const { start_time: start, end_time: end } = resolveLogSessionTimes({ prefill, scheduleContext });
    return {
      client_id: client?.id,
      session_date: prefill?.session_date || scheduleContext?.session_date || toISODate(new Date()),
      start_time: start,
      end_time: end,
      hours: computeHours(start, end),
      status: "Completed",
      therapist_ids: resolveSessionTherapistIds(client, initialSvc, currentUser, selfTherapistId),
      note: prefill?.note || "",
      location: prefill?.location || defaultLoc?.address || "",
      service_type: initialSvc,
    };
  });

  const [saving, setSaving] = useState(false);
  const [coPickOpen, setCoPickOpen] = useState(false);

  const applyServiceChange = (next) => {
    setForm((f) => {
      const defaults = resolveSessionTherapistIds(client, next.service_type, currentUser, selfTherapistId);
      return { ...f, ...next, therapist_ids: mergeSessionTherapistIds(f.therapist_ids, defaults) };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!canPickAnyDate && (form.session_date || "").slice(0, 10) !== todayISO) {
      alert("Preparation is only allowed on the session day until 11:59 PM.\nالتحضير مسموح فقط في يوم الجلسة حتى 11:59 مساءً.");
      return;
    }
    if (form.status === "No Service") {
      alert("No Service is no longer available. Choose Completed, Cancelled, or No Show.");
      return;
    }
    const payload = buildSessionPayload(
      { ...form, status: normalizeSessionStatus(form.status) },
      client?.id,
    );
    if (scheduleContext?.therapist_id) {
      payload.therapist_ids = mergeSessionTherapistIds(
        [scheduleContext.therapist_id],
        payload.therapist_ids,
      );
    }
    if (!payload.therapist_ids?.length) {
      alert("Please select at least one therapist for this session.");
      return;
    }
    if (!form.start_time || !form.end_time) {
      alert("Start and end time are required.\nوقت البداية والنهاية مطلوبان.");
      return;
    }
    if (!(payload.note || "").trim()) {
      alert("Session notes are required before saving.\nملاحظات الجلسة مطلوبة قبل الحفظ.");
      return;
    }
    setSaving(true);
    try {
      if (session?.id) await api.put(`/sessions/${session.id}`, payload);
      else await api.post("/sessions", payload);
      invalidateCache("/sessions");
      invalidateCache("/schedule/preparations");
      invalidateCache("/schedule");
      window.dispatchEvent(new CustomEvent("boost:prep-changed"));
      onSaved({
        ...form,
        status: normalizeSessionStatus(form.status),
        start_time: form.start_time,
        end_time: form.end_time,
        note: form.note,
      });
    } catch (err) {
      const status = err?.response?.status;
      const detail = formatErr(err?.response?.data?.detail);
      if (status === 409) {
        alert(detail || "A session for this day already exists on this invoice. Open the invoice sheet and edit the existing row.");
      } else {
        alert(detail || "Could not save session. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleT = (id) => {
    setForm(f => ({
      ...f,
      therapist_ids: f.therapist_ids.includes(id) ? f.therapist_ids.filter(x => x !== id) : [...f.therapist_ids, id],
    }));
  };

  const formId = session ? "edit-session-form" : "log-session-form";
  const hours = computeHours(form.start_time, form.end_time);
  const availableCoTherapists = therapists.filter(t => !form.therapist_ids.includes(t.id));
  const clientSubtitle = client
    ? `${client.name}${client.file_no ? ` · #${client.file_no}` : ""}`
    : undefined;

  return (
    <ModalBase
      className="log-session-modal"
      shellClassName="log-session-shell"
      bodyClassName="log-session-body"
      title={session ? "Edit Session" : "Log Session"}
      subtitle={clientSubtitle}
      onClose={onClose}
      size="session"
      mobileCompact
      compact
      footer={(
        <div className="log-session-footer">
          <ModalBtnSecondary type="button" className="log-session-btn-secondary" onClick={onClose}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary data-testid="sess-save" type="submit" form={formId} className="log-session-btn-primary" disabled={saving}>
            {saving ? "Saving…" : (session ? "Save" : "Log Session")}
          </ModalBtnPrimary>
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} className="log-session-form">
        <div className="log-session-status-row" role="group" aria-label="Session status">
          {STATUS_OPTS.map(s => {
            const Icon = s.icon;
            const active = form.status === s.id;
            return (
              <button
                key={s.id}
                type="button"
                data-testid={`sess-status-${s.id.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setForm({ ...form, status: s.id })}
                className={`log-session-status-btn log-session-status-btn--${s.id.toLowerCase().replace(/\s+/g, "-")}${active ? " is-active" : ""}`}
                style={{
                  background: s.bg,
                  borderColor: active ? s.border : `${s.border}99`,
                  color: s.color,
                }}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="log-session-card">
          {client?.locations?.length > 0 ? (
            <div className="log-session-field">
              <FieldLabel>Location</FieldLabel>
              <select
                data-testid="sess-location"
                className="modal-input log-session-input"
                value={form.location}
                onChange={e => {
                  const loc = client.locations.find(l => l.address === e.target.value);
                  const svc = loc?.service || form.service_type || "HS";
                  applyServiceChange({ location: e.target.value, service_type: svc });
                }}
              >
                {client.locations.map((l, i) => (
                  <option key={i} value={l.address}>{l.service} · {l.address}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="log-session-field">
              <FieldLabel>Service</FieldLabel>
              <select
                className="modal-input log-session-input"
                value={form.service_type || "HS"}
                onChange={e => applyServiceChange({ service_type: e.target.value })}
              >
                <option value="HS">Home Session (HS)</option>
                <option value="SS">School Support (SS)</option>
              </select>
            </div>
          )}

          <div className="log-session-datetime">
            <div className="log-session-field">
              <FieldLabel required>Date</FieldLabel>
              <input
                data-testid="sess-date"
                type="date"
                className="modal-input log-session-input"
                required
                value={form.session_date}
                min={canPickAnyDate ? undefined : todayISO}
                max={canPickAnyDate ? undefined : todayISO}
                readOnly={!canPickAnyDate && !session}
                onChange={e => setForm({ ...form, session_date: e.target.value })}
              />
            </div>
            <div className="log-session-field">
              <FieldLabel required>From</FieldLabel>
              <input
                data-testid="sess-start-time"
                type="time"
                className="modal-input log-session-input"
                required
                value={form.start_time || ""}
                disabled={saving}
                onChange={e => setForm({ ...form, start_time: e.target.value, hours: computeHours(e.target.value, form.end_time) })}
              />
            </div>
            <div className="log-session-field">
              <FieldLabel required>To</FieldLabel>
              <input
                data-testid="sess-end-time"
                type="time"
                className="modal-input log-session-input"
                required
                value={form.end_time || ""}
                disabled={saving}
                onChange={e => setForm({ ...form, end_time: e.target.value, hours: computeHours(form.start_time, e.target.value) })}
              />
            </div>
          </div>

          <p className="log-session-duration">
            <Clock size={13} weight="duotone" />
            <span><strong>{hours}h</strong> duration</span>
          </p>
        </div>

        <div className="log-session-card">
          <FieldLabel>Therapist{form.therapist_ids.length > 1 ? "s" : ""}</FieldLabel>
          <div className="log-session-therapists">
            {form.therapist_ids.map(id => {
              const t = therapists.find(x => x.id === id);
              if (!t) return null;
              const isSelf = id === selfTherapistId || id === currentUser?.id;
              return (
                <span key={id} className="log-session-therapist-chip" style={{ background: t.color || "#7A8A6A" }}>
                  {getTherapistScheduleName(t)}
                  {!isSelf && (
                    <button type="button" onClick={() => toggleT(id)} aria-label="Remove therapist">×</button>
                  )}
                </span>
              );
            })}
          </div>
          {availableCoTherapists.length > 0 && (
            <div className="log-session-co-pick">
              <button
                type="button"
                className="log-session-add-co-btn"
                onClick={() => setCoPickOpen(v => !v)}
                aria-expanded={coPickOpen}
              >
                + Add co-therapist / supervisor
              </button>
              {coPickOpen && (
                <div className="log-session-co-list">
                  {availableCoTherapists.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className="log-session-co-option"
                      onClick={() => {
                        toggleT(t.id);
                        setCoPickOpen(false);
                      }}
                    >
                      <span className="log-session-co-dot" style={{ background: t.color || "#7A8A6A" }} />
                      {getTherapistScheduleName(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="log-session-card">
          <FieldLabel required>Session notes</FieldLabel>
          <textarea
            data-testid="sess-notes"
            className="modal-input log-session-input log-session-notes"
            rows={3}
            required
            placeholder="Required — what happened in this session / ما الذي تم في الجلسة"
            value={form.note || ""}
            onChange={e => setForm({ ...form, note: e.target.value })}
          />
          {scheduleContext && (
            <p className="text-[11px] m-0 mt-1.5 leading-relaxed" style={{ color: "#8B9E7A" }}>
              Notes are saved with the session and appear in preparation history.
            </p>
          )}
        </div>
      </form>
    </ModalBase>
  );
}
