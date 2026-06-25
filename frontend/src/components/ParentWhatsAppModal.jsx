import { useEffect, useMemo, useState } from "react";
import { Copy, Check, WhatsappLogo } from "@phosphor-icons/react";
import { ModalBase, ModalBtnSecondary } from "./Modal";
import { buildWhatsAppUrl } from "../scheduleParentMessages";

export default function ParentWhatsAppModal({ open, onClose, messages, weekLabel, publishedNote }) {
  const [copiedId, setCopiedId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState([]);

  if (!open) return null;

  useEffect(() => {
    setDrafts((messages || []).map((m) => ({
      ...m,
      _id: m.childName,
      _removed: false,
      _message: m.message || "",
    })));
  }, [open]); // reset each open

  const copyMessage = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy message:", text);
    }
  };

  const visibleDrafts = useMemo(() => drafts.filter(d => !d._removed), [drafts]);

  const subtitle = [
    weekLabel,
    publishedNote,
    `${visibleDrafts.length} famil${visibleDrafts.length === 1 ? "y" : "ies"} with sessions`,
  ].filter(Boolean).join(" · ");

  return (
    <ModalBase
      title="Parent WhatsApp Messages"
      subtitle={subtitle}
      onClose={onClose}
      size="lg"
      footer={(
        <div className="flex justify-end">
          <ModalBtnSecondary onClick={onClose}>Close</ModalBtnSecondary>
        </div>
      )}
    >
      {visibleDrafts.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: "#5C6853" }}>
          No client sessions found for this week. Add schedule cells with a child name (HS / SS / OS), then try again.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm m-0" style={{ color: "#5C6853" }}>
            Ready-to-send Arabic messages for each family. Copy the text or open WhatsApp with the message pre-filled.
          </p>
          {visibleDrafts.map((row) => {
            const id = row._id;
            const isOpen = expanded === id;
            const messageText = row._message || "";
            const whatsappUrl = row.phone ? buildWhatsAppUrl(row.phone, messageText) : null;
            return (
              <div
                key={id}
                className="rounded-xl border p-3 sm:p-4"
                style={{ borderColor: "#D4DEC8", background: "#FAFCF8" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm" style={{ color: "#2F4A35" }}>{row.childName}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6B8270" }}>
                      {row.parentName ? `${row.parentName} · ` : ""}
                      {row.phone || "No phone — add in Client Info"}
                      {row.sessionCount ? ` · ${row.sessionCount} session${row.sessionCount > 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="btn btn-outline text-xs py-1.5 px-2.5 min-h-0"
                      onClick={() => copyMessage(id, messageText)}
                    >
                      {copiedId === id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === id ? "Copied" : "Copy"}
                    </button>
                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary text-xs py-1.5 px-2.5 min-h-0 no-underline"
                      >
                        <WhatsappLogo size={14} weight="fill" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "#F0E0D4", color: "#965132" }}>
                        Add phone first
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline text-xs py-1.5 px-2.5 min-h-0"
                      onClick={() => {
                        if (!window.confirm(`Remove ${row.childName} from this list?`)) return;
                        setDrafts((prev) => prev.map((p) => p._id === id ? { ...p, _removed: true } : p));
                      }}
                      title="Remove this client from the send list"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
                  style={{ color: "#6B8F71" }}
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  {isOpen ? "Hide editor" : "Edit message"}
                </button>
                {isOpen && (
                  <textarea
                    className="mt-2 p-3 rounded-lg text-sm whitespace-pre-wrap font-sans leading-relaxed m-0 w-full"
                    rows={8}
                    style={{ background: "#fff", border: "1px solid #E2DDD4", color: "#2F4A35", direction: "rtl" }}
                    value={messageText}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) => prev.map((p) => p._id === id ? { ...p, _message: v } : p));
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalBase>
  );
}
