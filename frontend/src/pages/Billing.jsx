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
import { yearMonthTabs, monthKeyFromDate } from "../monthTabs";
import {
  Receipt, CheckCircle, MagnifyingGlass, EnvelopeSimple, ClipboardText,
} from "@phosphor-icons/react";

function BillingRow({ row, onEdit, onOpenSheet }) {
  const st = paymentStatusStyle(row.payment_status);
  return (
    <div className="card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 border" style={{ borderColor: st.border }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>{row.client_name}</span>
          <span className="text-[10px] pill px-1.5 py-0.5" style={{ background: "#F0EDE9", color: "#5C6853" }}>
            #{row.file_no || "—"}
          </span>
          <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
            {paymentStatusLabel(row.payment_status)}
          </span>
        </div>
        <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "#5C6853" }}>
          <span>{row.invoice_number}</span>
          <span>{formatServiceTypeDisplay(row.service_type) || row.service_type || "—"}</span>
          {row.payment_status === "pending" && row.days_unpaid != null && (
            <span className="font-bold" style={{ color: "#8A3F27" }}>
              {row.days_unpaid} day{row.days_unpaid !== 1 ? "s" : ""} without payment
            </span>
          )}
          {row.payment_status === "partial" && row.amount_remaining != null && (
            <span>{formatMoney(row.amount_remaining)} remaining</span>
          )}
          {row.payment_status === "partial" && row.next_payment_reminder_at && (
            <span>
              Next reminder: {row.next_payment_reminder_at}
              {row.days_until_reminder != null && row.days_until_reminder >= 0 && (
                <span> ({row.days_until_reminder === 0 ? "today" : `in ${row.days_until_reminder}d`})</span>
              )}
            </span>
          )}
        </div>
        {row.payment_notes && (
          <div className="text-[11px] mt-1 italic truncate" style={{ color: "#8B9E7A" }}>{row.payment_notes}</div>
        )}
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">
        <button type="button" onClick={() => onOpenSheet(row)} className="btn btn-primary text-xs min-h-[36px]">
          <ClipboardText size={14} /> Invoice Sheet
        </button>
        <button type="button" onClick={() => onEdit(row)} className="btn btn-secondary text-xs min-h-[36px]">
          Update Payment
        </button>
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
  const tab = params.get("tab") || "all";
  const deepClientId = params.get("client");
  const deepService = params.get("service");
  const deepNewInvoice = params.get("newInvoice") === "1";
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [sheetClient, setSheetClient] = useState(null);
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [sending, setSending] = useState(false);
  const monthTabs = useMemo(() => yearMonthTabs(), []);
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return monthTabs.some((m) => m.value === key) ? key : monthTabs[0]?.value || "";
  }, [monthTabs]);
  const [filterMonth, setFilterMonth] = useState(defaultMonth);

  const loadSupport = useCallback(() => {
    cachedGet("/clients", { force: true }).then(c => setClients(Array.isArray(c) ? c : [])).catch(() => {});
    cachedGet("/therapists", { force: true }).then(t => setTherapists(Array.isArray(t) ? t : [])).catch(() => {});
    cachedGet("/sessions", { force: true }).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
    api.get("/invoices").then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => setInvoices([]));
  }, []);

  const load = useCallback(() => {
    api.get("/billing/dashboard").then(r => setData(r.data)).catch(() => setData(null));
    loadSupport();
  }, [loadSupport]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!deepClientId || !clients.length) return;
    const c = clients.find(x => x.id === deepClientId);
    if (c) setSheetClient(c);
  }, [deepClientId, clients]);

  const clientMap = useMemo(() => {
    const m = {};
    clients.forEach((c) => { m[c.id] = c; });
    return m;
  }, [clients]);

  const monthlyRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices
      .map((inv) => {
        const client = clientMap[inv.client_id];
        if (!client) return null;
        const start = (inv.start_date || inv.created_at || "").slice(0, 10);
        const month = monthKeyFromDate(start);
        const amount = parseFloat(inv.amount) || 0;
        const paid = parseFloat(inv.amount_paid) || 0;
        const status = inv.payment_status === "complete" || (amount > 0 && paid >= amount)
          ? "complete"
          : (inv.payment_status === "partial" || (paid > 0 && paid < amount) ? "partial" : "pending");
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
          month,
          days_unpaid: start && status !== "complete" ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(start)) / 86400000)) : 0,
          next_payment_reminder_at: inv.next_payment_reminder_at || null,
          payment_notes: inv.payment_notes,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || "") || (a.client_name || "").localeCompare(b.client_name || ""));
  }, [invoices, clientMap]);

  const monthFilteredRows = useMemo(() => {
    if (!filterMonth) return monthlyRows;
    return monthlyRows.filter((r) => r.month === filterMonth);
  }, [monthlyRows, filterMonth]);

  const list = useMemo(() => {
    const base = filterMonth ? monthFilteredRows : (data ? (tab === "unpaid" ? data.unpaid || [] : tab === "partial" ? data.partial || [] : data.items || []) : []);
    if (!filterMonth) return base;
    if (tab === "unpaid") return base.filter((r) => r.payment_status === "pending");
    if (tab === "partial") return base.filter((r) => r.payment_status === "partial");
    return base;
  }, [data, tab, filterMonth, monthFilteredRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      (r.client_name || "").toLowerCase().includes(q)
      || (r.invoice_number || "").toLowerCase().includes(q)
      || String(r.file_no || "").includes(q)
    );
  }, [list, search]);

  const summary = data?.summary || { unpaid: 0, partial: 0, reminders_soon: 0 };

  const sendReminders = async () => {
    if (!window.confirm("Send payment reminder emails for invoices due in 1–2 days (or overdue up to 7 days)?")) return;
    setSending(true);
    try {
      const r = await api.post("/billing/send-reminders");
      const data = r.data || {};
      const to = (data.recipients || []).join(", ") || "configured recipients";
      const lines = [
        `Invoice reminders processed: ${data.sent ?? 0}`,
        `Recipients: ${to}`,
      ];
      if (data.skipped) lines.push("Note: automatic run already completed today (manual send still applies matching rules).");
      if (data.provider_configured === false) {
        lines.push("⚠ No email provider configured — messages were queued but not delivered. Configure Mailgun/Brevo in Admin.");
      }
      if (data.email_results?.length) {
        const statuses = data.email_results.map((e) => `${e.to}: ${e.status}${e.error ? ` (${e.error})` : ""}`);
        lines.push("", "Email delivery:", ...statuses);
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

  const openSheet = (row) => {
    const c = clients.find(x => x.id === row.client_id);
    if (c) setSheetClient(c);
  };

  if (!data) {
    return <div className="card p-12 text-center"><div className="spinner mx-auto" /></div>;
  }

  const tabs = [
    { id: "all", label: "All attention", n: (data.items || []).length },
    { id: "unpaid", label: "Unpaid", n: summary.unpaid, accent: "#F4A89A" },
    { id: "partial", label: "Partial", n: summary.partial, accent: "#F5D78E" },
  ];

  return (
    <div>
      <PageBanner
        title="Billing & Payments"
        subtitle="Monthly invoice payments · Jan–Jul overview"
        stats={[
          { label: "Unpaid", n: summary.unpaid, color: "#8A3F27" },
          { label: "Partial", n: summary.partial, color: "#6B5218" },
          { label: "Reminders soon", n: summary.reminders_soon, color: "#5C6853" },
          { label: filterMonth ? "This month" : "Open items", n: filterMonth ? monthFilteredRows.length : (data.items || []).length, color: "#3D4F35" },
        ]}
      />

      <div className="card p-3 mb-4 sticky top-[3.5rem] z-10" style={{ background: "#FAFCF8", borderColor: "#B8C8A8" }}>
        <div className="text-xs font-bold tracking-wider mb-2" style={{ color: "#5C6853" }}>PAYMENTS BY MONTH</div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {monthTabs.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`btn text-xs whitespace-nowrap min-h-[36px] ${filterMonth === m.value ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilterMonth(m.value)}
            >
              {m.short}
            </button>
          ))}
        </div>
        <div className="text-[11px] mt-2" style={{ color: "#5C6853" }}>
          {filterMonth
            ? `${monthFilteredRows.length} invoice${monthFilteredRows.length === 1 ? "" : "s"} in ${monthTabs.find((m) => m.value === filterMonth)?.label || filterMonth}`
            : "Select a month above"}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl border" style={{ background: "#FAFAF7", borderColor: "#E2DDD4" }}>
        <p className="ui-caption m-0 flex-1 min-w-[200px]">
          Open <strong>Invoice Sheet</strong> for full billing details. Reminder emails go to admin and Walaa <strong>1–2 days before</strong> the next payment date on partial invoices.
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

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ tab: t.id })}
              className={`pill px-3 py-2 text-sm font-semibold border min-h-[40px] transition ${
                tab === t.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E2DDD4] text-[#5C6853]"
              }`}
            >
              {t.label}
              {t.n > 0 && (
                <span className="ml-1 opacity-80">({t.n})</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B9E7A" }} />
          <input
            className="input w-full pl-9 text-sm min-h-[40px]"
            placeholder="Search child or invoice…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={sendReminders}
          disabled={sending}
          className="sm:hidden btn btn-secondary text-xs min-h-[40px]"
        >
          <EnvelopeSimple size={14} /> {sending ? "…" : "Reminders"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckCircle size={40} weight="duotone" className="mx-auto mb-3" style={{ color: "#7A8A6A" }} />
          <div className="font-bold" style={{ color: "#2C3625" }}>
            {filterMonth ? "No invoices this month" : "No items in this list"}
          </div>
          <div className="text-sm mt-1" style={{ color: "#8B9E7A" }}>
            {filterMonth
              ? `No payment records for ${monthTabs.find((m) => m.value === filterMonth)?.label || filterMonth}.`
              : (tab === "unpaid" ? "All open invoices are paid or partially paid." : "Nothing to show here.")}
          </div>
        </div>
      ) : filterMonth ? (
        <div className="intake-table-wrap">
          <table className="intake-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Invoice</th>
                <th>Service</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const st = paymentStatusStyle(row.payment_status);
                return (
                  <tr key={row.invoice_id}>
                    <td>
                      <div className="font-semibold">{row.client_name}</div>
                      <div className="text-[10px]" style={{ color: "#8B9E7A" }}>#{row.file_no || "—"}</div>
                    </td>
                    <td>{row.invoice_number || "—"}</td>
                    <td>{formatServiceTypeDisplay(row.service_type) || row.service_type || "—"}</td>
                    <td>
                      <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {paymentStatusLabel(row.payment_status)}
                      </span>
                    </td>
                    <td>{row.amount != null ? formatMoney(row.amount) : "—"}</td>
                    <td>{row.amount_paid != null ? formatMoney(row.amount_paid) : "—"}</td>
                    <td>{row.start_date || "—"}</td>
                    <td>
                      <button type="button" className="text-[10px] underline mr-2" onClick={() => openSheet(row)}>Sheet</button>
                      <button type="button" className="text-[10px] underline" onClick={() => setEditRow(row)}>Update</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => (
            <BillingRow
              key={row.invoice_id}
              row={row}
              onEdit={setEditRow}
              onOpenSheet={openSheet}
            />
          ))}
        </div>
      )}

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
