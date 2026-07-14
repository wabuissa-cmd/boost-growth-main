import { useState } from "react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { ModalBase, ModalBtnSecondary } from "./Modal";
import { formatPkgBadge } from "../packageStatusUtils";

/**
 * Quick follow-up menu for package ending soon / billing status chips.
 * Actions update invoice payment fields and optional client wont_renew.
 */
export default function PackageFollowUpModal({ row, onClose, onDone, onEditInvoice, onOpenSheet }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [hours, setHours] = useState(
    row?.package_size != null ? String(row.package_size) : "",
  );

  const invoiceId = row?.invoice_id;
  const clientName = row?.client_name || "Client";

  const refreshCaches = () => {
    invalidateCache("/clients/package-status");
    invalidateCache("/invoices");
    invalidateCache("/billing/dashboard");
    invalidateCache("/clients");
  };

  const run = async (payload, successMsg) => {
    if (!invoiceId && payload.wont_renew === undefined) {
      alert("No open invoice linked for this client yet. Open the sheet to create or select one.");
      return;
    }
    setBusy(true);
    try {
      if (payload.wont_renew !== undefined && !invoiceId) {
        await api.put(`/clients/${row.client_id}/wont-renew`, { wont_renew: payload.wont_renew });
      } else if (invoiceId) {
        await api.put(`/invoices/${invoiceId}/payment`, {
          ...payload,
          client_id: row.client_id,
        });
      } else {
        alert("No open invoice linked for this client yet. Open the sheet to create or select one.");
        return;
      }
      refreshCaches();
      if (successMsg) alert(successMsg);
      onDone?.();
      onClose?.();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not update. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    const text = (note || "").trim();
    if (!text) {
      alert("Write a short note first.");
      return;
    }
    await run({ payment_notes: text }, "Note saved.");
  };

  const saveHours = async () => {
    const n = parseFloat(hours);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Enter a valid package size (hours or weeks).");
      return;
    }
    await run({ package_size: n }, `Package size updated to ${n}.`);
  };

  const actions = [
    {
      id: "wont_renew",
      label: "Won't renew next package",
      hint: "Removes from ending soon and marks client Inactive",
      run: () => run(
        { wont_renew: true, payment_notes: "Won't renew next package" },
        "Marked: won't renew. Client moved to Inactive.",
      ),
    },
    {
      id: "paid",
      label: "Paid in full",
      run: () => run({ payment_status: "complete" }, "Marked as paid."),
    },
    {
      id: "half",
      label: "Half paid (50%)",
      run: () => run(
        { payment_status: "partial", installment_percent: 50 },
        "Marked as half paid.",
      ),
    },
    {
      id: "unpaid",
      label: "Not paid",
      run: () => run(
        { payment_status: "pending", amount_paid: 0 },
        "Marked as unpaid.",
      ),
    },
  ];

  return (
    <ModalBase
      title={clientName}
      subtitle={`${row?.service_type || ""} · ${formatPkgBadge(row)}${row?.wont_renew ? " · Won't renew" : ""}`}
      onClose={onClose}
      size="sm"
      footer={(
        <>
          {onOpenSheet && (
            <ModalBtnSecondary type="button" onClick={() => { onClose?.(); onOpenSheet(row); }}>
              Open sheet
            </ModalBtnSecondary>
          )}
          {onEditInvoice && invoiceId && (
            <ModalBtnSecondary type="button" onClick={() => { onClose?.(); onEditInvoice(row); }}>
              Full edit
            </ModalBtnSecondary>
          )}
          <ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>
        </>
      )}
    >
      <div className="space-y-2">
        <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>
          Choose a follow-up action for this client&apos;s package.
        </p>
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={a.run}
            className="w-full text-left px-3 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)", color: "var(--brand-dark)" }}
          >
            {a.label}
            {a.hint && (
              <span className="block text-[11px] font-normal mt-0.5" style={{ color: "var(--text-muted)" }}>{a.hint}</span>
            )}
          </button>
        ))}

        <div className="pt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
          <label className="label">Note</label>
          <textarea
            className="input text-sm min-h-[72px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Parent confirmed cash next week"
            disabled={busy}
          />
          <button type="button" className="btn btn-secondary text-xs mt-2" disabled={busy} onClick={saveNote}>
            Save note
          </button>
        </div>

        <div className="pt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
          <label className="label">Edit package hours</label>
          <div className="flex gap-2 items-center">
            <input
              className="input text-sm flex-1"
              type="number"
              min="0.5"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              disabled={busy || !invoiceId}
              placeholder="e.g. 5"
            />
            <button type="button" className="btn btn-primary text-xs shrink-0" disabled={busy || !invoiceId} onClick={saveHours}>
              Save hours
            </button>
          </div>
          {!invoiceId && (
            <p className="text-[11px] mt-1 m-0" style={{ color: "var(--text-muted)" }}>
              Create or open an invoice first to edit hours.
            </p>
          )}
        </div>
      </div>
    </ModalBase>
  );
}
