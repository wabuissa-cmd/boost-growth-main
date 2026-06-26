import { useMemo, useState } from "react";
import { CaretLeft, CaretRight, MapPin, VideoCamera, Plus } from "@phosphor-icons/react";
import LocationLink from "./LocationLink";
import { DAYS_SHORT, TIME_SLOTS, addDays, toISODate, formatDateRange } from "../api";
import { getCellStyle } from "../scheduleUtils";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";
import api, { formatErr } from "../api";

const META = new Set(["LEAVE", "BREAK", "AVC", "AVAILABLE", "MEETING", "SUPERVISION", "OBSERVATION"]);

function dayDate(weekStart, dayIdx) {
  return addDays(weekStart, dayIdx);
}

function resolveClient(clients, cell) {
  if (!cell?.child_name) return null;
  const name = cell.child_name.trim().toLowerCase();
  return clients.find(c => (c.name || "").trim().toLowerCase() === name) || null;
}

function sessionLocation(client, serviceCode) {
  if (!client) return null;
  const code = (serviceCode || "").toUpperCase();
  const locs = client.locations || [];
  const match = locs.find(l => (l.service || "").toUpperCase().includes(code === "SS" ? "SS" : "HS"));
  if (match?.address) return match.address;
  if (client.address) return client.address;
  const hs = locs.find(l => (l.service || "").toUpperCase().includes("HS"));
  const ss = locs.find(l => (l.service || "").toUpperCase().includes("SS"));
  if (code === "SS" && ss?.address) return ss.address;
  if (code === "HS" && hs?.address) return hs.address;
  return locs[0]?.address || null;
}

function meetUrl(client) {
  const url = client?.drive_url || "";
  if (/meet\.google\.com/i.test(url)) return url;
  return null;
}

function closureForDay(closures, iso, therapistId) {
  return (closures || []).filter(c => {
    if (c.date !== iso) return false;
    const ids = c.therapist_ids || [];
    return !ids.length || ids.includes(therapistId);
  });
}

function personalForDay(personalEvents, iso) {
  return (personalEvents || []).filter(e => e.date === iso);
}

