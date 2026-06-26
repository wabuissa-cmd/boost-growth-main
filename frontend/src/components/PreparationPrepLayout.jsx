import { useEffect, useMemo } from "react";
import { ClipboardText, CheckCircle, Clock, Warning } from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";
import { prepTrackMeta, cardStatusMeta } from "../attendanceUtils";
import { getTherapistScheduleName } from "../scheduleConstants";
import LocationLink from "./LocationLink";
import SsWeekStatusRow from "./SsWeekStatusRow";
import "../preparationLayout.css";

function PrepRing({ value }) {
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
        <div className="prep-ring-lbl">Progress</div>
      </div>
    </div>
  );
}

export default function PreparationPrepLayout({
  clients,
  selectedId,
  onSelect,
  onLog,
  onHistory,
  onInvoiceSheet,
  counts,
  isAdmin,
  findTherapist,
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

  const attention = (counts?.urgent || 0) + (counts?.warning || 0);
  const track = selected ? prepTrackMeta(selected) : null;
  const statusMeta = selected ? cardStatusMeta(selected.cardStatus) : null;

  if (!clients.length) {
    return (
      <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
        No clients match your search.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="prep-stats">
        <div className="prep-stat-card">
          <div className="prep-stat-icon" style={{ background: "#E5EBE1", color: "#606E52" }}>
            <ClipboardText size={22} weight="fill" />
          </div>
          <div>
            <div className="prep-stat-value">{counts?.all ?? clients.length}</div>
            <div className="prep-stat-label">My clients</div>
          </div>
        </div>
        <div className="prep-stat-card">
          <div className="prep-stat-icon" style={{ background: "#F0E4C8", color: "#6B5218" }}>
            {isAdmin ? <Warning size={22} weight="fill" /> : <CheckCircle size={22} weight="fill" />}
          </div>
          <div>
            <div className="prep-stat-value">{isAdmin ? attention : (counts?.ok ?? 0)}</div>
            <div className="prep-stat-label">{isAdmin ? "Need attention" : "On track"}</div>
          </div>
        </div>
        <div className="prep-stat-card">
          <div className="prep-stat-icon" style={{ background: "#EAF0F3", color: "#375568" }}>
            <Clock size={22} weight="fill" />
          </div>
          <div>
            <div className="prep-stat-value">{track?.pct ?? 0}%</div>
            <div className="prep-stat-label">Selected progress</div>
          </div>
        </div>
      </div>

      <div className="prep-content">
        <div className="prep-client-list">
          {clients.map(c => {
            const t = prepTrackMeta(c);
            const svc = c.hasSs && c.hasHs ? "HS+SS" : (c.hasSs ? "SS" : (c.hasHs ? "HS" : t.service || "—"));
            const avatarBg = getChildColor(c.name) || cardStatusMeta(c.cardStatus).bar;
            const isSel = selected?.id === c.id;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className={`prep-client-card${isSel ? " selected" : ""}`}
                onClick={() => onSelect(c.id)}
                onKeyDown={e => e.key === "Enter" && onSelect(c.id)}
              >
                <div className="prep-client-avatar" style={{ background: avatarBg, color: readable(avatarBg) }}>
                  {c.initials || c.name?.[0]}
                </div>
                <div className="min-w-0">
                  <div className="prep-client-name">{c.name}</div>
                  <div className="prep-client-meta">
                    File #{c.file_no}
                    {c.location ? (
                      <> · <LocationLink address={c.locationHref || c.location} className="underline" onClick={e => e.stopPropagation()}>{c.location}</LocationLink></>
                    ) : null}
                  </div>
                </div>
                <span className="prep-pill">{svc} · {t.pct}%</span>
                <button
                  type="button"
                  className="prep-card-btn"
                  data-testid={`prep-select-${c.id}`}
                  onClick={(e) => { e.stopPropagation(); onSelect(c.id); onLog(c); }}
                >
                  Log
                </button>
              </div>
            );
          })}
        </div>

        {selected && (
          <aside className="prep-detail">
            <div>
              <div className="prep-detail-head">{selected.name}</div>
              <div className="prep-detail-sub">
                File #{selected.file_no} · {track?.service || "—"}
                {findTherapist?.(selected.main_therapist_id)
                  ? ` · ${getTherapistScheduleName(findTherapist(selected.main_therapist_id))}`
                  : ""}
              </div>
            </div>
            <div className="prep-ring-wrap">
              <PrepRing value={track?.pct ?? 0} />
            </div>
            <div className="prep-detail-rows">
              <div className="prep-detail-row"><span>Package</span><span>{track?.label || "—"}</span></div>
              <div className="prep-detail-row"><span>Detail</span><span>{track?.sub || "—"}</span></div>
              {isAdmin && statusMeta && selected.cardStatus !== "ok" && (
                <div className="prep-detail-row"><span>Status</span><span>{statusMeta.label}</span></div>
              )}
            </div>
            {selected.hasSs && selected.ssWeeks?.length > 0 && (
              <div className="rounded-xl p-2" style={{ background: "rgba(255,255,255,0.12)" }}>
                <SsWeekStatusRow weeks={selected.ssWeeks} compact />
              </div>
            )}
            <div className="prep-detail-actions">
              <button type="button" className="prep-detail-cta" data-testid={`log-${selected.id}`} onClick={() => onLog(selected)}>
                Log session
              </button>
              <button type="button" className="prep-detail-cta secondary" onClick={() => onHistory(selected)}>
                View history
              </button>
              {onInvoiceSheet && (
                <button type="button" className="prep-detail-cta secondary" data-testid={`invoice-sheet-${selected.id}`} onClick={() => onInvoiceSheet(selected)}>
                  Invoice sheet
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
