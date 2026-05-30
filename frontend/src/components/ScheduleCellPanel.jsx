import { useState } from "react";
import { X, FloppyDisk } from "@phosphor-icons/react";
import { DAYS_EN, TIME_SLOTS, SERVICE_CODES } from "../api";
import { SERVICE_CELL_COLORS, resolveClientScheduleColor } from "../scheduleUtils";
import { ModalBtnPrimary, ModalBtnSecondary } from "./Modal";

const STATES = [
  { id: "normal", label: "Normal", swatch: "#E5EBE1" },
  { id: "cancel_therapist", label: "Therapist Cancel", swatch: "#FFF4C4" },
  { id: "cancel_child", label: "Client Cancel", swatch: "#FCE0E8" },
];

const META_CODES = new Set(["LEAVE", "BREAK", "AVC", "AVAILABLE", "MEETING", "SUPERVISION", "OBSERVATION"]);

export default function ScheduleCellPanel({
  form,
  setForm,
  onClose,
  onSave,
  therapists,
  clients,
  saving,
}) {
  if (!form) return null;

  const therapist = therapists.find(t => t.id === form.therapist_id);
  const previewColor = form.service_code === "AVAILABLE" || form.state === "available"
    ? "#FFFFFF"
    : form.color || resolveClientScheduleColor(form.child_name, clients)
      || SERVICE_CELL_COLORS[form.service_code]?.background || "#E5EBE1";

  const pickService = (code) => {
    if (code === "AVAILABLE") {
      setForm(f => ({
        ...f, service_code: "AVAILABLE", state: "available", color: "#FFFFFF",
        child_name: null, note: "Available",
      }));
    } else if (code === "LEAVE") {
      setForm(f => ({
        ...f, service_code: "LEAVE", state: "normal", color: SERVICE_CELL_COLORS.LEAVE.background,
        child_name: null, note: f.note || "Leave",
      }));
    } else {
      setForm(f => ({ ...f, service_code: code, state: "normal" }));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 no-print" onClick={onClose} aria-hidden />
      <aside
        className="schedule-cell-panel fixed top-0 right-0 z-50 h-[100dvh] w-full max-w-[420px] flex flex-col shadow-2xl no-print"
        style={{ background: "#FFFFFF", borderLeft: "1px solid #EDE9E3" }}
      >
        <div className="px-5 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight" style={{ color: "#1C2617" }}>
                {form.id ? "Edit Session" : "Add Session"}
              </h2>
              <p className="text-xs mt-1" style={{ color: "#8B9E7A" }}>
                {therapist?.name} · {DAYS_EN[form.day]} · {form.time_slot}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white transition" style={{ color: "#9CA3AF" }}>
              <X size={22} weight="bold" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg border flex-shrink-0" style={{ background: previewColor, borderColor: "#DDD8D0" }} />
            <div className="text-xs" style={{ color: "#5C6853" }}>
              {form.state === "available" || form.service_code === "AVAILABLE"
                ? "Available"
                : form.child_name || form.note || SERVICE_CODES.find(s => s.id === form.service_code)?.short || "Session"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {SERVICE_CODES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickService(s.id)}
                    className={`pill ${s.cls} justify-center py-1.5 text-[11px] ${form.service_code === s.id ? "ring-2 ring-[#5C8A47]" : ""}`}
                  >
                    {s.short}
                  </button>
                ))}
              </div>
            </div>

            {!META_CODES.has(form.service_code) && form.state !== "available" && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Client name</label>
                <input
                  data-testid="cell-child-input"
                  className="modal-input"
                  list="panel-clients-list"
                  value={form.child_name || ""}
                  onChange={e => setForm(f => ({ ...f, child_name: e.target.value, color: null }))}
                  placeholder="Select or type..."
                />
                <datalist id="panel-clients-list">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Custom time</label>
                <input
                  className="modal-input"
                  placeholder="2:30-4:30"
                  value={form.custom_time || ""}
                  onChange={e => setForm(f => ({ ...f, custom_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Duration (hours)</label>
                <select
                  className="modal-input"
                  value={form.duration || 1}
                  onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value, 10) }))}
                >
                  {TIME_SLOTS.map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1} slot{i > 0 ? "s" : ""} ({i + 1}h)</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Note</label>
              <input className="modal-input" value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            {form.id && form.state !== "available" && form.service_code !== "AVAILABLE" && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {STATES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, state: s.id }))}
                      className={`pill text-xs px-2 py-1 ${form.state === s.id ? "ring-2 ring-[#5C8A47]" : ""}`}
                      style={{ background: s.swatch, color: "#2C3625" }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-4 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          <ModalBtnSecondary type="button" className="flex-1" onClick={onClose}>Close</ModalBtnSecondary>
          <ModalBtnPrimary type="button" className="flex-1" data-testid="cell-save-btn" onClick={onSave} disabled={saving}>
            <FloppyDisk size={16} className="inline mr-1" />
            {saving ? "Saving..." : "Save"}
          </ModalBtnPrimary>
        </div>
      </aside>
    </>
  );
}
