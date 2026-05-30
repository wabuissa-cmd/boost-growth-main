import { useState } from "react";
import {
  X, CaretDown, CaretUp, FloppyDisk, Trash, Copy, BellRinging,
  ArrowLeft, ArrowRight, ArrowsMerge, CalendarBlank, PaintBrush,
} from "@phosphor-icons/react";
import { DAYS_EN, TIME_SLOTS, SERVICE_CODES } from "../api";
import {
  MERGE_QUICK, SCHEDULE_COLOR_SWATCHES, SERVICE_CELL_COLORS,
  resolveClientScheduleColor,
} from "../scheduleUtils";
import { ModalBtnPrimary, ModalBtnSecondary, ModalBtnDanger } from "./Modal";

const STATES = [
  { id: "normal", label: "Normal", swatch: "#E5EBE1" },
  { id: "cancel_therapist", label: "Therapist Cancel", swatch: "#FFF4C4" },
  { id: "cancel_child", label: "Client Cancel", swatch: "#FCE0E8" },
];

function Accordion({ title, icon, open, onToggle, children, badge }) {
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "#EDE9E3" }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[#FAFAF7]"
      >
        <span style={{ color: "#5C6853" }}>{icon}</span>
        <span className="flex-1 text-sm font-bold" style={{ color: "#1C2617" }}>{title}</span>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#E5EBE1", color: "#3D5C3A" }}>
            {badge}
          </span>
        )}
        {open ? <CaretUp size={16} style={{ color: "#9CA3AF" }} /> : <CaretDown size={16} style={{ color: "#9CA3AF" }} />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "#EDE9E3" }}>{children}</div>}
    </div>
  );
}

