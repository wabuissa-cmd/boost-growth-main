import { useState } from "react";
import api, { toISODate } from "../api";
import { resolveSessionTherapistIds } from "../attendanceUtils";
import { hasFullClientAccess, isHrOps } from "../auth";
import {
  CheckCircle, Warning, XCircle, Clock, MapPin,
} from "@phosphor-icons/react";
import { resolveSelfTherapist } from "../scheduleUtils";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";
import { getTherapistScheduleName } from "../scheduleConstants";

const STATUS_OPTS = [
  { id: "Completed", label: "Completed", icon: CheckCircle, color: "#3D4F35", bg: "#E5EBE1" },
  { id: "Cancelled", label: "Cancelled", icon: Warning, color: "#6B5218", bg: "#FAF0D1" },
  { id: "No Show", label: "No Show", icon: XCircle, color: "#8A3F27", bg: "#F8EBE7" },
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

export default function LogSessionModal({
  client, therapists, currentUser, onClose, onSaved, session, prefill, scheduleContext,
}) {
  const defaultLoc = client?.locations?.[0];
  const initialSvc = prefill?.service_type || defaultLoc?.service || client?.service_type || "HS";
  const selfTherapistId = resolveSelfTherapist(currentUser, therapists)?.id;
  const canPickAnyDate = hasFullClientAccess(currentUser) || isHrOps(currentUser);
  const todayISO = toISODate(new Date());
  const [form, setForm] = useState(() => {
    if (session) return { ...session };
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

  const submit = async (e) => {
    e.preventDefault();
    if (!canPickAnyDate && (form.session_date || "").slice(0, 10) !== todayISO) {
      alert("التحضير مسموح فقط في يوم الجلسة.\nPreparation is only allowed on the session day.");
      return;
    }
    if (form.status === "No Service") {
      alert("No Service is no longer available. Choose Completed, Cancelled, or No Show.");
      return;
    }
    const payload = { ...form, hours: computeHours(form.start_time, form.end_time) };
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
        });
      } catch {
        /* session save succeeded; schedule marker may still sync from backend */
      }
    }
    onSaved();
  };

  const toggleT = (id) => {
    setForm(f => ({
      ...f,
      therapist_ids: f.therapist_ids.includes(id) ? f.therapist_ids.filter(x => x !== id) : [...f.therapist_ids, id],
    }));
  };

  const formId = session ? "edit-session-form" : "log-session-form";
  const hours = computeHours(form.start_time, form.end_time);

  return (
    <ModalBase
      title={session ? "Edit Session" : "Log Session"}
      subtitle={session ? "Update session details" : "Record attendance for this session"}
      onClose={onClose}
      size="lg"
      mobileCompact
      footer={(
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary data-testid="sess-save" type="submit" form={formId}>
            {session ? "Save changes" : "Log Session"}
          </ModalBtnPrimary>
        </>
      )}
    >
      <form id={formId} onSubmit={submit}>
        {client && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4" style={{ background: "#F0E9D8", border: "1px solid #E2DDD4" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ background: client.color || "#7A8A6A" }}>
              {client.name?.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{client.name}</div>
              <div className="ui-caption">File #{client.file_no || "—"}</div>
            </div>
          </div>
        )}
        <FormSection title="Status">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUS_OPTS.filter(s => s.id !== "No Service").map(s => {
              const Icon = s.icon;
              const active = form.status === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm({ ...form, status: s.id })}
                  className={`px-2 py-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${active ? "ring-2 ring-[#7A8A6A]" : ""}`}
                  style={{ background: s.bg, borderColor: active ? "#7A8A6A" : "#E2DDD4", color: s.color }}
                >
                  <Icon size={20} weight="fill" />
                  <span className="text-[11px] font-bold leading-tight text-center">{s.label}</span>
                </button>
              );
            })}
          </div>
        </FormSection>
        <FormSection title="When & where">
          {client?.locations?.length > 0 && (
            <FormField label="Service / location">
              <select data-testid="sess-location" className="modal-input" value={form.location}
                onChange={e => {
                  const loc = client.locations.find(l => l.address === e.target.value);
                  const svc = loc?.service || form.service_type || "HS";
                  setForm({
                    ...form,
                    location: e.target.value,
                    service_type: svc,
                    therapist_ids: resolveSessionTherapistIds(client, svc, currentUser, selfTherapistId),
                  });
                }}>
                {client.locations.map((l, i) => (
                  <option key={i} value={l.address}>{l.service} · {l.address}</option>
                ))}
              </select>
            </FormField>
          )}
          {(!client?.locations?.length) && (
            <FormField label="Service type">
              <select className="modal-input" value={form.service_type || "HS"}
                onChange={e => {
                  const svc = e.target.value;
                  setForm({
                    ...form,
                    service_type: svc,
                    therapist_ids: resolveSessionTherapistIds(client, svc, currentUser, selfTherapistId),
                  });
                }}>
                <option value="HS">Home Session (HS)</option>
                <option value="SS">School Support (SS)</option>
              </select>
            </FormField>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Date" required>
              <input
                data-testid="sess-date"
                type="date"
                className="modal-input"
                required
                value={form.session_date}
                min={canPickAnyDate ? undefined : todayISO}
                max={canPickAnyDate ? undefined : todayISO}
                readOnly={!canPickAnyDate && !session}
                onChange={e => setForm({ ...form, session_date: e.target.value })}
              />
            </FormField>
            <FormField label="From">
              <input type="time" className="modal-input" value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </FormField>
            <FormField label="To">
              <input type="time" className="modal-input" value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </FormField>
          </div>
          <p className="ui-caption flex items-center gap-1 mt-1">
            <Clock size={12} /> Duration: <strong>{hours}h</strong>
          </p>
        </FormSection>
        <FormSection title="Therapist">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.therapist_ids.map(id => {
              const t = therapists.find(x => x.id === id);
              if (!t) return null;
              return (
                <span key={id} className="pill px-2.5 py-1 text-[11px]" style={{ background: t.color, color: "white" }}>
                  {getTherapistScheduleName(t)}
                  <button type="button" onClick={() => toggleT(id)} className="ml-1 opacity-80">✕</button>
                </span>
              );
            })}
          </div>
          <select className="modal-input text-sm" value="" onChange={e => { if (e.target.value) toggleT(e.target.value); e.target.value = ""; }}>
            <option value="">+ Add co-therapist</option>
            {therapists.filter(t => !form.therapist_ids.includes(t.id)).map(t => (
              <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>
            ))}
          </select>
        </FormSection>
        <FormSection title="Notes">
          <textarea className="modal-input text-sm" rows={2} placeholder="Optional note…" value={form.note || ""}
            onChange={e => setForm({ ...form, note: e.target.value })} />
        </FormSection>
      </form>
    </ModalBase>
  );
}
