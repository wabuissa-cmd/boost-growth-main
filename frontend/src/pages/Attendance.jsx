import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  MagnifyingGlass, Plus, X, Trash, PencilSimple, ClipboardText, ClockCounterClockwise,
  CheckCircle, Prohibit, Warning, XCircle, Clock, MapPin, Printer, FileXls,
  Receipt, ArrowsCounterClockwise, CalendarBlank, CaretDown
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";

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
function getStatus(used, pkg) {
  const rem = pkg - used;
  const pct = rem / pkg;
  if (rem <= 0 || pct <= 0.2 || rem <= 2) return "urgent";
  if (pct <= 0.35 || rem <= 4) return "warning";
  return "ok";
}

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [clients, setClients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [logFor, setLogFor] = useState(null); // client OR null OR "__pick__"
  const [editingSess, setEditingSess] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [sheetMode, setSheetMode] = useState("invoice");

  const load = useCallback(async () => {
    const [c, t, s] = await Promise.all([
      api.get("/clients"),
      api.get("/therapists").catch(() => ({ data: [] })),
      api.get("/sessions"),
    ]);
    setClients(c.data); setTherapists(t.data); setSessions(s.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => clients.map(c => {
    if (c.billing_mode === "weeks") {
      // Weeks-based: compute completed weeks in current cycle
      const cycleWeeks = c.cycle_weeks || 4;
      const cycleStart = c.cycle_start_date ? new Date(c.cycle_start_date) : null;
      const completedSessions = sessions.filter(s => s.client_id === c.id && s.status === "Completed");
      let weeksDone = 0;
      if (cycleStart) {
        for (let k = 0; k < cycleWeeks; k++) {
          const ws = new Date(cycleStart); ws.setDate(ws.getDate() + 7 * k);
          const we = new Date(ws); we.setDate(we.getDate() + 5);
          const wsISO = ws.toISOString().slice(0,10);
          const weISO = we.toISOString().slice(0,10);
          if (completedSessions.some(s => s.session_date >= wsISO && s.session_date < weISO)) weeksDone++;
        }
      }
      const pct = Math.round((weeksDone / cycleWeeks) * 100);
      const status = pct >= 75 ? "urgent" : pct >= 50 ? "warning" : "ok";
      return { ...c, billing_mode: "weeks", weeksDone, cycleWeeks, weeksRem: cycleWeeks - weeksDone, pct, status, used: 0, pkg: 0, rem: 0 };
    }
    const used = getUsedHours(sessions, c.id, c.package_reset_at);
    const pkg = c.package_hours || 24;
    const rem = Math.max(0, pkg - used);
    return { ...c, billing_mode: "hours", used, pkg, rem, pct: Math.min(100, Math.round(used/pkg*100)), status: getStatus(used, pkg) };
  }), [clients, sessions]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter !== "all") list = list.filter(c => c.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.file_no || "").includes(q));
    }
    const order = { urgent: 0, warning: 1, ok: 2 };
    return [...list].sort((a, b) => order[a.status] - order[b.status]);
  }, [enriched, filter, search]);

  const counts = {
    all: enriched.length,
    urgent: enriched.filter(c => c.status === "urgent").length,
    warning: enriched.filter(c => c.status === "warning").length,
    ok: enriched.filter(c => c.status === "ok").length,
  };

  const findT = id => therapists.find(t => t.id === id);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Attendance</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Log sessions, track hours, monitor packages</div>
        </div>
        <button data-testid="log-session-picker" onClick={() => setLogFor("__pick__")} className="btn btn-primary"><Plus size={16}/> Log Session</button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        {[
          {id:"all", label:"All", color:"#7A8A6A"},
          {id:"urgent", label:"🔴 Urgent", color:"#C97B5C"},
          {id:"warning", label:"🟡 Warning", color:"#D4A64A"},
          {id:"ok", label:"🟢 OK", color:"#7A8A6A"},
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`pill px-4 py-2 text-sm transition border-2 ${filter === f.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E8E4DE]"}`}>
            {f.label} <span className="opacity-60 text-xs">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
        <input data-testid="att-search" className="input pl-10" placeholder="Search client by name or file #..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Client cards */}
      <div className="space-y-3 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>No clients</div>}
        {filtered.map(c => {
          const fillColor = c.status === "urgent" ? "#C97B5C" : c.status === "warning" ? "#D4A64A" : "#7A8A6A";
          const stCls = c.status === "urgent" ? "bg-[#F8EBE7] text-[#8A3F27]" : c.status === "warning" ? "bg-[#FAF0D1] text-[#6B5218]" : "bg-[#E5EBE1] text-[#3D4F35]";
          const stIcon = c.status === "urgent" ? "🔴" : c.status === "warning" ? "🟡" : "🟢";
          return (
            <div key={c.id} className="card p-5" style={{borderColor: c.status === "ok" ? "#E8E4DE" : fillColor, borderWidth: c.status === "ok" ? 1 : 2}}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 text-white" style={{background: c.color || "#7A8A6A", color: "#2C3625"}}>
                    {(c.name || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg" style={{color: "#2C3625"}}>{c.name} <span className="text-xs font-normal ml-1" style={{color: "#8B9E7A"}}>#{c.file_no}</span></div>
                    <div className="text-xs mt-0.5" style={{color: "#8B9E7A"}}>
                      {c.billing_mode === "weeks" ? (
                        <>📅 Week {c.weeksDone}/{c.cycleWeeks} · {c.weeksRem} left</>
                      ) : (
                        <>Pkg {c.pkg}h · Used {c.used.toFixed(1)}h</>
                      )} · Main: {findT(c.main_therapist_id)?.name || "—"}
                    </div>
                    {/* Package end date + Payment status */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {c.package_end_date && (
                        <span className="pill text-[10px] px-2 py-0.5 inline-flex items-center gap-1" style={{background: "#F4EDE3", color: "#6B5430", border: "1px solid #E0CDB0"}}>
                          <CalendarBlank size={11}/> Ends {c.package_end_date}
                        </span>
                      )}
                      <span data-testid={`pay-${c.id}`} className="pill text-[10px] px-2 py-0.5 font-bold" style={{
                          background: c.payment_status === "complete" ? "#E5EBE1" : "#FAE8C8",
                          color: c.payment_status === "complete" ? "#3D4F35" : "#8B6918",
                          border: c.payment_status === "complete" ? "1px solid #B8C8A8" : "1px solid #E5C387",
                        }}>
                        {c.payment_status === "complete" ? "✓ Payment Complete" : "⚠ Payment Pending"}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`pill ${stCls} font-bold`}>{stIcon} {c.status.toUpperCase()}</span>
              </div>

              <div className="flex items-center gap-2 mt-3 mb-3">
                <div className="flex-1 h-2 bg-[#F0EDE9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: fillColor }}/>
                </div>
                <span className="text-xs min-w-[100px] text-right font-bold" style={{color: "#5C6853"}}>
                  {c.billing_mode === "weeks" ? `${c.weeksRem}/${c.cycleWeeks} weeks left` : `${c.rem}/${c.pkg}h left`}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button data-testid={`log-${c.id}`} onClick={() => setLogFor(c)} className="btn btn-primary text-xs"><Plus size={14}/> Log Session</button>
                <button onClick={() => { setSheetMode("history"); setHistoryFor(c); }} className="btn btn-secondary text-xs"><ClockCounterClockwise size={14}/> History</button>
                <button onClick={() => { setSheetMode("invoice"); setHistoryFor(c); }} className="btn btn-gold text-xs"><ClipboardText size={14}/> Invoice Sheet</button>
              </div>
            </div>
          );
        })}
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
                  <div className="text-[11px]" style={{ color: "#8B9E7A" }}>#{c.file_no} · {c.rem}/{c.pkg}h left</div>
                </div>
              </button>
            ))}
          </div>
        </ModalBase>
      )}

      {/* Log Session form */}
      {logFor && logFor !== "__pick__" && (
        <LogSessionForm client={logFor} therapists={therapists} currentUser={user} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); load(); }}/>
      )}

      {/* History / Invoice */}
      {historyFor && sheetMode === "history" && (
        <AttendanceHistoryModal client={historyFor} sessions={sessions.filter(s => s.client_id === historyFor.id)}
                                therapists={therapists} isAdmin={isAdmin} user={user} currentUserId={user?.id}
                                onClose={() => setHistoryFor(null)}
                                onEdit={(s) => { setEditingSess(s); }}
                                onDeleted={() => load()}/>
      )}

      {historyFor && sheetMode === "invoice" && (
        <HistoryModal client={historyFor} sessions={sessions.filter(s => s.client_id === historyFor.id)}
                      therapists={therapists} isAdmin={isAdmin} user={user} currentUserId={user?.id}
                      onClose={() => setHistoryFor(null)}
                      onEdit={(s) => { setEditingSess(s); }}
                      onDeleted={() => load()}
                      onClientUpdated={() => load()}/>
      )}

      {editingSess && (
        <LogSessionForm session={editingSess} client={clients.find(c => c.id === editingSess.client_id)} therapists={therapists} currentUser={user}
                        onClose={() => setEditingSess(null)} onSaved={() => { setEditingSess(null); load(); }}/>
      )}
    </div>
  );
}

