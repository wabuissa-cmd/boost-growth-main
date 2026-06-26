import {
  Plus, ClockCounterClockwise, MapPin, Flower,
} from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import LocationLink from "./LocationLink";
import SsWeekStatusRow from "./SsWeekStatusRow";

function HoursBar({ progress, barColor }) {
  if (!progress) return null;
  const fill = progress.status === "critical" ? "#C97B5C" : progress.status === "low" ? "#D4A64A" : barColor;
  return (
    <div className="mt-1.5">
      <div className="h-2 bg-[#F0EDE9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${progress.pct}%`, background: fill }} />
      </div>
      <div className="text-[11px] font-bold mt-1 text-right" style={{ color: "#5C6853" }}>
        {progress.used.toFixed(1)}h / {progress.pkg}h
      </div>
    </div>
  );
}

export default function PreparationClientCard({
  client,
  therapistName,
  onLog,
  onHistory,
}) {
  const meta = cardStatusMeta(client.cardStatus);
  const avatarBg = getChildColor(client.name) || meta.bar;
  const avatarFg = readable(avatarBg);
  const showBadge = client.cardStatus !== "ok";

  return (
    <div
      className="card p-4 flex flex-col h-full"
      style={{
        borderColor: client.cardStatus === "ok" ? "#E2DDD4" : meta.border,
        borderWidth: client.cardStatus === "ok" ? 1 : 2,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: avatarBg, color: avatarFg }}
        >
          {client.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] leading-tight truncate" style={{ color: "#2C3625" }}>
            {client.name}
          </div>
          <div className="text-[11px]" style={{ color: "#8B9E7A" }}>
            File #{client.file_no}
          </div>
          {therapistName && (
            <div className="flex items-center gap-1 text-[11px] mt-0.5 truncate" style={{ color: "#C97B5C" }}>
              <Flower size={12} weight="fill" />
              {therapistName}
            </div>
          )}
        </div>
        {showBadge && (
          <span
            className="pill text-[10px] font-bold px-2 py-1 shrink-0"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
          >
            {meta.label}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3 flex-1">
        {client.hasSs && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#8B9E7A" }}>
              School Support
            </div>
            {client.ssAlert && (
              <div className="text-[11px] font-bold mt-0.5" style={{ color: meta.bar }}>
                {client.ssAlert}
              </div>
            )}
            <SsWeekStatusRow weeks={client.ssWeeks} compact />
          </div>
        )}

        {client.hasHs && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#8B9E7A" }}>
              Home Session
            </div>
            <HoursBar progress={client.hsProgress} barColor={meta.bar} />
          </div>
        )}

        {!client.hasSs && !client.hasHs && (
          <div className="text-xs py-2 text-center rounded-lg" style={{ background: "#F5F5F5", color: "#8B9E7A" }}>
            No open invoice
          </div>
        )}
      </div>

      {client.location && (
        <div className="flex items-start gap-1 mt-3 text-[10px] leading-snug" style={{ color: "#8B9E7A" }}>
          <MapPin size={12} className="shrink-0 mt-0.5" style={{ color: "#C97B5C" }} />
          <LocationLink
            address={client.locationHref || client.location}
            className="line-clamp-2 underline"
          >
            {client.location}
          </LocationLink>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[#F0EDE9] space-y-2">
        <button
          type="button"
          data-testid={`log-${client.id}`}
          onClick={onLog}
          className="btn btn-primary text-sm w-full min-h-[44px]"
        >
          <Plus size={16} weight="bold" /> Log Session
        </button>
        <button
          type="button"
          onClick={onHistory}
          className="flex items-center justify-center gap-2 rounded-xl border-2 min-h-[48px] py-2 px-3 transition hover:bg-[#E5EBE1] w-full"
          style={{ borderColor: "#B8C8A8", background: "#FAFAF7", color: "#3D4F35" }}
        >
          <ClockCounterClockwise size={20} weight="duotone" />
          <span className="text-sm font-bold">Session History</span>
        </button>
      </div>
    </div>
  );
}
