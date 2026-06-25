import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, X, UsersThree } from "@phosphor-icons/react";
import { getChildColor, readable } from "../childColors";

export default function ClientPickerSheet({
  open,
  onClose,
  clients,
  selectedId,
  onSelect,
  findTherapist,
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(query) || (c.file_no || "").includes(q.trim())
    );
  }, [clients, q]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="client-picker-backdrop"
        aria-label="Close client list"
        onClick={onClose}
      />
      <div className="client-picker-sheet" role="dialog" aria-label="All clients">
        <div className="client-picker-head">
          <div className="flex items-center gap-2 min-w-0">
            <UsersThree size={20} weight="duotone" style={{ color: "#6B8F71", flexShrink: 0 }} />
            <div className="font-bold text-sm" style={{ color: "#2F4A35" }}>All Clients</div>
          </div>
          <button type="button" className="btn btn-ghost p-1.5 min-h-0" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="client-picker-search">
          <MagnifyingGlass size={15} className="client-picker-search-icon" />
          <input
            className="input client-picker-search-input"
            placeholder="Search name or file #…"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="client-picker-list">
          {filtered.length === 0 ? (
            <div className="text-center text-sm py-8" style={{ color: "#8B9E7A" }}>No clients match your search.</div>
          ) : filtered.map(c => {
            const bg = getChildColor(c.name) || c.color || "#E5EBE1";
            const avatarColor = getChildColor(c.name) || c.color ? readable(bg) : "#606E52";
            const tName = findTherapist?.(c.main_therapist_id)?.name?.replace("Ms. ", "");
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                className={`client-picker-row${active ? " is-active" : ""}`}
                onClick={() => { onSelect(c.id); onClose(); }}
              >
                <span className="client-picker-avatar" style={{ background: bg, color: avatarColor }}>
                  {(c.name || "?").charAt(0)}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="client-picker-name">{c.name}</span>
                  <span className="client-picker-meta">
                    {c.file_no ? `#${c.file_no}` : "—"}
                    {tName ? ` · ${tName}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
