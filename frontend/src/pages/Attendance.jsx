import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth, showAdminNav } from "../auth";
import {
  MagnifyingGlass, Plus, X, Trash, PencilSimple, ClipboardText, ClockCounterClockwise,
  CheckCircle, Prohibit, Warning, XCircle, Clock, MapPin, Printer, FileXls,
  Receipt, ArrowsCounterClockwise, CalendarBlank, CaretDown, Download
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import {
  enrichClientForCardView, resolveClientBillingMode, formatServiceTypeDisplay,
  resolveCycleAnchor, computeSsWeekSummary, groupSessionsBySchoolWeeks,
  computeHsInvoiceTotals,
  filterSessionsForInvoice,
  filterInvoicesForServiceTab,
  sortInvoicesByRecent,
  sortSessionsByDateAsc,
  fmtDate, dayShort, dayNameFromDate, WEEK_ROW_BG,
  normalizeServiceTypeCode, inferDefaultServiceType,
  pickLatestOpenInvoice, computeSsTotals, ssSessionDayValue,
  resolveServiceTabState, hasOpenInvoice, countSsWeeksDone, nextWeekOverride,
  sessionEditableByUser,
} from "../attendanceUtils";
import { PackageAlertBanner } from "../components/PackageStatusBadge";
import PreparationPrepLayout from "../components/PreparationPrepLayout";
import PageBanner from "../components/PageBanner";
import LogSessionModal from "../components/LogSessionModal";
import SsWeekStatusRow, { SsWeekLegend } from "../components/SsWeekStatusRow";
import ExportColumnsModal, { buildInvoiceSheetColumns } from "../components/ExportColumnsModal";
import { cachedGet } from "../dataCache";

const EXPORT_COLS_KEY = "bg_export_columns";

const SUPERVISOR_CLIENTS = {
  msMaha: ["035", "037", "038", "040", "041", "042", "047", "052", "054", "060", "063", "065", "070"],
  msFahda: ["009", "011", "018", "023", "024", "027", "030", "034", "061", "062", "068", "072", "079"],
};

function isSupervisorForClient(user, fileNo) {
  if (!user || user.role === "admin") return user?.role === "admin";
  const key = user.key || "";
  const fn = String(fileNo || "").padStart(3, "0");
  return (SUPERVISOR_CLIENTS[key] || []).includes(fn);
}

const STATUS_OPTS = [
  { id: "Completed", label: "Completed", icon: <CheckCircle size={28} weight="fill"/>, color: "#3D4F35", bg: "#E5EBE1" },
  { id: "No Service", label: "No Service", icon: <Prohibit size={28} weight="fill"/>, color: "#5C6853", bg: "#F0EDE9" },
  { id: "Cancelled", label: "Cancelled", icon: <Warning size={28} weight="fill"/>, color: "#8B6918", bg: "#FAF0D1" },
  { id: "No Show", label: "No Show", icon: <XCircle size={28} weight="fill"/>, color: "#8A3F27", bg: "#F8EBE7" },
];

function getUsedHours(sessions, clientId, resetAt) {
  return sessions
    .filter(s => s.client_id === clientId && s.status === "Completed")
    .filter(s => !resetAt || (s.session_date && s.session_date >= resetAt.slice(0, 10)))
    .reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
}

function ServiceTypeToggle({ value, onChange, tabState }) {
  const ts = tabState || {};
  const renderBtn = (code) => {
    const active = value === code;
    const disabled = code === "HS" ? ts.hsDisabled : ts.ssDisabled;

    const tooltip = disabled
      ? `This client does not have ${code === "HS" ? "Home Session (HS)" : "School Support (SS)"} service`
      : undefined;

    return (
      <button
        key={code}
        type="button"
        data-testid={`service-type-${code}`}
        disabled={disabled}
        title={tooltip}
        onClick={() => !disabled && onChange(code)}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition shrink-0 min-h-[44px] min-w-[44px]"
        style={
          active
            ? { background: "#7A8A6A", color: "#fff", borderColor: "#7A8A6A" }
            : disabled
              ? { background: "#F5F5F5", color: "#A0A0A0", borderColor: "#E0E0E0", opacity: 0.55, cursor: "not-allowed" }
              : { background: "#fff", color: "#5C6853", borderColor: "#7A8A6A" }
        }
      >
        {code}{active ? " ✓" : ""}
      </button>
    );
  };
  return (
    <div className="flex gap-1 items-center" role="group" aria-label="Service type">
      {renderBtn("HS")}
      {renderBtn("SS")}
    </div>
  );
}

function SessionTableRow({ s, findT, isAdmin, user, client, currentUserId, onEdit, onDeleted, rowBg, billingKind, locked = false, bordered = false, sheetCols }) {
  const colIds = sheetCols ? new Set(sheetCols.map(c => c.id)) : null;
  const show = (id) => !colIds || colIds.has(id);
  const stColor = s.status === "Completed" ? "#3D4F35" :
    s.status === "Cancelled" ? "#6B5218" :
    s.status === "No Show" ? "#8A3F27" : "#5C6853";
  const stBg = s.status === "Completed" ? "#E5EBE1" :
    s.status === "Cancelled" ? "#FAF0D1" :
    s.status === "No Show" ? "#F8EBE7" : "#F0EDE9";
  const tNames = (s.therapist_ids || []).map(id => findT(id)?.name?.replace("Ms. ", "")).filter(Boolean).join(" - ");
  const canEdit = !locked && (
    isAdmin ||
    isSupervisorForClient(user, client.file_no) ||
    ((s.therapist_ids || []).includes(currentUserId) && sessionEditableByUser(s, user, false))
  );
  const measureVal = billingKind === "SS"
    ? (ssSessionDayValue(s) ? 1 : "—")
    : s.hours;
  const cell = bordered ? "p-2 border border-[#E0E8DC]" : "p-2";
  return (
    <tr key={s.id} className={bordered ? "" : "border-t border-[#E2DDD4]"} style={{ background: rowBg || undefined }}>
      {show("days") && <td className={`${cell} font-bold`}>{dayNameFromDate(s.session_date)}</td>}
      {show("date") && <td className={`${cell} font-bold`}>{fmtDate(s.session_date)}</td>}
      {show("status") && <td className={cell}><span className="pill text-[10px] uppercase" style={{ background: stBg, color: stColor }}>{s.status}</span></td>}
      {show("time") && <td className={cell}>{s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : "—"}</td>}
      {show("hours") && <td className={`${cell} font-bold`}>{measureVal}</td>}
      {show("therapist") && <td className={cell}>{tNames || "—"}</td>}
      {show("service") && <td className={cell}>{s.service_type || "—"}</td>}
      {show("location") && <td className={cell}>{s.location || "—"}</td>}
      {show("note") && <td className={`${cell} italic`} style={{ color: "#5C6853" }}>{s.note || ""}</td>}
      {!locked && show("_action") && (
        <td className={`${cell} text-right whitespace-nowrap no-print`}>
          {canEdit && <button onClick={() => onEdit(s)} className="btn btn-ghost p-1.5"><PencilSimple size={14}/></button>}
          {canEdit && <button onClick={async () => { if (window.confirm("Delete?")) { await api.delete(`/sessions/${s.id}`); onDeleted(); } }} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14}/></button>}
        </td>
      )}
    </tr>
  );
}

