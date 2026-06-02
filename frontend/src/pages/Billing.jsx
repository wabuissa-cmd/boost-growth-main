import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav } from "../auth";
import { HistoryModal } from "./Attendance";
import PageBanner from "../components/PageBanner";
import BillingProgressStrip from "../components/BillingProgressStrip";
import { ModalBase, FormSection, FormField, ModalBtnPrimary, ModalBtnSecondary } from "../components/Modal";
import { formatMoney, paymentStatusLabel, paymentStatusStyle } from "../billingUtils";
import { formatServiceTypeDisplay } from "../attendanceUtils";
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
  const [amountPaid, setAmountPaid] = useState(row.amount_paid ?? "");
  const [reminder, setReminder] = useState(row.next_payment_reminder_at || "");
  const [notes, setNotes] = useState(row.payment_notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/invoices/${row.invoice_id}/payment`, {
        payment_status: status,
        amount: amount === "" ? null : parseFloat(amount),
        amount_paid: amountPaid === "" ? null : parseFloat(amountPaid),
        next_payment_reminder_at: reminder || null,
        payment_notes: notes || null,
      });
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
      <FormSection title="Amounts (optional)">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Invoice total (SAR)">
            <input type="number" min="0" step="1" className="modal-input" value={amount} onChange={e => setAmount(e.target.value)} />
          </FormField>
          <FormField label="Amount paid (SAR)">
            <input type="number" min="0" step="1" className="modal-input" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
          </FormField>
        </div>
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
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [sheetClient, setSheetClient] = useState(null);
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [sending, setSending] = useState(false);

  const loadSupport = useCallback(() => {
    cachedGet("/clients", { force: true }).then(c => setClients(Array.isArray(c) ? c : [])).catch(() => {});
    cachedGet("/therapists", { force: true }).then(t => setTherapists(Array.isArray(t) ? t : [])).catch(() => {});
    cachedGet("/sessions", { force: true }).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
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

  const list = useMemo(() => {
    if (!data) return [];
    if (tab === "unpaid") return data.unpaid || [];
    if (tab === "partial") return data.partial || [];
    return data.items || [];
  }, [data, tab]);

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
    setSending(true);
    try {
      const r = await api.post("/billing/send-reminders");
      const to = (r.data?.recipients || []).join(", ") || "configured recipients";
      alert(`Reminder emails sent: ${r.data?.sent ?? 0}\nTo: ${to}`);
      load();
    } catch {
      alert("Could not send reminders");
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
        subtitle="Invoices, payment tracking, and installment reminders"
        badge={(
          <button
            type="button"
            onClick={sendReminders}
            disabled={sending}
            className="hidden sm:inline-flex items-center gap-1.5 pill px-2.5 py-1 text-[11px] font-bold bg-[#E5EBE1] text-[#3D4F35] border border-[#B8C8A8] hover:bg-[#D8E4D0] transition"
          >
            <EnvelopeSimple size={13} /> {sending ? "Sending…" : "Send reminders"}
          </button>
        )}
        stats={[
          { label: "Unpaid", n: summary.unpaid, color: "#8A3F27" },
          { label: "Partial", n: summary.partial, color: "#6B5218" },
          { label: "Reminders soon", n: summary.reminders_soon, color: "#5C6853" },
          { label: "Open items", n: (data.items || []).length, color: "#3D4F35" },
        ]}
      >
        <p className="ui-caption m-0">
          Open <strong>Invoice Sheet</strong> for full billing details. Reminder emails go to admin and Walaa <strong>1–2 days before</strong> the next payment date on partial invoices.
        </p>
      </PageBanner>

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
                tab === t.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E8E4DE] text-[#5C6853]"
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
          <div className="font-bold" style={{ color: "#2C3625" }}>No items in this list</div>
          <div className="text-sm mt-1" style={{ color: "#8B9E7A" }}>
            {tab === "unpaid" ? "All open invoices are paid or partially paid." : "Nothing to show here."}
          </div>
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
