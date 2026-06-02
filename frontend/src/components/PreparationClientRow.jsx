import { Plus, ClockCounterClockwise, MapPin, Flower } from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import { cardStatusMeta } from "../attendanceUtils";
import SsWeekStatusRow from "./SsWeekStatusRow";

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
  const barColor = client.cardStatus === "urgent" ? "#E8A898"
    : client.cardStatus === "warning" ? "#E8C87A" : "#D4A64A";

  return (
    <article
      className="prep-row rounded-2xl overflow-hidden border bg-white shadow-sm"
      style={{ borderColor: client.cardStatus === "ok" ? "#E8E4DE" : meta.border }}
    >
      <div
        className="prep-row-head px-3 sm:px-4 py-3 flex flex-wrap items-center gap-3 border-b border-[#E8E4DE]"
        style={{ background: "#FAFAF7" }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-[#E5EBE1]"
            style={{ background: avatarBg, color: avatarFg }}
          >
            {client.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>{client.name}</span>
              {client.cardStatus !== "ok" && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                >
                  {meta.label}
                </span>
              )}
            </div>
            <div className="text-[11px] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5" style={{ color: "#8B9E7A" }}>
              <span>#{client.file_no}</span>
              {therapistName && (
                <span className="inline-flex items-center gap-0.5" style={{ color: "#C97B5C" }}>
                  <Flower size={10} weight="fill" />
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
          <div className="text-[11px] font-semibold" style={{ color: "#48543E" }}>{track.label}</div>
          {track.sub && <div className="text-[10px] mt-0.5" style={{ color: "#8B9E7A" }}>{track.sub}</div>}
        </div>

        <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            data-testid={`log-${client.id}`}
            onClick={onLog}
            className="btn btn-primary text-xs min-h-[40px] px-3"
          >
            <Plus size={14} weight="bold" /> Log
          </button>
          <button
            type="button"
            onClick={onHistory}
            className="btn btn-outline text-xs min-h-[40px] px-3"
          >
            <ClockCounterClockwise size={14} weight="duotone" /> History
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-2.5" style={{ background: "#F6F9F3" }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E8E4DE" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(track.pct, 2)}%`, background: barColor }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] font-bold" style={{ color: "#8B9E7A" }}>
              <span className="md:hidden truncate pr-2">{track.label}</span>
              <span className="ml-auto shrink-0">{track.pct}%</span>
            </div>
          </div>
        </div>
        {client.hasSs && client.ssWeeks?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#E8E4DE]">
            <SsWeekStatusRow weeks={client.ssWeeks} compact />
          </div>
        )}
      </div>
    </article>
  );
}