function HistoryTableHead({ cols, bordered = false }) {
  const cell = bordered ? "p-2 text-left font-bold border border-[#E0E8DC]" : "p-2 text-left font-bold";
  const items = cols.map(c => (typeof c === "string" ? { id: c, label: c } : c));
  return (
    <thead style={{ background: bordered ? "#F6F9F3" : "#F0E9D8" }}>
      <tr style={{ color: "#2C3625" }}>
        {items.map((c, i) => (
          <th key={c.id || i} className={`${cell}${c.id === "_action" ? " no-print" : ""}`}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [packageRows, setPackageRows] = useState([]);
  const [cardsReady, setCardsReady] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [logFor, setLogFor] = useState(null); // client OR null OR "__pick__"
  const [editingSess, setEditingSess] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [selectedPrepId, setSelectedPrepId] = useState(null);

  const load = useCallback(async (force = false) => {
    const [c, t, pkg] = await Promise.all([
      cachedGet("/clients", { force }),
      cachedGet("/therapists", { force }).catch(() => []),
      cachedGet("/clients/package-status", { force }).catch(() => []),
    ]);
    setClients(Array.isArray(c) ? c : []);
    setTherapists(Array.isArray(t) ? t : []);
    setPackageRows(Array.isArray(pkg) ? pkg : []);
    setCardsReady(true);
    cachedGet("/sessions", { force }).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(
    () => clients
      .filter(c => (c.status || "Active") !== "Inactive")
      .map(c => enrichClientForCardView(c, packageRows)),
    [clients, packageRows]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter !== "all") list = list.filter(c => c.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.file_no || "").includes(q));
    }
    return [...list].sort((a, b) => isAdmin
      ? ({ urgent: 0, warning: 1, ok: 2 }[a.status] - { urgent: 0, warning: 1, ok: 2 }[b.status])
      : (a.name || "").localeCompare(b.name || ""));
  }, [enriched, filter, search]);

  const counts = {
    all: enriched.length,
    urgent: enriched.filter(c => c.status === "urgent").length,
    warning: enriched.filter(c => c.status === "warning").length,
    ok: enriched.filter(c => c.status === "ok").length,
  };

  const findT = id => therapists.find(t => t.id === id);

  const filterOpts = [
    { id: "all", label: "All" },
    { id: "urgent", label: "Urgent", dot: "#C97B5C" },
    { id: "warning", label: "Warning", dot: "#D4A64A" },
    { id: "ok", label: "Safe", dot: "#7A8A6A" },
  ];

  const showPrepStats = isAdmin;

  const prepToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {showPrepStats && (
        <div className="flex gap-1.5 flex-wrap">
          {filterOpts.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`filter-chip ${filter === f.id ? "active" : ""}`}
            >
              {f.dot && filter !== f.id && (
                <span className="inline-block w-2 h-2 rounded-full align-middle" style={{ background: f.dot }} />
              )}
              {f.label}
            </button>
          ))}
        </div>
      )}
      <div className="search-pill-wrap">
        <MagnifyingGlass size={16} className="search-pill-icon" />
        <input
          data-testid="att-search"
          className="input search-pill py-2 text-sm w-full"
          placeholder="Search client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <button data-testid="log-session-picker" type="button" onClick={() => setLogFor("__pick__")} className="btn btn-primary text-sm min-h-[40px]">
        <Plus size={16} /> Log Session
      </button>
      {isAdmin && (
        <button type="button" onClick={() => navigate("/clients")} className="btn btn-outline text-sm min-h-[40px]">
          <Plus size={16} /> Add Client
        </button>
      )}
    </div>
  );

  return (
    <div>
      <PageBanner
        title="Session Preparation"
        subtitle="Log sessions and track package progress"
        stats={showPrepStats ? [
          { label: "Total", n: counts.all, color: "#2C3625" },
          { label: "Urgent", n: counts.urgent, color: "#8A3F27" },
          { label: "Warning", n: counts.warning, color: "#6B5218" },
          { label: "Safe", n: counts.ok, color: "#3D4F35" },
        ] : undefined}
        toolbar={prepToolbar}
      />

      {/* Client list — design preview layout */}
      <div className="stagger">
        {!cardsReady && (
          <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
            <div className="spinner mx-auto mb-3" /> Loading clients…
          </div>
        )}
        {cardsReady && (
          <PreparationPrepLayout
            clients={filtered}
            selectedId={selectedPrepId}
            onSelect={setSelectedPrepId}
            onLog={c => setLogFor(c)}
            onHistory={c => setHistoryFor(c)}
            counts={counts}
            isAdmin={isAdmin}
            findTherapist={id => findT(id)}
          />
        )}
      </div>

      {/* Picker modal */}
      {logFor === "__pick__" && (
        <ModalBase
          title="Select Client"
          subtitle="Choose a client to log a session"
          onClose={() => setLogFor(null)}
          size="sm"
        >
          <div className="max-h-96 overflow-y-auto flex flex-col gap-2 -mt-2">
            {enriched.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setLogFor(c)}
                className="text-left p-3 rounded-xl border flex items-center gap-3 transition hover:bg-[#E5EBE1]"
                style={{ borderColor: "#DDD8D0" }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold" style={{ background: c.color || "#E5EBE1" }}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm" style={{ color: "#1C2617" }}>{c.name}</div>
                  <div className="text-[11px]" style={{ color: "#8B9E7A" }}>
                    #{c.file_no} · {c.billing_mode === "weeks"
                      ? `Week ${c.currentWeek}/${c.cycleWeeks}`
                      : `${c.rem.toFixed(1)}/${c.pkg}h left`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ModalBase>
      )}

      {historyFor && (
        <AttendanceHistoryModal client={historyFor} sessions={sessions.filter(s => s.client_id === historyFor.id)}
                                therapists={therapists} isAdmin={isAdmin} user={user} currentUserId={user?.id}
                                onClose={() => setHistoryFor(null)}
                                onEdit={(s) => { setEditingSess(s); }}
                                onRefresh={load}/>
      )}

      {logFor && logFor !== "__pick__" && (
        <LogSessionModal client={logFor} therapists={therapists} currentUser={user}
          onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); load(); }} />
      )}

      {editingSess && (
        <LogSessionModal session={editingSess} client={clients.find(c => c.id === editingSess.client_id)} therapists={therapists} currentUser={user}
          onClose={() => setEditingSess(null)} onSaved={() => { setEditingSess(null); load(); }} />
      )}
    </div>
  );
}

