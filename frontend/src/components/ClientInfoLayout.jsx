import { useEffect, useMemo } from "react";
import {
  MapPin, Paperclip, ClipboardText, ChartLineUp,
  Leaf, PencilSimple, CaretRight,
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

function MiniPkgBar({ row }) {
  if (!row || row.status === "none") return null;
  const total = row.package_size || 1;
  const used = row.used || 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const ur = formatPkgUsedRemaining(row);
  return (
    <div className="ci-pkg-mini">
      <span style={{ fontWeight: 700, color: "#606E52" }}>{row.service_type}</span>
      <div className="ci-pkg-mini-track">
        <div className="ci-pkg-mini-fill" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: "0.65rem", color: "#5C6853" }}>{ur.remaining} left</span>
    </div>
  );
}

const SECTIONS = [
  { id: "location", icon: MapPin, title: "Locations", desc: "Home, school & clinic addresses" },
  { id: "attachments", icon: Paperclip, title: "Attachments", desc: "Documents & uploaded files" },
  { id: "details", icon: ClipboardText, title: "Case summary", desc: "Diagnosis, goals & clinical notes" },
  { id: "progress", icon: ChartLineUp, title: "Progress reports", desc: "Development milestones & reports" },
];

export default function ClientInfoLayout({
  clients, selectedId, onSelect, pkgByClient, findTherapist, prSummaries, counts,
  isAdmin, hasOps, onOpenSection, onEdit, onBilling,
}) {
  const selected = useMemo(
    () => clients.find(c => c.id === selectedId) || clients[0] || null,
    [clients, selectedId]
  );

  useEffect(() => {
    if (clients.length && !clients.some(c => c.id === selectedId)) onSelect(clients[0].id);
  }, [clients, selectedId, onSelect]);

  const selectedPkg = selected ? (pkgByClient[selected.id] || []) : [];
  const track = selected ? prepTrackMeta(selected) : null;
  const statusMeta = selected ? cardStatusMeta(selected.cardStatus || "ok") : null;
  const therapistName = selected ? findTherapist(selected.main_therapist_id)?.name?.replace("Ms. ", "") : "";
  const prCount = selected ? prSummaries?.[selected.id]?.count : 0;
  const avatarBg = selected ? (getChildColor(selected.name) || selected.color || "#E5EBE1") : "#E5EBE1";

  if (!clients.length) {
    return <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>No clients match your filters.</div>;
  }

  return (
    <div className="ci-naturora">
      <div className="ci-canvas">
        <div className="ci-pane-left">
          <div className="ci-pane-brand">
            <h2><Leaf size={14} className="inline mr-1" style={{ verticalAlign: -2 }} /> Client Directory</h2>
            <div className="ci-pane-stats">
              <span><em>{counts.active}</em> Active</span>
              <span><em>{counts.all}</em> Total</span>
              {counts.attention > 0 && <span className="ci-stat-alert"><em>{counts.attention}</em> Alerts</span>}
            </div>
          </div>
          <div className="ci-pane-list">
            {clients.map(c => {
              const dot = pkgAlertDot(pkgByClient[c.id]);
              const tName = findTherapist(c.main_therapist_id)?.name?.replace("Ms. ", "");
              const bg = getChildColor(c.name) || c.color || "#E5EBE1";
              const avatarColor = getChildColor(c.name) || c.color ? readable(bg) : "#606E52";
              const isSelected = selected?.id === c.id;
              return (
                <button key={c.id} type="button" className={`ci-client-card${isSelected ? " selected" : ""}`} onClick={() => onSelect(c.id)}>
                  <div className="ci-client-card-inner">
                    <div className="ci-client-card-avatar" style={{ background: bg, color: avatarColor }}>
                      {c.initials || c.name?.charAt(0)}
                    </div>
                    <div className="ci-client-card-body">
                      <div className="ci-client-card-top">
                        <div className="ci-client-card-name">{c.name}</div>
                        {dot && <span className="ci-client-card-alert" style={{ background: dot }} title="Package alert" />}
                      </div>
                      <div className="ci-client-card-meta">File #{c.file_no || "—"}</div>
                      {tName && <div className="ci-client-card-therapist">Therapist · {tName}</div>}
                    </div>
                    <CaretRight size={14} className="ci-client-card-chevron" weight="bold" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ci-pane-right">
          {selected ? (
            <div className="ci-profile-body">
              <div className="ci-profile-card">
                <div className="ci-profile-avatar" style={{ background: avatarBg, color: readable(avatarBg) }}>
                  {selected.initials || selected.name?.charAt(0)}
                </div>
                <div className="ci-profile-info">
                  <h1>{selected.name}</h1>
                  <dl className="ci-profile-grid">
                    <dt>File</dt><dd>#{selected.file_no || "—"}</dd>
                    <dt>Status</dt><dd>{selected.status || "Active"}</dd>
                    <dt>Therapist</dt><dd>{therapistName || "—"}</dd>
                    <dt>Phone</dt><dd>{selected.parent_phone || "—"}</dd>
                    <dt>Age</dt><dd>{selected.age || "—"}</dd>
                    <dt>Supervisor</dt><dd>{selected.supervisor || "—"}</dd>
                  </dl>
                  {isAdmin && selected.cardStatus && selected.cardStatus !== "ok" && statusMeta && (
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
                  )}
                </div>
                <div className="ci-profile-actions">
                  {hasOps && <button type="button" className="ci-btn-purple" onClick={onBilling}>Billing</button>}
                  {isAdmin && <button type="button" className="ci-btn-outline-p" onClick={() => onEdit(selected)}>Edit</button>}
                </div>
              </div>

              {selectedPkg.length > 0 && (
                <div className="ci-pkg-box">
                  <div className="ci-timeline-title" style={{ margin: 0 }}>Packages</div>
                  {track?.label && <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{track.label}</div>}
                  {selectedPkg.map(row => <MiniPkgBar key={row.service_type} row={row} />)}
                </div>
              )}

              <div className="ci-timeline">
                <p className="ci-timeline-title">Records & files</p>
                <div className="ci-timeline-list">
                  {SECTIONS.map((s, i) => {
                    const Icon = s.icon;
                    const desc = s.id === "progress" && prCount > 0 ? `${prCount} report(s) on file` : s.desc;
                    return (
                      <button key={s.id} type="button" className="ci-timeline-item" onClick={() => onOpenSection(s.id)}>
                        <div className="ci-timeline-rail">
                          <div className="ci-timeline-dot" />
                          {i < SECTIONS.length - 1 && <div className="ci-timeline-line" />}
                        </div>
                        <div className="ci-timeline-card">
                          <span className="ci-timeline-icon"><Icon size={18} weight="duotone" /></span>
                          <div className="flex-1 min-w-0">
                            <h3>{s.title}</h3>
                            <p>{desc}</p>
                          </div>
                          <CaretRight size={14} style={{ color: "#8B9E7A", flexShrink: 0 }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-sm" style={{ color: "#8B9E7A" }}>Select a client</div>
          )}
        </div>
      </div>
    </div>
  );
}
