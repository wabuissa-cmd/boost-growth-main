import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  MapPin, Leaf, Trash, CaretRight, UsersThree,
  House, Receipt, ClipboardText, Paperclip,
} from "@phosphor-icons/react";
import LocationLink from "./LocationLink";
import { formatLocationLabel, getMapsHref } from "../mapsUtils";
import { getChildColor, readable } from "../childColors";
import { clientDisplayName, formatSupervisorDisplayName } from "../clientDisplayUtils";
import { prepTrackMeta, cardStatusMeta, formatClientStatus, computeAgeFromBirthDate, formatBirthDateDisplay } from "../attendanceUtils";
import { getTherapistScheduleName } from "../scheduleConstants";
import { formatPkgUsedRemaining } from "../packageStatusUtils";
import { AttendanceHistoryModal } from "../pages/Attendance";
import "../clientInfoLayout.css";

const DETAIL_TABS = [
  { id: "overview", label: "Overview", icon: House },
  { id: "billing", label: "Billing & History", icon: Receipt },
  { id: "summary", label: "Case Summary", icon: ClipboardText },
  { id: "records", label: "Records", icon: Paperclip },
];

function worstPkgRow(rows) {
  if (!rows?.length) return null;
  const order = { critical: 0, expired: 1, low: 2, ok: 3, good: 3, none: 4 };
  return [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))[0];
}

function pkgAlertDot(rows) {
  const w = worstPkgRow(rows);
  if (!w || ["none", "good", "ok"].includes(w.status)) return null;
  const colors = { critical: "#B91C1C", expired: "#8A3F27", low: "#B45309" };
  return colors[w.status] || "#6B8F71";
}

function MiniPkgBar({ row }) {
  if (!row || row.status === "none") return null;
  const total = row.package_size || 1;
  const used = row.used || 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const ur = formatPkgUsedRemaining(row);
  return (
    <div className="ci-pkg-mini">
      <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{row.service_type}</span>
      <div className="ci-pkg-mini-track">
        <div className="ci-pkg-mini-fill" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{ur.remaining} left</span>
    </div>
  );
}

