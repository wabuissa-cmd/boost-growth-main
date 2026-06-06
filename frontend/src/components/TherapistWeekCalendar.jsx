import { useMemo } from "react";
import { CaretLeft, CaretRight, MapPin, VideoCamera } from "@phosphor-icons/react";
import { DAYS_SHORT, TIME_SLOTS, addDays, toISODate, formatDateRange } from "../api";
import { getCellStyle } from "../scheduleUtils";

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

export default function TherapistWeekCalendar({
  weekStart,
  onWeekChange,
  cells = [],
  clients = [],
  closures = [],
  therapistId,
}) {
  const todayISO = toISODate(new Date());
  const jsDow = new Date().getDay();
  const todayDayIdx = jsDow <= 4 ? jsDow : -1;

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
          const events = byDay[di] || [];

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
                {events.length === 0 && dayClosures.length === 0 && (
                  <div className="text-[0.65rem] text-center py-4 opacity-50" style={{ color: "#8B9E7A" }}>—</div>
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
                          <span>{loc}</span>
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
