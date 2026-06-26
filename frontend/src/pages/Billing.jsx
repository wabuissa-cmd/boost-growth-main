import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav } from "../auth";
import { HistoryModal } from "./Attendance";
import PageBanner from "../components/PageBanner";
import BillingProgressStrip from "../components/BillingProgressStrip";
import "../clientInfoLayout.css";
import { ModalBase, FormSection, FormField, ModalBtnPrimary, ModalBtnSecondary } from "../components/Modal";
import { formatMoney, paymentStatusLabel, paymentStatusStyle } from "../billingUtils";
import { formatServiceTypeDisplay } from "../attendanceUtils";
import { formatPkgBadge, formatPkgUsedRemaining } from "../packageStatusUtils";
import {
  Receipt, CheckCircle, EnvelopeSimple, ClipboardText, Warning,
} from "@phosphor-icons/react";

function invoiceToRow(inv, client, today) {
  const start = (inv.start_date || inv.created_at || "").slice(0, 10);
  const amount = parseFloat(inv.amount) || 0;
  const paid = parseFloat(inv.amount_paid) || 0;
  const status = inv.payment_status === "complete" || (amount > 0 && paid >= amount)
    ? "complete"
    : (inv.payment_status === "partial" || (paid > 0 && paid < amount) ? "partial" : "pending");
  let daysUntilReminder = null;
  if (inv.next_payment_reminder_at) {
    daysUntilReminder = Math.floor((Date.parse(inv.next_payment_reminder_at) - Date.parse(today)) / 86400000);
  }
  return {
    invoice_id: inv.id,
    invoice_number: inv.invoice_number,
    client_id: client.id,
    client_name: client.name,
    file_no: client.file_no,
    service_type: inv.service_type,
    payment_status: status,
    amount: amount || null,
    amount_paid: paid || null,
    amount_remaining: amount > 0 ? Math.max(0, amount - paid) : null,
    start_date: start || null,
    days_unpaid: start && status !== "complete" ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(start)) / 86400000)) : 0,
    next_payment_reminder_at: inv.next_payment_reminder_at || null,
    days_until_reminder: daysUntilReminder,
    payment_notes: inv.payment_notes,
  };
}

function CompactAttentionRow({ row, onEdit, onOpenSheet }) {
  const st = paymentStatusStyle(row.payment_status);
  return (
    <div className="flex items-center gap-2 py-2 px-3 border-b last:border-b-0 text-xs" style={{ borderColor: "#EDE9E3" }}>
      <div className="flex-1 min-w-0">
        <span className="font-semibold truncate block" style={{ color: "#2C3625" }}>{row.client_name}</span>
        <span style={{ color: "#8B9E7A" }}>{row.invoice_number} · {paymentStatusLabel(row.payment_status)}</span>
      </div>
      <div className="flex gap-1 shrink-0">
        <button type="button" className="btn btn-primary text-[10px] px-2 py-1 min-h-0" onClick={() => onOpenSheet(row)}>Sheet</button>
        <button type="button" className="btn btn-secondary text-[10px] px-2 py-1 min-h-0" onClick={() => onEdit(row)}>Pay</button>
      </div>
    </div>
  );
}

