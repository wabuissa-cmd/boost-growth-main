import { X, MapPin, Paperclip, ClipboardText, ChartLineUp, PencilSimple, ArrowSquareOut } from "@phosphor-icons/react";
import LocationLink from "./LocationLink";
import { formatLocationLabel } from "../mapsUtils";
import { PackageStatusBadge } from "./PackageStatusBadge";
import { useNavigate } from "react-router-dom";
import { useAuth, hasOpsAccess } from "../auth";
import { formatClientStatus } from "../attendanceUtils";
import { formatSupervisorDisplayName } from "../clientDisplayUtils";

export default function ClientDrawer({
  client,
  therapistName,
  pkgRows = [],
  prSummary,
  isAdmin,
  onClose,
  onEdit,
  onOpenSection,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ops = hasOpsAccess(user);

  if (!client) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="client-drawer"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`${client.name} details`}
      >
        <div className="client-drawer-head">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0"
              style={{ background: client.color || "#E5EBE1", color: "#2C3625" }}
            >
              {client.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="ui-title-sm m-0 truncate">{client.name}</h2>
              <div className="ui-caption mt-0.5">File #{client.file_no || "—"} · {formatClientStatus(client.status)}</div>
              {therapistName && (
                <div className="ui-caption mt-1">Main therapist · {therapistName}</div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost p-2 shrink-0" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="client-drawer-body">
          {(pkgRows || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {pkgRows.map(row => (
                <PackageStatusBadge key={`${client.id}-${row.service_type}`} row={row} clientId={client.id} />
              ))}
            </div>
          )}

          <div className="space-y-2 ui-text-sm" style={{ color: "#5C6853" }}>
            {client.parent_phone && <div>Phone · {client.parent_phone}</div>}
            {client.supervisor && <div>Supervisor · {formatSupervisorDisplayName(client.supervisor)}</div>}
            {client.locations?.[0] && (
              <div className="flex gap-1.5">
                <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: "#8B9E7A" }} />
                <LocationLink
                  address={client.locations[0].address}
                  className="underline"
                >
                  {client.locations[0].service} · {formatLocationLabel(client.locations[0].address) || client.locations[0].address}
                </LocationLink>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <DrawerAction icon={<MapPin size={18} weight="duotone" />} label="Locations" onClick={() => onOpenSection("location")} />
            <DrawerAction icon={<Paperclip size={18} weight="duotone" />} label="Attachments" onClick={() => onOpenSection("attachments")} />
            <DrawerAction icon={<ClipboardText size={18} weight="duotone" />} label="Case details" onClick={() => onOpenSection("details")} />
            <DrawerAction icon={<ChartLineUp size={18} weight="duotone" />} label="Progress" onClick={() => onOpenSection("progress")} badge={prSummary?.count} />
          </div>

          <div className="flex flex-col gap-2 mt-5 pt-4 border-t border-[#E2DDD4]">
            {ops && (
              <button type="button" className="btn btn-outline text-sm w-full justify-center gap-2"
                onClick={() => { onClose(); navigate(`/billing?client=${client.id}`); }}>
                <ArrowSquareOut size={16} /> Open billing
              </button>
            )}
            {isAdmin && (
              <button type="button" className="btn btn-secondary text-sm w-full justify-center gap-2" onClick={() => { onClose(); onEdit?.(client); }}>
                <PencilSimple size={16} /> Edit profile
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DrawerAction({ icon, label, onClick, badge }) {
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2DDD4] bg-[#FAFAF7] hover:bg-[#E5EBE1] transition text-center min-h-[72px]">
      <span style={{ color: "#7A8A6A" }}>{icon}</span>
      <span className="ui-label">{label}</span>
      {badge != null && badge > 0 && (
        <span className="text-[10px] font-bold pill px-1.5" style={{ background: "#E5EBE1", color: "#3D4F35" }}>{badge}</span>
      )}
    </button>
  );
}