export default function TherapistWeekCalendar({
  weekStart,
  onWeekChange,
  cells = [],
  clients = [],
  closures = [],
  personalEvents = [],
  onPersonalChange,
  therapistId,
  compact = false,
  editable = false,
}) {
  const todayISO = toISODate(new Date());
  const jsDow = new Date().getDay();
  const todayDayIdx = jsDow <= 4 ? jsDow : -1;
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ date: "", title: "", notes: "", time_label: "" });
  const [saving, setSaving] = useState(false);

  const byDay = useMemo(() => {
    const map = {};
    for (let d = 0; d < 5; d++) map[d] = [];
    const real = cells.filter(c =>
      c.therapist_id === therapistId &&
      !["LEAVE", "BREAK", "AVC"].includes(c.service_code) &&
      c.state !== "cancel_therapist" &&
      c.state !== "cancel_child"
    );
    real.sort((a, b) => TIME_SLOTS.indexOf(a.time_slot) - TIME_SLOTS.indexOf(b.time_slot));
    for (const cell of real) {
      if (cell.day >= 0 && cell.day < 5) map[cell.day].push(cell);
    }
    return map;
  }, [cells, therapistId]);

  const openAdd = (iso) => {
    setAddForm({ date: iso || toISODate(new Date()), title: "", notes: "", time_label: "" });
    setAddOpen(true);
  };

  const submitPersonal = async () => {
    if (!addForm.title.trim() || !addForm.date) {
      alert("Title and date required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/calendar/personal", addForm);
      setAddOpen(false);
      onPersonalChange?.();
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    return (
      <>
        <div className="cal-compact" data-testid="therapist-week-calendar-compact">
          <div className="cal-compact-nav">
            <button type="button" className="cal-nav-btn" onClick={() => onWeekChange?.(addDays(weekStart, -7))} aria-label="Previous week"><CaretLeft size={14} /></button>
            <span className="text-[10px] font-bold" style={{ color: "#5C6853" }}>{formatDateRange(weekStart)}</span>
            <button type="button" className="cal-nav-btn" onClick={() => onWeekChange?.(addDays(weekStart, 7))} aria-label="Next week"><CaretRight size={14} /></button>
          </div>
          {editable && (
            <button type="button" className="btn btn-outline text-[10px] w-full mb-2 min-h-0 py-1" onClick={() => openAdd()}>
              <Plus size={12}/> Add personal note
            </button>
          )}
          <div className="cal-compact-days">
            {DAYS_SHORT.map((dayName, di) => {
              const iso = toISODate(dayDate(weekStart, di));
              const isToday = di === todayDayIdx;
              const sessions = (byDay[di] || []).length;
              const clos = closureForDay(closures, iso, therapistId).length;
              const personal = personalForDay(personalEvents, iso).length;
              const n = sessions + clos + personal;
              const empty = n === 0;
              return (
                <div
                  key={dayName}
                  className={`cal-compact-day${isToday ? " today" : ""}${n > 0 ? " has-events" : ""}${empty ? " is-empty" : ""}`}
                  title={empty ? "No sessions — tap + to add a note" : `${n} item(s)`}
                  onClick={editable && empty ? () => openAdd(iso) : undefined}
                  role={editable && empty ? "button" : undefined}
                >
                  <span className="cal-compact-dow">{dayName.slice(0, 3)}</span>
                  <span className="cal-compact-num">{dayDate(weekStart, di).getDate()}</span>
                  {empty ? (
                    <span className="cal-compact-empty">—</span>
                  ) : (
                    <span className="cal-compact-dot">{n}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] mt-2 text-center leading-snug" style={{ color: "#8B9E7A" }}>
            Each cell is one day · dot = sessions or notes · dashed = free day
          </p>
        </div>
        {addOpen && (
          <ModalBase
            title="Add personal note"
            subtitle="Your private reminder on the calendar"
            onClose={() => setAddOpen(false)}
            size="sm"
            footer={(
              <>
                <ModalBtnSecondary type="button" onClick={() => setAddOpen(false)}>Cancel</ModalBtnSecondary>
                <ModalBtnPrimary type="button" onClick={submitPersonal} disabled={saving}>{saving ? "Saving…" : "Save"}</ModalBtnPrimary>
              </>
            )}
          >
            <FormSection title="Event">
              <FormField label="Date" required>
                <input type="date" className="modal-input" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
              </FormField>
              <FormField label="Title" required>
                <input className="modal-input" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Follow up with parent" />
              </FormField>
              <FormField label="Time (optional)">
                <input className="modal-input" value={addForm.time_label} onChange={e => setAddForm(f => ({ ...f, time_label: e.target.value }))} placeholder="e.g. 2:00 PM" />
              </FormField>
              <FormField label="Notes">
                <textarea className="modal-input" rows={2} value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
              </FormField>
            </FormSection>
          </ModalBase>
        )}
      </>
    );
  }

  return (
    <div className="cal-shell" data-testid="therapist-week-calendar">
      <div className="cal-head">
        <button type="button" className="cal-nav-btn" onClick={() => onWeekChange?.(addDays(weekStart, -7))} aria-label="Previous week">
          <CaretLeft size={16} />
        </button>
        <div className="text-center">
          <div className="cal-head-title">{formatDateRange(weekStart)}</div>
        </div>
        <button type="button" className="cal-nav-btn" onClick={() => onWeekChange?.(addDays(weekStart, 7))} aria-label="Next week">
          <CaretRight size={16} />
        </button>
      </div>

      <div className="cal-grid">
        {DAYS_SHORT.map((dayName, di) => {
          const iso = toISODate(dayDate(weekStart, di));
          const isToday = di === todayDayIdx && iso.slice(0, 10) <= todayISO && todayISO <= toISODate(addDays(weekStart, 4));
          const dayClosures = closureForDay(closures, iso, therapistId);
          const dayPersonal = personalForDay(personalEvents, iso);
          const events = byDay[di] || [];
          const empty = !events.length && !dayClosures.length && !dayPersonal.length;

          return (
            <div key={dayName} className={`cal-day-col${isToday ? " today" : ""}`}>
              <div className="cal-day-head">
                <div className="cal-day-name">{dayName}</div>
                <div className="cal-day-num">{dayDate(weekStart, di).getDate()}</div>
              </div>
              <div className="cal-events">
                {dayClosures.map(c => (
                  <div key={c.id} className="cal-event cal-closure">
                    <div className="cal-event-title">{c.label}</div>
                    <div className="cal-event-loc">Center closure</div>
                  </div>
                ))}
                {dayPersonal.map(ev => (
                  <div key={ev.id} className="cal-event cal-personal">
                    <div className="cal-event-time">{ev.time_label || "Note"}</div>
                    <div className="cal-event-title">{ev.title}</div>
                    {ev.notes && <div className="cal-event-loc">{ev.notes}</div>}
                  </div>
                ))}
                {empty && (
                  <div className="cal-empty-cell">No sessions</div>
                )}
                {events.map(cell => {
                  const client = resolveClient(clients, cell);
                  const style = getCellStyle(cell, clients);
                  const meet = meetUrl(client);
                  const loc = !meet ? sessionLocation(client, cell.service_code) : null;
                  const isMeta = META.has(cell.service_code) || !cell.child_name;
                  const title = isMeta
                    ? (cell.note || cell.service_code)
                    : `${cell.service_code}${cell.child_name ? ` · ${cell.child_name}` : ""}`;

                  return (
                    <div
                      key={`${cell.day}-${cell.time_slot}-${cell.service_code}`}
                      className="cal-event"
                      style={{
                        background: style.background,
                        borderLeftColor: style.borderColor || style.background,
                        color: style.color || "#2C3625",
                      }}
                    >
                      <div className="cal-event-time">{cell.custom_time || cell.time_slot?.split(" - ")[0]}</div>
                      <div className="cal-event-title">{title}</div>
                      {meet && (
                        <div className="cal-event-loc">
                          <VideoCamera size={11} weight="fill" />
                          <a href={meet} target="_blank" rel="noopener noreferrer">Join Meet</a>
                        </div>
                      )}
                      {loc && (
                        <div className="cal-event-loc">
                          <MapPin size={11} weight="fill" />
                          <LocationLink address={loc} className="underline" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
