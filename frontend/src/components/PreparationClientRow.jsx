import LocationLink from "./LocationLink";
import { getChildColor, readable } from "../childColors";
import { cardStatusMeta, prepTrackMeta } from "../attendanceUtils";
import SsWeekStatusRow from "./SsWeekStatusRow";

/** Intake palette — beige + white, calm for the eye */
const C = {
  beige: "#F0E9D8",
  beigeLight: "#FAF0D1",
  white: "#FFFFFF",
  page: "#F3EFE8",
  border: "#E2DDD4",
  borderSoft: "#F0EDE9",
  text: "#2C3625",
  textMid: "#5C6853",
  textMuted: "#8B9E7A",
  progress: "#D4A64A",
  progressTrack: "#E2DDD4",
  hover: "#E5EBE1",
};

const PROGRESS_FILL = C.progress;

export default function PreparationClientRow({
  client,
  therapistName,
  onLog,
  onHistory,
  hideStatusBadge = false,
}) {
  const meta = cardStatusMeta(client.cardStatus);
  const avatarBg = getChildColor(client.name) || meta.bar;
  const avatarFg = readable(avatarBg);
  const track = prepTrackMeta(client);

  return (
    <article
      className="prep-row rounded-[1.25rem] overflow-hidden border bg-white shadow-sm transition-all hover:shadow-md"
      style={{
        borderColor: client.cardStatus === "ok" ? C.border : meta.border,
      }}
    >
      <div
        className="prep-row-head px-3 sm:px-4 py-3 flex flex-wrap items-center gap-3 border-b"
        style={{ background: "linear-gradient(90deg, #F0E9D8 0%, #E5EBE1 100%)", borderColor: C.border }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white/80"
            style={{ background: avatarBg, color: avatarFg }}
          >
            {client.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm truncate" style={{ color: C.text }}>{client.name}</span>
              {client.cardStatus !== "ok" && !hideStatusBadge && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                >
                  {meta.label}
                </span>
              )}
            </div>
            <div className="text-[11px] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5" style={{ color: C.textMuted }}>
              <span>#{client.file_no}</span>
              {therapistName && (
                <span className="inline-flex items-center gap-0.5" style={{ color: "#C97B5C" }}>
                  <Flower size={10} weight="fill" />
                  {therapistName}
                </span>
              )}
              {client.location && (
                <LocationLink
                  address={client.locationHref || client.location}
                  className="inline-flex items-center gap-0.5 max-w-[200px] truncate underline"
                  style={{ color: C.textMid }}
                >
                  <MapPin size={10} className="shrink-0" />
                  {client.location}
                </LocationLink>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block min-w-[140px] text-right shrink-0">
          <div className="text-[11px] font-semibold" style={{ color: C.text }}>{track.label}</div>
          {track.sub && <div className="text-[10px] mt-0.5" style={{ color: C.textMuted }}>{track.sub}</div>}
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
            className="btn btn-secondary text-xs min-h-[40px] px-3"
          >
            <ClockCounterClockwise size={14} weight="duotone" /> History
          </button>
        </div>
      </div>

      {/* White body + beige-tinted progress — Intake card style */}
      <div className="px-3 sm:px-4 py-2.5" style={{ background: C.white }}>
        <div className="rounded-xl px-3 py-2.5 border" style={{ background: C.page, borderColor: C.borderSoft }}>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.progressTrack }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(track.pct, 2)}%`, background: PROGRESS_FILL }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-bold" style={{ color: C.textMid }}>
            <span className="truncate pr-2">{track.label}</span>
            <span className="shrink-0" style={{ color: "#6B5218" }}>{track.pct}%</span>
          </div>
        </div>
        {client.hasSs && client.ssWeeks?.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: C.borderSoft }}>
            <SsWeekStatusRow weeks={client.ssWeeks} compact />
          </div>
        )}
      </div>
    </article>
  );
}
