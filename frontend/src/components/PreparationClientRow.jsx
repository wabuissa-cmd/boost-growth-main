import { Plus, ClockCounterClockwise, MapPin, Flower } from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import { cardStatusMeta } from "../attendanceUtils";
import SsWeekStatusRow from "./SsWeekStatusRow";

const PROGRESS_ORANGE = "#E8A050";
function trackMeta(client) {
  if (client.hasHs && client.hsProgress) {
    const { used, pkg, pct, remaining } = client.hsProgress;
    return {
      pct: pct ?? 0,
      label: `Home Session · ${used.toFixed(1)}h of ${pkg}h`,
      sub: `${remaining.toFixed(1)}h remaining`,
    };
  }
  if (client.hasSs && client.ssWeeks?.length) {
    const done = client.ssWeeks.filter(w => w.weekStatus === "Completed").length;
    const total = client.ssWeeks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const current = client.ssWeeks.find(w => w.weekStatus === "In Progress")
      || client.ssWeeks.find(w => w.weekStatus === "Not started");
    return {
      pct,
      label: `School Support · ${done}/${total} weeks done`,
      sub: current ? `Week ${current.weekNumber} · ${current.weekStatus}` : client.ssAlert || "",
    };
  }
  return { pct: 0, label: "No open package", sub: "" };
}

export default function PreparationClientRow({
  client,
  therapistName,
  onLog,
  onHistory,
}) {
  const meta = cardStatusMeta(client.cardStatus);
  const avatarBg = getChildColor(client.name) || meta.bar;
  const avatarFg = readable(avatarBg);
  const track = trackMeta(client);

  return (
    <article
      className="prep-row rounded-2xl overflow-hidden border shadow-sm"
      style={{
        borderColor: client.cardStatus === "ok" ? "#E8E4DE" : meta.border,
        background: "#FAFAF7",
      }}
    >
      {/* Sage header — balanced: not too dark, not flat white */}
      <div
        className="prep-row-head px-3 sm:px-4 py-3 flex flex-wrap items-center gap-3"
        style={{
          background: "linear-gradient(120deg, #5F6E54 0%, #6E7D62 45%, #7A8A6A 100%)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white/25"
            style={{ background: avatarBg, color: avatarFg }}
          >
            {client.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm truncate text-white">{client.name}</span>
              {client.cardStatus !== "ok" && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                >
                  {meta.label}
                </span>
              )}
            </div>
            <div className="text-[11px] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-white/75">
              <span>#{client.file_no}</span>
              {therapistName && (
                <span className="inline-flex items-center gap-0.5 text-white/90">
                  <Flower size={10} weight="fill" className="text-[#F4C4B0]" />
                  {therapistName}
                </span>
              )}
              {client.location && (
                <span className="inline-flex items-center gap-0.5 max-w-[200px] truncate">
                  <MapPin size={10} />
                  {client.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block min-w-[140px] text-right shrink-0">
          <div className="text-[11px] font-semibold text-white/95">{track.label}</div>
          {track.sub && <div className="text-[10px] mt-0.5 text-white/60">{track.sub}</div>}
        </div>

        <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            data-testid={`log-${client.id}`}
            onClick={onLog}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold min-h-[40px] bg-white text-[#48543E] hover:bg-[#F6F9F3] transition shadow-sm"
          >
            <Plus size={14} weight="bold" /> Log
          </button>
          <button
            type="button"
            onClick={onHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold min-h-[40px] border border-white/35 text-white hover:bg-white/10 transition"
          >
            <ClockCounterClockwise size={14} weight="duotone" /> History
          </button>
        </div>
      </div>

      {/* Progress strip — soft footer, unified orange bar */}
      <div className="px-3 sm:px-4 py-2.5 bg-white border-t border-[#E8E4DE]">
        <div className="rounded-xl px-3 py-2" style={{ background: "#EDF4E8" }}>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#DDE8D4" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(track.pct, 2)}%`, background: PROGRESS_ORANGE }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-bold" style={{ color: "#5C6853" }}>
            <span className="truncate pr-2">{track.label}</span>
            <span className="shrink-0" style={{ color: "#6B5218" }}>{track.pct}%</span>
          </div>
        </div>
        {client.hasSs && client.ssWeeks?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#F0EDE9]">
            <SsWeekStatusRow weeks={client.ssWeeks} compact />
          </div>
        )}
      </div>
    </article>
  );
}
