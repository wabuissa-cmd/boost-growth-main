import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Paperclip, ClipboardText, MapPin,
  Leaf, PencilSimple, Trash, CaretRight,
} from "@phosphor-icons/react";
import LocationLink from "./LocationLink";
import { formatLocationLabel, getMapsHref } from "../mapsUtils";
import { getChildColor, readable } from "../childColors";
import { prepTrackMeta, cardStatusMeta } from "../attendanceUtils";
import { getTherapistScheduleName } from "../scheduleConstants";
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

const RECORD_SECTIONS = [
  { id: "attachments", icon: Paperclip, title: "Records & files", desc: "Drive links, intake & case documents" },
  { id: "details", icon: ClipboardText, title: "Case summary", desc: "Diagnosis, goals & clinical notes" },
];

function LocationSectionCard({ locations = [] }) {
  const items = locations.filter(l => (l.address || "").trim());
  const primary = items[0];
  const label = primary ? (formatLocationLabel(primary.address) || primary.address) : "";
  const desc = items.length === 0
    ? "No locations on file"
    : items.length === 1
      ? (primary.service ? `${primary.service} · ${label}` : label)
      : `${items.length} saved addresses`;

  const inner = (
    <>
      <span className="ci-section-card-icon"><MapPin size={16} weight="duotone" /></span>
      <div className="ci-section-card-body">
        <h3>Location</h3>
        <p>{desc}</p>
        {items.length > 0 && (
          items.length === 1 ? (
            <span className="ci-section-card-maps">
              <MapPin size={12} weight="duotone" />
              Open in Maps
            </span>
          ) : (
            <div className="ci-section-card-maps-list">
              {items.map((l, i) => {
                const addrLabel = formatLocationLabel(l.address) || l.address;
                return (
                  <LocationLink key={`${l.service || "loc"}-${i}`} address={l.address} className="ci-section-card-maps">
                    <MapPin size={12} weight="duotone" />
                    {l.service ? `${l.service} · ` : ""}{addrLabel}
                  </LocationLink>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );

  if (items.length === 1 && getMapsHref(primary.address)) {
    return (
      <LocationLink address={primary.address} className="ci-section-card">
        {inner}
      </LocationLink>
    );
  }

  return (
    <div className="ci-section-card ci-section-card--static">
      {inner}
    </div>
  );
}

export default function ClientInfoLayout({
  clients, selectedId, onSelect, pkgByClient, findTherapist, counts,
  isAdmin, hasOps, canDeleteClient, onOpenSection, onEdit, onRemove, onBilling, onPhoneSave,
}) {
  const selected = useMemo(
    () => clients.find(c => c.id === selectedId) || clients[0] || null,
    [clients, selectedId]
  );

  const detailRef = useRef(null);

  const handleSelect = useCallback((id) => {
    onSelect(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 960px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [onSelect]);

  useEffect(() => {
    if (!clients.length) return;
    if (selectedId == null && clients[0]?.id) onSelect(clients[0].id);
  }, [clients, selectedId, onSelect]);

  const selectedPkg = selected ? (pkgByClient[selected.id] || []) : [];
  const track = selected ? prepTrackMeta(selected) : null;
  const statusMeta = selected ? cardStatusMeta(selected.cardStatus || "ok") : null;
  const therapistName = selected
    ? getTherapistScheduleName(findTherapist(selected.main_therapist_id))
    : "";
  const driveLinkCount = selected ? (selected.drive_links?.length || 0) : 0;
  const avatarBg = selected ? (getChildColor(selected.name) || selected.color || "#E5EBE1") : "#E5EBE1";
  const canEditPhone = isAdmin || hasOps || Boolean(onPhoneSave);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);

  useEffect(() => {
    setPhoneDraft(selected?.parent_phone || "");
    setPhoneEditing(false);
  }, [selected?.id, selected?.parent_phone]);

  const savePhone = async () => {
    if (!selected || !onPhoneSave) return;
    setPhoneSaving(true);
    try {
      await onPhoneSave(selected, phoneDraft.trim());
      setPhoneEditing(false);
    } finally {
      setPhoneSaving(false);
    }
  };

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
              const tName = getTherapistScheduleName(findTherapist(c.main_therapist_id));
              const bg = getChildColor(c.name) || c.color || "#E5EBE1";
              const avatarColor = getChildColor(c.name) || c.color ? readable(bg) : "#606E52";
              const isSelected = selected?.id === c.id;
              return (
                <button key={c.id} type="button" className={`ci-client-card${isSelected ? " selected" : ""}`} onClick={() => handleSelect(c.id)}>
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

        <div className="ci-pane-right" ref={detailRef}>
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
                    <dt>Phone</dt>
                    <dd>
                      {phoneEditing ? (
                        <span className="flex items-center gap-1 flex-wrap">
                          <input
                            className="text-xs border rounded-lg px-2 py-1 min-w-[120px]"
                            style={{ borderColor: "#C4D4B8" }}
                            value={phoneDraft}
                            onChange={e => setPhoneDraft(e.target.value)}
                            placeholder="05xxxxxxxx"
                          />
                          <button type="button" className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "#7A8A6A", color: "#fff" }} onClick={savePhone} disabled={phoneSaving}>
                            {phoneSaving ? "…" : "Save"}
                          </button>
                          <button type="button" className="text-[10px] underline" style={{ color: "#8B9E7A" }} onClick={() => { setPhoneEditing(false); setPhoneDraft(selected.parent_phone || ""); }}>Cancel</button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {selected.parent_phone || "—"}
                          {canEditPhone && onPhoneSave && (
                            <button type="button" className="text-[10px] underline" style={{ color: "#5C8A47" }} onClick={() => setPhoneEditing(true)}>
                              {selected.parent_phone ? "Edit" : "Add"}
                            </button>
                          )}
                        </span>
                      )}
                    </dd>
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
                  {canDeleteClient && (
                    <button
                      type="button"
                      data-testid="delete-client-btn"
                      className="ci-btn-outline-p"
                      style={{ color: "#B91C1C", borderColor: "#FECACA" }}
                      onClick={() => onRemove(selected)}
                    >
                      <Trash size={14} className="inline mr-1" style={{ verticalAlign: -2 }} />
                      Remove
                    </button>
                  )}
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
                <p className="ci-timeline-title">Client records</p>
                <div className="ci-section-grid">
                  <LocationSectionCard locations={selected.locations || []} />
                  {RECORD_SECTIONS.map((s) => {
                    const Icon = s.icon;
                    const desc = s.id === "attachments" && driveLinkCount > 0
                      ? `${driveLinkCount} file${driveLinkCount !== 1 ? "s" : ""}`
                      : s.desc;
                    return (
                      <button key={s.id} type="button" className="ci-section-card" onClick={() => onOpenSection(s.id)}>
                        <span className="ci-section-card-icon"><Icon size={16} weight="duotone" /></span>
                        <div className="ci-section-card-body">
                          <h3>{s.title}</h3>
                          <p>{desc}</p>
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
