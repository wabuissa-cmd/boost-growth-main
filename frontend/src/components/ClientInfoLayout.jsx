import { useEffect, useMemo } from "react";
import {
  MapPin, Paperclip, ClipboardText, ChartLineUp,
  PencilSimple, Flower, CaretRight, Phone,
} from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import { prepTrackMeta, cardStatusMeta } from "../attendanceUtils";
import { formatPkgBadge, pkgStatusStyle, formatPkgUsedRemaining } from "../packageStatusUtils";
import "../clientInfoLayout.css";

function worstPkgRow(rows) {
  if (!rows?.length) return null;
  const order = { critical: 0, expired: 1, low: 2, ok: 3, good: 3, none: 4 };
  return [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))[0];
}

function pkgAlertDot(rows) {
  const w = worstPkgRow(rows);
  if (!w || w.status === "none" || w.status === "good" || w.status === "ok") return null;
  const st = pkgStatusStyle(w.status);
  return st.color;
}

function PackageBar({ row }) {
  if (!row || row.status === "none") return null;
  const ur = formatPkgUsedRemaining(row);
  const total = row.package_size || 1;
  const used = row.used || 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const ps = pkgStatusStyle(row.status);
  const label = row.service_type === "HS" ? "Home Session" : "School Support";

  return (
    <div className="ci-pkg-bar-card">
      <div className="ci-pkg-bar-label">{row.service_type}</div>
      <div className="ci-pkg-bar-title">{label}</div>
      <div className="ci-pkg-track">
        <div className="ci-pkg-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ci-pkg-bar-sub">
        {ur.used} used · {ur.remaining} left
        {row.status !== "good" && row.status !== "ok" && (
          <span style={{ color: ps.color, fontWeight: 700 }}> · {formatPkgBadge(row)}</span>
        )}
      </div>
    </div>
  );
}