function PaymentEditModal({ row, onClose, onSaved }) {
  const [status, setStatus] = useState(row.payment_status || "pending");
  const [amount, setAmount] = useState(row.amount ?? "");
  const [installmentPct, setInstallmentPct] = useState(row.installment_percent ?? "");
  const [amountPaid, setAmountPaid] = useState(row.amount_paid ?? "");
  const [reminder, setReminder] = useState(row.next_payment_reminder_at || "");
  const [notes, setNotes] = useState(row.payment_notes || "");
  const [saving, setSaving] = useState(false);

  const computedPaid = useMemo(() => {
    const a = parseFloat(amount);
    const p = parseFloat(installmentPct);
    if (Number.isFinite(a) && Number.isFinite(p) && p > 0) return (a * p / 100).toFixed(2);
    return amountPaid;
  }, [amount, installmentPct, amountPaid]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        payment_status: status,
        amount: amount === "" ? null : parseFloat(amount),
        next_payment_reminder_at: reminder || null,
        payment_notes: notes || null,
      };
      if (installmentPct !== "" && installmentPct != null) {
        payload.installment_percent = parseFloat(installmentPct);
      } else {
        payload.amount_paid = amountPaid === "" ? null : parseFloat(amountPaid);
      }
      await api.put(`/invoices/${row.invoice_id}/payment`, payload);
      onSaved();
      onClose();
    } catch {
      alert("Could not save payment details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBase
      title={`Payment · ${row.client_name}`}
      subtitle={row.invoice_number}
      onClose={onClose}
      size="sm"
      elevated
      footer={
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </ModalBtnPrimary>
        </>
      }
    >
      <FormSection title="Status">
        <FormField label="Payment status">
          <select className="modal-input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="pending">Unpaid — service started, no payment</option>
            <option value="partial">Partial — installment, balance remaining</option>
            <option value="complete">Paid in full</option>
          </select>
        </FormField>
      </FormSection>
      <FormSection title="Amounts">
        <FormField label="Invoice total (SAR)">
          <input type="number" min="0" step="1" className="modal-input" value={amount} onChange={e => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Installment (%)">
          <select className="modal-input" value={installmentPct} onChange={e => setInstallmentPct(e.target.value)}>
            <option value="">Custom amount paid</option>
            <option value="25">25% paid</option>
            <option value="50">50% paid</option>
            <option value="75">75% paid</option>
            <option value="100">100% paid in full</option>
          </select>
        </FormField>
        <FormField label={installmentPct ? "Calculated amount paid (SAR)" : "Amount paid (SAR)"}>
          <input
            type="number"
            min="0"
            step="0.01"
            className="modal-input"
            value={installmentPct ? computedPaid : amountPaid}
            readOnly={Boolean(installmentPct)}
            onChange={e => setAmountPaid(e.target.value)}
          />
        </FormField>
        {amount && computedPaid && installmentPct && parseFloat(installmentPct) < 100 && (
          <p className="ui-caption">Remaining: {formatMoney(parseFloat(amount) - parseFloat(computedPaid))}</p>
        )}
      </FormSection>
      {(status === "partial" || status === "pending") && (
        <FormSection title="Reminder">
          <FormField label="Next payment reminder date" hint="Email sent to admin 1–2 days before this date">
            <input type="date" className="modal-input" value={reminder} onChange={e => setReminder(e.target.value)} />
          </FormField>
          <FormField label="Notes">
            <textarea className="modal-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 2nd installment due after Eid" />
          </FormField>
        </FormSection>
      )}
    </ModalBase>
  );
}

export default function Billing() {
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const [params, setParams] = useSearchParams();
  const deepClientId = params.get("client");
  const deepService = params.get("service");
  const deepNewInvoice = params.get("newInvoice") === "1";
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [pkgRows, setPkgRows] = useState([]);
  const [sheetClient, setSheetClient] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(deepClientId || "");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [sending, setSending] = useState(false);
  const loadSupport = useCallback(() => {
    cachedGet("/clients", { force: true }).then(c => setClients(Array.isArray(c) ? c : [])).catch(() => {});
    cachedGet("/therapists", { force: true }).then(t => setTherapists(Array.isArray(t) ? t : [])).catch(() => {});
    cachedGet("/sessions", { force: true }).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
    cachedGet("/clients/package-status", { force: true }).then(r => setPkgRows(Array.isArray(r) ? r : [])).catch(() => setPkgRows([]));
    api.get("/invoices").then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => setInvoices([]));
  }, []);

  const load = useCallback(() => {
    api.get("/billing/dashboard").then(r => setData(r.data)).catch(() => setData(null));
    loadSupport();
  }, [loadSupport]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (deepClientId) setSelectedClientId(deepClientId);
  }, [deepClientId]);

  useEffect(() => {
    if (!deepNewInvoice || !deepClientId || !clients.length) return;
    const c = clients.find(x => x.id === deepClientId);
    if (c) setSheetClient(c);
  }, [deepNewInvoice, deepClientId, clients]);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [clients]
  );

  const clientMap = useMemo(() => {
    const m = {};
    clients.forEach((c) => { m[c.id] = c; });
    return m;
  }, [clients]);

  const allRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices
      .map((inv) => {
        const client = clientMap[inv.client_id];
        if (!client) return null;
        return invoiceToRow(inv, client, today);
      })
      .filter(Boolean)
      .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || "") || (a.client_name || "").localeCompare(b.client_name || ""));
  }, [invoices, clientMap]);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const clientInvoices = useMemo(
    () => allRows.filter(r => r.client_id === selectedClientId),
    [allRows, selectedClientId]
  );

  const clientPkg = useMemo(
    () => pkgRows.filter(r => r.client_id === selectedClientId),
    [pkgRows, selectedClientId]
  );

  const attentionItems = useMemo(() => {
    const items = data?.items || [];
    return items.filter((r) => r.payment_status === "pending" || r.payment_status === "partial");
  }, [data]);

  const summary = data?.summary || { unpaid: 0, partial: 0, reminders_soon: 0 };

  const sendReminders = async () => {
    if (!window.confirm("Send payment reminder emails for invoices due in 1–2 days (or overdue up to 7 days)?")) return;
    setSending(true);
    try {
      const r = await api.post("/billing/send-reminders");
      const res = r.data || {};
      const to = (res.recipients || []).join(", ") || "configured recipients";
      const lines = [
        `Invoice reminders processed: ${res.sent ?? 0}`,
        `Recipients: ${to}`,
      ];
      if (res.provider_configured === false) {
        lines.push("⚠ No email provider configured — messages were queued but not delivered.");
      }
      alert(lines.join("\n"));
      load();
    } catch (e) {
      alert(e.response?.data?.detail || "Could not send reminders");
    } finally {
      setSending(false);
    }
  };

  const closeSheet = () => {
    setSheetClient(null);
    if (deepClientId) {
      const next = new URLSearchParams(params);
      next.delete("client");
      next.delete("service");
      next.delete("newInvoice");
      setParams(next);
    }
  };

  const openSheetForClient = (client) => {
    if (client) setSheetClient(client);
  };

  const openSheet = (row) => {
    const c = clients.find(x => x.id === row.client_id);
    if (c) setSheetClient(c);
  };

  const onClientChange = (id) => {
    setSelectedClientId(id);
    setSelectedInvoiceId(null);
    setSheetClient(null);
    const next = new URLSearchParams(params);
    if (id) next.set("client", id);
    else next.delete("client");
    next.delete("newInvoice");
    setParams(next, { replace: true });
  };

  if (!data) {
    return <div className="card p-12 text-center"><div className="spinner mx-auto" /></div>;
  }

  const clientSelect = (
    <select
      className="input text-sm w-full"
      value={selectedClientId}
      onChange={e => onClientChange(e.target.value)}
      data-testid="billing-client-select"
    >
      <option value="">Select a client…</option>
      {sortedClients.map(c => (
        <option key={c.id} value={c.id}>
          {c.name}{c.file_no ? ` (#${c.file_no})` : ""}
        </option>
      ))}
    </select>
  );

  const attentionPanel = (
    <div className="card overflow-hidden flex flex-col max-h-[min(360px,50vh)]">
      <div className="px-3 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: "#EDE9E3", background: "#FDF8F3" }}>
        <span className="text-xs font-bold tracking-wider" style={{ color: "#8A3F27" }}>
          NEEDS ATTENTION · {attentionItems.length}
        </span>
        <span className="text-[10px]" style={{ color: "#8B9E7A" }}>Unpaid & partial</span>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {attentionItems.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={28} weight="duotone" className="mx-auto mb-2" style={{ color: "#7A8A6A" }} />
            <p className="text-sm m-0 font-semibold" style={{ color: "#2C3625" }}>All caught up</p>
          </div>
        ) : attentionItems.map(row => (
          <CompactAttentionRow key={row.invoice_id} row={row} onEdit={setEditRow} onOpenSheet={openSheet} />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <PageBanner
        title="Billing & Payments"
        subtitle="Payment alerts first · then browse clients & invoices"
        className="editorial-banner--compact-mobile"
        stats={[
          { label: "Unpaid", n: summary.unpaid, color: "#8A3F27" },
          { label: "Partial", n: summary.partial, color: "#6B5218" },
          { label: "Reminders", n: summary.reminders_soon, color: "#5C6853" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl border" style={{ background: "#FAFAF7", borderColor: "#E2DDD4" }}>
        <p className="ui-caption m-0 flex-1 min-w-[200px]">
          Open <strong>Invoice Sheet</strong> for full billing details. Reminder emails go to admin and Walaa <strong>1–2 days before</strong> the next payment date.
        </p>
        <button
          type="button"
          onClick={sendReminders}
          disabled={sending}
          className="inline-flex items-center gap-1.5 pill px-3 py-2 text-xs font-bold bg-[#E5EBE1] text-[#3D4F35] border border-[#B8C8A8] hover:bg-[#D8E4D0] transition shrink-0 min-h-[40px]"
        >
          <EnvelopeSimple size={14} /> {sending ? "Sending…" : "Send reminders"}
        </button>
      </div>

      <div className="mb-4">
        <BillingProgressStrip summary={summary} items={data.items || []} />
      </div>

      <div className="mb-4">
        {attentionPanel}
      </div>

      <div className="flex flex-col gap-3 min-w-0">
          <div className="card p-4">
            <label className="label block mb-2 text-xs font-bold tracking-wide" style={{ color: "#5C6853" }}>
              CLIENT
            </label>
            {clientSelect}
          </div>

          {selectedClient ? (
            <>
              <div className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold m-0" style={{ color: "#2C3625" }}>{selectedClient.name}</h2>
                    <p className="text-xs m-0 mt-1" style={{ color: "#8B9E7A" }}>File #{selectedClient.file_no || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSheetForClient(selectedClient)}
                    className="btn btn-primary text-xs min-h-[40px]"
                  >
                    <ClipboardText size={14} /> Open Invoice Sheet
                  </button>
                </div>

                {clientPkg.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {clientPkg.map(row => {
                      const ur = formatPkgUsedRemaining(row);
                      const needsInvoice = ["critical", "expired", "low"].includes(row.status);
                      return (
                        <div
                          key={`${row.client_id}-${row.service_type}`}
                          className="p-3 rounded-xl border"
                          style={{ borderColor: needsInvoice ? "#E8C4A8" : "#E2DDD4", background: needsInvoice ? "#FDF8F3" : "#FAFAF7" }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm" style={{ color: "#2C3625" }}>{row.service_type}</span>
                            {needsInvoice && <Warning size={16} weight="fill" style={{ color: "#C4783A" }} />}
                          </div>
                          <p className="text-xs m-0" style={{ color: "#5C6853" }}>{formatPkgBadge(row)}</p>
                          <p className="text-[11px] m-0 mt-1" style={{ color: "#8B9E7A" }}>
                            {ur.used} used · {ur.remaining} remaining
                          </p>
                          {needsInvoice && (
                            <p className="text-[11px] font-bold m-0 mt-2" style={{ color: "#8A3F27" }}>
                              Upload / issue invoice soon
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card overflow-hidden flex flex-col max-h-[420px]">
                <div className="px-3 py-2 border-b text-xs font-bold tracking-wider shrink-0" style={{ borderColor: "#EDE9E3", color: "#5C6853", background: "#FAFAF7" }}>
                  INVOICE HISTORY · {clientInvoices.length}
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {clientInvoices.length === 0 ? (
                    <div className="p-6 text-center text-xs" style={{ color: "#8B9E7A" }}>No invoices on file.</div>
                  ) : clientInvoices.map(row => {
                    const st = paymentStatusStyle(row.payment_status);
                    const active = selectedInvoiceId === row.invoice_id;
                    return (
                      <button
                        key={row.invoice_id}
                        type="button"
                        onClick={() => setSelectedInvoiceId(row.invoice_id)}
                        className={`w-full text-left px-3 py-2.5 border-b transition text-xs ${active ? "bg-[#E5EBE1]" : "hover:bg-[#FAFAF7]"}`}
                        style={{ borderColor: "#EDE9E3" }}
                      >
                        <div className="font-semibold truncate" style={{ color: "#2C3625" }}>{row.invoice_number || "Invoice"}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="pill text-[9px] font-bold px-1.5 py-0.5" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            {paymentStatusLabel(row.payment_status)}
                          </span>
                          <span style={{ color: "#8B9E7A" }}>{row.start_date || "—"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedInvoiceId && (() => {
                const row = clientInvoices.find(r => r.invoice_id === selectedInvoiceId);
                if (!row) return null;
                const st = paymentStatusStyle(row.payment_status);
                return (
                  <div className="card p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-bold">{row.invoice_number}</span>
                      <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {paymentStatusLabel(row.payment_status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: "#5C6853" }}>
                      <span>{formatServiceTypeDisplay(row.service_type) || row.service_type}</span>
                      {row.amount != null && <span>{formatMoney(row.amount)}</span>}
                      {row.payment_status === "partial" && row.amount_remaining != null && (
                        <span>{formatMoney(row.amount_remaining)} remaining</span>
                      )}
                      {row.payment_status === "pending" && row.days_unpaid > 0 && (
                        <span className="font-bold" style={{ color: "#8A3F27" }}>{row.days_unpaid}d unpaid</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button type="button" className="btn btn-secondary text-[10px] px-2 py-1 min-h-0" onClick={() => setEditRow(row)}>Update payment</button>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="card p-8 text-center">
              <Receipt size={40} weight="duotone" className="mx-auto mb-3" style={{ color: "#7A8A6A" }} />
              <p className="text-sm m-0" style={{ color: "#5C6853" }}>Choose a client above to view invoices, package balance & payment details.</p>
            </div>
          )}
      </div>

      {editRow && (
        <PaymentEditModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={load}
        />
      )}

      {sheetClient && (
        <HistoryModal
          client={sheetClient}
          sessions={sessions.filter(s => s.client_id === sheetClient.id)}
          therapists={therapists}
          isAdmin={isAdmin}
          user={user}
          currentUserId={user?.id}
          onClose={closeSheet}
          onEdit={() => {}}
          onDeleted={load}
          onClientUpdated={load}
          initialService={deepService}
          autoNewInvoice={deepNewInvoice}
        />
      )}
    </div>
  );
}

Billing.requireOps = true;