function LogSessionForm({ client, therapists, currentUser, onClose, onSaved, session }) {
  const [form, setForm] = useState(session ? {...session} : {
    client_id: client.id,
    session_date: new Date().toISOString().slice(0, 10),
    start_time: "14:00", end_time: "16:00", hours: 2,
    status: "Completed",
    therapist_ids: currentUser?.role === "therapist" ? [currentUser.id] : [client.main_therapist_id].filter(Boolean),
    note: "", location: client.locations?.[0]?.address || "",
  });

  const computeHours = (st, et) => {
    if (!st || !et) return 0;
    const [h1,m1] = st.split(":").map(Number); const [h2,m2] = et.split(":").map(Number);
    let diff = (h2*60+m2) - (h1*60+m1); if (diff < 0) diff += 24*60;
    return Math.round(diff / 30) / 2;
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {...form, hours: computeHours(form.start_time, form.end_time)};
    if (session?.id) await api.put(`/sessions/${session.id}`, payload);
    else await api.post("/sessions", payload);
    onSaved();
  };

  const toggleT = (id) => {
    setForm(f => ({...f, therapist_ids: f.therapist_ids.includes(id) ? f.therapist_ids.filter(x => x !== id) : [...f.therapist_ids, id]}));
  };

  const formId = session ? "edit-session-form" : "log-session-form";

  return (
    <ModalBase
      title={session ? "Edit Session Record" : "Log Session"}
      subtitle={session ? "Correct session details" : "Record a completed session"}
      onClose={onClose}
      size="md"
      footer={
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary data-testid="sess-save" type="submit" form={formId}>
            {session ? "Save changes" : "Log Session"}
          </ModalBtnPrimary>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        {client && (
          <p className="text-sm -mt-2 mb-2" style={{ color: "#8B9E7A" }}>
            {client.name} <span className="text-xs">#{client.file_no}</span>
          </p>
        )}

        <FormSection title="Session">
          {client?.locations?.length > 0 && (
            <FormField label="Service type / location">
              <select
                data-testid="sess-location"
                className="modal-input"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              >
                {client.locations.map((l, i) => (
                  <option key={i} value={l.address}>{l.service} | {l.address}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Status">
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm({ ...form, status: s.id })}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${form.status === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}
                  style={{ background: s.bg, borderColor: form.status === s.id ? "#7A8A6A" : s.bg, color: s.color }}
                >
                  {s.icon}
                  <div className="font-bold text-sm">{s.label}</div>
                </button>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Date" required>
              <input
                data-testid="sess-date"
                type="date"
                className="modal-input"
                required
                value={form.session_date}
                onChange={e => setForm({ ...form, session_date: e.target.value })}
              />
            </FormField>
            <FormField label="Time from">
              <input
                type="time"
                className="modal-input"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
              />
            </FormField>
            <FormField label="Time to">
              <input
                type="time"
                className="modal-input"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
              />
            </FormField>
          </div>
          <p className="text-xs" style={{ color: "#8B9E7A" }}>
            <Clock size={12} className="inline mr-1" />
            Hours: <strong>{computeHours(form.start_time, form.end_time)}h</strong>
          </p>
        </FormSection>

        <FormSection title="Therapist">
          <FormField
            label="Therapist(s)"
            hint={currentUser?.role === "therapist" ? "Your name is added automatically" : undefined}
          >
            <div className="flex flex-wrap gap-2 mb-2">
              {form.therapist_ids.map(id => {
                const t = therapists.find(t => t.id === id);
                if (!t) return null;
                return (
                  <span key={id} className="pill px-3 py-1.5 text-xs" style={{ background: t.color, color: "white" }}>
                    {t.name}{" "}
                    <button type="button" onClick={() => toggleT(id)} className="ml-1 opacity-80 hover:opacity-100">✕</button>
                  </span>
                );
              })}
            </div>
            <select
              className="modal-input"
              value=""
              onChange={e => { if (e.target.value) toggleT(e.target.value); e.target.value = ""; }}
            >
              <option value="">+ Add co-therapist...</option>
              {therapists.filter(t => !form.therapist_ids.includes(t.id)).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </FormField>
        </FormSection>

        <FormSection title="Notes">
          <FormField label="Note" hint="Optional">
            <textarea
              className="modal-input"
              rows={3}
              value={form.note || ""}
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </FormField>
        </FormSection>
      </form>
    </ModalBase>
  );
}

function AttendanceHistoryModal({ client, sessions, therapists, isAdmin, user, currentUserId, onClose, onEdit, onDeleted }) {
  const findT = id => therapists.find(t => t.id === id);
  const [invoices, setInvoices] = useState([]);
  const [filterInvoiceId, setFilterInvoiceId] = useState("");

  useEffect(() => {
    api.get(`/clients/${client.id}/invoices`).then(r => setInvoices(r.data || [])).catch(() => setInvoices([]));
  }, [client.id]);

  const filteredSessions = sessions.filter(s => {
    if (!filterInvoiceId) return true;
    const inv = invoices.find(i => i.id === filterInvoiceId);
    if (!inv) return true;
    const invNum = (inv.invoice_number || "").trim();
    return s.invoice_id === filterInvoiceId ||
      (s.source_invoice && s.source_invoice.trim() === invNum);
  });

  const resetAt = client.package_reset_at;
  const pkg = client.package_hours || 24;
  const used = filteredSessions.filter(s => s.status === "Completed")
    .filter(s => !resetAt || (s.session_date && s.session_date >= resetAt.slice(0, 10)))
    .reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const sorted = [...filteredSessions].sort((a, b) => new Date(a.session_date) - new Date(b.session_date));
  const dayShort = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  const fmtDate = (d) => {
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
  };
  const removeSess = async (sid) => {
    if (!window.confirm("Delete this session?")) return;
    await api.delete(`/sessions/${sid}`);
    onDeleted();
  };

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-0 w-full max-w-4xl modal-card max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E4DE]">
          <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Attendance History · {client.name}</div>
          <button onClick={onClose} className="btn btn-ghost p-2"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-8 pb-4 text-center border-b-2" style={{ borderColor: "#7A8A6A" }}>
            <div className="w-16 h-16 rounded-xl mx-auto mb-3 flex items-center justify-center p-2" style={{ background: "#7A8A6A" }}>
              <img src="/bg-logo.png" alt="" className="w-full h-full object-contain"/>
            </div>
            <div className="font-display text-2xl font-semibold" style={{ color: "#2C3625" }}>{client.name}</div>
            <div className="text-sm mt-2" style={{ color: "#5C6853" }}>
              Package: <strong>{pkg}h</strong> · Used: <strong>{used.toFixed(1)}h</strong>
            </div>
            {invoices.length > 0 && (
              <div className="mt-4 max-w-xs mx-auto">
                <select className="select text-xs w-full" value={filterInvoiceId} onChange={e => setFilterInvoiceId(e.target.value)}>
                  <option value="">All Invoices</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {sorted.length === 0 ? (
            <div className="p-12 text-center" style={{ color: "#8B9E7A" }}>No sessions logged yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead style={{ background: "#F0E9D8" }}>
                <tr style={{ color: "#2C3625" }}>
                  <th className="p-2 text-left font-bold">Day</th>
                  <th className="p-2 text-left font-bold">Date</th>
                  <th className="p-2 text-left font-bold">Status</th>
                  <th className="p-2 text-left font-bold">Time</th>
                  <th className="p-2 text-left font-bold">Hours</th>
                  <th className="p-2 text-left font-bold">Therapist</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(s => {
                  const canEdit = isAdmin || isSupervisorForClient(user, client.file_no) || (s.therapist_ids || []).includes(currentUserId);
                  const tNames = (s.therapist_ids || []).map(id => findT(id)?.name?.replace("Ms. ", "")).filter(Boolean).join(" - ");
                  const stBg = s.status === "Completed" ? "#E5EBE1" : s.status === "No Show" ? "#F8EBE7" : "#F0EDE9";
                  const stColor = s.status === "Completed" ? "#3D4F35" : s.status === "No Show" ? "#8A3F27" : "#5C6853";
                  return (
                    <tr key={s.id} className="border-t border-[#E8E4DE]">
                      <td className="p-2 font-bold">{dayShort(s.session_date)}</td>
                      <td className="p-2">{fmtDate(s.session_date)}</td>
                      <td className="p-2"><span className="pill text-[10px]" style={{ background: stBg, color: stColor }}>{s.status}</span></td>
                      <td className="p-2">{s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : "—"}</td>
                      <td className="p-2 font-bold">{s.hours}</td>
                      <td className="p-2">{tNames || "—"}</td>
                      <td className="p-2 text-right">
                        {canEdit && <button onClick={() => onEdit(s)} className="btn btn-ghost p-1.5"><PencilSimple size={14}/></button>}
                        {canEdit && isAdmin && <button onClick={() => removeSess(s.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ client, sessions, therapists, isAdmin, user, currentUserId, onClose, onEdit, onDeleted, onClientUpdated }) {
  const [closed, setClosed] = useState(false);
  const [closureDate, setClosureDate] = useState("");
  // Invoice + package management state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [packageSize, setPackageSize] = useState(client.package_hours || 24);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [packageEndDate, setPackageEndDate] = useState(client.package_end_date || "");
  const [paymentStatus, setPaymentStatus] = useState(client.payment_status || "pending");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showNewInvModal, setShowNewInvModal] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newInvMenuOpen, setNewInvMenuOpen] = useState(false);
  const [localSessions, setLocalSessions] = useState(sessions);

  const findT = id => therapists.find(t => t.id === id);
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
  const cycleSessions = localSessions;
  const used = cycleSessions.filter(s => s.status === "Completed").reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const pkg = (selectedInvoice?.package_size) || client.package_hours || 24;
  const rem = Math.max(0, pkg - used);
  const completed = cycleSessions.filter(s => s.status === "Completed").length;
  const noShows = cycleSessions.filter(s => s.status === "No Show").length;
  const counted = completed + noShows;

  // Load existing invoices for this client
  useEffect(() => {
    api.get(`/clients/${client.id}/invoices`).then(r => setInvoices(r.data || [])).catch(() => setInvoices([]));
  }, [client.id]);

  // Re-fetch sessions when invoice filter changes
  useEffect(() => {
    const params = { client_id: client.id };
    if (selectedInvoiceId) params.invoice_id = selectedInvoiceId;
    api.get("/sessions", { params }).then(r => setLocalSessions(r.data || [])).catch(() => setLocalSessions([]));
  }, [client.id, selectedInvoiceId]);

  // When user picks an invoice from the dropdown, populate the form fields with that invoice's data
  useEffect(() => {
    if (selectedInvoice) {
      setInvoiceNumber(selectedInvoice.invoice_number || "");
      setPackageEndDate(selectedInvoice.period_to || client.package_end_date || "");
      setPaymentStatus(selectedInvoice.payment_status || "pending");
      setPackageSize(selectedInvoice.package_size || client.package_hours || 24);
      setClosed(!!selectedInvoice.is_closed);
      setClosureDate(selectedInvoice.close_date || "");
    } else {
      // No invoice selected -> client defaults
      setInvoiceNumber("");
      setPackageEndDate(client.package_end_date || "");
      setPaymentStatus(client.payment_status || "pending");
      setPackageSize(client.package_hours || 24);
      setClosed(false);
      setClosureDate("");
    }
  }, [selectedInvoiceId, invoices, client.package_end_date, client.payment_status, client.package_hours]);

  const createInvoice = async (number, size, serviceType) => {
    const trimmed = (number || "").trim();
    if (!trimmed) { alert("Please enter an invoice number"); return; }
    const r = await api.post(`/clients/${client.id}/invoices`, {
      invoice_number: trimmed,
      package_size: parseFloat(size) || (client.package_hours || 24),
      payment_status: "pending",
      start_date: new Date().toISOString().slice(0, 10),
      service_type: serviceType || null,
      is_closed: false,
    });
    setInvoices(prev => [r.data, ...prev]);
    setSelectedInvoiceId(r.data.id);
    setShowNewInvModal(false);
  };

  const deleteInvoice = async (iid) => {
    if (!window.confirm("Delete this invoice number?")) return;
    await api.delete(`/invoices/${iid}`);
    setInvoices(prev => prev.filter(x => x.id !== iid));
    if (selectedInvoiceId === iid) setSelectedInvoiceId("");
  };

  // Sync invoices from an uploaded client workbook (.xlsx) — reads sheet names matching INV pattern.
  const syncFromExcel = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post(`/clients/${client.id}/invoices/sync-from-excel`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { invoices_added = [], invoices_updated = [], sessions_added = 0, sessions_skipped_existing = 0, matched_sheets = [] } = r.data || {};
      const list = await api.get(`/clients/${client.id}/invoices`);
      setInvoices(list.data || []);
      alert([
        `Invoice sheets detected: ${matched_sheets.length}`,
        `Invoices added: ${invoices_added.length}`,
        `Invoices updated: ${invoices_updated.length}`,
        `Sessions added: ${sessions_added}`,
        `Sessions already existed (skipped): ${sessions_skipped_existing}`,
      ].join("\n"));
    } catch (e) {
      alert("Sync failed: " + (e?.response?.data?.detail || e.message));
    }
  };

  // Sync from Google Drive removed per product request.

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
          amount: selectedInvoice.amount || null,
          period_from: selectedInvoice.period_from || null,
          service_type: selectedInvoice.service_type || null,
          is_closed: !!closed,
          close_date: closed ? (closureDate || null) : null,
        });
        setInvoices(prev => prev.map(inv => inv.id === updated.data.id ? updated.data : inv));
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
      service_type: selectedInvoice.service_type || null,
      is_closed: newClosed,
      close_date: newDate,
    });
    setInvoices(prev => prev.map(inv => inv.id === updated.data.id ? updated.data : inv));
  };

  const performReset = async () => {
    await api.post(`/clients/${client.id}/reset-package`);
    setShowResetConfirm(false);
    onClientUpdated && onClientUpdated();
    onClose();
  };

  const exportExcel = async () => {
    const url = `${api.defaults.baseURL}/clients/${client.id}/sessions/export`;
    const token = localStorage.getItem("bg_token");
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
    if (!r.ok) { alert("Export failed"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${client.file_no || client.id}_${client.name.replace(/\s+/g, "_")}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setExportOpen(false);
  };

  const fmtDate = (d) => {
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
  };
  const dayShort = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  const sortedInvoiceSessions = [...cycleSessions].sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-0 w-full max-w-5xl modal-card max-h-[92vh] flex flex-col printable" onClick={e=>e.stopPropagation()}>
        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E4DE] no-print flex-wrap gap-2">
          <div className="font-bold text-sm" style={{color: "#2C3625"}}>Invoice Sheet · {client.name}</div>
          <div className="flex gap-2 flex-wrap items-center">
            {invoices.length > 0 ? (
              <select data-testid="invoice-dropdown" value={selectedInvoiceId} onChange={e => setSelectedInvoiceId(e.target.value)}
                      className="select text-xs" style={{maxWidth: 220}}>
                <option value="">All Invoices</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.invoice_number}{inv.is_closed ? " (Closed)" : ""}</option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] italic px-2 py-1.5" style={{color: "#8B6918", background: "#FAE8C8", borderRadius: 8}}>No invoices</span>
            )}
            {isAdmin && (
              <>
                <input id={`sync-xlsx-${client.id}`} type="file" accept=".xlsx" className="hidden"
                       data-testid="sync-xlsx-input"
                       onChange={e => { const f = e.target.files?.[0]; if (f) { syncFromExcel(f); } e.target.value = ""; }}/>
                <button data-testid="sync-xlsx-btn" onClick={() => document.getElementById(`sync-xlsx-${client.id}`).click()}
                        className="btn btn-secondary text-xs"><FileXls size={14}/> Sync from Excel</button>
              </>
            )}
            {isAdmin && (
              <div className="relative">
                <button data-testid="new-invoice-btn" onClick={() => setNewInvMenuOpen(o => !o)} className="btn btn-primary text-xs">
                  <Plus size={14}/> New Invoice <CaretDown size={12}/>
                </button>
                {newInvMenuOpen && (
                  <div
                    className="absolute right-0 mt-1 z-50 min-w-[200px] shadow-lg rounded-xl border overflow-hidden"
                    style={{ background: "#FFFFFF", borderColor: "#EDE9E3" }}
                  >
                    <button
                      type="button"
                      onClick={() => { setShowNewInvModal(true); setNewInvMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] transition"
                      style={{ color: "#374151" }}
                    >
                      New Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowResetConfirm(true); setNewInvMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] transition border-t"
                      style={{ color: "#374151", borderColor: "#EDE9E3" }}
                    >
                      Start New Package
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <button onClick={() => setExportOpen(o => !o)} className="btn btn-gold text-xs">Export <CaretDown size={12}/></button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 card p-1 z-50 min-w-[180px] shadow-lg">
                  <button data-testid="export-excel-btn" onClick={exportExcel} className="btn btn-ghost w-full justify-start text-xs"><FileXls size={14}/> Export as Excel</button>
                  <button onClick={() => { window.print(); setExportOpen(false); }} className="btn btn-ghost w-full justify-start text-xs"><Printer size={14}/> Export as PDF</button>
                  {isAdmin && selectedInvoice && (
                    <button onClick={() => { savePackageInfo(); setExportOpen(false); }} className="btn btn-ghost w-full justify-start text-xs">Save</button>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn btn-ghost p-2"><X size={20}/></button>
          </div>
        </div>

        {/* Compact invoice summary line */}
        {selectedInvoice && (
          <div className="px-5 py-2 flex items-center gap-2 text-xs no-print border-b border-[#E8E4DE] flex-wrap" style={{background: "#FAFAF7"}}>
            <span className="font-bold" style={{color: "#2C3625"}}>{selectedInvoice.invoice_number}</span>
            <span className="pill text-[10px]" style={{background: closed ? "#F8EBE7" : "#E5EBE1", color: closed ? "#8A3F27" : "#3D4F35"}}>
              {closed ? "Closed" : "Open"}
            </span>
            <span style={{color: "#5C6853"}}>{rem.toFixed(1)}h remaining</span>
            <button onClick={() => setShowInvoiceDetails(true)} className="btn btn-ghost text-[11px] py-0 px-2">ⓘ Details</button>
            {isAdmin && (
              <button onClick={() => deleteInvoice(selectedInvoice.id)} className="ml-auto text-[11px] underline" style={{color: "#8A3F27"}}>delete</button>
            )}
          </div>
        )}

        {/* Pending payment warning */}
        {selectedInvoice && paymentStatus === "pending" && (
          <div data-testid="pending-warning" className="px-5 py-2 flex items-center gap-2 text-xs font-bold no-print"
               style={{background: "#FAE8C8", color: "#8B6918", borderBottom: "1px solid #E5C387"}}>
            <Warning size={16} weight="fill"/>
            <span>Payment Pending</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white">
          {/* Logo + Title */}
          <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b-2" style={{borderColor: "#7A8A6A"}}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center p-2" style={{background: "#7A8A6A"}}>
                <img src="/bg-logo.png" alt="" className="w-full h-full object-contain"/>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold" style={{color: "#2C3625"}}>Boost Growth</div>
                <div className="text-[11px] tracking-[0.2em] font-bold" style={{color: "#8B9E7A"}}>ATTENDANCE SHEET · ABA SERVICES</div>
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
              {closed && closureDate && <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>Closure: {fmtDate(closureDate)}</div>}
              {packageEndDate && <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>Pkg ends: {fmtDate(packageEndDate)}</div>}
            </div>
          </div>

          {/* Patient info row */}
          <div className="px-8 py-4 grid grid-cols-4 gap-4 border-b border-[#E8E4DE] text-sm">
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>PATIENT'S NAME</div>
              <div className="font-bold" style={{color: "#2C3625"}}>{client.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>FILE NO.</div>
              <div className="font-bold" style={{color: "#2C3625"}}>{client.file_no || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}># PAID SESH.</div>
              <div className="font-bold" style={{color: "#2C3625"}}>{counted}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>{pkg}H DAYS</div>
              <div className="font-bold" style={{color: "#2C3625"}}>{used.toFixed(1)} / {pkg}h</div>
            </div>
          </div>

          {/* Sessions table grouped by day */}
          {cycleSessions.length === 0 ? (
            <div className="p-12 text-center" style={{color: "#8B9E7A"}}>
              {selectedInvoiceId ? "No sessions for this invoice" : "No sessions logged yet"}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead style={{background: "#F0E9D8"}}>
                <tr style={{color: "#2C3625"}}>
                  <th className="p-2 text-left font-bold">Day</th>
                  <th className="p-2 text-left font-bold">Date</th>
                  <th className="p-2 text-left font-bold">Status</th>
                  <th className="p-2 text-left font-bold">Time</th>
                  <th className="p-2 text-left font-bold"># of Hrs</th>
                  <th className="p-2 text-left font-bold">Therapist</th>
                  <th className="p-2 text-left font-bold">Note</th>
                  <th className="p-2 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoiceSessions.map(s => {
                    const stColor = s.status === "Completed" ? "#3D4F35" :
                                    s.status === "Cancelled" ? "#6B5218" :
                                    s.status === "No Show" ? "#8A3F27" : "#5C6853";
                    const stBg = s.status === "Completed" ? "#E5EBE1" :
                                  s.status === "Cancelled" ? "#FAF0D1" :
                                  s.status === "No Show" ? "#F8EBE7" : "#F0EDE9";
                    const tNames = (s.therapist_ids || []).map(id => findT(id)?.name?.replace("Ms. ", "")).filter(Boolean).join(" - ");
                    const canEdit = isAdmin || isSupervisorForClient(user, client.file_no) || (s.therapist_ids || []).includes(currentUserId);
                    return (
                      <tr key={s.id} className="border-t border-[#E8E4DE]">
                        <td className="p-2 font-bold">{dayShort(s.session_date)}</td>
                        <td className="p-2 font-bold">{fmtDate(s.session_date)}</td>
                        <td className="p-2"><span className="pill text-[10px] uppercase" style={{background: stBg, color: stColor}}>{s.status}</span></td>
                        <td className="p-2">{s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : "—"}</td>
                        <td className="p-2 font-bold">{s.hours}</td>
                        <td className="p-2">{tNames || "—"}</td>
                        <td className="p-2 italic" style={{color: "#5C6853"}}>{s.note || ""}</td>
                        <td className="p-2 text-right whitespace-nowrap no-print">
                          {canEdit && <button onClick={() => onEdit(s)} className="btn btn-ghost p-1.5"><PencilSimple size={14}/></button>}
                          {canEdit && <button onClick={async () => { if (window.confirm("Delete?")) { await api.delete(`/sessions/${s.id}`); onDeleted(); } }} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14}/></button>}
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          )}

          {/* Footer summary */}
          <div className="px-8 py-5 border-t-2 grid grid-cols-4 gap-4 text-sm" style={{borderColor: "#7A8A6A", background: "#FAFAF7"}}>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>TOTAL DELIVERED SESSIONS</div>
              <div className="font-display text-2xl" style={{color: "#3D4F35"}}>{completed}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>TOTAL NO-SHOW (counted)</div>
              <div className="font-display text-2xl" style={{color: "#8A3F27"}}>{noShows}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>TOTAL COUNTED SESSIONS</div>
              <div className="font-display text-2xl" style={{color: "#2C3625"}}>{counted}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>HOURS REMAINING</div>
              <div className="font-display text-2xl" style={{color: rem <= 4 ? "#C97B5C" : "#3D4F35"}}>{rem}h</div>
            </div>
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
                  <input className="modal-input" readOnly value={fmtDate(selectedInvoice.start_date)} />
                </FormField>
              )}
            </FormSection>

            <FormSection title="Package">
              <FormField label="Package size">
                <input
                  className="modal-input"
                  readOnly
                  value={`${packageSize || selectedInvoice.package_size || pkg}h`}
                />
              </FormField>
              <FormField label="Hours used">
                <input className="modal-input" readOnly value={`${used.toFixed(1)}h`} />
              </FormField>
              <FormField label="Hours remaining">
                <input className="modal-input" readOnly value={`${rem.toFixed(1)}h`} />
              </FormField>
              <div className="h-2 rounded-lg overflow-hidden" style={{ background: "#EDE9E3" }}>
                <div
                  className="h-full rounded-lg transition-all"
                  style={{
                    width: `${Math.min(100, ((used / (packageSize || selectedInvoice.package_size || pkg || 1)) * 100))}%`,
                    background: rem <= 4 ? "#C97B5C" : "#5C8A47",
                  }}
                />
              </div>
            </FormSection>

            <FormSection title="Payment">
              {isAdmin ? (
                <>
                  <FormField label="Payment status">
                    <select
                      data-testid="pay-status-select"
                      className="modal-input"
                      value={paymentStatus}
                      onChange={e => setPaymentStatus(e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="complete">Paid</option>
                    </select>
                  </FormField>
                  <FormField label="Package end date">
                    <input
                      data-testid="pkg-end-input"
                      type="date"
                      className="modal-input"
                      value={packageEndDate}
                      onChange={e => setPackageEndDate(e.target.value)}
                    />
                  </FormField>
                </>
              ) : (
                <FormField label="Payment status">
                  <input
                    className="modal-input"
                    readOnly
                    value={paymentStatus === "complete" ? "Paid" : "Pending"}
                  />
                </FormField>
              )}
            </FormSection>
          </ModalBase>
        )}

        {/* New Invoice modal */}
        {showNewInvModal && (
          <NewInvoiceModal client={client} defaultPackage={client.package_hours || 24}
                           onCancel={() => setShowNewInvModal(false)}
                           onCreate={createInvoice}/>
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
      </div>
    </div>
  );
}

function NewInvoiceModal({ client, defaultPackage, onCancel, onCreate }) {
  const [num, setNum] = useState("");
  const [size, setSize] = useState(defaultPackage);
  const [serviceType, setServiceType] = useState("Home Session");
  const submit = (e) => { e.preventDefault(); onCreate(num, size, serviceType); };
  return (
    <ModalBase
      title="New Invoice"
      subtitle={`Create a fresh invoice for ${client.name}`}
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
          The new sheet starts empty.
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
          <FormField label="Service type">
            <select
              data-testid="new-inv-service"
              className="modal-input"
              value={serviceType}
              onChange={e => setServiceType(e.target.value)}
            >
              <option value="Home Session">Home Session</option>
              <option value="School Support">School Support</option>
            </select>
          </FormField>
          <FormField label="Package size" required hint="Sessions or hours">
            <input
              data-testid="new-inv-size"
              type="number"
              min="0"
              step="0.5"
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
