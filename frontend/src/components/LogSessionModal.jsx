import { useState } from "react";
import api, { toISODate, formatErr } from "../api";
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
import {
  ModalBase, ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";
import { getTherapistScheduleName } from "../scheduleConstants";

const ALLOWED_SESSION_STATUSES = new Set(["Completed", "Cancelled", "No Show"]);

function normalizeSessionStatus(status) {
  if (!status || status === "No Service") return "Completed";
  return ALLOWED_SESSION_STATUSES.has(status) ? status : "Completed";
}

const STATUS_OPTS = [
  { id: "Completed", label: "Completed", icon: CheckCircle, color: "#3D4F35", bg: "#EEF3EA", border: "#C8D4BE" },
  { id: "Cancelled", label: "Cancelled", icon: Warning, color: "#6B5218", bg: "#FBF6E8", border: "#E8D9A8" },
  { id: "No Show", label: "No Show", icon: XCircle, color: "#8A3F27", bg: "#FAF0ED", border: "#E8C4B8" },
];

function computeHours(st, et) {
  if (!st || !et) return 0;
  const [h1, m1] = st.split(":").map(Number);
  const [h2, m2] = et.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return Math.round(diff / 30) / 2;
}

export function slotToTime24(slot) {
  if (!slot) return "08:00";
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return "08:00";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export function addHoursToTime(time24, hours) {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
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
    const start = prefill?.start_time || "14:00";
    const end = prefill?.end_time || "16:00";
    return {
      client_id: client?.id,
      session_date: prefill?.session_date || toISODate(new Date()),
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
      alert("التحضير مسموح فقط في يوم الجلسة.\nPreparation is only allowed on the session day.");
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
    if (!payload.therapist_ids?.length) {
      alert("Please select at least one therapist for this session.");
      return;
    }
    setSaving(true);
    try {
      if (session?.id) await api.put(`/sessions/${session.id}`, payload);
      else await api.post("/sessions", payload);
      if (scheduleContext?.therapist_id && client?.id && form.session_date) {
        try {
          await api.post("/schedule/preparations", {
            therapist_id: scheduleContext.therapist_id,
            client_id: client.id,
            session_date: form.session_date,
            time_slot: scheduleContext.time_slot || "",
            schedule_cell_id: scheduleContext.schedule_cell_id || null,
            week_start: scheduleContext.week_start || null,
            day: scheduleContext.day,
            notes: payload.note || "",
          });
        } catch {
          /* session saved; schedule marker may still sync from backend */
        }
      }
      onSaved();
    } catch (err) {
      alert(formatErr(err?.response?.data?.detail) || "Could not save session. Please try again.");
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
                className={`log-session-status-btn${active ? " is-active" : ""}`}
                style={{
                  background: active ? s.bg : "#FAFAF8",
                  borderColor: active ? s.border : "#E8E4DC",
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
              <FieldLabel>From</FieldLabel>
              <input
                type="time"
                className="modal-input log-session-input"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div className="log-session-field">
              <FieldLabel>To</FieldLabel>
              <input
                type="time"
                className="modal-input log-session-input"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
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

        <div className="log-session-field">
          <FieldLabel>Notes</FieldLabel>
          <textarea
            className="modal-input log-session-input log-session-notes"
            rows={2}
            placeholder="Optional…"
            value={form.note || ""}
            onChange={e => setForm({ ...form, note: e.target.value })}
          />
        </div>
      </form>
    </ModalBase>
  );
}
