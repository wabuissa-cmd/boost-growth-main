import { useEffect, useMemo } from "react";
import {
  MapPin, Paperclip, ClipboardText, ChartLineUp, PencilSimple,
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
        {/* Left half — directory */}
        <div className="ci-pane-left">
          <div className="ci-pane-brand">
            <div className="ci-pane-logo">
              <Leaf size={24} weight="thin" />
            </div>
            <h2>Client Directory</h2>
            <p>Select a child to view their profile, services & case files</p>
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
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ci-pane-item${isSel ? " selected" : ""}`}
                  onClick={() => onSelect(c.id)}
                >
                  <div className="ci-pane-item-name">{c.name}</div>
                  <div className="ci-pane-item-sub">
                    <span>File #{c.file_no || "—"}</span>
                    {tName && <span>· {tName}</span>}
                    {dot && <span className="ci-pane-item-dot" style={{ background: dot }} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right half — detail (merged canvas) */}
        <div className="ci-pane-right">
          {selected ? (
            <>
              <div className="ci-meta-bar">
                <MetaItem icon={<House size={20} weight="light" />} label="Home" value={selected.hasHs ? (selectedPkg.find(r => r.service_type === "HS") ? formatPkgBadge(selectedPkg.find(r => r.service_type === "HS")) : "Active") : "—"} />
                <MetaItem icon={<GraduationCap size={20} weight="light" />} label="School" value={selected.hasSs ? (selectedPkg.find(r => r.service_type === "SS") ? formatPkgBadge(selectedPkg.find(r => r.service_type === "SS")) : "Active") : "—"} />
                <MetaItem icon={<CheckCircle size={20} weight="light" />} label="Status" value={selected.status || "Active"} />
                <MetaItem icon={<User size={20} weight="light" />} label="Therapist" value={therapistName || "—"} />
                <MetaItem icon={<Folder size={20} weight="light" />} label="File" value={`#${selected.file_no || "—"}`} />
                <MetaItem icon={<CalendarBlank size={20} weight="light" />} label="Age" value={selected.age || "—"} />
              </div>

              <div className="ci-hero-split">
                <div className="ci-hero-copy">
                  <h1>{selected.name}</h1>
                  <p className="ci-hero-tagline">
                    {svc && <>{svc}. </>}
                    {track?.sub || track?.label || "Client profile & clinical records"}
                    {selected.parent_phone && (
                      <> · <Phone size={12} className="inline" style={{ verticalAlign: -1 }} /> {selected.parent_phone}</>
                    )}
                  </p>
                  {isAdmin && selected.cardStatus && selected.cardStatus !== "ok" && statusMeta && (
                    <span className="inline-block text-xs font-bold px-2 py-1 rounded-sm" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                  )}
                  <div className="ci-hero-ctas">
                    {hasOps && (
                      <button type="button" className="ci-btn-olive" onClick={onBilling}>
                        Open billing
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" className="ci-btn-ghost" onClick={() => onEdit(selected)}>
                        <PencilSimple size={14} className="inline mr-1" style={{ verticalAlign: -2 }} />
                        Edit profile
                      </button>
                    )}
                  </div>
                </div>
                <div className="ci-hero-visual">
                  <div
                    className="ci-hero-portrait"
                    style={{
                      background: getChildColor(selected.name) || selected.color || "#fff",
                      color: readable(getChildColor(selected.name) || selected.color || "#fff"),
                    }}
                  >
                    {selected.initials || selected.name?.charAt(0)}
                  </div>
                </div>
              </div>

              {selectedPkg.length > 0 && (
                <div className="ci-pkg-strip">
                  {selectedPkg.map(row => (
                    <MiniPkgBar key={row.service_type} row={row} />
                  ))}
                </div>
              )}

              <div className="ci-categories">
                <CategoryCard icon={<MapPin size={28} weight="light" />} label="Locations" onClick={() => onOpenSection("location")} />
                <CategoryCard icon={<Paperclip size={28} weight="light" />} label="Attachments" onClick={() => onOpenSection("attachments")} />
                <CategoryCard icon={<ClipboardText size={28} weight="light" />} label="Case details" onClick={() => onOpenSection("details")} />
                <CategoryCard icon={<ChartLineUp size={28} weight="light" />} label={`Progress${prCount > 0 ? ` (${prCount})` : ""}`} onClick={() => onOpenSection("progress")} />
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
