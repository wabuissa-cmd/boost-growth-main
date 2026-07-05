import { useState, useEffect } from "react";
import { X, FloppyDisk, BellRinging, WhatsappLogo, PencilSimple } from "@phosphor-icons/react";
import { DAYS_EN, SERVICE_CODES } from "../api";
import { DURATION_OPTIONS, getTherapistScheduleName } from "../scheduleConstants";
import { SERVICE_CELL_COLORS, shiftSessionStyle, resolveClientScheduleColor, findClientForScheduleCell, scheduleCellDisplayLabel, buildDefaultCellNote, shouldAutoUpdateCellNote, isScheduleCancelState } from "../scheduleUtils";
import { ModalBtnPrimary, ModalBtnSecondary } from "./Modal";
import { buildTherapistCancellationMessage, buildWhatsAppUrl } from "../scheduleParentMessages";

const STATES = [
  { id: "normal", label: "Normal", swatch: "#E5EBE1" },
  { id: "cancel_therapist", label: "× Therapist Cancel", swatch: "#FFF4C4" },
  { id: "cancel_child", label: "× Client Cancel", swatch: "#FCE0E8" },
];

const META_CODES = new Set(["LEAVE", "BREAK", "AVC", "AVAILABLE", "MEETING", "SUPERVISION", "OBSERVATION"]);
const CELL_TYPE_OPTIONS = [
  { id: "AVAILABLE", short: "Available", cls: "evt-available" },
  { id: "HS", short: "HS", cls: "evt-hs" },
  { id: "SS", short: "SS", cls: "evt-ss" },
  { id: "LEAVE", short: "Leave", cls: "evt-leave" },
];
const CANCEL_STATES = new Set(["cancel_therapist", "cancel_child"]);

function buildCancelNotify(form) {
  const defaultMsg = form.state === "cancel_therapist"
    ? `Your session "${form.service_code}${form.child_name ? " | " + form.child_name : ""}" at ${form.time_slot} on ${DAYS_EN[form.day]} has been marked as Therapist Cancellation.`
    : `The session "${form.service_code}${form.child_name ? " | " + form.child_name : ""}" at ${form.time_slot} on ${DAYS_EN[form.day]} has been marked as Client Cancellation.`;
  return {
    recipient_ids: form.therapist_id ? [form.therapist_id] : [],
    message: defaultMsg,
    send_email: form.state === "cancel_therapist",
    send_in_app: form.state === "cancel_therapist",
  };
}

function ClientColorDot({ color, size = 12 }) {
  if (!color) return null;
  return (
    <span
      className="inline-block rounded-full flex-shrink-0 border"
      style={{ width: size, height: size, background: color, borderColor: "rgba(0,0,0,0.12)" }}
    />
  );
}

