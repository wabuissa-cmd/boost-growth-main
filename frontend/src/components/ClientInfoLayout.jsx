import { useEffect, useMemo } from "react";
import {
  MapPin, Paperclip, ClipboardText, ChartLineUp,
  Leaf, House, GraduationCap, User, Folder, CalendarBlank,
  Phone, CheckCircle,
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
  if (!w || ["none", "good", "ok"].includes(w.status)) return null;
  return pkgStatusStyle(w.status).color;
}

function serviceLabel(c) {
  if (c.hasHs && c.hasSs) return "HS + SS";
  if (c.hasSs) return "School Support";
  if (c.hasHs) return "Home Session";
  return c.service_type || "—";
}

function MiniPkgBar({ row }) {
  if (!row || row.status === "none") return null;
  const total = row.package_size || 1;
  const used = row.used || 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const ur = formatPkgUsedRemaining(row);
  return (
    <div className="ci-pkg-mini">
      <span className="ci-pkg-mini-label">{row.service_type}</span>
      <div className="ci-pkg-mini-track">
        <div className="ci-pkg-mini-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="ci-pkg-mini-val">{ur.remaining} left</span>
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
  const svc = selected ? serviceLabel(selected) : "";
  const avatarBg = selected ? (getChildColor(selected.name) || selected.color || "#E5EBE1") : "#E5EBE1";

  if (!clients.length) {
    return (
      <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
        No clients match your filters.
      </div>
    );
  }

  return (
    <div className="ci-naturora">
      <div className="ci-canvas">
        <div className="ci-pane-left">
          <div className="ci-pane-brand">
            <div className="ci-pane-logo">
              <Leaf size={22} weight="thin" />
            </div>
            <h2>Client Directory</h2>
            <p>Select a child to view profile & case files</p>
            <div className="ci-pane-stats">
              <span><em>{counts.active}</em> Active</span>
              <span><em>{counts.all}</em> Total</span>
              {counts.attention > 0 && <span><em>{counts.attention}</em> Alerts</span>}
            </div>
          </div>
          <div className="ci-pane-list">
            {clients.map(c => {
              const dot = pkgAlertDot(pkgByClient[c.id]);
              const tName = findTherapist(c.main_therapist_id)?.name?.replace("Ms. ", "");
              const isSel = selected?.id === c.id;
              const bg = getChildColor(c.name) || c.color || "#7A8A6A";
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ci-pane-item${isSel ? " selected" : ""}`}
                  onClick={() => onSelect(c.id)}
                >
                  <div className="ci-pane-item-avatar" style={{ background: bg, color: readable(bg) }}>
                    {c.initials || c.name?.charAt(0)}
                  </div>
                  <div className="ci-pane-item-body">
                    <div className="ci-pane-item-name">{c.name}</div>
                    <div className="ci-pane-item-sub">
                      <span>File #{c.file_no || "—"}</span>
                      {tName && <span>· {tName}</span>}
                    </div>
                  </div>
                  {dot && <span className="ci-pane-item-dot" style={{ background: dot }} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ci-pane-right">
          {selected ? (
            <>
              <div className="ci-meta-bar">
                <MetaItem icon={<House size={16} weight="light" />} label="Home" value={selected.hasHs ? (selectedPkg.find(r => r.service_type === "HS") ? formatPkgBadge(selectedPkg.find(r => r.service_type === "HS")) : "Active") : "—"} />
                <MetaItem icon={<GraduationCap size={16} weight="light" />} label="School" value={selected.hasSs ? (selectedPkg.find(r => r.service_type === "SS") ? formatPkgBadge(selectedPkg.find(r => r.service_type === "SS")) : "Active") : "—"} />
                <MetaItem icon={<CheckCircle size={16} weight="light" />} label="Status" value={selected.status || "Active"} />
                <MetaItem icon={<User size={16} weight="light" />} label="Therapist" value={therapistName || "—"} />
                <MetaItem icon={<Folder size={16} weight="light" />} label="File" value={`#${selected.file_no || "—"}`} />
                <MetaItem icon={<CalendarBlank size={16} weight="light" />} label="Age" value={selected.age || "—"} />
              </div>

              <div className="ci-profile-body">
                <div className="ci-profile-card">
                  <div className="ci-profile-avatar" style={{ background: avatarBg, color: readable(avatarBg) }}>
                    {selected.initials || selected.name?.charAt(0)}
                  </div>
                  <div className="ci-profile-info">
                    <h1>{selected.name}</h1>
                    <p className="ci-profile-tagline">
                      {svc}
                      {track?.sub ? ` · ${track.sub}` : track?.label ? ` · ${track.label}` : ""}
                      {selected.parent_phone && (
                        <> · <Phone size={11} className="inline" style={{ verticalAlign: -1 }} /> {selected.parent_phone}</>
                      )}
                    </p>
                    {isAdmin && selected.cardStatus && selected.cardStatus !== "ok" && statusMeta && (
                      <span className="ci-status-badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="ci-profile-actions">
                    {hasOps && (
                      <button type="button" className="ci-btn-olive" onClick={onBilling}>Billing</button>
                    )}
                    {isAdmin && (
                      <button type="button" className="ci-btn-ghost" onClick={() => onEdit(selected)}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {selectedPkg.length > 0 && (
                  <div className="ci-pkg-box">
                    <div className="ci-pkg-box-title">Package progress</div>
                    {selectedPkg.map(row => (
                      <MiniPkgBar key={row.service_type} row={row} />
                    ))}
                  </div>
                )}

                <div>
                  <p className="ci-sections-label">Case files & records</p>
                  <div className="ci-categories">
                    <CategoryCard icon={<MapPin size={18} weight="duotone" />} label="Locations" onClick={() => onOpenSection("location")} />
                    <CategoryCard icon={<Paperclip size={18} weight="duotone" />} label="Attachments" onClick={() => onOpenSection("attachments")} />
                    <CategoryCard icon={<ClipboardText size={18} weight="duotone" />} label="Case details" onClick={() => onOpenSection("details")} />
                    <CategoryCard icon={<ChartLineUp size={18} weight="duotone" />} label={prCount > 0 ? `Progress (${prCount})` : "Progress"} onClick={() => onOpenSection("progress")} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="ci-empty-pane">Select a client from the directory</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }) {
  return (
    <div className="ci-meta-item">
      {icon}
      <span className="ci-meta-label">{label}</span>
      <span className="ci-meta-value" title={String(value)}>{value}</span>
    </div>
  );
}

function CategoryCard({ icon, label, onClick }) {
  return (
    <button type="button" className="ci-cat-card" onClick={onClick}>
      <div className="ci-cat-visual">{icon}</div>
      <div className="ci-cat-label">{label}</div>
    </button>
  );
}