function AttendanceHistoryModal({ client, sessions, therapists, isAdmin, user, currentUserId, onClose, onEdit, onRefresh }) {
  const findT = id => therapists.find(t => t.id === id);
  const [allInvoices, setAllInvoices] = useState([]);
  const [serviceTypeFilter, setServiceTypeFilter] = useState(() =>
    inferDefaultServiceType([], client, user, sessions) || "HS"
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [localSessions, setLocalSessions] = useState(() => sessions || []);
  const [loading, setLoading] = useState(true);
  const prevServiceFilter = useRef(serviceTypeFilter);

  const tabState = useMemo(() => resolveServiceTabState(client, allInvoices), [client, allInvoices]);
  const isSchool = serviceTypeFilter === "SS";
  const invoices = useMemo(
    () => filterInvoicesForServiceTab(allInvoices, serviceTypeFilter, client),
    [allInvoices, serviceTypeFilter, client]
  );
  const sortedInvoices = useMemo(() => sortInvoicesByRecent(invoices), [invoices]);
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
  const invoiceLocked = !!selectedInvoice?.is_closed;
  const cycleWeeks = selectedInvoice?.ss_week_count || 4;

  const fetchSessionsForInvoice = useCallback(async (invoiceId) => {
    const params = { client_id: client.id };
    if (invoiceId) params.invoice_id = invoiceId;
    try {
      const r = await api.get("/sessions", { params });
      return r.data || [];
    } catch {
      return [];
    }
  }, [client.id]);

  const bootstrapModal = useCallback(async () => {
    setLoading(true);
    try {
      const invRes = await api.get(`/clients/${client.id}/invoices`);
      const list = invRes.data || [];
      setAllInvoices(list);
      const def = inferDefaultServiceType(list, client, user, sessions) || "HS";
      setServiceTypeFilter(def);
      const tab = resolveServiceTabState(client, list);
      const filtered = tab.showToggle ? filterInvoicesForServiceTab(list, def, client) : list;
      const pick = pickLatestOpenInvoice(filtered);
      const invId = pick?.id || "";
      setSelectedInvoiceId(invId);
      prevServiceFilter.current = def;
      const data = await fetchSessionsForInvoice(invId);
      setLocalSessions(data);
    } catch {
      setAllInvoices([]);
      setLocalSessions([]);
    } finally {
      setLoading(false);
    }
  }, [client, user, sessions, fetchSessionsForInvoice]);

  useEffect(() => {
    bootstrapModal();
  }, [client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevServiceFilter.current === serviceTypeFilter) return;
    prevServiceFilter.current = serviceTypeFilter;
    const filtered = tabState.showToggle
      ? filterInvoicesForServiceTab(allInvoices, serviceTypeFilter, client)
      : allInvoices;
    const pick = pickLatestOpenInvoice(filtered);
    const invId = pick?.id || "";
    setSelectedInvoiceId(invId);
    setLoading(true);
    fetchSessionsForInvoice(invId).then(data => {
      setLocalSessions(data);
      setLoading(false);
    });
  }, [serviceTypeFilter, allInvoices, tabState.showToggle, client, fetchSessionsForInvoice]);

  const reloadSessions = useCallback(async () => {
    const data = await fetchSessionsForInvoice(selectedInvoiceId);
    setLocalSessions(data);
  }, [fetchSessionsForInvoice, selectedInvoiceId]);

  useEffect(() => {
    if (loading) return;
    reloadSessions();
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const cycleSessions = useMemo(
    () => filterSessionsForInvoice(localSessions, selectedInvoice, allInvoices),
    [localSessions, selectedInvoice, allInvoices]
  );
  const cycleAnchor = useMemo(
    () => (selectedInvoice ? resolveCycleAnchor(client, selectedInvoice, cycleSessions) : null),
    [client, selectedInvoice, cycleSessions]
  );
  const ssWeekSummary = useMemo(
    () => (isSchool && cycleAnchor
      ? computeSsWeekSummary(cycleSessions, cycleAnchor, cycleWeeks, selectedInvoice?.week_overrides || {})
      : []),
    [isSchool, cycleSessions, cycleAnchor, cycleWeeks, selectedInvoice?.week_overrides]
  );
  const sorted = useMemo(() => sortSessionsByDateAsc(cycleSessions), [cycleSessions]);

  const ssWeekGroups = useMemo(
    () => (isSchool && cycleAnchor ? groupSessionsBySchoolWeeks(cycleSessions, cycleAnchor, cycleWeeks) : []),
    [isSchool, cycleSessions, cycleAnchor, cycleWeeks]
  );

  const reloadInvoices = useCallback(async () => {
    const r = await api.get(`/clients/${client.id}/invoices`).catch(() => ({ data: [] }));
    const list = r.data || [];
    setAllInvoices(list);
    return list;
  }, [client.id]);

  const toggleWeekOverride = async (weekNum, currentKey) => {
    if (!selectedInvoice || invoiceLocked || !isAdmin) return;
    const overrides = { ...(selectedInvoice.week_overrides || {}) };
    const key = String(weekNum);
    const next = nextWeekOverride(currentKey);
    if (next) overrides[key] = next;
    else delete overrides[key];
    try {
      await api.put(`/invoices/${selectedInvoice.id}/week-overrides`, { week_overrides: overrides });
      await reloadInvoices();
      onRefresh && onRefresh();
      reloadSessions();
    } catch {
      alert("Could not save week override");
    }
  };

  const addSsWeek = async () => {
    if (!selectedInvoice || invoiceLocked || !isAdmin || !isSchool) return;
    const next = cycleWeeks + 1;
    try {
      await api.put(`/invoices/${selectedInvoice.id}`, {
        invoice_number: selectedInvoice.invoice_number,
        ss_week_count: next,
        start_date: selectedInvoice.start_date,
        package_size: selectedInvoice.package_size,
        payment_status: selectedInvoice.payment_status,
        service_type: selectedInvoice.service_type,
        is_closed: selectedInvoice.is_closed,
      });
      await reloadInvoices();
      onRefresh && onRefresh();
    } catch {
      alert("Could not add week");
    }
  };

  const removeSsWeek = async () => {
    if (!selectedInvoice || invoiceLocked || !isAdmin || !isSchool || cycleWeeks <= 4) return;
    if (!window.confirm(`Remove Week ${cycleWeeks} from this invoice?`)) return;
    try {
      await api.put(`/invoices/${selectedInvoice.id}`, {
        invoice_number: selectedInvoice.invoice_number,
        ss_week_count: cycleWeeks - 1,
        start_date: selectedInvoice.start_date,
        package_size: selectedInvoice.package_size,
        payment_status: selectedInvoice.payment_status,
        service_type: selectedInvoice.service_type,
        is_closed: selectedInvoice.is_closed,
      });
      await reloadInvoices();
      onRefresh && onRefresh();
    } catch {
      alert("Could not remove week");
    }
  };

  const historySheetCols = useMemo(
    () => buildInvoiceSheetColumns(null, { isSchool, includeAction: !invoiceLocked }),
    [isSchool, invoiceLocked]
  );

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-2 z-50" onClick={onClose}>
      <div className="card p-0 relative w-full max-w-3xl modal-card max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-1.5 right-1.5 z-20 btn btn-ghost p-1.5 min-h-[32px] min-w-[32px] rounded-lg no-print"
        >
          <X size={18}/>
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 pr-10 border-b border-[#E2DDD4] no-print shrink-0">
          <div className="font-bold text-sm truncate min-w-0 flex-1" style={{ color: "#2C3625" }}>
            History · {client.name}
          </div>
          {tabState.showToggle && (
            <ServiceTypeToggle value={serviceTypeFilter} onChange={setServiceTypeFilter} tabState={tabState} />
          )}
          {sortedInvoices.length > 1 ? (
            <select
              className="select text-xs min-h-[32px] max-w-[150px] shrink-0"
              value={selectedInvoiceId}
              onChange={e => {
                const id = e.target.value;
                setSelectedInvoiceId(id);
                setLoading(true);
                fetchSessionsForInvoice(id).then(data => {
                  setLocalSessions(data);
                  setLoading(false);
                });
              }}
            >
              {sortedInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} · {inv.is_closed ? "Closed" : "Open"}
                </option>
              ))}
            </select>
          ) : selectedInvoice ? (
            <span className="text-[10px] shrink-0 pill px-1.5 py-0.5" style={{ background: "#F0EDE9", color: "#5C6853" }}>
              {selectedInvoice.invoice_number}
            </span>
          ) : null}
        </div>

        {invoiceLocked && (
          <div className="px-3 py-1 text-[10px] font-bold no-print shrink-0"
            style={{ background: "#F5F5F5", color: "#5C6853", borderBottom: "1px solid #E0E0E0" }}>
            🔒 Closed invoice — view only
          </div>
        )}

        {isSchool && ssWeekSummary.length > 0 && (
          <div className="px-3 py-1.5 border-b border-[#F0EDE9] no-print shrink-0" style={{ background: "#FAFAF7" }}>
            {isAdmin && !invoiceLocked && <SsWeekLegend compact />}
            <SsWeekStatusRow
              weeks={ssWeekSummary}
              compact
              editable={isAdmin && !invoiceLocked}
              onToggleOverride={toggleWeekOverride}
              showAddWeek={isAdmin && !invoiceLocked && isSchool}
              onAddWeek={addSsWeek}
              showRemoveWeek={isAdmin && !invoiceLocked && isSchool && cycleWeeks > 4}
              onRemoveWeek={removeSsWeek}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 bg-[#FAFAF7]">
          <div className="px-3 pt-3 pb-2 text-center bg-white border-b border-[#E2DDD4]">
            <div className="w-10 h-10 rounded-lg mx-auto flex items-center justify-center p-1.5" style={{ background: "#7A8A6A" }}>
              <img src="/bg-logo.png" alt="" className="w-full h-full object-contain"/>
            </div>
            <div className="font-display text-base font-semibold mt-1 leading-tight" style={{ color: "#2C3625" }}>Boost Growth</div>
            <div className="text-[9px] tracking-[0.12em] font-bold" style={{ color: "#8B9E7A" }}>SESSION HISTORY</div>
            {!isAdmin && (
              <p
                className="mt-2 mb-0 text-[10px] leading-snug px-2 py-1.5 rounded-lg border mx-auto max-w-md no-print"
                style={{ background: "#FFF8E6", borderColor: "#E6C983", color: "#6B5218" }}
                role="note"
              >
                You cannot edit preparation after 24 hours from the session.
              </p>
            )}
          </div>

          {!selectedInvoice ? (
            <div className="p-4 text-center text-sm" style={{ color: "#8B9E7A" }}>No invoice selected</div>
          ) : loading ? (
            <div className="p-4 text-center text-sm" style={{ color: "#8B9E7A" }}>Loading sessions…</div>
          ) : cycleSessions.length === 0 && !isSchool ? (
            <div className="p-4 text-center text-sm" style={{ color: "#8B9E7A" }}>No sessions for this invoice yet</div>
          ) : isSchool ? (
            <div className="p-2 space-y-2">
              {ssWeekGroups.map((group) => {
                const wk = ssWeekSummary[group.weekNumber - 1];
                const st = wk?.weekStatus || "Not started";
                const badgeBg = st === "Completed" ? "#E5EBE1" : st === "Open" ? "#FAF0D1" : st === "In Progress" ? "#FAF0D1" : "#FAFAF7";
                return (
                  <div key={`week-${group.weekNumber}`} className="border rounded-lg overflow-hidden bg-white" style={{ borderColor: "#C4D4B8" }}>
                    <div className="px-2.5 py-1 flex items-center justify-between flex-wrap gap-1.5" style={{ background: "#EDF4E8" }}>
                      <span className="font-bold text-xs" style={{ color: "#2C5035" }}>WEEK {group.weekNumber}</span>
                      <span className="text-[10px]" style={{ color: "#5C6853" }}>{group.label}</span>
                      {wk && (
                        <span className="pill text-[10px] font-bold" style={{ background: badgeBg, color: "#3D4F35" }}>
                          {st}
                          {group.sessions.length > 0 && ` (${wk.attended}/${group.dates.length || 5} days)`}
                        </span>
                      )}
                    </div>
                    {group.sessions.length === 0 ? (
                      <div className="p-3 text-center text-xs italic" style={{ color: "#8B9E7A" }}>
                        {group.startISO ? "No sessions this week" : "Upcoming"}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[480px] border-collapse">
                          <HistoryTableHead cols={historySheetCols.filter(c => c.id !== "_action" || !invoiceLocked)} bordered />
                          <tbody>
                            {sortSessionsByDateAsc(group.sessions).map(s => (
                              <SessionTableRow
                                key={s.id}
                                s={s}
                                findT={findT}
                                isAdmin={isAdmin}
                                user={user}
                                client={client}
                                currentUserId={currentUserId}
                                onEdit={onEdit}
                                onDeleted={() => { onRefresh && onRefresh(); reloadSessions(); }}
                                rowBg={WEEK_ROW_BG[(group.weekNumber - 1) % WEEK_ROW_BG.length]}
                                billingKind="SS"
                                locked={invoiceLocked}
                                bordered
                                sheetCols={historySheetCols}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-2">
              <div className="border rounded-lg overflow-hidden bg-white" style={{ borderColor: "#C4D4B8" }}>
                <div className="px-2.5 py-1 flex items-center justify-between" style={{ background: "#EDF4E8" }}>
                  <span className="font-bold text-xs" style={{ color: "#2C5035" }}>HOME SESSIONS</span>
                  <span className="text-[10px]" style={{ color: "#5C6853" }}>{sorted.length} session{sorted.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[520px] border-collapse">
                    <HistoryTableHead cols={historySheetCols} bordered />
                    <tbody>
                      {sorted.map((s, i) => (
                        <SessionTableRow
                          key={s.id}
                          s={s}
                          findT={findT}
                          isAdmin={isAdmin}
                          user={user}
                          client={client}
                          currentUserId={currentUserId}
                          onEdit={onEdit}
                          onDeleted={() => { onRefresh && onRefresh(); reloadSessions(); }}
                          rowBg={WEEK_ROW_BG[i % WEEK_ROW_BG.length]}
                          billingKind="HS"
                          locked={invoiceLocked}
                          bordered
                          sheetCols={historySheetCols}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function HistoryModal({ client, sessions, therapists, isAdmin, user, currentUserId, onClose, onEdit, onDeleted, onClientUpdated, initialService, autoNewInvoice }) {
  const [closed, setClosed] = useState(false);
  const [closureDate, setClosureDate] = useState("");
  // Invoice + package management state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [packageSize, setPackageSize] = useState(client.package_hours || 24);
  const [allInvoices, setAllInvoices] = useState([]);
  const [serviceTypeFilter, setServiceTypeFilter] = useState(() =>
    inferDefaultServiceType([], client, user, sessions) || "HS"
  );
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [packageEndDate, setPackageEndDate] = useState(client.package_end_date || "");
  const [paymentStatus, setPaymentStatus] = useState(client.payment_status || "pending");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [nextPaymentReminder, setNextPaymentReminder] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showNewInvModal, setShowNewInvModal] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [localSessions, setLocalSessions] = useState(sessions);
  const [showExportColumns, setShowExportColumns] = useState(false);
  const [exportPendingMode, setExportPendingMode] = useState(null);
  const [sheetColIds, setSheetColIds] = useState(() => {
    try {
      const raw = localStorage.getItem(EXPORT_COLS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [newInvMenuOpen, setNewInvMenuOpen] = useState(false);
  const invoicesInitialized = useRef(false);
  const prevServiceFilter = useRef(serviceTypeFilter);
  const autoNewInvDone = useRef(false);

  useEffect(() => {
    if (initialService && (initialService === "HS" || initialService === "SS")) {
      setServiceTypeFilter(initialService);
    }
  }, [client.id, initialService]);

  useEffect(() => {
    if (autoNewInvoice && isAdmin && !autoNewInvDone.current) {
      autoNewInvDone.current = true;
      setShowNewInvModal(true);
    }
  }, [autoNewInvoice, isAdmin]);

  const findT = id => therapists.find(t => t.id === id);
  const tabState = useMemo(() => resolveServiceTabState(client, allInvoices), [client, allInvoices]);
  const isSchool = serviceTypeFilter === "SS";
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
  const sortedInvoices = useMemo(() => sortInvoicesByRecent(invoices), [invoices]);
  const cycleWeeks = selectedInvoice?.ss_week_count || 4;
  const cycleSessions = useMemo(
    () => filterSessionsForInvoice(localSessions, selectedInvoice, allInvoices),
    [localSessions, selectedInvoice, allInvoices]
  );
  const cycleAnchor = useMemo(
    () => (selectedInvoice ? resolveCycleAnchor(client, selectedInvoice, cycleSessions) : null),
    [client, selectedInvoice, cycleSessions]
  );
  const hsTotals = useMemo(
    () => computeHsInvoiceTotals(cycleSessions, selectedInvoice?.package_size || 24),
    [cycleSessions, selectedInvoice?.package_size]
  );
  const ssWeekGroups = useMemo(
    () => (isSchool && cycleAnchor ? groupSessionsBySchoolWeeks(cycleSessions, cycleAnchor, cycleWeeks) : []),
    [isSchool, cycleSessions, cycleAnchor, cycleWeeks]
  );
  const ssWeekSummary = useMemo(
    () => (isSchool && cycleAnchor
      ? computeSsWeekSummary(cycleSessions, cycleAnchor, cycleWeeks, selectedInvoice?.week_overrides || {})
      : []),
    [isSchool, cycleSessions, cycleAnchor, cycleWeeks, selectedInvoice?.week_overrides]
  );
  const ssTotals = useMemo(() => computeSsTotals(cycleSessions), [cycleSessions]);
  const pkg = hsTotals.pkg;
  const used = hsTotals.hoursUsed;
  const rem = hsTotals.hoursRemaining;
  const hoursDelivered = hsTotals.hoursDelivered;
  const noServiceCount = hsTotals.noServiceCount;
  const completed = hsTotals.completedCount;
  const noShows = hsTotals.noShowCount;

  const selectedInvoiceAlert = useMemo(() => {
    if (!selectedInvoice || selectedInvoice.is_closed || isSchool) return null;
    const pkgSize = parseFloat(selectedInvoice.package_size) || pkg;
    if (pkgSize <= 0 || rem <= 0) return null;
    const pctRem = (rem / pkgSize) * 100;
    if (pctRem > 15) return null;
    return {
      service_type: serviceTypeFilter,
      remaining: rem,
      package_size: pkgSize,
      status: "critical",
      unit: "hours",
    };
  }, [selectedInvoice, isSchool, rem, pkg, serviceTypeFilter]);

  const currentWeekInfo = useMemo(
    () => ssWeekSummary.find(w => w.weekStatus === "In Progress") || ssWeekSummary.find(w => w.weekStatus === "Not started") || ssWeekSummary[ssWeekSummary.length - 1],
    [ssWeekSummary]
  );
  const weeksDone = countSsWeeksDone(ssWeekSummary);
  const weeksRem = Math.max(0, cycleWeeks - weeksDone);

  const billingMode = useMemo(
    () => resolveClientBillingMode(client, selectedInvoice || null, serviceTypeFilter),
    [client, selectedInvoice, serviceTypeFilter]
  );
  const serviceDisplay = useMemo(
    () => formatServiceTypeDisplay(selectedInvoice?.service_type || serviceTypeFilter) || serviceTypeFilter,
    [selectedInvoice?.service_type, serviceTypeFilter]
  );

  // Reset invoice tab when switching clients
  useEffect(() => {
    invoicesInitialized.current = false;
    const def = inferDefaultServiceType([], client, user, sessions) || "HS";
    setServiceTypeFilter(def);
    setSelectedInvoiceId("");
  }, [client.id, client.service_type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load all invoices, then apply HS/SS filter
  const loadInvoices = useCallback(async () => {
    const r = await api.get(`/clients/${client.id}/invoices`).catch(() => ({ data: [] }));
    return r.data || [];
  }, [client.id]);

  useEffect(() => {
    loadInvoices().then(list => {
      setAllInvoices(list);
      if (!invoicesInitialized.current) {
        invoicesInitialized.current = true;
        const def = inferDefaultServiceType(list, client, user, sessions) || "HS";
        setServiceTypeFilter(def);
        const filtered = tabState.showToggle
          ? filterInvoicesForServiceTab(list, def, client)
          : list;
        const pick = pickLatestOpenInvoice(filtered);
        setSelectedInvoiceId(pick?.id || "");
      }
    }).catch(() => setAllInvoices([]));
  }, [client.id, client.service_type, loadInvoices]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!allInvoices.length) {
      setInvoices([]);
      return;
    }
    const filtered = tabState.showToggle
      ? filterInvoicesForServiceTab(allInvoices, serviceTypeFilter, client)
      : allInvoices;
    setInvoices(filtered);
    if (prevServiceFilter.current !== serviceTypeFilter) {
      prevServiceFilter.current = serviceTypeFilter;
      const pick = pickLatestOpenInvoice(filtered);
      setSelectedInvoiceId(pick?.id || "");
    }
  }, [allInvoices, serviceTypeFilter, tabState.showToggle]);

  // Re-fetch sessions when invoice filter changes
  useEffect(() => {
    const params = { client_id: client.id };
    if (selectedInvoiceId) params.invoice_id = selectedInvoiceId;
    api.get("/sessions", { params }).then(r => setLocalSessions(r.data || [])).catch(() => setLocalSessions([]));
  }, [client.id, selectedInvoiceId, sessions]);

  // When user picks an invoice from the dropdown, populate the form fields with that invoice's data
  useEffect(() => {
    if (selectedInvoice) {
      setInvoiceNumber(selectedInvoice.invoice_number || "");
      setPackageEndDate(selectedInvoice.period_to || client.package_end_date || "");
      setPaymentStatus(selectedInvoice.payment_status || "pending");
      setInvoiceAmount(selectedInvoice.amount ?? "");
      setAmountPaid(selectedInvoice.amount_paid ?? "");
      setNextPaymentReminder((selectedInvoice.next_payment_reminder_at || "").slice(0, 10));
      setPaymentNotes(selectedInvoice.payment_notes || "");
      setPackageSize(selectedInvoice.package_size || client.package_hours || 24);
      setClosed(!!selectedInvoice.is_closed);
      setClosureDate(selectedInvoice.close_date || "");
    } else {
      // No invoice selected -> client defaults
      setInvoiceNumber("");
      setPackageEndDate(client.package_end_date || "");
      setPaymentStatus(client.payment_status || "pending");
      setInvoiceAmount("");
      setAmountPaid("");
      setNextPaymentReminder("");
      setPaymentNotes("");
      setPackageSize(client.package_hours || 24);
      setClosed(false);
      setClosureDate("");
    }
  }, [selectedInvoiceId, invoices, client.package_end_date, client.payment_status, client.package_hours]);

  const createInvoice = async (number, size) => {
    const trimmed = (number || "").trim();
    if (!trimmed) { alert("Please enter an invoice number"); return; }
    const r = await api.post(`/clients/${client.id}/invoices`, {
      invoice_number: trimmed,
      package_size: parseFloat(size) || (isSchool ? 4 : (client.package_hours || 24)),
      payment_status: "pending",
      start_date: new Date().toISOString().slice(0, 10),
      service_type: serviceTypeFilter,
      is_closed: false,
    });
    const list = await loadInvoices();
    setAllInvoices(list);
    setSelectedInvoiceId(r.data.id);
    setShowNewInvModal(false);
  };

  const deleteInvoice = async (iid) => {
    if (!window.confirm("Delete this invoice number?")) return;
    await api.delete(`/invoices/${iid}`);
    const list = await loadInvoices();
    setAllInvoices(list);
    if (selectedInvoiceId === iid) setSelectedInvoiceId("");
  };

  const syncFromExcel = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post(`/clients/${client.id}/invoices/sync-from-excel`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const {
        invoices_added = [], invoices_updated = [], sessions_added = 0,
        sessions_skipped_existing = 0, matched_sheets = [], workbook_tabs = [],
        warning = null,
      } = r.data || {};
      const list = await loadInvoices();
      setAllInvoices(list);
      const lines = [
        warning || `Invoice sheets detected: ${matched_sheets.length}`,
        matched_sheets.length ? `Sheets: ${matched_sheets.join(", ")}` : (workbook_tabs.length ? `Tabs in file: ${workbook_tabs.join(", ")}` : ""),
        `Invoices added: ${invoices_added.length}`,
        `Invoices updated: ${invoices_updated.length}`,
        `Sessions added: ${sessions_added}`,
        `Sessions already existed (skipped): ${sessions_skipped_existing}`,
      ].filter(Boolean);
      alert(lines.join("\n"));
    } catch (e) {
      alert("Sync failed: " + (e?.response?.data?.detail || e.message));
    }
  };

  const syncFromDrive = async () => {
    const url = (client.attendance_sheet_url || client.drive_url || "").trim();
    if (!url) {
      alert("No attendance sheet URL on this client. Run Import → Sync Active Clients from Drive, or add the URL in Client Info.");
      return;
    }
    try {
      const r = await api.post(`/clients/${client.id}/invoices/sync-from-drive`, { drive_url: url });
      const {
        invoices_added = [], invoices_updated = [], sessions_added = 0,
        sessions_skipped_existing = 0, matched_sheets = [], workbook_tabs = [],
        warning = null,
      } = r.data || {};
      const list = await loadInvoices();
      setAllInvoices(list);
      const lines = [
        warning || `Invoice sheets detected: ${matched_sheets.length}`,
        matched_sheets.length ? `Sheets: ${matched_sheets.join(", ")}` : (workbook_tabs.length ? `Tabs: ${workbook_tabs.join(", ")}` : ""),
        `Invoices added: ${invoices_added.length}`,
        `Invoices updated: ${invoices_updated.length}`,
        `Sessions added: ${sessions_added}`,
        `Sessions skipped: ${sessions_skipped_existing}`,
      ].filter(Boolean);
      alert(lines.join("\n"));
    } catch (e) {
      alert("Drive sync failed: " + (e?.response?.data?.detail || e.message));
    }
  };

  // Save: when invoice selected -> update the invoice; otherwise -> update the client defaults.
  const savePackageInfo = async () => {
    setSavingClient(true);
    try {
      if (selectedInvoice) {
        const updated = await api.put(`/invoices/${selectedInvoice.id}`, {
          invoice_number: (invoiceNumber || selectedInvoice.invoice_number).trim(),
          payment_status: paymentStatus,
          period_to: packageEndDate || null,
          package_size: parseFloat(packageSize) || selectedInvoice.package_size,
          start_date: selectedInvoice.start_date,
          notes: selectedInvoice.notes || null,
          amount: invoiceAmount === "" ? selectedInvoice.amount : parseFloat(invoiceAmount),
          amount_paid: amountPaid === "" ? selectedInvoice.amount_paid : parseFloat(amountPaid),
          next_payment_reminder_at: nextPaymentReminder || null,
          payment_notes: paymentNotes || null,
          period_from: selectedInvoice.period_from || null,
          service_type: selectedInvoice.service_type || serviceTypeFilter,
          is_closed: !!closed,
          close_date: closed ? (closureDate || null) : null,
        });
        setAllInvoices(prev => prev.map(inv => inv.id === updated.data.id ? updated.data : inv));
        onClientUpdated && onClientUpdated();
      } else {
        await api.put(`/clients/${client.id}`, {
          ...client,
          package_end_date: packageEndDate || null,
          payment_status: paymentStatus,
        });
        onClientUpdated && onClientUpdated();
      }
    } finally { setSavingClient(false); }
  };

  // Toggle closed state for the selected invoice and auto-save
  const toggleClosed = async () => {
    if (!selectedInvoice) {
      // Local-only toggle when no invoice selected
      setClosed(c => !c);
      return;
    }
    const newClosed = !closed;
    const newDate = newClosed ? (closureDate || new Date().toISOString().slice(0, 10)) : null;
    setClosed(newClosed);
    setClosureDate(newDate || "");
    const updated = await api.put(`/invoices/${selectedInvoice.id}`, {
      invoice_number: (invoiceNumber || selectedInvoice.invoice_number).trim(),
      payment_status: paymentStatus,
      period_to: packageEndDate || null,
      package_size: parseFloat(packageSize) || selectedInvoice.package_size,
      start_date: selectedInvoice.start_date,
      notes: selectedInvoice.notes || null,
      amount: selectedInvoice.amount || null,
      period_from: selectedInvoice.period_from || null,
      service_type: selectedInvoice.service_type || serviceTypeFilter,
      is_closed: newClosed,
      close_date: newDate,
    });
    setAllInvoices(prev => prev.map(inv => inv.id === updated.data.id ? updated.data : inv));
    onClientUpdated && onClientUpdated();
  };

  const performReset = async () => {
    await api.post(`/clients/${client.id}/reset-package`);
    setShowResetConfirm(false);
    onClientUpdated && onClientUpdated();
    onClose();
  };

  const exportExcel = async (cols) => {
    const colParam = cols?.length ? `?columns=${cols.join(",")}` : "";
    const url = `${api.defaults.baseURL}/clients/${client.id}/sessions/export${colParam}`;
    const token = localStorage.getItem("bg_token");
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
    if (!r.ok) { alert("Export failed"); return; }
    if (cols?.length) {
      try { localStorage.setItem(EXPORT_COLS_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
    }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${client.file_no || client.id}_${client.name.replace(/\s+/g, "_")}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setExportOpen(false);
  };

  const showNoOpenWarning = useMemo(() => {
    const forType = filterInvoicesForServiceTab(allInvoices, serviceTypeFilter, client);
    return forType.length > 0 && !hasOpenInvoice(forType);
  }, [allInvoices, serviceTypeFilter]);

  const fmtDateLocal = fmtDate;
  const dayShortLocal = dayShort;
  const sortedInvoiceSessions = useMemo(
    () => sortSessionsByDateAsc(cycleSessions),
    [cycleSessions]
  );
  const invoiceLocked = !!selectedInvoice?.is_closed;

  const toggleWeekOverride = async (weekNum, currentKey) => {
    if (!selectedInvoice || invoiceLocked || !isAdmin) return;
    const overrides = { ...(selectedInvoice.week_overrides || {}) };
    const key = String(weekNum);
    const next = nextWeekOverride(currentKey);
    if (next) overrides[key] = next;
    else delete overrides[key];
    try {
      await api.put(`/invoices/${selectedInvoice.id}/week-overrides`, { week_overrides: overrides });
      const list = await loadInvoices();
      setAllInvoices(list);
      onClientUpdated && onClientUpdated();
    } catch {
      alert("Could not save week override");
    }
  };

  const addSsWeek = async () => {
    if (!selectedInvoice || invoiceLocked || !isAdmin || !isSchool) return;
    const next = cycleWeeks + 1;
    try {
      await api.put(`/invoices/${selectedInvoice.id}`, {
        invoice_number: selectedInvoice.invoice_number,
        ss_week_count: next,
        start_date: selectedInvoice.start_date,
        package_size: selectedInvoice.package_size,
        payment_status: selectedInvoice.payment_status,
        service_type: selectedInvoice.service_type,
        is_closed: selectedInvoice.is_closed,
      });
      const list = await loadInvoices();
      setAllInvoices(list);
      onClientUpdated && onClientUpdated();
    } catch {
      alert("Could not add week");
    }
  };

  const removeSsWeek = async () => {
    if (!selectedInvoice || invoiceLocked || !isAdmin || !isSchool || cycleWeeks <= 4) return;
    if (!window.confirm(`Remove Week ${cycleWeeks} from this invoice?`)) return;
    try {
      await api.put(`/invoices/${selectedInvoice.id}`, {
        invoice_number: selectedInvoice.invoice_number,
        ss_week_count: cycleWeeks - 1,
        start_date: selectedInvoice.start_date,
        package_size: selectedInvoice.package_size,
        payment_status: selectedInvoice.payment_status,
        service_type: selectedInvoice.service_type,
        is_closed: selectedInvoice.is_closed,
      });
      const list = await loadInvoices();
      setAllInvoices(list);
      onClientUpdated && onClientUpdated();
    } catch {
      alert("Could not remove week");
    }
  };

  const sheetCols = useMemo(
    () => buildInvoiceSheetColumns(sheetColIds, { isSchool, includeAction: !invoiceLocked }),
    [sheetColIds, isSchool, invoiceLocked]
  );

  const savedExportCols = sheetColIds;

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop invoice-print-shell flex items-center justify-center p-2 z-50" onClick={onClose}>
      <div className="card p-0 relative w-full max-w-4xl modal-card max-h-[82vh] flex flex-col invoice-print-root printable" onClick={e=>e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-1 right-1 z-20 btn btn-ghost p-1 min-h-[28px] min-w-[28px] rounded-lg no-print"
        >
          <X size={18}/>
        </button>
        {/* Action bar */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 pr-9 border-b border-[#E2DDD4] no-print shrink-0">
          <div className="font-bold text-xs truncate min-w-0 flex-1" style={{color: "#2C3625"}}>Invoice Sheet · {client.name}</div>
          <div className="flex gap-1 flex-wrap items-center justify-end shrink-0">
            {tabState.showToggle && (
              <ServiceTypeToggle
                value={serviceTypeFilter}
                onChange={setServiceTypeFilter}
                tabState={tabState}
              />
            )}
            {sortedInvoices.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
              <select data-testid="invoice-dropdown" value={selectedInvoiceId} onChange={e => setSelectedInvoiceId(e.target.value)}
                      className="select text-xs min-h-[30px] py-1 px-2" style={{maxWidth: 220}}>
                {sortedInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {inv.is_closed ? "Closed" : "Open"}
                  </option>
                ))}
              </select>
              {selectedInvoice && (
                <span className="pill text-[10px] font-bold px-1.5 py-0.5"
                  style={{
                    background: selectedInvoice.is_closed ? "#F0EDE9" : "#E5EBE1",
                    color: selectedInvoice.is_closed ? "#5C6853" : "#3D4F35",
                    border: `1px solid ${selectedInvoice.is_closed ? "#E2DDD4" : "#B4C2A9"}`,
                  }}>
                  {selectedInvoice.is_closed ? "Closed" : "Open"}
                </span>
              )}
              </div>
            ) : tabState.showToggle ? (
              <span className="text-[10px] italic px-1.5 py-1" style={{color: "#8B6918", background: "#FAE8C8", borderRadius: 6}}>
                No {serviceTypeFilter} invoices
              </span>
            ) : (
              <span className="text-[10px] italic px-1.5 py-1" style={{color: "#8B6918", background: "#FAE8C8", borderRadius: 6}}>
                No invoices
              </span>
            )}
            {isAdmin && (
              <div className="relative">
                <input id={`sync-xlsx-${client.id}`} type="file" accept=".xlsx" className="hidden"
                       data-testid="sync-xlsx-input"
                       onChange={e => { const f = e.target.files?.[0]; if (f) { syncFromExcel(f); } e.target.value = ""; }}/>
                <button
                  data-testid="sync-menu-btn"
                  type="button"
                  onClick={() => setSyncMenuOpen(o => !o)}
                  className="btn btn-secondary text-xs min-h-[30px] px-2 py-1"
                >
                  Sync <CaretDown size={11}/>
                </button>
                {syncMenuOpen && (
                  <div
                    className="absolute right-0 mt-1 z-50 min-w-[168px] shadow-lg rounded-lg border overflow-hidden mobile-action-menu"
                    style={{ background: "#FFFFFF", borderColor: "#EDE9E3" }}
                  >
                    <button
                      type="button"
                      data-testid="sync-xlsx-btn"
                      onClick={() => { document.getElementById(`sync-xlsx-${client.id}`).click(); setSyncMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#FAFAF7] transition"
                      style={{ color: "#374151" }}
                    >
                      <FileXls size={13} className="inline mr-1.5" /> From Excel
                    </button>
                    <button
                      type="button"
                      data-testid="sync-drive-btn"
                      onClick={() => { syncFromDrive(); setSyncMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#FAFAF7] transition border-t"
                      style={{ color: "#374151", borderColor: "#EDE9E3" }}
                    >
                      <Download size={13} className="inline mr-1.5" /> From Drive
                    </button>
                  </div>
                )}
              </div>
            )}
            {isAdmin && (
              <button
                data-testid="new-invoice-btn"
                type="button"
                onClick={() => setShowNewInvModal(true)}
                className="btn btn-primary text-xs min-h-[30px] px-2 py-1"
              >
                <Plus size={13}/> New Invoice
              </button>
            )}
            <div className="relative">
              <button onClick={() => setExportOpen(o => !o)} className="btn btn-gold text-xs min-h-[30px] px-2 py-1">Export <CaretDown size={11}/></button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 card p-1 z-50 min-w-[160px] shadow-lg mobile-action-menu">
                  <button data-testid="export-excel-btn" onClick={() => { setExportOpen(false); setExportPendingMode("excel"); setShowExportColumns(true); }} className="btn btn-ghost w-full justify-start text-xs min-h-[30px] py-1"><FileXls size={13}/> Export as Excel</button>
                  <button onClick={() => { setExportOpen(false); setExportPendingMode("pdf"); setShowExportColumns(true); }} className="btn btn-ghost w-full justify-start text-xs min-h-[30px] py-1"><Printer size={13}/> Export as PDF</button>
                  {isAdmin && selectedInvoice && (
                    <button onClick={() => { savePackageInfo(); setExportOpen(false); }} className="btn btn-ghost w-full justify-start text-xs min-h-[30px] py-1">Save</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <PackageAlertBanner
          row={selectedInvoiceAlert}
          onNewInvoice={isAdmin ? () => setShowNewInvModal(true) : undefined}
          onViewDetails={() => setShowInvoiceDetails(true)}
        />

        {showNoOpenWarning && (
          <div className="mx-5 mt-2 px-3 py-2 rounded-lg border text-xs no-print flex items-center justify-between gap-2 flex-wrap"
            style={{ background: "#F5F5F5", borderColor: "#E0E0E0", color: "#5C6853" }}>
            <span>⚫ No open {serviceTypeFilter} invoice — showing most recent closed invoice.</span>
            {isAdmin && (
              <button type="button" onClick={() => setShowNewInvModal(true)} className="btn btn-primary text-xs">Create New Invoice</button>
            )}
          </div>
        )}

        {/* Compact invoice summary line */}
        {selectedInvoice && (
          <div className="px-5 py-2 flex items-center gap-2 text-xs no-print border-b border-[#E2DDD4] flex-wrap" style={{background: "#FAFAF7"}}>
            <span className="font-bold" style={{color: "#2C3625"}}>{selectedInvoice.invoice_number}</span>
            {selectedInvoice && (
              <span className="pill text-[10px] font-bold" style={{
                background: isSchool ? "#E0EBD8" : "#F4EDE3",
                color: isSchool ? "#2C5035" : "#6B5430",
              }}>
                {serviceDisplay}
              </span>
            )}
            <span className="pill text-[10px]" style={{background: closed ? "#F8EBE7" : "#E5EBE1", color: closed ? "#8A3F27" : "#3D4F35"}}>
              {closed ? "Closed" : "Open"}
            </span>
            {isSchool && currentWeekInfo ? (
              <span style={{color: "#5C6853"}}>Week {currentWeekInfo.weekNumber}/{cycleWeeks} · {weeksDone}/{cycleWeeks} weeks done</span>
            ) : selectedInvoice ? (
              <span style={{color: "#5C6853"}}>{rem.toFixed(1)}h remaining · {used.toFixed(1)}/{pkg}h</span>
            ) : null}
            <button onClick={() => setShowInvoiceDetails(true)} className="btn btn-ghost text-[11px] py-0 px-2">ⓘ Details</button>
            {isAdmin && (
              <button onClick={() => deleteInvoice(selectedInvoice.id)} className="ml-auto text-[11px] underline" style={{color: "#8A3F27"}}>delete</button>
            )}
          </div>
        )}

        {/* Pending payment warning */}
        {isAdmin && selectedInvoice && paymentStatus === "pending" && (
          <div data-testid="pending-warning" className="px-5 py-2 flex items-center gap-2 text-xs font-bold no-print"
               style={{background: "#FAE8C8", color: "#8B6918", borderBottom: "1px solid #E5C387"}}>
            <Warning size={16} weight="fill"/>
            <span>Payment Pending</span>
          </div>
        )}

        {invoiceLocked && (
          <div className="px-4 py-1.5 text-xs font-bold no-print flex items-center gap-2"
            style={{ background: "#F5F5F5", color: "#5C6853", borderBottom: "1px solid #E0E0E0" }}>
            🔒 Invoice closed — sessions are view-only. Re-open from Invoice Details to edit.
          </div>
        )}

        {isSchool && selectedInvoice && ssWeekSummary.length > 0 && (
          <div className="px-4 py-2 border-b border-[#F0EDE9] no-print" style={{ background: "#FAFAF7" }}>
            {isAdmin && !invoiceLocked && <SsWeekLegend compact />}
            <SsWeekStatusRow
              weeks={ssWeekSummary}
              compact
              editable={isAdmin && !invoiceLocked}
              onToggleOverride={toggleWeekOverride}
              showAddWeek={isAdmin && !invoiceLocked && isSchool}
              onAddWeek={addSsWeek}
              showRemoveWeek={isAdmin && !invoiceLocked && isSchool && cycleWeeks > 4}
              onRemoveWeek={removeSsWeek}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white min-h-0">
          {/* Logo + Title */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b-2" style={{borderColor: "#7A8A6A"}}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5" style={{background: "#7A8A6A"}}>
                <img src="/bg-logo.png" alt="" className="w-full h-full object-contain"/>
              </div>
              <div>
                <div className="font-display text-lg font-semibold leading-tight" style={{color: "#2C3625"}}>Boost Growth</div>
                <div className="text-[10px] tracking-[0.15em] font-bold" style={{color: "#8B9E7A"}}>ATTENDANCE SHEET · ABA SERVICES</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {selectedInvoice && (
                  <span className="pill text-[11px]" style={{background: "#F4EDE3", color: "#6B5430"}}>{selectedInvoice.invoice_number}</span>
                )}
                <span className="pill text-[11px]" style={{
                    background: paymentStatus === "complete" ? "#E5EBE1" : "#FAE8C8",
                    color: paymentStatus === "complete" ? "#3D4F35" : "#8B6918"}}>
                  {paymentStatus === "complete" ? "✓ Paid" : "⚠ Pending"}
                </span>
                <span className="pill text-[11px]" style={{background: closed ? "#F8EBE7" : "#E5EBE1", color: closed ? "#8A3F27" : "#3D4F35"}}>
                  {closed ? "🔒 CLOSED" : "🔓 OPEN"}
                </span>
                <button onClick={toggleClosed} className="text-[10px] underline no-print" style={{color: "#7A8A6A"}}>toggle</button>
              </div>
              {closed && (
                <input type="date" value={closureDate} onChange={e=>setClosureDate(e.target.value)} className="text-xs mt-1 border-0 outline-none bg-transparent text-right no-print"/>
              )}
              {closed && closureDate && <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>Closure: {fmtDateLocal(closureDate)}</div>}
              {packageEndDate && <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>Pkg ends: {fmtDateLocal(packageEndDate)}</div>}
            </div>
          </div>

          {/* Patient + package summary — single row */}
          <div className="px-4 py-3 border-b border-[#E2DDD4] text-sm" style={{ background: "#FAFAF7" }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>PATIENT</div>
                <div className="font-bold text-sm truncate" style={{color: "#2C3625"}}>{client.name}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>FILE NO.</div>
                <div className="font-bold text-sm" style={{color: "#2C3625"}}>{client.file_no || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>SERVICE</div>
                <div className="font-bold text-sm" style={{color: isSchool ? "#2C5035" : "#6B5430"}}>{serviceDisplay}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>PACKAGE</div>
                <div className="font-bold text-sm" style={{color: "#2C3625"}}>{isSchool ? `${cycleWeeks} Weeks` : `${pkg}h`}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>{isSchool ? "WEEKS DONE" : "HOURS USED"}</div>
                <div className="font-bold text-sm" style={{color: "#2C3625"}}>{isSchool ? `${weeksDone}/${cycleWeeks}` : `${used.toFixed(1)}h`}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>{isSchool ? "CURRENT WK" : "REMAINING"}</div>
                <div className="font-bold text-sm" style={{color: isSchool ? "#2C3625" : rem <= pkg * 0.2 ? "#C97B5C" : "#2C3625"}}>
                  {isSchool ? `W${currentWeekInfo?.weekNumber || 1}` : `${rem.toFixed(1)}h`}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>PAYMENT</div>
                <div className="font-bold text-sm" style={{color: paymentStatus === "complete" ? "#3D4F35" : "#8B6918"}}>
                  {paymentStatus === "complete" ? "Paid" : paymentStatus === "partial" ? "Partial" : "Pending"}
                </div>
              </div>
            </div>
          </div>

          {/* Sessions table grouped by day / week */}
          {!selectedInvoice ? (
            <div className="p-6 text-center" style={{color: "#8B9E7A"}}>
              Select an invoice to view sessions
            </div>
          ) : cycleSessions.length === 0 && !isSchool ? (
            <div className="p-6 text-center" style={{color: "#8B9E7A"}}>
              No sessions for this invoice
            </div>
          ) : isSchool ? (
            <div className="p-3 space-y-3">
              {ssWeekGroups.map((group) => {
                const wk = ssWeekSummary[group.weekNumber - 1];
                const st = wk?.weekStatus || "Not started";
                const badgeBg = st === "Completed" ? "#E5EBE1" : st === "Open" ? "#FAF0D1" : st === "In Progress" ? "#FAF0D1" : "#FAFAF7";
                return (
                <div key={`week-${group.weekNumber}`} className="border rounded-xl overflow-hidden" style={{ borderColor: "#C4D4B8" }}>
                  <div className="px-3 py-1.5 flex items-center justify-between flex-wrap gap-2" style={{ background: "#EDF4E8" }}>
                    <span className="font-bold text-sm" style={{ color: "#2C5035" }}>WEEK {group.weekNumber}</span>
                    <span className="text-xs" style={{ color: "#5C6853" }}>{group.label}</span>
                    {wk && (
                      <span className="pill text-[10px] font-bold" style={{ background: badgeBg, color: "#3D4F35" }}>
                        {st}
                        {group.sessions.length > 0 && ` (${wk.attended}/${group.dates.length || 5} days)`}
                      </span>
                    )}
                  </div>
                  {group.sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs italic" style={{ color: "#8B9E7A" }}>
                      {group.startISO ? "No sessions this week" : "Upcoming"}
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table className="w-full text-xs min-w-[520px]">
                      <HistoryTableHead cols={sheetCols.filter(c => c.id !== "_action")} bordered />
                      <tbody>
                        {sortSessionsByDateAsc(group.sessions).map(s => (
                          <SessionTableRow
                            key={s.id}
                            s={s}
                            findT={findT}
                            isAdmin={isAdmin}
                            user={user}
                            client={client}
                            currentUserId={currentUserId}
                            onEdit={onEdit}
                            onDeleted={onDeleted}
                            rowBg={WEEK_ROW_BG[(group.weekNumber - 1) % WEEK_ROW_BG.length]}
                            billingKind="SS"
                            locked={invoiceLocked}
                            sheetCols={sheetCols}
                          />
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              );})}
            </div>
          ) : (
            <div className="p-2">
              <div className="border rounded-lg overflow-hidden bg-white" style={{ borderColor: "#C4D4B8" }}>
                <div className="px-2.5 py-1 flex items-center justify-between" style={{ background: "#EDF4E8" }}>
                  <span className="font-bold text-xs" style={{ color: "#2C5035" }}>HOME SESSIONS</span>
                  <span className="text-[10px]" style={{ color: "#5C6853" }}>{sortedInvoiceSessions.length} session{sortedInvoiceSessions.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[520px] border-collapse">
                    <HistoryTableHead cols={sheetCols} bordered />
                    <tbody>
                      {sortedInvoiceSessions.map((s, i) => (
                        <SessionTableRow
                          key={s.id}
                          s={s}
                          findT={findT}
                          isAdmin={isAdmin}
                          user={user}
                          client={client}
                          currentUserId={currentUserId}
                          onEdit={onEdit}
                          onDeleted={onDeleted}
                          rowBg={WEEK_ROW_BG[i % WEEK_ROW_BG.length]}
                          billingKind="HS"
                          locked={invoiceLocked}
                          bordered
                          sheetCols={sheetCols}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Footer summary */}
          <div className="px-4 py-3 border-t-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm" style={{borderColor: "#7A8A6A", background: "#FAFAF7"}}>
            {isSchool ? (
              <>
                {ssWeekSummary.map(w => (
                  <div key={`sum-${w.weekNumber}`}>
                    <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>WEEK {w.weekNumber}</div>
                    <div className="font-bold text-sm" style={{color: "#3D4F35"}}>
                      {w.weekStatus === "Completed" ? "✓" : w.weekStatus === "Open" ? "○" : w.weekStatus === "In Progress" ? "…" : "—"} {w.weekStatus}
                      {w.sessions.length > 0 && ` (${w.attended}/${w.dates.length || 5} days)`}
                    </div>
                  </div>
                ))}
                <div>
                  <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>PAYMENT</div>
                  <div className="font-bold text-sm" style={{color: paymentStatus === "complete" ? "#3D4F35" : "#8B6918"}}>
                    {paymentStatus === "complete" ? "Paid" : "Pending"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>TOTAL SESSIONS COMPLETED</div>
                  <div className="font-display text-2xl" style={{color: "#3D4F35"}}>{completed}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>TOTAL HOURS DELIVERED</div>
                  <div className="font-display text-2xl" style={{color: "#3D4F35"}}>{hoursDelivered.toFixed(1)}h</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>TOTAL NO SERVICE DAYS</div>
                  <div className="font-display text-2xl" style={{color: "#5C6853"}}>{noServiceCount}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>HOURS REMAINING</div>
                  <div className="font-display text-2xl" style={{color: rem <= pkg * 0.2 ? "#C97B5C" : "#3D4F35"}}>{rem.toFixed(1)}h</div>
                </div>
              </>
            )}
          </div>
          <div className="px-8 py-3 text-[10px] text-center" style={{color: "#8B9E7A"}}>
            Generated {new Date().toLocaleString('en-US')} · Boost Growth Center · boost-growthsa.com
          </div>
        </div>

        {/* Invoice Details popup */}
        {showInvoiceDetails && selectedInvoice && (
          <ModalBase
            title="Invoice Details"
            subtitle="Current package and billing information"
            onClose={() => setShowInvoiceDetails(false)}
            size="sm"
            elevated
            footer={
              isAdmin ? (
                <>
                  <ModalBtnSecondary type="button" onClick={() => setShowInvoiceDetails(false)}>Close</ModalBtnSecondary>
                  <ModalBtnPrimary
                    data-testid="save-pkg-btn"
                    type="button"
                    onClick={() => { savePackageInfo(); setShowInvoiceDetails(false); }}
                    disabled={savingClient}
                  >
                    {savingClient ? "Saving..." : "Save"}
                  </ModalBtnPrimary>
                </>
              ) : (
                <ModalBtnSecondary type="button" onClick={() => setShowInvoiceDetails(false)}>Close</ModalBtnSecondary>
              )
            }
          >
            <FormSection title="Invoice">
              <FormField label="Invoice number">
                <input
                  className="modal-input"
                  readOnly
                  value={invoiceNumber || selectedInvoice.invoice_number || ""}
                />
              </FormField>
              <FormField label="Service">
                <input
                  className="modal-input"
                  readOnly
                  value={isSchool ? "School Support (SS)" : "Home Session (HS)"}
                />
              </FormField>
              <div>
                <span className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>Status</span>
                <span
                  className="inline-block pill text-xs px-2 py-1"
                  style={{ background: closed ? "#F8EBE7" : "#E5EBE1", color: closed ? "#8A3F27" : "#3D4F35" }}
                >
                  {closed ? "Closed" : "Open"}
                </span>
              </div>
              {selectedInvoice.start_date && (
                <FormField label="Start date">
                  <input className="modal-input" readOnly value={fmtDateLocal(selectedInvoice.start_date)} />
                </FormField>
              )}
            </FormSection>

            <FormSection title="Package">
              {isSchool ? (
                <>
                  <FormField label="Package size">
                    <input className="modal-input" readOnly value={`${cycleWeeks} weeks`} />
                  </FormField>
                  <FormField label="Weeks completed">
                    <input className="modal-input" readOnly value={`${weeksDone} / ${cycleWeeks}`} />
                  </FormField>
                  <FormField label="Weeks remaining">
                    <input
                      className="modal-input"
                      readOnly
                      value={`${weeksRem}`}
                      style={{ color: weeksRem <= 1 ? "#C97B5C" : undefined }}
                    />
                  </FormField>
                  <div className="h-2 rounded-lg overflow-hidden" style={{ background: "#EDE9E3" }}>
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{
                        width: `${Math.min(100, (weeksDone / cycleWeeks) * 100)}%`,
                        background: weeksRem <= 1 ? "#C97B5C" : "#5C8A47",
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <FormField label="Package size">
                    <input className="modal-input" readOnly value={`${packageSize || selectedInvoice.package_size || pkg} hours`} />
                  </FormField>
                  <FormField label="Hours used">
                    <input className="modal-input" readOnly value={`${used.toFixed(1)}h`} />
                  </FormField>
                  <FormField label="Hours remaining">
                    <input
                      className="modal-input"
                      readOnly
                      value={`${rem.toFixed(1)}h`}
                      style={{ color: rem <= pkg * 0.2 ? "#C97B5C" : undefined }}
                    />
                  </FormField>
                  <div className="h-2 rounded-lg overflow-hidden" style={{ background: "#EDE9E3" }}>
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{
                        width: `${Math.min(100, ((used / (packageSize || selectedInvoice.package_size || pkg || 1)) * 100))}%`,
                        background: rem <= pkg * 0.2 ? "#C97B5C" : "#5C8A47",
                      }}
                    />
                  </div>
                </>
              )}
            </FormSection>

            {isAdmin && (
              <FormSection title="Dates">
                <FormField label="Package end date">
                  <input
                    data-testid="pkg-end-input"
                    type="date"
                    className="modal-input"
                    value={packageEndDate}
                    onChange={e => setPackageEndDate(e.target.value)}
                  />
                </FormField>
              </FormSection>
            )}
          </ModalBase>
        )}

        {/* New Invoice modal */}
        {showNewInvModal && (
          <NewInvoiceModal
            client={client}
            serviceTypeFilter={serviceTypeFilter}
            defaultPackage={client.package_hours || 24}
            onCancel={() => setShowNewInvModal(false)}
            onCreate={createInvoice}
          />
        )}

        {/* Reset confirmation dialog */}
        {showResetConfirm && (
          <ModalBase
            title="Start a new package cycle?"
            subtitle={`Reset used-hours counter for ${client.name}`}
            onClose={() => setShowResetConfirm(false)}
            size="sm"
            elevated
            footer={
              <>
                <ModalBtnSecondary type="button" onClick={() => setShowResetConfirm(false)}>Cancel</ModalBtnSecondary>
                <ModalBtnPrimary data-testid="confirm-reset-btn" type="button" onClick={performReset}>
                  Yes, start new cycle
                </ModalBtnPrimary>
              </>
            }
          >
            <p className="text-sm" style={{ color: "#5C6853" }}>
              This will reset <strong>{client.name}'s</strong> used-hours counter to <strong>0</strong> and start a new cycle.
              Past sessions are <strong>kept</strong> in the database but will no longer count against the new cycle.
            </p>
          </ModalBase>
        )}

        {showExportColumns && (
          <ExportColumnsModal
            initial={savedExportCols}
            confirmLabel={exportPendingMode === "pdf" ? "Export PDF" : "Export Excel"}
            onClose={() => { setShowExportColumns(false); setExportPendingMode(null); }}
            onExport={(cols) => {
              setSheetColIds(cols);
              try { localStorage.setItem(EXPORT_COLS_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
              setShowExportColumns(false);
              if (exportPendingMode === "pdf") {
                setTimeout(() => window.print(), 150);
              } else {
                exportExcel(cols);
              }
              setExportPendingMode(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function NewInvoiceModal({ client, serviceTypeFilter, defaultPackage, onCancel, onCreate }) {
  const isSchool = serviceTypeFilter === "SS";
  const [num, setNum] = useState("");
  const [size, setSize] = useState(isSchool ? 20 : defaultPackage);
  const submit = (e) => { e.preventDefault(); onCreate(num, size); };
  return (
    <ModalBase
      title="New Invoice"
      subtitle={`Create a new ${serviceTypeFilter} invoice for ${client.name}`}
      onClose={onCancel}
      size="sm"
      elevated
      footer={
        <>
          <ModalBtnSecondary type="button" onClick={onCancel}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary data-testid="confirm-new-inv" type="submit" form="new-invoice-form">Create Invoice</ModalBtnPrimary>
        </>
      }
    >
      <form id="new-invoice-form" onSubmit={submit}>
        <p className="text-xs -mt-2 mb-4" style={{ color: "#9CA3AF" }}>
          Service type: <strong>{isSchool ? "School Support (SS)" : "Home Session (HS)"}</strong> — matches the selected tab.
        </p>
        <FormSection title="Invoice Details">
          <FormField label="Invoice number" required hint="Manual entry, e.g. INV0490">
            <input
              data-testid="new-inv-num"
              className="modal-input"
              placeholder="e.g. INV0490"
              required
              autoFocus
              value={num}
              onChange={e => setNum(e.target.value)}
            />
          </FormField>
          <FormField
            label={isSchool ? "Package size (sessions)" : "Package size (hours)"}
            required
            hint={isSchool ? "Total school sessions / days in this invoice" : "Total paid hours for this invoice"}
          >
            <input
              data-testid="new-inv-size"
              type="number"
              min="0"
              step={isSchool ? "1" : "0.5"}
              className="modal-input"
              required
              value={size}
              onChange={e => setSize(e.target.value)}
            />
          </FormField>
        </FormSection>
      </form>
    </ModalBase>
  );
}

export { HistoryModal };
