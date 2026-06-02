import { Flower, CaretRight } from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import { formatPkgBadge, pkgStatusStyle } from "../packageStatusUtils";

function worstPkgRow(rows) {
  if (!rows?.length) return null;
  const order = { critical: 0, expired: 1, low: 2, ok: 3, none: 4 };
  return [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))[0];
}

export default function ClientInfoCard({ client, therapistName, pkgRows = [], onView }) {
  const avatarBg = getChildColor(client.name) || client.color || "#E5EBE1";
  const avatarFg = readable(avatarBg);
  const worst = worstPkgRow(pkgRows);
  const st = worst && worst.status !== "none" ? pkgStatusStyle(worst.status) : null;
  const inactive = (client.status || "Active") === "Inactive";
  const accent = client.color || "#7A8A6A";

  return (
    <button
      type="button"
      onClick={() => onView(client)}
      className={`client-info-card group text-left ${inactive ? "opacity-80" : ""}`}
    >
      <div className="client-info-card-accent" style={{ background: accent }} />
      <div className="client-info-card-body">
        <div className="flex items-start gap-2.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-sm"
            style={{ background: avatarBg, color: avatarFg }}
          >
            {client.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="ui-title-sm truncate leading-tight">{client.name}</div>
            <div className="ui-caption mt-0.5">File #{client.file_no || "—"}</div>
          </div>
          <CaretRight
            size={14}
            className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#8B9E7A" }}
          />
        </div>

        {therapistName && (
          <div className="ui-caption mt-2.5 inline-flex items-center gap-1 truncate max-w-full">
            <Flower size={11} weight="fill" style={{ color: "#C97B5C" }} />
            {therapistName}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1">
          {inactive && <span className="ui-pill ui-pill-muted">Inactive</span>}
          {(pkgRows || []).slice(0, 2).map(row => {
            const ps = pkgStatusStyle(row.status);
            return (
              <span
                key={row.service_type}
                className="ui-pill"
                style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}
              >
                {row.service_type} · {formatPkgBadge(row)}
              </span>
            );
          })}
          {!pkgRows?.length && !inactive && (
            <span className="ui-pill ui-pill-muted">No open package</span>
          )}
        </div>

        {worst && worst.status !== "none" && (
          <div className="ui-caption mt-2 truncate" style={{ color: st?.color }}>
            {worst.service_type === "HS" ? "Home Session" : "School Support"} · {formatPkgBadge(worst)}
          </div>
        )}
      </div>
    </button>
  );
}
