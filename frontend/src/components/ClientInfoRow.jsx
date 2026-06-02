import { CaretRight, Flower } from "@phosphor-icons/react";
import { PackageStatusBadge } from "./PackageStatusBadge";
import { getChildColor, readable } from "../childColors";
import { formatPkgBadge, pkgStatusStyle } from "../packageStatusUtils";

function worstPkgRow(rows) {
  if (!rows?.length) return null;
  const order = { critical: 0, expired: 1, low: 2, ok: 3, none: 4 };
  return [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))[0];
}

export default function ClientInfoRow({ client, therapistName, pkgRows = [], onView }) {
  const avatarBg = getChildColor(client.name) || client.color || "#E5EBE1";
  const avatarFg = readable(avatarBg);
  const worst = worstPkgRow(pkgRows);
  const st = worst ? pkgStatusStyle(worst.status) : null;
  const inactive = (client.status || "Active") === "Inactive";

  return (
    <button
      type="button"
      onClick={() => onView(client)}
      className={`client-info-row w-full text-left ${inactive ? "opacity-75" : ""}`}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: avatarBg, color: avatarFg }}
      >
        {client.name?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="ui-title-sm truncate">{client.name}</span>
          <span className="ui-caption">#{client.file_no || "—"}</span>
          {inactive && (
            <span className="ui-pill ui-pill-muted">Inactive</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {therapistName && (
            <span className="ui-caption inline-flex items-center gap-0.5">
              <Flower size={11} weight="fill" style={{ color: "#C97B5C" }} />
              {therapistName}
            </span>
          )}
          {worst && worst.status !== "none" && (
            <span className="ui-caption" style={{ color: st?.color }}>
              {worst.service_type} · {formatPkgBadge(worst)}
            </span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 max-w-[40%]">
        {(pkgRows || []).slice(0, 2).map(row => (
          <PackageStatusBadge key={`${client.id}-${row.service_type}`} row={row} clientId={client.id} className="!text-[8px]" />
        ))}
      </div>
      <CaretRight size={16} className="shrink-0" style={{ color: "#8B9E7A" }} />
    </button>
  );
}