function LocationList({ locations = [] }) {
  const items = locations.filter(l => (l.address || "").trim());
  if (!items.length) {
    return <p className="ci-loc-empty">No locations on file</p>;
  }
  return (
    <div className="location-list">
      {items.map((l, i) => {
        const addrLabel = formatLocationLabel(l.address) || l.address;
        return (
          <div key={`${l.service || "loc"}-${i}`} className="location-item">
            <MapPin size={18} weight="duotone" style={{ color: "#5C8A47", flexShrink: 0, marginTop: 2 }} />
            <div className="location-item-body">
              {l.service && (
                <span className="ci-loc-service">{l.service}</span>
              )}
              {getMapsHref(l.address) ? (
                <LocationLink address={l.address} className="location-item-address">
                  {addrLabel}
                </LocationLink>
              ) : (
                <span className="location-item-address" style={{ textDecoration: "none" }}>{addrLabel}</span>
              )}
              {getMapsHref(l.address) && (
                <LocationLink address={l.address} className="location-maps-btn">
                  <MapPin size={14} weight="duotone" /> Open in Maps
                </LocationLink>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClientInfoLayout({
  clients, selectedId, onSelect, pkgByClient, findTherapist,
  isAdmin, hasOps, canDeleteClient,
  user, therapists, sessions, onRefreshSessions,
  canEditRecords, canSyncDrive, onClientRefresh,
  onEdit, onRemove, onBilling, onPhoneSave,
  CaseSummaryPanel, RecordsPanel,
}) {
  const selected = useMemo(
    () => clients.find(c => c.id === selectedId) || null,
    [clients, selectedId]
  );

  const detailRef = useRef(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [selected?.id]);

  const handleSelect = useCallback((id) => {
    onSelect(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 960px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [onSelect]);

  const selectedPkg = selected ? (pkgByClient[selected.id] || []) : [];
  const track = selected ? prepTrackMeta(selected) : null;
  const statusMeta = selected ? cardStatusMeta(selected.cardStatus || "ok") : null;
  const therapistName = selected
    ? getTherapistScheduleName(findTherapist(selected.main_therapist_id))
    : "";
  const avatarBg = selected ? (getChildColor(selected.name) || selected.color || "var(--bg-warm, #E9E2D6)") : "var(--bg-warm, #E9E2D6)";
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
    return (
      <div className="clients-page-empty">
        <div className="clients-page-empty-icon"><UsersThree size={28} weight="duotone" /></div>
        <h3 className="clients-page-empty-title">No clients match your filters</h3>
        <p className="clients-page-empty-text">Try another tab or clear your search.</p>
      </div>
    );
  }

  const displayName = selected ? clientDisplayName(selected) : "";

  return (
    <div className="ci-naturora">
      <div className="ci-canvas">
        <div className="ci-pane-left">
          <div className="ci-pane-brand">
            <h2><Leaf size={14} className="inline mr-1" style={{ verticalAlign: -2 }} /> Client Directory</h2>
          </div>
          <div className="ci-pane-list">
            {clients.map(c => {
              const dot = pkgAlertDot(pkgByClient[c.id]);
              const tName = getTherapistScheduleName(findTherapist(c.main_therapist_id));
              const bg = getChildColor(c.name) || c.color || "var(--bg-warm, #E9E2D6)";
              const avatarColor = getChildColor(c.name) || c.color ? readable(bg) : "var(--text-secondary)";
              const isSelected = selected?.id === c.id;
              return (
                <button key={c.id} type="button" className={`ci-client-card${isSelected ? " selected" : ""}`} onClick={() => handleSelect(c.id)}>
                  <div className="ci-client-card-inner">
                    <div className="ci-client-card-avatar" style={{ background: bg, color: avatarColor }}>
                      {c.initials || c.name?.charAt(0)}
                    </div>
                    <div className="ci-client-card-body">
                      <div className="ci-client-card-top">
                        <div className="ci-client-card-name">{clientDisplayName(c)}</div>
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
              <div className="ci-profile-card ci-profile-card--hero">
                <div className="ci-profile-avatar" style={{ background: avatarBg, color: readable(avatarBg) }}>
                  {selected.initials || selected.name?.charAt(0)}
                </div>
                <div className="ci-profile-info">
                  <h1>{displayName}</h1>
                  {selected.name_ar && selected.name_ar !== selected.name && (
                    <p className="ci-profile-name-ar">{selected.name_ar}</p>
                  )}
                  <dl className="ci-profile-grid">
                    <dt>File</dt><dd>#{selected.file_no || "—"}</dd>
                    <dt>Status</dt><dd>{formatClientStatus(selected.status)}</dd>
                    <dt>Therapist</dt><dd>{therapistName || "—"}</dd>
                    <dt>Phone</dt>
                    <dd>
                      {phoneEditing ? (
                        <span className="flex items-center gap-1 flex-wrap">
                          <input
                            className="text-xs border rounded-lg px-2 py-1 min-w-[120px]"
                            style={{ borderColor: "var(--border-default)" }}
                            value={phoneDraft}
                            onChange={e => setPhoneDraft(e.target.value)}
                            placeholder="05xxxxxxxx"
                          />
                          <button type="button" className="ci-btn-green-sm" onClick={savePhone} disabled={phoneSaving}>
                            {phoneSaving ? "…" : "Save"}
                          </button>
                            <button type="button" className="text-[10px] underline" style={{ color: "var(--brand-sage)" }} onClick={() => { setPhoneEditing(false); setPhoneDraft(selected.parent_phone || ""); }}>Cancel</button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {selected.parent_phone || "—"}
                          {canEditPhone && onPhoneSave && (
                            <button type="button" className="text-[10px] underline" style={{ color: "var(--brand)" }} onClick={() => setPhoneEditing(true)}>
                              {selected.parent_phone ? "Edit" : "Add"}
                            </button>
                          )}
                        </span>
                      )}
                    </dd>
                    <dt>Birth date</dt><dd>{formatBirthDateDisplay(selected.birth_date)}</dd>
                    <dt>Age</dt><dd>{computeAgeFromBirthDate(selected.birth_date) || selected.age || "—"}</dd>
                    <dt>Supervisor</dt><dd>{formatSupervisorDisplayName(selected.supervisor)}</dd>
                    {(selected.family_prep_url || (hasOps || isAdmin)) && (
                      <>
                        <dt>Family prep link</dt>
                        <dd>
                          {selected.family_prep_url ? (
                            <a href={selected.family_prep_url} target="_blank" rel="noreferrer" className="underline text-xs break-all" style={{ color: "var(--brand)" }}>
                              {selected.family_prep_url}
                            </a>
                          ) : (
                            <span className="text-xs" style={{ color: "#9CA3AF" }}>Add in Edit client (published sheet for parents)</span>
                          )}
                        </dd>
                      </>
                    )}
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

              <nav className="ci-detail-tabs" aria-label="Client sections">
                {DETAIL_TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`ci-detail-tab${activeTab === id ? " is-active" : ""}`}
                    onClick={() => setActiveTab(id)}
                  >
                    <Icon size={15} weight="duotone" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>

              <div className="ci-tab-panel">
                {activeTab === "overview" && (
                  <>
                    {selectedPkg.length > 0 && (
                      <div className="ci-pkg-box">
                        <div className="ci-panel-title">Packages</div>
                        {track?.label && <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{track.label}</div>}
                        {selectedPkg.map(row => <MiniPkgBar key={row.service_type} row={row} />)}
                      </div>
                    )}
                    <div className="ci-locations-box">
                      <div className="ci-panel-title">Locations</div>
                      <LocationList locations={selected.locations || []} />
                    </div>
                  </>
                )}

                {activeTab === "billing" && (
                  <div className="ci-billing-panel">
                    <AttendanceHistoryModal
                      embedded
                      client={selected}
                      sessions={sessions}
                      therapists={therapists}
                      isAdmin={isAdmin}
                      user={user}
                      currentUserId={user?.therapist_id || user?.id}
                      onRefresh={onRefreshSessions}
                    />
                  </div>
                )}

                {activeTab === "summary" && CaseSummaryPanel && (
                  <CaseSummaryPanel
                    inline
                    client={selected}
                    therapists={therapists}
                    user={user}
                    isAdmin={isAdmin}
                    onSaved={onClientRefresh}
                  />
                )}

                {activeTab === "records" && RecordsPanel && (
                  <RecordsPanel
                    inline
                    client={selected}
                    canEdit={!!canEditRecords}
                    canSyncDrive={!!canSyncDrive}
                    onRefresh={onClientRefresh}
                    onSaved={onClientRefresh}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="ci-empty-select">
              <Leaf size={32} weight="duotone" />
              <p>Select a client from the directory</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
