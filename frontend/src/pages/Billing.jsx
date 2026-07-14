import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess } from "../auth";
import { HistoryModal } from "./Attendance";
import PageBanner from "../components/PageBanner";
import BillingProgressStrip from "../components/BillingProgressStrip";
import InvoiceEditModal from "../components/InvoiceEditModal";
import InvoiceCalendarTab from "../components/InvoiceCalendarTab";
import PackageFollowUpModal from "../components/PackageFollowUpModal";
import "../clientInfoLayout.css";
import { formatMoney, effectivePaymentStatus, paymentStatusLabel, paymentStatusStyle } from "../billingUtils";
import { formatServiceTypeDisplay } from "../attendanceUtils";
import { formatPkgBadge, formatPkgUsedRemaining, pkgStatusStyle, PKG_SORT_ORDER } from "../packageStatusUtils";
import {
  Receipt, CheckCircle, EnvelopeSimple, ClipboardText, Warning,
  MagnifyingGlass, CaretRight, Leaf, CalendarBlank,
} from "@phosphor-icons/react";

function invoiceToRow(inv, client, today) {
  const start = (inv.start_date || inv.created_at || "").slice(0, 10);
  const amount = parseFloat(inv.amount) || 0;
  const paid = parseFloat(inv.amount_paid) || 0;
  const status = effectivePaymentStatus(inv);
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
    is_closed: !!inv.is_closed,
    amount: amount || null,
    amount_paid: paid || null,
    amount_remaining: amount > 0 ? Math.max(0, amount - paid) : null,
    start_date: start || null,
    days_unpaid: start && status !== "complete" ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(start)) / 86400000)) : 0,
    next_payment_reminder_at: inv.next_payment_reminder_at || null,
    days_until_reminder: daysUntilReminder,
    payment_notes: inv.payment_notes,
    installment_percent: inv.installment_percent ?? null,
    package_size: inv.package_size ?? null,
    period_to: inv.period_to || null,
    close_date: inv.close_date || null,
    notes: inv.notes || null,
    created_at: inv.created_at || null,
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
        {onEdit && (
          <button type="button" className="btn btn-secondary text-[10px] px-2 py-1 min-h-0" onClick={() => onEdit(row)}>Edit</button>
        )}
      </div>
    </div>
  );
}

function rowToInvoice(row) {
  return {
    id: row.invoice_id,
    invoice_number: row.invoice_number,
    service_type: row.service_type,
    payment_status: row.payment_status,
    is_closed: row.is_closed,
    amount: row.amount,
    amount_paid: row.amount_paid,
    installment_percent: row.installment_percent,
    start_date: row.start_date,
    period_to: row.period_to,
    close_date: row.close_date,
    package_size: row.package_size,
    next_payment_reminder_at: row.next_payment_reminder_at,
    payment_notes: row.payment_notes,
    notes: row.notes,
    created_at: row.created_at,
  };
}