export default function ClientInfoLayout({
  clients,
  selectedId,
  onSelect,
  pkgByClient,
  findTherapist,
  prSummaries,
  counts,
  isAdmin,
  hasOps,
  onOpenSection,
  onEdit,
  onBilling,
}) {
  const selected = useMemo(
    () => clients.find(c => c.id === selectedId) || clients[0] || null,
    [clients, selectedId]
  );

  useEffect(() => {
    if (clients.length && !clients.some(c => c.id === selectedId)) {
      onSelect(clients[0].id);
    }
  }, [clients, selectedId, onSelect]);

  const selectedPkg = selected ? (pkgByClient[selected.id] || []) : [];
  const track = selected ? prepTrackMeta(selected) : null;
  const statusMeta = selected ? cardStatusMeta(selected.cardStatus || "ok") : null;
  const therapistName = selected ? findTherapist(selected.main_therapist_id)?.name?.replace("Ms. ", "") : "";
  const prCount = selected ? prSummaries?.[selected.id]?.count : 0;

  if (!clients.length) {
    return (
      <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
        No clients match your filters.
      </div>
    );
  }

  return (
    <div className="ci-shell">
      {/* Directory index — compact filing list */}
      <nav className="ci-directory" aria-label="Client directory">
        <div className="ci-directory-head">
          <p className="ci-directory-title">Directory</p>
          <div className="ci-directory-counts">
            <span className="ci-count-chip">{counts.active} active</span>
            <span className="ci-count-chip">{counts.all} total</span>
            {counts.attention > 0 && (
              <span className="ci-count-chip warn">{counts.attention} alerts</span>
            )}
          </div>
        </div>
        <div className="ci-directory-list">
          {clients.map(c => {
            const dot = pkgAlertDot(pkgByClient[c.id]);
            const isSel = selected?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`ci-dir-item${isSel ? " selected" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="ci-dir-file">#{c.file_no || "—"}</span>
                <span className="ci-dir-name">{c.name}</span>
                {dot && <span className="ci-dir-dot" style={{ background: dot }} aria-hidden />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile workspace — dossier view */}
      {selected && (
        <div className="ci-workspace">
          <header className="ci-hero">
            <div
              className="ci-hero-avatar"
              style={{
                background: getChildColor(selected.name) || selected.color || "#E5EBE1",
                color: readable(getChildColor(selected.name) || selected.color || "#E5EBE1"),
              }}
            >
              {selected.initials || selected.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="ci-hero-name">{selected.name}</h1>
              <div className="ci-hero-meta">
                <span>File #{selected.file_no || "—"}</span>
                {selected.age && <span>Age {selected.age}</span>}
                {therapistName && (
                  <span className="inline-flex items-center gap-1">
                    <Flower size={13} weight="fill" style={{ color: "#C97B5C" }} />
                    {therapistName}
                  </span>
                )}
                <span className="ci-hero-badge">{selected.status || "Active"}</span>
                {isAdmin && selected.cardStatus && selected.cardStatus !== "ok" && statusMeta && (
                  <span className="ci-hero-badge" style={{ background: statusMeta.bg, color: statusMeta.color, borderColor: statusMeta.border }}>
                    {statusMeta.label}
                  </span>
                )}
              </div>
            </div>
            <div className="ci-hero-actions">
              {hasOps && (
                <button type="button" className="ci-btn-gold" onClick={onBilling}>
                  Billing
                </button>
              )}
              {isAdmin && (
                <button type="button" className="ci-btn-outline" onClick={() => onEdit(selected)}>
                  <PencilSimple size={14} className="inline mr-1" style={{ verticalAlign: -2 }} />
                  Edit
                </button>
              )}
            </div>
          </header>

          {(selectedPkg.length > 0 || track) && (
            <div className="ci-pkg-bars">
              {selectedPkg.map(row => (
                <PackageBar key={row.service_type} row={row} />
              ))}
              {!selectedPkg.length && track?.label && (
                <div className="ci-pkg-bar-card">
                  <div className="ci-pkg-bar-label">Package</div>
                  <div className="ci-pkg-bar-title">{track.label}</div>
                  {track.sub && <div className="ci-pkg-bar-sub">{track.sub}</div>}
                </div>
              )}
            </div>
          )}

          {selected.locations?.length > 0 && (
            <div className="ci-loc-strip">
              {selected.locations.map((loc, i) => (
                <div key={i} className="ci-loc-pill">
                  <MapPin size={16} weight="duotone" style={{ color: "#7A8A6A", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>{loc.service || "Location"}</strong>
                    {loc.address || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="ci-split">
            <div className="ci-contact-block">
              <h3>Contact & team</h3>
              {therapistName && (
                <div className="ci-contact-item">
                  <strong>Main therapist</strong>
                  {therapistName}
                </div>
              )}
              {selected.supervisor && (
                <div className="ci-contact-item">
                  <strong>Supervisor</strong>
                  {selected.supervisor}
                </div>
              )}
              {selected.parent_phone && (
                <div className="ci-contact-item">
                  <strong>Parent phone</strong>
                  <span className="inline-flex items-center gap-1">
                    <Phone size={13} /> {selected.parent_phone}
                  </span>
                </div>
              )}
              {selected.service_type && (
                <div className="ci-contact-item">
                  <strong>Service type</strong>
                  {selected.service_type}
                </div>
              )}
            </div>

            <div className="ci-tile-grid">
              <SectionTile
                icon={<MapPin size={20} weight="duotone" />}
                title="Locations"
                desc="Home, school & clinic addresses"
                onClick={() => onOpenSection("location")}
              />
              <SectionTile
                icon={<Paperclip size={20} weight="duotone" />}
                title="Attachments"
                desc="Documents, reports & files"
                onClick={() => onOpenSection("attachments")}
              />
              <SectionTile
                icon={<ClipboardText size={20} weight="duotone" />}
                title="Case details"
                desc="Diagnosis, goals & clinical notes"
                onClick={() => onOpenSection("details")}
              />
              <SectionTile
                icon={<ChartLineUp size={20} weight="duotone" />}
                title="Progress reports"
                desc={prCount > 0 ? `${prCount} report${prCount !== 1 ? "s" : ""} on file` : "Track development milestones"}
                badge={prCount}
                onClick={() => onOpenSection("progress")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTile({ icon, title, desc, onClick, badge }) {
  return (
    <button type="button" className="ci-tile" onClick={onClick}>
      <span className="ci-tile-icon">{icon}</span>
      <span className="ci-tile-title">
        {title}
        {badge > 0 && (
          <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#D4A64A", color: "#2C3625", verticalAlign: "middle" }}>
            {badge}
          </span>
        )}
      </span>
      <span className="ci-tile-desc">{desc}</span>
      <span className="ci-tile-link">Open <CaretRight size={12} weight="bold" /></span>
    </button>
  );
}
