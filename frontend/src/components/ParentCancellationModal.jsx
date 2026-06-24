import { useEffect, useMemo, useState } from "react";
import { Copy, Check, WhatsappLogo, CheckCircle } from "@phosphor-icons/react";
import api from "../api";
import { ModalBase, ModalBtnPrimary, ModalBtnSecondary } from "./Modal";
import { buildTherapistCancellationMessage, buildWhatsAppUrl } from "../scheduleParentMessages";
import { findClientForScheduleCell } from "../scheduleUtils";

function defaultMessageForRow(row, clients) {
  const client = row.client_id
    ? clients.find((c) => c.id === row.client_id)
    : findClientForScheduleCell(row.child_name, clients);
  return buildTherapistCancellationMessage(row, client, row.week_start, row.therapist_name);
}

export default function ParentCancellationModal({
  open,
  onClose,
  items = [],
  clients = [],
  focusCellId = null,
  onMarkedSent,
}) {
  const [messages, setMessages] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const rows = useMemo(() => {
    if (!focusCellId) return items;
    const one = items.find((x) => x.id === focusCellId);
    return one ? [one] : items;
  }, [items, focusCellId]);

  useEffect(() => {
    if (!open) return;
    const next = {};
    rows.forEach((row) => {
      next[row.id] = row.parent_notify_message || defaultMessageForRow(row, clients);
    });
    setMessages(next);
  }, [open, rows, clients]);

  if (!open) return null;

  const copyMessage = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy message:", text);
    }
  };

  const markSent = async (row) => {
    setSavingId(row.id);
    try {
      await api.post(`/schedule/${row.id}/parent-whatsapp-sent`, {
        message: messages[row.id] || "",
      });
      onMarkedSent?.(row.id);
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not mark as sent");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ModalBase
      title="Parent cancellations (WhatsApp)"
      subtitle={`${rows.length} pending parent notification${rows.length === 1 ? "" : "s"}`}
      onClose={onClose}
      size="lg"
      footer={(
        <div className="flex justify-end">
          <ModalBtnSecondary onClick={onClose}>Close</ModalBtnSecondary>
        </div>
      )}
    >
      {rows.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: "#5C6853" }}>
          No pending parent cancellations. Mark a session as Therapist Cancel to queue a parent WhatsApp alert.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm m-0" style={{ color: "#5C6853" }}>
            Edit the Arabic message, open WhatsApp, then mark as sent when the parent has been notified.
          </p>
          {rows.map((row) => {
            const msg = messages[row.id] || "";
            const phone = row.parent_phone;
            const waUrl = buildWhatsAppUrl(phone, msg);
            return (
              <div
                key={row.id}
                className="rounded-xl border p-3 sm:p-4"
                style={{ borderColor: "#E8C572", background: "#FFFBF0" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm" style={{ color: "#6B5218" }}>{row.child_name || "—"}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#8B6918" }}>
                      {row.therapist_name ? `${row.therapist_name} · ` : ""}
                      {row.day_label || row.day_ar || ""}
                      {row.time_slot ? ` · ${row.time_slot}` : ""}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#6B8270" }}>
                      {row.parent_name ? `${row.parent_name} · ` : ""}
                      {phone || "No phone — add in Client Info"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="btn btn-outline text-xs py-1.5 px-2.5 min-h-0"
                      onClick={() => copyMessage(row.id, msg)}
                    >
                      {copiedId === row.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === row.id ? "Copied" : "Copy"}
                    </button>
                    {waUrl ? (
                      <a
                        href={waUrl}
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
                      className="btn btn-gold text-xs py-1.5 px-2.5 min-h-0"
                      disabled={savingId === row.id}
                      onClick={() => markSent(row)}
                    >
                      <CheckCircle size={14} />
                      {savingId === row.id ? "Saving…" : "Mark as sent"}
                    </button>
                  </div>
                </div>
                <textarea
                  className="modal-input text-sm w-full leading-relaxed"
                  rows={8}
                  dir="rtl"
                  value={msg}
                  onChange={(e) => setMessages((m) => ({ ...m, [row.id]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      )}
    </ModalBase>
  );
}