export default function ScheduleCellPanel({
  form,
  setForm,
  onClose,
  onSave,
  therapists,
  clients,
  selection,
  onExtendSelection,
  onClearSelection,
  onApplyMerge,
  mergeForm,
  setMergeForm,
  colorForm,
  setColorForm,
  onSaveClientColor,
  onResetClientColor,
  onBulkFill,
  onMarkAvailable,
  onSetState,
  onNotify,
  onDelete,
  onCopy,
  onUnmerge,
  saving,
}) {
  const [open, setOpen] = useState({
    session: true,
    span: false,
    quick: true,
    color: false,
    merge: false,
    actions: false,
  });
  const toggle = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));

  if (!form) return null;

  const therapist = therapists.find(t => t.id === form.therapist_id);
  const client = form.child_name
    ? clients.find(c => form.child_name.trim() === c.name || form.child_name.startsWith(c.name + " "))
    : null;
  const previewColor = form.color || resolveClientScheduleColor(form.child_name, clients)
    || SERVICE_CELL_COLORS[form.service_code]?.background || "#E5EBE1";
  const selCount = selection?.slots?.length || 1;
  const isMerged = (form.duration || 1) > 1;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 no-print" onClick={onClose} aria-hidden />
      <aside
        className="schedule-cell-panel fixed top-0 right-0 z-50 h-[100dvh] w-full max-w-[420px] flex flex-col shadow-2xl no-print"
        style={{ background: "#FFFFFF", borderLeft: "1px solid #EDE9E3" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight" style={{ color: "#1C2617" }}>
                {form.id ? "Edit Cell" : "New Cell"}
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
              {form.child_name || form.note || SERVICE_CODES.find(s => s.id === form.service_code)?.short || "Empty slot"}
              {form.state === "available" && " · Available"}
            </div>
          </div>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {/* ── Session ── */}
          <Accordion title="Session details" icon="📋" open={open.session} onToggle={() => toggle("session")}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Service type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SERVICE_CODES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, service_code: s.id }))}
                      className={`pill ${s.cls} justify-center py-1.5 text-[11px] ${form.service_code === s.id ? "ring-2 ring-[#5C8A47]" : ""}`}
                    >
                      {s.short}
                    </button>
                  ))}
                </div>
              </div>

              {!["LEAVE", "BREAK", "AVC"].includes(form.service_code) && (
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

              {form.id && (
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
          </Accordion>

          {/* ── Span & selection ── */}
          <Accordion
            title="Time span & merge"
            icon={<ArrowsMerge size={16} />}
            open={open.span}
            onToggle={() => toggle("span")}
            badge={selCount > 1 ? `${selCount} slots` : null}
          >
            <p className="text-[11px] mb-3" style={{ color: "#9CA3AF" }}>
              Shift+click cells in the same row to select a range, then merge below.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <button type="button" onClick={() => onExtendSelection("left")} className="btn btn-outline p-2" title="Extend left">
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs font-bold flex-1 text-center" style={{ color: "#374151" }}>
                {selCount} slot{selCount !== 1 ? "s" : ""} selected
              </span>
              <button type="button" onClick={() => onExtendSelection("right")} className="btn btn-outline p-2" title="Extend right">
                <ArrowRight size={16} />
              </button>
              <button type="button" onClick={onClearSelection} className="btn btn-ghost text-xs">Clear</button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold" style={{ color: "#374151" }}>Merge label</label>
              <div className="flex flex-wrap gap-1">
                {MERGE_QUICK.map(q => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setMergeForm(f => ({ ...f, quick: q.id, label: q.label }))}
                    className={`pill text-[10px] px-2 py-0.5 ${mergeForm.quick === q.id ? "ring-2 ring-[#5C8A47]" : ""}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <input
                className="modal-input text-sm"
                value={mergeForm.label}
                onChange={e => setMergeForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Custom label..."
              />
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(SERVICE_CELL_COLORS).slice(0, 8).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMergeForm(f => ({ ...f, color: v.background }))}
                    className="w-7 h-7 rounded-md border-2"
                    style={{ background: v.background, borderColor: mergeForm.color === v.background ? "#5C8A47" : "#DDD8D0" }}
                    title={k}
                  />
                ))}
                <input type="color" className="w-7 h-7 rounded cursor-pointer" value={mergeForm.color} onChange={e => setMergeForm(f => ({ ...f, color: e.target.value }))} />
              </div>
              <ModalBtnPrimary type="button" className="w-full !py-2" onClick={onApplyMerge}>
                <ArrowsMerge size={16} className="inline mr-1" /> Merge selected ({selCount})
              </ModalBtnPrimary>
              {isMerged && (
                <ModalBtnSecondary type="button" className="w-full !py-2 text-xs" onClick={onUnmerge}>
                  Unmerge this cell
                </ModalBtnSecondary>
              )}
            </div>
          </Accordion>

          {/* ── Quick fill (day / week) ── */}
          <Accordion title="Quick fill — day & week" icon={<CalendarBlank size={16} />} open={open.quick} onToggle={() => toggle("quick")}>
            <p className="text-[11px] mb-3" style={{ color: "#9CA3AF" }}>
              Apply Leave, Available, or clear slots across a full day or the whole week.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: "leave_day", label: "Leave — full day (this day, merged)", desc: "One block covering all hours" },
                { id: "leave_week_slot", label: "Leave — full week (this time slot)", desc: "Sun–Thu at same hour" },
                { id: "leave_week", label: "Leave — full week (all days)", desc: "Merged block each day" },
                { id: "available_day", label: "Available — full day", desc: "White slots, all hours" },
                { id: "clear_day", label: "Clear — full day", desc: "Remove all cells this day" },
                { id: "clear_week_slot", label: "Clear — full week (this slot)", desc: "Remove same hour Sun–Thu" },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onBulkFill(item.id)}
                  className="text-left px-3 py-2.5 rounded-xl border transition hover:bg-[#FAFAF7]"
                  style={{ borderColor: "#EDE9E3" }}
                >
                  <div className="text-xs font-bold" style={{ color: "#1C2617" }}>{item.label}</div>
                  <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{item.desc}</div>
                </button>
              ))}
            </div>
          </Accordion>

          {/* ── Color ── */}
          <Accordion title="Cell & client color" icon={<PaintBrush size={16} />} open={open.color} onToggle={() => toggle("color")}>
            {form.child_name ? (
              <>
                <p className="text-[11px] mb-2" style={{ color: "#9CA3AF" }}>
                  Updates <strong>{client?.name || form.child_name}</strong> across all weeks.
                </p>
                <div className="grid grid-cols-8 gap-1.5 mb-3">
                  {SCHEDULE_COLOR_SWATCHES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorForm(c)}
                      className="w-7 h-7 rounded-md border-2"
                      style={{ background: c, borderColor: colorForm === c ? "#5C8A47" : "#DDD8D0" }}
                    />
                  ))}
                </div>
                <input type="color" className="modal-input h-9 p-1 mb-2" value={colorForm} onChange={e => setColorForm(e.target.value)} />
                <div className="flex gap-2">
                  {client && (
                    <ModalBtnSecondary type="button" className="flex-1 !text-xs" onClick={onResetClientColor}>
                      Reset default
                    </ModalBtnSecondary>
                  )}
                  <ModalBtnPrimary type="button" className="flex-1 !text-xs" onClick={onSaveClientColor}>
                    Apply color
                  </ModalBtnPrimary>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] mb-2" style={{ color: "#9CA3AF" }}>Set background for this cell only.</p>
                <input
                  type="color"
                  className="modal-input h-9 p-1"
                  value={form.color || mergeForm.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                />
              </>
            )}
          </Accordion>

          {/* ── Actions ── */}
          <Accordion title="Actions" icon="⚡" open={open.actions} onToggle={() => toggle("actions")}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onMarkAvailable()} className="btn btn-outline text-xs justify-center col-span-2">
                ⬜ Mark as Available
              </button>
              {form.id && (
                <>
                  <button type="button" onClick={() => onSetState("cancel_child")} className="btn btn-outline text-xs" style={{ color: "#8B3A55" }}>
                    Client Cancel
                  </button>
                  <button type="button" onClick={() => onSetState("cancel_therapist")} className="btn btn-outline text-xs" style={{ color: "#8B6918" }}>
                    Therapist Cancel
                  </button>
                  <button type="button" onClick={() => onSetState("normal")} className="btn btn-outline text-xs col-span-2">
                    ✓ Mark Normal
                  </button>
                  <button type="button" onClick={onCopy} className="btn btn-outline text-xs justify-center">
                    <Copy size={14} className="inline mr-1" /> Copy
                  </button>
                  <button type="button" onClick={onNotify} className="btn btn-outline text-xs justify-center">
                    <BellRinging size={14} className="inline mr-1" /> Notify
                  </button>
                  <button type="button" onClick={onDelete} className="btn btn-danger text-xs col-span-2 justify-center">
                    <Trash size={14} className="inline mr-1" /> Delete cell
                  </button>
                </>
              )}
            </div>
          </Accordion>
        </div>

        {/* Footer save */}
        <div className="px-4 py-4 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          <ModalBtnSecondary type="button" className="flex-1" onClick={onClose}>Close</ModalBtnSecondary>
          <ModalBtnPrimary type="button" className="flex-1" data-testid="cell-save-btn" onClick={onSave} disabled={saving}>
            <FloppyDisk size={16} className="inline mr-1" />
            {saving ? "Saving..." : "Save cell"}
          </ModalBtnPrimary>
        </div>
      </aside>
    </>
  );
}
