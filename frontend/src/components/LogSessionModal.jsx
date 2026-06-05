import { useState } from "react";
import api from "../api";
import {
  CheckCircle, Prohibit, Warning, XCircle, Clock, MapPin,
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";

const STATUS_OPTS = [
  { id: "Completed", label: "Completed", icon: CheckCircle, color: "#3D4F35", bg: "#E5EBE1" },
  { id: "No Service", label: "No Service", icon: Prohibit, color: "#5C6853", bg: "#F0EDE9" },
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
  client, therapists, currentUser, onClose, onSaved, session, prefill,
}) {
  const defaultLoc = client?.locations?.[0];
  const [form, setForm] = useState(() => {
    if (session) return { ...session };
    const start = prefill?.start_time || "14:00";
    const end = prefill?.end_time || "16:00";
    return {
      client_id: client?.id,
      session_date: prefill?.session_date || new Date().toISOString().slice(0, 10),
      start_time: start,
      end_time: end,
      hours: computeHours(start, end),
      status: "Completed",
      therapist_ids: currentUser?.role === "therapist" ? [currentUser.id] : [client?.main_therapist_id].filter(Boolean),
      note: prefill?.note || "",
      location: prefill?.location || defaultLoc?.address || "",
      service_type: prefill?.service_type || defaultLoc?.service || client?.service_type || "HS",
    };
  });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, hours: computeHours(form.start_time, form.end_time) };
    if (session?.id) await api.put(`/sessions/${session.id}`, payload);
    else await api.post("/sessions", payload);
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
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4" style={{ background: "#F0E9D8", border: "1px solid #E8E4DE" }}>
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
            {STATUS_OPTS.map(s => {
              const Icon = s.icon;
              const active = form.status === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm({ ...form, status: s.id })}
                  className={`px-2 py-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${active ? "ring-2 ring-[#7A8A6A]" : ""}`}
                  style={{ background: s.bg, borderColor: active ? "#7A8A6A" : "#E8E4DE", color: s.color }}
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
                  setForm({ ...form, location: e.target.value, service_type: loc?.service || form.service_type || "HS" });
                }}>
                {client.locations.map((l, i) => (
                  <option key={i} value={l.address}>{l.service} · {l.address}</option>
                ))}
              </select>
            </FormField>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Date" required>
              <input data-testid="sess-date" type="date" className="modal-input" required value={form.session_date}
                onChange={e => setForm({ ...form, session_date: e.target.value })} />
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
                  {t.name?.replace("Ms. ", "")}
                  <button type="button" onClick={() => toggleT(id)} className="ml-1 opacity-80">✕</button>
                </span>
              );
            })}
          </div>
          <select className="modal-input text-sm" value="" onChange={e => { if (e.target.value) toggleT(e.target.value); e.target.value = ""; }}>
            <option value="">+ Add co-therapist</option>
            {therapists.filter(t => !form.therapist_ids.includes(t.id)).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
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
