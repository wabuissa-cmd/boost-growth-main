import { useEffect, useMemo } from "react";
import {
  Users, UserCircle, Warning, MapPin, Paperclip, ClipboardText,
  ChartLineUp, ArrowSquareOut, PencilSimple, Flower,
} from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import { prepTrackMeta, cardStatusMeta } from "../attendanceUtils";
import { formatPkgBadge, pkgStatusStyle } from "../packageStatusUtils";
import "../preparationLayout.css";
import "../clientInfoLayout.css";

function ProgressRing({ value, label = "Progress" }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="prep-ring">
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="#D4A64A" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div className="prep-ring-center">
        <div className="prep-ring-val">{value}%</div>
        <div className="prep-ring-lbl">{label}</div>
      </div>
    </div>
  );
}

function worstPkgRow(rows) {
  if (!rows?.length) return null;
  const order = { critical: 0, expired: 1, low: 2, ok: 3, good: 3, none: 4 };
  return [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))[0];
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
    <div className="space-y-4">
      <div className="prep-stats">
        <div className="prep-stat-card">
          <div className="prep-stat-icon" style={{ background: "#E5EBE1", color: "#606E52" }}>
            <Users size={22} weight="fill" />
          </div>
          <div>
            <div className="prep-stat-value">{counts.all}</div>
            <div className="prep-stat-label">Total clients</div>
          </div>
        </div>
        <div className="prep-stat-card">
          <div className="prep-stat-icon" style={{ background: "#EAF0F3", color: "#375568" }}>
            <UserCircle size={22} weight="fill" />
          </div>
          <div>
            <div className="prep-stat-value">{counts.active}</div>
            <div className="prep-stat-label">Active</div>
          </div>
        </div>
        <div className="prep-stat-card">
          <div className="prep-stat-icon" style={{ background: "#F0E4C8", color: "#6B5218" }}>
            <Warning size={22} weight="fill" />
          </div>
          <div>
            <div className="prep-stat-value">{counts.attention}</div>
            <div className="prep-stat-label">Package alerts</div>
          </div>
        </div>
      </div>

      <div className="ci-content">
        <div className="ci-list-wrap">
          {clients.map(c => {
            const avatarBg = getChildColor(c.name) || c.color || "#7A8A6A";
            const rows = pkgByClient[c.id] || [];
            const worst = worstPkgRow(rows);
            const st = worst && worst.status !== "none" ? pkgStatusStyle(worst.status) : null;
            const tName = findTherapist(c.main_therapist_id)?.name?.replace("Ms. ", "");
            const isSel = selected?.id === c.id;
            const svc = c.hasSs && c.hasHs ? "HS + SS" : (c.hasSs ? "SS" : (c.hasHs ? "HS" : "—"));
            return (
              <button
                key={c.id}
                type="button"
                className={`ci-list-card${isSel ? " selected" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <div className="ci-list-avatar" style={{ background: avatarBg, color: readable(avatarBg) }}>
                  {c.initials || c.name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="ci-list-name">{c.name}</div>
                  <div className="ci-list-meta">
                    <span>File #{c.file_no || "—"}</span>
                    {tName && (
                      <span className="inline-flex items-center gap-0.5">
                        <Flower size={11} weight="fill" style={{ color: "#C97B5C" }} />
                        {tName}
                      </span>
                    )}
                    <span>{svc}</span>
                  </div>
                </div>
                <div className="ci-list-pills">
                  {(c.status || "Active") === "Inactive" && (
                    <span className="prep-pill" style={{ background: "#F0EDE9", color: "#8B9E7A" }}>Inactive</span>
                  )}
                  {worst && worst.status !== "none" && (
                    <span className="prep-pill" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {worst.service_type} · {formatPkgBadge(worst)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <aside className="ci-detail">
            <div className="ci-detail-hero">
              <div
                className="ci-detail-avatar"
                style={{
                  background: getChildColor(selected.name) || selected.color || "#606E52",
                  color: readable(getChildColor(selected.name) || selected.color || "#606E52"),
                }}
              >
                {selected.initials || selected.name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="ci-detail-name">{selected.name}</h2>
                <div className="ci-detail-sub">
                  File #{selected.file_no || "—"}
                  {selected.age ? ` · Age ${selected.age}` : ""}
                </div>
                <span className="ci-status-pill">{selected.status || "Active"}</span>
              </div>
            </div>

            <div className="prep-ring-wrap">
              <ProgressRing value={track?.pct ?? 0} />
            </div>

            <div className="ci-inset">
              <div className="text-center text-sm font-semibold mb-1">{track?.label || "No open package"}</div>
              {track?.sub && <div className="text-center text-xs opacity-80">{track.sub}</div>}
              {isAdmin && selected.cardStatus && selected.cardStatus !== "ok" && statusMeta && (
                <div className="text-center mt-2">
                  <span className="prep-pill" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                </div>
              )}
            </div>

            <div className="ci-inset ci-info-rows">
              {therapistName && (
                <div className="ci-info-row"><span>Therapist</span><span>{therapistName}</span></div>
              )}
              {selected.supervisor && (
                <div className="ci-info-row"><span>Supervisor</span><span>{selected.supervisor}</span></div>
              )}
              {selected.parent_phone && (
                <div className="ci-info-row"><span>Phone</span><span>{selected.parent_phone}</span></div>
              )}
              {selected.service_type && (
                <div className="ci-info-row"><span>Service</span><span>{selected.service_type}</span></div>
              )}
            </div>

            {selectedPkg.length > 0 && (
              <div className="ci-inset">
                {selectedPkg.map(row => {
                  const ps = pkgStatusStyle(row.status);
                  return (
                    <div key={row.service_type} className="ci-pkg-row">
                      <span>{row.service_type === "HS" ? "Home Session" : "School Support"}</span>
                      <span style={{ color: ps.color, fontWeight: 700 }}>{formatPkgBadge(row)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {selected.locations?.length > 0 && (
              <div className="space-y-2">
                {selected.locations.slice(0, 2).map((loc, i) => (
                  <div key={i} className="ci-loc-card">
                    <MapPin size={18} weight="duotone" style={{ color: "#7A8A6A", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>{loc.service || "Location"}</strong>
                      <p>{loc.address || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ci-actions">
              <ActionCard icon={<MapPin size={18} />} label="Locations" onClick={() => onOpenSection("location")} />
              <ActionCard icon={<Paperclip size={18} />} label="Attachments" onClick={() => onOpenSection("attachments")} />
              <ActionCard icon={<ClipboardText size={18} />} label="Case details" onClick={() => onOpenSection("details")} />
              <ActionCard icon={<ChartLineUp size={18} />} label="Progress" badge={prCount} onClick={() => onOpenSection("progress")} />
            </div>

            <div className="flex flex-col gap-2">
              {hasOps && (
                <button type="button" className="ci-detail-cta" onClick={onBilling}>
                  <ArrowSquareOut size={16} className="inline mr-1.5" style={{ verticalAlign: -2 }} />
                  Open billing
                </button>
              )}
              {isAdmin && (
                <button type="button" className="ci-detail-cta secondary" onClick={() => onEdit(selected)}>
                  <PencilSimple size={16} className="inline mr-1.5" style={{ verticalAlign: -2 }} />
                  Edit profile
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function ActionCard({ icon, label, onClick, badge }) {
  return (
    <button type="button" className="ci-action-card" onClick={onClick}>
      <span className="ci-action-icon">{icon}</span>
      <span className="ci-action-label">{label}</span>
      {badge != null && badge > 0 && <span className="ci-action-badge">{badge}</span>}
    </button>
  );
}