export default function ScheduleCellPanel({
  form,
  setForm,
  onClose,
  onSave,
  therapists,
  clients,
  saving,
  canParentCancellationOps = false,
  weekStart,
  canManagePrep = false,
  canManageCover = false,
  showPrepBadge = false,
  onClearPrep,
  prepInternalNote = "",
  onSavePrepNote,
  prepNoteSaving = false,
  onRestoreCancellation,
  mergedSlotCount = 0,
}) {
  const [clientOpen, setClientOpen] = useState(false);
  const [cancelNotify, setCancelNotify] = useState(null);
  const [parentMsg, setParentMsg] = useState("");
  const [internalNoteDraft, setInternalNoteDraft] = useState(prepInternalNote || "");

  useEffect(() => {
    setInternalNoteDraft(prepInternalNote || "");
  }, [prepInternalNote, form?.id, form?.day, form?.time_slot]);

  useEffect(() => {
    if (!form || !CANCEL_STATES.has(form.state)) {
      setCancelNotify(null);
      return;
    }
    setCancelNotify(buildCancelNotify(form));
  }, [form, form?.state, form?.child_name, form?.service_code, form?.time_slot, form?.day, form?.therapist_id]);

  useEffect(() => {
    if (!form || form.state !== "cancel_therapist" || !canParentCancellationOps) {
      setParentMsg("");
      return;
    }
    const client = findClientForScheduleCell(form.child_name, clients);
    const therapist = therapists.find((t) => t.id === form.therapist_id);
    setParentMsg(buildTherapistCancellationMessage(form, client, weekStart, therapist?.name));
  }, [form, form?.state, form?.child_name, form?.day, form?.time_slot, form?.custom_time, form?.duration, clients, therapists, canParentCancellationOps, weekStart]);

  if (!form) return null;

  const therapist = therapists.find(t => t.id === form.therapist_id);
  const parentClient = form.child_name ? findClientForScheduleCell(form.child_name, clients) : null;
  const parentPhone = parentClient?.parent_phone || parentClient?.phone || null;
  const parentWaUrl = buildWhatsAppUrl(parentPhone, parentMsg);
  const accentColor = form.child_name
    ? resolveClientScheduleColor(form.child_name, clients, form.time_slot)
    : null;
  const previewColor = form.service_code === "AVAILABLE" || form.state === "available"
    ? "#FFFFFF"
    : SERVICE_CELL_COLORS[form.service_code]?.background
      || (form.child_name ? shiftSessionStyle(form.time_slot).background : null)
      || "#E5EBE1";
  const serviceShort = SERVICE_CODES.find(s => s.id === form.service_code)?.short;
  const previewLabel = form.state === "available" || form.service_code === "AVAILABLE"
    ? "Available"
    : scheduleCellDisplayLabel(form, serviceShort);
  const effectiveDuration = Math.max(parseFloat(form.duration) || 1, mergedSlotCount || 0);

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

  const applyClientName = (name) => {
    const trimmed = (name || "").trim();
    setForm((f) => {
      const note = shouldAutoUpdateCellNote(f.note, f.child_name, f.service_code)
        ? buildDefaultCellNote(f.service_code, trimmed)
        : f.note;
      const sessionBg = SERVICE_CELL_COLORS[f.service_code]?.background
        || shiftSessionStyle(f.time_slot).background
        || null;
      return { ...f, child_name: trimmed || null, color: sessionBg, note };
    });
    setClientOpen(false);
  };

  const pickClient = (name) => applyClientName(name);

  const toggleCancelRecipient = (tid) => {
    setCancelNotify(n => {
      const ids = n.recipient_ids || [];
      return { ...n, recipient_ids: ids.includes(tid) ? ids.filter(x => x !== tid) : [...ids, tid] };
    });
  };

  const handleSave = () => {
    onSave(CANCEL_STATES.has(form.state) ? { cancelNotify } : {});
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 no-print" onClick={onClose} aria-hidden />
      <aside
        className="schedule-cell-panel fixed top-0 right-0 z-50 h-[100dvh] w-full max-w-[420px] flex flex-col shadow-2xl no-print"
        style={{ background: "#FFFFFF", borderLeft: "1px solid #EDE9E3" }}
      >
        <div className="px-5 pt-5 pb-4 border-b flex-shrink-0 schedule-cell-panel__header">
          <div className="schedule-page-panel-head" style={{ marginBottom: "0.85rem" }}>
            <div className="schedule-page-hero-icon" style={{ width: 40, height: 40, borderRadius: 10 }}>
              <PencilSimple size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <h2>{form.id ? "Edit Session" : "Add Session"}</h2>
              <p>{therapist?.name} · {DAYS_EN[form.day]} · {form.time_slot}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white transition shrink-0" style={{ color: "#9CA3AF" }} aria-label="Close panel">
              <X size={22} weight="bold" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg border flex-shrink-0" style={{ background: previewColor, borderColor: "#DDD8D0" }} />
            <div className="text-xs flex items-center gap-1.5 min-w-0" style={{ color: "#5C6853" }}>
              {form.child_name && accentColor && <ClientColorDot color={accentColor} size={10} />}
              <span className="truncate">{previewLabel || "Session"}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 schedule-cell-panel__body">
          <div className="log-session-card">
            <div className="log-session-label">Type</div>
            <div className="grid grid-cols-2 gap-2">
              {CELL_TYPE_OPTIONS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickService(s.id)}
                  className={`schedule-cell-type-btn pill ${s.cls} justify-center py-2 text-xs font-bold ${form.service_code === s.id ? "is-active" : ""}`}
                >
                  {s.short}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {!META_CODES.has(form.service_code) && form.state !== "available" && (
              <div className="log-session-field">
                <label className="log-session-label">Client name</label>
                <div className="relative flex gap-1.5">
                  <div className="relative flex-1 flex items-center gap-2 min-w-0">
                    {accentColor ? <ClientColorDot color={accentColor} /> : <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "#E5E7EB" }} />}
                    <input
                      type="text"
                      data-testid="cell-child-input"
                      list="schedule-client-suggestions"
                      className="modal-input log-session-input flex-1 min-w-0"
                      placeholder="Type client name…"
                      value={form.child_name || ""}
                      onChange={(e) => applyClientName(e.target.value)}
                    />
                    <datalist id="schedule-client-suggestions">
                      {clients.map(c => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="button"
                    className="modal-input px-2.5 shrink-0 text-xs font-semibold"
                    style={{ color: "#5C6853", minWidth: 44 }}
                    onClick={() => setClientOpen(o => !o)}
                    title="Pick from client list"
                    aria-label="Pick from client list"
                  >
                    List
                  </button>
                  {clientOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setClientOpen(false)} aria-hidden />
                      <div
                        className="absolute right-0 left-0 top-full mt-1 z-[61] max-h-48 overflow-y-auto rounded-lg border shadow-lg bg-white py-1"
                        style={{ borderColor: "#E2DDD4" }}
                      >
                        {clients.map(c => {
                          const dotColor = resolveClientScheduleColor(c.name, clients);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#F5F5F0]"
                              style={{ color: "#2C3625", background: form.child_name === c.name ? "#E5EBE1" : undefined }}
                              onClick={() => pickClient(c.name)}
                            >
                              <ClientColorDot color={dotColor} />
                              {c.name}
                            </button>
                          );
                        })}
                        {clients.length === 0 && (
                          <div className="px-3 py-2 text-xs" style={{ color: "#8B9E7A" }}>No clients found</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {canManageCover && form.state === "cancel_child" && form.child_name && (
              <div className="log-session-field" data-testid="cell-cover-section">
                <label className="log-session-label">Cover at / تغطية عند</label>
                <input
                  type="text"
                  className="modal-input log-session-input"
                  list="schedule-cover-client-suggestions"
                  placeholder="اسم الطفل الذي غطّت عنده الأخصائية"
                  value={form.cover_child_name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, cover_child_name: e.target.value.trim() || null }))}
                  data-testid="cell-cover-input"
                />
                <datalist id="schedule-cover-client-suggestions">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <p className="text-[10px] mt-1 m-0 leading-relaxed" style={{ color: "#8B9E7A" }}>
                  يظهر فقط عند إلغاء الطفل — سجّلي عند أي عميل غطّت الأخصائية هذه الجلسة.
                </p>
              </div>
            )}

            <div className="log-session-card">
              <div className="grid grid-cols-2 gap-2">
                <div className="log-session-field">
                  <label className="log-session-label">Custom time</label>
                  <input
                    className="modal-input log-session-input log-session-input-sm"
                    placeholder="2:30-4:30"
                    value={form.custom_time || ""}
                    onChange={e => setForm(f => ({ ...f, custom_time: e.target.value }))}
                  />
                </div>
                <div className="log-session-field">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="log-session-label m-0">Duration</label>
                    {effectiveDuration > 1 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
                        Merged: {effectiveDuration}h
                      </span>
                    )}
                  </div>
                  <select
                    className="modal-input log-session-input log-session-input-sm"
                    value={form.duration || 1}
                    onChange={e => setForm(f => ({ ...f, duration: parseFloat(e.target.value) }))}
                  >
                    {DURATION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="log-session-field">
              <label className="log-session-label">Cell label (shown in grid)</label>
              <input
                className="modal-input log-session-input"
                data-testid="cell-label-input"
                placeholder="Auto: HS | Client name — or type short label e.g. SS | Abdul Elah"
                value={form.note || ""}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
              {form.child_name && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["HS", "SS", "OS"].map(code => (
                    <button
                      key={code}
                      type="button"
                      className="text-[10px] font-bold px-2 py-1 rounded-lg border"
                      style={{ borderColor: "#C8D4BE", color: "#3D4F35", background: "#F6FAF3" }}
                      onClick={() => setForm(f => ({ ...f, note: buildDefaultCellNote(code, f.child_name), service_code: code }))}
                    >
                      {code} | {form.child_name.split(/\s+/)[0]}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg border"
                    style={{ borderColor: "#E2DDD4", color: "#5C6853", background: "#FAFAF7" }}
                    onClick={() => setForm(f => ({ ...f, note: buildDefaultCellNote(f.service_code, f.child_name) }))}
                  >
                    Reset label
                  </button>
                </div>
              )}
            </div>

            {form.child_name && !META_CODES.has(form.service_code) && form.state !== "available" && onSavePrepNote && (
              <div className="log-session-field" data-testid="cell-prep-internal-note">
                <label className="log-session-label">Prep notes (internal)</label>
                <textarea
                  className="modal-input log-session-input text-xs leading-relaxed"
                  rows={3}
                  placeholder="Private notes for your preparation — not shown on the schedule grid"
                  value={internalNoteDraft}
                  onChange={(e) => setInternalNoteDraft(e.target.value)}
                  data-testid="cell-prep-internal-note-input"
                />
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <p className="text-[10px] m-0 leading-relaxed" style={{ color: "#8B9E7A" }}>
                    Only you and ops can see this — not on the public schedule.
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border shrink-0"
                    style={{ borderColor: "#C8D4BE", color: "#3D4F35", background: "#F6FAF3" }}
                    disabled={prepNoteSaving || internalNoteDraft === (prepInternalNote || "")}
                    onClick={() => onSavePrepNote(internalNoteDraft)}
                    data-testid="cell-prep-internal-note-save"
                  >
                    {prepNoteSaving ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            )}

            {form.id && form.state !== "available" && form.service_code !== "AVAILABLE" && (
              <div className="log-session-card">
                <label className="log-session-label">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {STATES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm(f => {
                        const togglingOff = f.state === s.id && CANCEL_STATES.has(s.id);
                        const nextState = togglingOff ? "normal" : s.id;
                        return {
                          ...f,
                          state: nextState,
                          cover_child_name: nextState === "cancel_child" ? f.cover_child_name : null,
                        };
                      })}
                      className={`pill text-xs px-2 py-1 ${form.state === s.id ? "ring-2 ring-[#5C8A47]" : ""}`}
                      style={{ background: s.swatch, color: "#2C3625" }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {cancelNotify && (
                  <div
                    className="mt-3 rounded-xl border p-3 space-y-3"
                    style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}
                    data-testid="cancel-notify-section"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#2C3625" }}>
                      <BellRinging size={18} weight="duotone" style={{ color: "#8B6918" }} />
                      Send Cancellation Notification?
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#8B9E7A" }}>Recipients</label>
                      <div className="flex flex-wrap gap-1.5">
                        {therapists.map(t => (
                          <label
                            key={t.id}
                            className="flex items-center gap-1.5 text-xs cursor-pointer pill px-2 py-1"
                            style={{
                              background: (cancelNotify.recipient_ids || []).includes(t.id) ? "#E5EBE1" : "#fff",
                              border: "1px solid #E2DDD4",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={(cancelNotify.recipient_ids || []).includes(t.id)}
                              onChange={() => toggleCancelRecipient(t.id)}
                            />
                            {getTherapistScheduleName(t)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#8B9E7A" }}>Message</label>
                      <textarea
                        className="modal-input text-xs"
                        rows={3}
                        value={cancelNotify.message}
                        onChange={e => setCancelNotify(n => ({ ...n, message: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!cancelNotify.send_email}
                          onChange={e => setCancelNotify(n => ({ ...n, send_email: e.target.checked }))}
                        />
                        Send Email
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cancelNotify.send_in_app !== false}
                          onChange={e => setCancelNotify(n => ({ ...n, send_in_app: e.target.checked }))}
                        />
                        In-app notify
                      </label>
                    </div>
                  </div>
                )}

                {form.state === "cancel_therapist" && canParentCancellationOps && (
                  <div
                    className="mt-3 rounded-xl border p-3 space-y-3"
                    style={{ borderColor: "#E8C572", background: "#FFFBF0" }}
                    data-testid="parent-cancel-notify-section"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#6B5218" }}>
                      <WhatsappLogo size={18} weight="fill" style={{ color: "#25D366" }} />
                      Notify parent (WhatsApp)
                    </div>
                    <p className="text-[11px] m-0 leading-relaxed" style={{ color: "#8B6918" }}>
                      Saving marks this session as cancelled and queues a parent alert for Admin / HR / Walaa.
                    </p>
                    <textarea
                      className="modal-input text-xs leading-relaxed"
                      rows={7}
                      dir="rtl"
                      value={parentMsg}
                      onChange={(e) => setParentMsg(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      {parentWaUrl ? (
                        <a
                          href={parentWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary text-xs py-1.5 px-2.5 min-h-0 no-underline"
                        >
                          <WhatsappLogo size={14} weight="fill" />
                          Open WhatsApp
                        </a>
                      ) : (
                        <span className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "#F0E0D4", color: "#965132" }}>
                          {parentPhone ? "Message required" : "Add parent phone in Client Info"}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-4 border-t flex gap-2 flex-shrink-0 flex-wrap" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          {onRestoreCancellation && form.id && isScheduleCancelState(form.state) && (
            <button
              type="button"
              data-testid="cell-restore-cancellation-btn"
              className="w-full text-sm font-semibold rounded-xl border-2 px-3 py-2.5 min-h-[44px]"
              style={{ borderColor: "#5C8A47", color: "#2C4A22", background: "#E5EBE1" }}
              onClick={onRestoreCancellation}
            >
              Clear cancellation
            </button>
          )}
          {canManagePrep && showPrepBadge && onClearPrep && (
            <button
              type="button"
              data-testid="cell-remove-prep-badge"
              className="w-full text-sm font-semibold rounded-xl border-2 px-3 py-2.5 min-h-[44px]"
              style={{ borderColor: "#C97B5C", color: "#8A3F27", background: "#FCE0E8" }}
              onClick={onClearPrep}
            >
              Remove prep checkmark ✓
            </button>
          )}
          <ModalBtnSecondary type="button" className="flex-1" onClick={onClose}>Close</ModalBtnSecondary>
          <ModalBtnPrimary type="button" className="flex-1" data-testid="cell-save-btn" onClick={handleSave} disabled={saving}>
            <FloppyDisk size={16} className="inline mr-1" />
            {saving ? "Saving..." : "Save"}
          </ModalBtnPrimary>
        </div>
      </aside>
    </>
  );
}