export default function Billing() {
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const canEditInvoice = hasOpsAccess(user);
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || "overview";
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
  const [followUpRow, setFollowUpRow] = useState(null);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const loadSupport = useCallback(() => {
    cachedGet("/clients", { force: true }).then(c => setClients(Array.isArray(c) ? c : [])).catch(() => {});
    cachedGet("/therapists", { force: true }).then(t => setTherapists(Array.isArray(t) ? t : [])).catch(() => {});
    cachedGet("/sessions", { force: true }).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
    cachedGet("/clients/package-status", { force: true }).then(r => setPkgRows(Array.isArray(r) ? r : [])).catch(() => setPkgRows([]));
    api.get("/invoices").then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => setInvoices([]));
  }, []);

  const load = useCallback(() => {
    api.get("/billing/dashboard").then(r => setData(r.data)).catch(() => setData({
      summary: { unpaid: 0, partial: 0, reminders_soon: 0 },
      items: [],
      unpaid: [],
      partial: [],
    }));
    loadSupport();
  }, [loadSupport]);

  useEffect(() => { load(); }, [load]);

  const setTab = (tab) => {
    const next = new URLSearchParams(params);
    if (tab && tab !== "overview") next.set("tab", tab);
    else next.delete("tab");
    setParams(next, { replace: true });
  };

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

  const filteredClients = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return sortedClients;
    return sortedClients.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const file = String(c.file_no || "").toLowerCase();
      return name.includes(q) || file.includes(q);
    });
  }, [sortedClients, search]);

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

  const clientTotals = useMemo(() => {
    const total = clientInvoices.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    const paid = clientInvoices.reduce((acc, r) => acc + (parseFloat(r.amount_paid) || 0), 0);
    const remaining = Math.max(0, total - paid);
    const openCount = clientInvoices.filter(r => !r.is_closed).length;
    const overdueCount = clientInvoices.filter(r => (r.payment_status === "pending" || r.payment_status === "partial") && (r.days_unpaid || 0) > 0).length;
    return { total, paid, remaining, openCount, overdueCount };
  }, [clientInvoices]);

  const nextPaymentDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const due = clientInvoices
      .filter(r => r.next_payment_reminder_at)
      .map(r => (r.next_payment_reminder_at || "").slice(0, 10))
      .filter(Boolean)
      .sort();
    if (!due.length) return null;
    const upcoming = due.find(d => d >= today);
    return upcoming || due[0];
  }, [clientInvoices]);

  const clientPkg = useMemo(
    () => pkgRows.filter(r => r.client_id === selectedClientId),
    [pkgRows, selectedClientId]
  );

  const attentionItems = useMemo(() => {
    const items = data?.items || [];
    return items.filter((r) => r.payment_status === "pending" || r.payment_status === "partial");
  }, [data]);

  const pkgEndingSoon = useMemo(
    () => [...pkgRows]
      .filter((r) => !r.wont_renew && (r.status === "critical" || r.status === "low"))
      .sort((a, b) => (PKG_SORT_ORDER[a.status] ?? 9) - (PKG_SORT_ORDER[b.status] ?? 9)),
    [pkgRows]
  );

  const pkgHealthy = useMemo(
    () => pkgRows.filter((r) => r.status === "good").length,
    [pkgRows]
  );

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

  const clientListPane = (
    <div className="ci-pane-left">
      <div className="ci-pane-brand">
        <h2><Leaf size={14} className="inline mr-1" style={{ verticalAlign: -2 }} /> Clients</h2>
        <div className="ci-pane-stats">
          <span><em>{filteredClients.length}</em> shown</span>
          <span><em>{sortedClients.length}</em> total</span>
        </div>
      </div>
      <div className="p-3 border-b" style={{ borderColor: "#E2DDD4", background: "#fff" }}>
        <div className="search-pill-wrap">
          <MagnifyingGlass size={16} className="search-pill-icon" />
          <input
            className="input search-pill py-2 text-sm w-full"
            placeholder="Search name or file #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
          />
        </div>
      </div>
      <div className="ci-pane-list">
        {filteredClients.map((c) => {
          const isSelected = selectedClientId === c.id;
          const bg = c.color || "#E5EBE1";
          const initials = c.initials || c.name?.charAt(0) || "C";
          return (
            <button
              key={c.id}
              type="button"
              className={`ci-client-card${isSelected ? " selected" : ""}`}
              onClick={() => onClientChange(c.id)}
              data-testid={`billing-client-${c.id}`}
            >
              <div className="ci-client-card-inner">
                <div className="ci-client-card-avatar" style={{ background: bg, color: "#2C3625" }}>
                  {initials}
                </div>
                <div className="ci-client-card-body">
                  <div className="ci-client-card-top">
                    <div className="ci-client-card-name">{c.name}</div>
                  </div>
                  <div className="ci-client-card-meta">File #{c.file_no || "—"}</div>
                </div>
                <CaretRight size={14} className="ci-client-card-chevron" weight="bold" />
              </div>
            </button>
          );
        })}
        {filteredClients.length === 0 && (
          <div className="p-6 text-center text-xs" style={{ color: "#8B9E7A" }}>
            No clients match your search.
          </div>
        )}
      </div>
    </div>
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
          <CompactAttentionRow key={row.invoice_id} row={row} onEdit={canEditInvoice ? setEditRow : null} onOpenSheet={openSheet} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="portal-page-shell">
      <PageBanner
        title="Billing & Payments"
        subtitle="Payment alerts first · then browse clients & invoices"
        className=""
        tabs={[
          { id: "overview", label: "Client Invoices", icon: <Receipt size={14} weight="duotone" /> },
          { id: "calendar", label: "Invoice Calendar", icon: <CalendarBlank size={14} weight="duotone" /> },
        ]}
        activeTab={activeTab}
        onTabChange={setTab}
        stats={[
          { label: "Unpaid", n: summary.unpaid, color: "#8A3F27" },
          { label: "Partial", n: summary.partial, color: "#6B5218" },
          { label: "Reminders", n: summary.reminders_soon, color: "#5C6853" },
        ]}
      />

      {activeTab === "calendar" ? (
        <section className="portal-content-panel portal-page-body">
          <InvoiceCalendarTab embedded />
        </section>
      ) : (
        <section className="portal-content-panel portal-page-body">
        <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <p className="ui-caption m-0 flex-1 min-w-[200px]">
          Open <strong>Invoice Sheet</strong> for full billing details. Reminder emails go to admin and Walaa <strong>1–2 days before</strong> the next payment date.
        </p>
        <button
          type="button"
          onClick={sendReminders}
          disabled={sending}
          className="btn btn-outline text-xs shrink-0 min-h-[40px]"
        >
          <EnvelopeSimple size={14} /> {sending ? "Sending…" : "Send reminders"}
        </button>
      </div>

      <div className="mb-4">
        <BillingProgressStrip summary={summary} items={data.items || []} />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="card p-3 border" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold m-0 flex items-center gap-1.5" style={{ color: "var(--brand-dark)" }}>
              <Warning size={16} weight="duotone" /> Package ending soon
            </h3>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{pkgEndingSoon.length} clients</span>
          </div>
          {pkgEndingSoon.length === 0 ? (
            <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>No critical or low packages right now.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {pkgEndingSoon.map((row) => {
                const st = pkgStatusStyle(row.status);
                return (
                  <button
                    key={`${row.client_id}-${row.service_type}`}
                    type="button"
                    onClick={() => setFollowUpRow(row)}
                    className="text-left px-2 py-1 rounded-lg border text-[10px]"
                    style={{ background: st.bg, color: st.color, borderColor: st.border }}
                    title="Open follow-up actions"
                  >
                    <span className="font-semibold block">{row.client_name || "Client"}</span>
                    <span>{formatPkgBadge(row)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-3 border" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold m-0 flex items-center gap-1.5" style={{ color: "var(--brand-dark)" }}>
              <Receipt size={16} weight="duotone" /> Needs payment follow-up
            </h3>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{attentionItems.length} open</span>
          </div>
          {attentionItems.length === 0 ? (
            <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>All open invoices are on track ({pkgHealthy} packages healthy).</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {attentionItems.slice(0, 16).map((row) => {
                const st = paymentStatusStyle(row.payment_status);
                return (
                  <button
                    key={row.invoice_id}
                    type="button"
                    onClick={() => openSheet(row)}
                    className="text-left px-2 py-1 rounded-lg border text-[10px]"
                    style={{ background: st.bg, color: st.color, borderColor: st.border }}
                  >
                    <span className="font-semibold block">{row.client_name}</span>
                    <span>{row.invoice_number} · {paymentStatusLabel(row.payment_status)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        {attentionPanel}
      </div>

        <div className="ci-naturora portal-content-panel-wrap">
          <div className="ci-canvas">
            {clientListPane}
            <div className="ci-pane-right">
              {selectedClient ? (
                <div className="ci-profile-body">
                  <div className="ci-profile-card">
                    <div
                      className="ci-profile-avatar"
                      style={{ background: selectedClient.color || "#E5EBE1", color: "#2C3625" }}
                    >
                      {selectedClient.initials || selectedClient.name?.charAt(0)}
                    </div>
                    <div className="ci-profile-info">
                      <h1>{selectedClient.name}</h1>
                      <dl className="ci-profile-grid">
                        <dt>File</dt><dd>#{selectedClient.file_no || "—"}</dd>
                        <dt>Invoices</dt><dd>{clientInvoices.length}</dd>
                        <dt>Next payment</dt><dd>{nextPaymentDate || "—"}</dd>
                        <dt>Remaining</dt><dd>{formatMoney(clientTotals.remaining)}</dd>
                      </dl>
                    </div>
                    <div className="ci-profile-actions">
                      <button
                        type="button"
                        onClick={() => openSheetForClient(selectedClient)}
                        className="ci-btn-purple"
                      >
                        <ClipboardText size={14} className="inline mr-1" style={{ verticalAlign: -2 }} />
                        Invoice Sheet
                      </button>
                    </div>
                  </div>

                  <div className="card p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                        <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>TOTAL</div>
                        <div className="text-sm font-bold" style={{ color: "#2C3625" }}>{formatMoney(clientTotals.total)}</div>
                      </div>
                      <div className="p-3 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                        <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>PAID</div>
                        <div className="text-sm font-bold" style={{ color: "#2C3625" }}>{formatMoney(clientTotals.paid)}</div>
                      </div>
                      <div className="p-3 rounded-xl border" style={{ borderColor: clientTotals.remaining > 0 ? "#E8C4A8" : "#E2DDD4", background: clientTotals.remaining > 0 ? "#FDF8F3" : "#FAFAF7" }}>
                        <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>REMAINING</div>
                        <div className="text-sm font-bold" style={{ color: clientTotals.remaining > 0 ? "#8A3F27" : "#2C3625" }}>{formatMoney(clientTotals.remaining)}</div>
                      </div>
                      <div className="p-3 rounded-xl border" style={{ borderColor: clientTotals.overdueCount > 0 ? "#E8C4A8" : "#E2DDD4", background: clientTotals.overdueCount > 0 ? "#FDF8F3" : "#FAFAF7" }}>
                        <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>OVERDUE</div>
                        <div className="text-sm font-bold" style={{ color: clientTotals.overdueCount > 0 ? "#8A3F27" : "#2C3625" }}>{clientTotals.overdueCount}</div>
                      </div>
                    </div>
                  </div>

                  {clientPkg.length > 0 && (
                    <div className="card p-4">
                      <div className="text-xs font-bold tracking-wider mb-2" style={{ color: "#5C6853" }}>
                        PACKAGE STATUS
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    </div>
                  )}

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
                              <span className="pill text-[9px] font-bold px-1.5 py-0.5" style={{
                                background: row.is_closed ? "#F0EDE9" : "#E5EBE1",
                                color: row.is_closed ? "#5C6853" : "#3D4F35",
                                border: `1px solid ${row.is_closed ? "#E2DDD4" : "#B4C2A9"}`,
                              }}>
                                {row.is_closed ? "Closed" : "Open"}
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
                    const isSchool = (row.service_type || "").toUpperCase() === "SS";
                    const pkgLabel = row.package_size != null
                      ? (isSchool ? `${row.package_size} weeks` : `${row.package_size}h`)
                      : null;
                    const balance = row.amount_remaining ?? (
                      row.amount != null && row.amount_paid != null
                        ? Math.max(0, row.amount - row.amount_paid)
                        : null
                    );
                    return (
                      <div className="card p-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="font-bold">{row.invoice_number}</span>
                          <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            {paymentStatusLabel(row.payment_status)}
                          </span>
                          <span className="pill text-[10px] font-bold px-2 py-0.5" style={{
                            background: row.is_closed ? "#F0EDE9" : "#E5EBE1",
                            color: row.is_closed ? "#5C6853" : "#3D4F35",
                            border: `1px solid ${row.is_closed ? "#E2DDD4" : "#B4C2A9"}`,
                          }}>
                            {row.is_closed ? "Closed" : "Open"}
                          </span>
                          <span style={{ color: "#8B9E7A" }}>{formatServiceTypeDisplay(row.service_type) || row.service_type}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                          <div className="p-2.5 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                            <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>INVOICE TOTAL</div>
                            <div className="text-sm font-bold mt-0.5" style={{ color: "#2C3625" }}>{formatMoney(row.amount)}</div>
                          </div>
                          <div className="p-2.5 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                            <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>PAID</div>
                            <div className="text-sm font-bold mt-0.5" style={{ color: "#2C3625" }}>{formatMoney(row.amount_paid)}</div>
                          </div>
                          <div className="p-2.5 rounded-xl border" style={{ borderColor: (balance ?? 0) > 0 ? "#E8C4A8" : "#E2DDD4", background: (balance ?? 0) > 0 ? "#FDF8F3" : "#FAFAF7" }}>
                            <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>BALANCE</div>
                            <div className="text-sm font-bold mt-0.5" style={{ color: (balance ?? 0) > 0 ? "#8A3F27" : "#2C3625" }}>{formatMoney(balance)}</div>
                          </div>
                          <div className="p-2.5 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                            <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>{isSchool ? "PACKAGE" : "HOURS PKG"}</div>
                            <div className="text-sm font-bold mt-0.5" style={{ color: "#2C3625" }}>{pkgLabel || "—"}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: "#5C6853" }}>
                          {row.start_date && <span>Start: {row.start_date}</span>}
                          {row.payment_status === "pending" && row.days_unpaid > 0 && (
                            <span className="font-bold" style={{ color: "#8A3F27" }}>{row.days_unpaid}d unpaid</span>
                          )}
                          {row.next_payment_reminder_at && (
                            <span className="pill text-[10px] font-bold px-2 py-0.5" style={{ background: "#F0E9D8", color: "#5C6853", border: "1px solid #E2DDD4" }}>
                              Next: {(row.next_payment_reminder_at || "").slice(0, 10)}
                            </span>
                          )}
                          {row.payment_notes && (
                            <span className="italic">Note: {row.payment_notes}</span>
                          )}
                        </div>
                        {canEditInvoice && (
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              className="btn btn-secondary text-[10px] px-2 py-1 min-h-0"
                              onClick={() => setEditRow(row)}
                              data-testid="billing-edit-invoice-btn"
                            >
                              Edit invoice
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Receipt size={44} weight="duotone" className="mx-auto mb-3" style={{ color: "#7A8A6A" }} />
                  <p className="text-sm m-0" style={{ color: "#5C6853" }}>
                    Select a client from the left to view invoices, the next payment due date, and the financial summary.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
        </section>
      )}

      {followUpRow && (
        <PackageFollowUpModal
          row={followUpRow}
          onClose={() => setFollowUpRow(null)}
          onDone={load}
          onEditInvoice={(row) => {
            // Prefer full invoice row from dashboard if available
            const match = (data?.items || []).find((r) => r.invoice_id === row.invoice_id)
              || {
                invoice_id: row.invoice_id,
                invoice_number: row.invoice_number,
                client_id: row.client_id,
                client_name: row.client_name,
                service_type: row.service_type,
                payment_status: row.payment_status,
                package_size: row.package_size,
              };
            setEditRow(match);
          }}
          onOpenSheet={(row) => {
            onClientChange(row.client_id);
            openSheet(row);
          }}
        />
      )}

      {editRow && (
        <InvoiceEditModal
          invoice={rowToInvoice(editRow)}
          clientName={editRow.client_name}
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
