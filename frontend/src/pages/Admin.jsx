import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  Plus, PencilSimple, Trash, X, UserPlus, Key, EnvelopeSimple, CheckCircle, Warning,
  Database, SignOut, CaretDown, CaretUp, Users, Wrench, LinkSimple,
} from "@phosphor-icons/react";

function AdminSection({ id, title, subtitle, icon, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card mb-3 overflow-hidden" data-testid={`admin-section-${id}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#FAFAF7] transition"
      >
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-bold block" style={{ color: "#2C3625" }}>{title}</span>
          {subtitle && <span className="text-xs block truncate" style={{ color: "#8B9E7A" }}>{subtitle}</span>}
        </span>
        {badge && (
          <span className="pill text-[10px] px-2 py-0.5 shrink-0" style={{ background: "#E5EBE1", color: "#3D4F35" }}>{badge}</span>
        )}
        {open ? <CaretUp size={18} style={{ color: "#8B9E7A" }} /> : <CaretDown size={18} style={{ color: "#8B9E7A" }} />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: "#E8E4DE" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ToolRow({ title, desc, children, danger }) {
  return (
    <div className={`rounded-xl p-4 mb-3 last:mb-0 border ${danger ? "border-[#E8C4C4]" : "border-[#E8E4DE]"}`}
      style={{ background: danger ? "#FDF8F8" : "#FAFAF7" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="font-bold text-sm" style={{ color: danger ? "#8A3F27" : "#2C3625" }}>{title}</div>
          {desc && <div className="text-xs mt-0.5" style={{ color: "#5C6853" }}>{desc}</div>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [emailSettings, setEmailSettings] = useState({
    configured: false, from_email: "", key_preview: null, active_provider: "none",
    smtp_configured: false, smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_user: "",
  });
  const [editEmail, setEditEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    resend_api_key: "", brevo_api_key: "", from_email: "", email_provider: "brevo",
    smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_user: "", smtp_password: "",
  });
  const [emailQueue, setEmailQueue] = useState([]);
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [prSeedResult, setPrSeedResult] = useState(null);
  const [prSeeding, setPrSeeding] = useState(false);
  const [deleteFileNo, setDeleteFileNo] = useState("");
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [clearLeavesResult, setClearLeavesResult] = useState(null);
  const [clearingLeaves, setClearingLeaves] = useState(false);
  const [migrateUrlsResult, setMigrateUrlsResult] = useState(null);
  const [migratingUrls, setMigratingUrls] = useState(false);
  const [repairSessionsResult, setRepairSessionsResult] = useState(null);
  const [repairingSessions, setRepairingSessions] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [therapistSearch, setTherapistSearch] = useState("");
  const [purgeResult, setPurgeResult] = useState(null);
  const [purging, setPurging] = useState(false);
  const [clearRequestsConfirm, setClearRequestsConfirm] = useState("");
  const [clearRequestsResult, setClearRequestsResult] = useState(null);
  const [clearingRequests, setClearingRequests] = useState(false);

  const load = async () => {
    const [t, e, q] = await Promise.all([
      api.get("/therapists"),
      api.get("/admin/email-settings").catch(() => ({ data: {} })),
      api.get("/admin/email-queue").catch(() => ({ data: [] })),
    ]);
    setTherapists(t.data);
    setEmailSettings(e.data);
    setEmailQueue(q.data);
    setEmailForm({
      resend_api_key: "",
      brevo_api_key: "",
      from_email: e.data?.from_email || "Boost Growth <admin@boostgrowthsa.com>",
      email_provider: e.data?.provider || "smtp",
      smtp_host: e.data?.smtp_host || "smtp.gmail.com",
      smtp_port: e.data?.smtp_port || 587,
      smtp_user: e.data?.smtp_user || "",
      smtp_password: "",
    });
  };
  useEffect(() => { load(); }, []);

  const saveEmail = async () => {
    const payload = {};
    if (emailForm.email_provider) payload.email_provider = emailForm.email_provider;
    if (emailForm.from_email) payload.from_email = emailForm.from_email;
    if (emailForm.email_provider === "smtp") {
      if (!emailForm.smtp_user?.trim()) { alert("Enter your Google Workspace email (SMTP User)"); return; }
      if (!emailForm.smtp_password?.trim() && !emailSettings.smtp_configured) {
        alert("Enter your Google App Password (16 characters)"); return;
      }
      payload.smtp_host = emailForm.smtp_host || "smtp.gmail.com";
      payload.smtp_port = parseInt(emailForm.smtp_port, 10) || 587;
      payload.smtp_user = emailForm.smtp_user.trim();
      if (emailForm.smtp_password?.trim()) payload.smtp_password = emailForm.smtp_password.trim();
    } else {
      if (emailForm.resend_api_key) payload.resend_api_key = emailForm.resend_api_key;
      if (emailForm.brevo_api_key) payload.brevo_api_key = emailForm.brevo_api_key;
      if (emailForm.smtp_host) payload.smtp_host = emailForm.smtp_host;
      if (emailForm.smtp_port) payload.smtp_port = parseInt(emailForm.smtp_port, 10);
      if (emailForm.smtp_user) payload.smtp_user = emailForm.smtp_user;
      if (emailForm.smtp_password) payload.smtp_password = emailForm.smtp_password;
    }
    if (Object.keys(payload).length === 0) { alert("Enter email settings first"); return; }
    try {
      await api.post("/admin/email-settings", payload);
      setEditEmail(false); load();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const sendTest = async () => {
    if (!testTo) return;
    if (!emailSettings.smtp_configured && !emailSettings.resend_configured && !emailSettings.brevo_configured) {
      alert("Save settings first");
      return;
    }
    setTestResult({ status: "sending" });
    try {
      const r = await api.post("/admin/email-test-send", { to: testTo });
      setTestResult(r.data);
      load();
    } catch (e) {
      setTestResult({ status: "failed", error: e.response?.data?.detail || e.message });
    }
  };

  const saveAndTest = async () => { await saveEmail(); if (testTo) sendTest(); };

  const save = async () => {
    if (edit.id) {
      const payload = { name: edit.name, color: edit.color, email: edit.email, phone: edit.phone };
      if (edit.pin) payload.pin = edit.pin;
      await api.put(`/therapists/${edit.id}`, payload);
    } else {
      await api.post("/therapists", { name: edit.name, color: edit.color, pin: edit.pin || "0000", email: edit.email, phone: edit.phone });
    }
    setEdit(null); load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this therapist and all their schedule cells?")) return;
    const { data } = await api.delete(`/therapists/${id}`);
    alert(`Removed ${data.name || "therapist"} · ${data.schedule_cells_deleted || 0} schedule cells cleared`);
    load();
  };

  const purgeTherapistByName = async (pattern) => {
    if (!window.confirm(`Remove all therapists matching "${pattern}" from DB (plus users & schedule cells)?`)) return;
    setPurging(true);
    try {
      const { data } = await api.post("/admin/purge-therapist", { name_pattern: pattern });
      setPurgeResult(data);
      load();
    } catch (e) {
      alert("Purge failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setPurging(false);
    }
  };

  const clearAllRequests = async () => {
    if (clearRequestsConfirm !== "DELETE") {
      alert('Type DELETE in the box to confirm');
      return;
    }
    if (!window.confirm("Delete ALL requests and leave requests? This cannot be undone.")) return;
    setClearingRequests(true);
    try {
      const { data } = await api.post("/admin/clear-requests", { confirm: "DELETE" });
      setClearRequestsResult(data);
      setClearRequestsConfirm("");
    } catch (e) {
      alert("Clear failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setClearingRequests(false);
    }
  };

  const filteredTherapists = therapists.filter(t =>
    !therapistSearch.trim() || t.name?.toLowerCase().includes(therapistSearch.toLowerCase())
  );

  const resetPassword = async (t) => {
    if (!window.confirm(`Generate a new temporary password for ${t.name}?`)) return;
    try {
      const { data } = await api.post(`/therapists/${t.id}/reset-password`);
      setResetInfo({ ...data, name: t.name });
    } catch (e) {
      alert("Reset failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      const { data } = await api.post("/admin/seed-master-data");
      setSeedResult(data);
      load();
    } catch (e) {
      alert("Seed failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSeeding(false);
      setSeedConfirm(false);
    }
  };

  const seedAprReports = async () => {
    if (!window.confirm("Seed April 2026 progress reports?")) return;
    setPrSeeding(true);
    setPrSeedResult(null);
    try {
      const { data } = await api.post("/admin/seed-progress-reports-apr2026");
      setPrSeedResult(data);
    } catch (e) {
      alert("Seed failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setPrSeeding(false);
    }
  };

  const clearAllLeaves = async () => {
    if (!window.confirm("Delete ALL leave requests?")) return;
    setClearingLeaves(true);
    try {
      const { data } = await api.post("/admin/clear-leaves");
      setClearLeavesResult(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setClearingLeaves(false);
    }
  };

  const migrateProgressUrls = async () => {
    if (!window.confirm("Update Apr 2026 Drive URLs?")) return;
    setMigratingUrls(true);
    try {
      const { data } = await api.post("/admin/migrate-progress-report-urls");
      setMigrateUrlsResult(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setMigratingUrls(false);
    }
  };

  const repairSessionInvoices = async () => {
    if (!window.confirm("Repair session invoice links?")) return;
    setRepairingSessions(true);
    try {
      const { data } = await api.post("/admin/repair-session-invoices");
      setRepairSessionsResult(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setRepairingSessions(false);
    }
  };

  const lookupDeleteClient = async () => {
    const fn = deleteFileNo.trim();
    if (!fn) return;
    setDeletePreview(null);
    setDeleteResult(null);
    try {
      const { data } = await api.get(`/admin/client-lookup/${encodeURIComponent(fn)}`);
      setDeletePreview(data);
    } catch (e) {
      alert("Lookup failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const confirmDeleteSessionsInvoices = async () => {
    if (!deletePreview) return;
    const msg = `Delete ALL sessions and invoices for ${deletePreview.name} (#${deletePreview.file_no})?\n\n${deletePreview.sessions_count} sessions · ${deletePreview.invoices_count} invoices`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      const { data } = await api.post("/admin/delete-client-sessions-invoices", { file_no: deletePreview.file_no });
      setDeleteResult(data);
      setDeletePreview(null);
      setDeleteFileNo("");
    } catch (e) {
      alert("Delete failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setDeleting(false);
    }
  };

  const downloadFullBackup = async () => {
    setBackingUp(true);
    try {
      const res = await api.get("/admin/full-backup", { responseType: "blob" });
      const cd = res.headers["content-disposition"] || "";
      const m = cd.match(/filename=([^;]+)/i);
      const fname = m ? m[1].trim().replace(/"/g, "") : `boost-growth-backup-${new Date().toISOString().slice(0, 19)}.json`;
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fname; document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Backup failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setBackingUp(false);
    }
  };

  const emailBadge = emailSettings.configured
    ? (emailSettings.active_provider === "brevo" ? "Brevo ✓" : emailSettings.active_provider || "On")
    : "Not set";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-5 flex-wrap gap-2">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#2C3625" }}>Admin Panel</h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>Choose a section from the menu below</div>
        </div>
        <button data-testid="admin-logout-btn" onClick={logout} className="btn btn-outline"><SignOut size={16} /> Log Out</button>
      </div>

      {/* Therapists */}
      <AdminSection
        id="therapists"
        title="Manage Therapists"
        subtitle={`${therapists.length} in database · view, edit, deactivate/delete`}
        icon={<Users size={20} weight="duotone" />}
        defaultOpen
        badge={String(therapists.length)}
      >
        <div className="flex flex-wrap justify-between gap-2 mb-3 pt-4">
          <input
            className="input text-sm max-w-xs flex-1 min-w-[160px]"
            placeholder="Search therapists..."
            value={therapistSearch}
            onChange={e => setTherapistSearch(e.target.value)}
          />
          <button data-testid="add-therapist-btn" onClick={() => setEdit({ name: "", color: "#7A8A6A", pin: "0000" })} className="btn btn-primary text-sm">
            <UserPlus size={16} /> New Therapist
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" disabled={purging} onClick={() => purgeTherapistByName("naja")} className="btn btn-outline text-xs" style={{ color: "#8A3F27" }}>
            {purging ? <span className="spinner" /> : "Remove Naja from DB"}
          </button>
        </div>
        {purgeResult && (
          <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            {purgeResult.message || `Removed ${purgeResult.therapists_deleted} therapist(s)`}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredTherapists.map(t => (
            <div key={t.id} className="p-3 rounded-xl border flex items-center gap-3" style={{ borderColor: "#E8E4DE" }}>
              <div className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{ background: t.color }}>
                {t.name?.replace("Ms. ", "").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>{t.name}</div>
                <div className="text-xs truncate" style={{ color: "#8B9E7A" }}>{t.email || t.phone || "—"}</div>
              </div>
              <button onClick={() => setEdit({ ...t, pin: "" })} className="btn btn-ghost p-1.5"><PencilSimple size={15} /></button>
              <button data-testid={`reset-pwd-${t.id}`} onClick={() => resetPassword(t)} className="btn btn-ghost p-1.5" title="Reset password"><Key size={15} /></button>
              <button onClick={() => remove(t.id)} className="btn btn-ghost p-1.5 text-red-700" title="Delete therapist"><Trash size={15} /></button>
            </div>
          ))}
        </div>
      </AdminSection>

      {/* Email */}
      <AdminSection
        id="email"
        title="Email Notifications"
        subtitle="Google Workspace · therapist notifications"
        icon={<EnvelopeSimple size={20} weight="duotone" />}
        badge={emailBadge}
      >
        <div className="pt-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            {emailSettings.configured
              ? <span className="pill text-xs" style={{ background: "#E5EBE1", color: "#3D4F35" }}><CheckCircle size={12} weight="fill" /> {emailSettings.active_provider} · {emailSettings.from_email}</span>
              : <span className="pill text-xs" style={{ background: "#FAF0D1", color: "#6B5218" }}><Warning size={12} /> Not configured</span>}
            <button data-testid="edit-email-settings-btn" onClick={() => setEditEmail(s => !s)} className="btn btn-outline text-xs">
              <PencilSimple size={14} /> {editEmail ? "Close" : "Configure"}
            </button>
          </div>

          {editEmail ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="sm:col-span-2">
                <label className="label">Provider</label>
                <select className="input" value={emailForm.email_provider} onChange={e => setEmailForm({ ...emailForm, email_provider: e.target.value })}>
                  <option value="smtp">Google Workspace (SMTP) — recommended</option>
                  <option value="brevo">Brevo</option>
                  <option value="resend">Resend</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              {emailForm.email_provider === "smtp" ? (
                <>
                  <div className="sm:col-span-2 text-xs p-3 rounded-lg" style={{ background: "#EAF0F3", color: "#375568" }}>
                    Use a Google App Password (16 chars). From Email must match SMTP User.
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline ml-1">Create App Password</a>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">From Email</label>
                    <input className="input" placeholder="Boost Growth &lt;walaa@boostgrowthsa.com&gt;" value={emailForm.from_email} onChange={e => setEmailForm({ ...emailForm, from_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">SMTP User (Google email)</label>
                    <input data-testid="smtp-user-input" className="input" placeholder="walaa@boostgrowthsa.com" value={emailForm.smtp_user} onChange={e => setEmailForm({ ...emailForm, smtp_user: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">App Password</label>
                    <input data-testid="smtp-password-input" className="input" type="password" placeholder="16-character app password" value={emailForm.smtp_password} onChange={e => setEmailForm({ ...emailForm, smtp_password: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">SMTP Host</label>
                    <input className="input" value={emailForm.smtp_host} onChange={e => setEmailForm({ ...emailForm, smtp_host: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">SMTP Port</label>
                    <input className="input" type="number" value={emailForm.smtp_port} onChange={e => setEmailForm({ ...emailForm, smtp_port: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="label">From Email</label>
                    <input className="input" value={emailForm.from_email} onChange={e => setEmailForm({ ...emailForm, from_email: e.target.value })} />
                  </div>
                  {emailForm.email_provider === "brevo" && (
                    <div className="sm:col-span-2">
                      <label className="label">Brevo API Key (xkeysib-...)</label>
                      <input data-testid="brevo-key-input" className="input" type="password" placeholder="xkeysib-..." value={emailForm.brevo_api_key} onChange={e => setEmailForm({ ...emailForm, brevo_api_key: e.target.value })} />
                    </div>
                  )}
                  {emailForm.email_provider === "resend" && (
                    <div className="sm:col-span-2">
                      <label className="label">Resend API Key (re_...)</label>
                      <input className="input" type="password" placeholder="re_..." value={emailForm.resend_api_key} onChange={e => setEmailForm({ ...emailForm, resend_api_key: e.target.value })} />
                    </div>
                  )}
                </>
              )}
              <div className="sm:col-span-2 flex gap-2 justify-end flex-wrap">
                <button onClick={() => setEditEmail(false)} className="btn btn-outline text-sm">Cancel</button>
                <button data-testid="save-email-settings-btn" onClick={saveEmail} className="btn btn-primary text-sm">Save</button>
                {testTo && <button type="button" onClick={saveAndTest} className="btn btn-gold text-sm">Save & Test</button>}
              </div>
            </div>
          ) : (
            <div className="text-xs mb-3 grid grid-cols-2 gap-2" style={{ color: "#5C6853" }}>
              <div>Active: <strong>{emailSettings.active_provider || "—"}</strong></div>
              <div>SMTP: <strong>{emailSettings.smtp_configured ? (emailSettings.smtp_user || "configured") : "—"}</strong></div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <input data-testid="test-email-input" className="input flex-1 text-sm" placeholder="Test email address" value={testTo} onChange={e => setTestTo(e.target.value)} />
            <button data-testid="send-test-email-btn" onClick={sendTest} disabled={!testTo || testResult?.status === "sending"} className="btn btn-primary text-sm">
              {testResult?.status === "sending" ? "Sending…" : "Send Test"}
            </button>
          </div>
          {testResult && testResult.status !== "sending" && (
            <div className="mt-2 text-xs px-3 py-2 rounded-lg" style={{
              background: testResult.status === "sent" ? "#E5EBE1" : "#FCE0E8",
              color: testResult.status === "sent" ? "#3D4F35" : "#8B3A55",
            }}>
              {testResult.status === "sent"
                ? <>✅ Sent via {testResult.provider} → {testResult.to}</>
                : <>❌ {testResult.error || "Failed"}{testResult.hint && <div className="mt-1">{testResult.hint}</div>}</>}
            </div>
          )}
          {emailQueue.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-bold" style={{ color: "#8B9E7A" }}>Recent activity ({emailQueue.length})</summary>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {emailQueue.slice(0, 8).map(q => (
                  <div key={q.id} className="flex gap-2">
                    <span className="pill text-[10px] px-1">{q.status}</span>
                    <span className="truncate">{q.to} — {q.subject}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </AdminSection>

      {/* Data & Backup */}
      <AdminSection
        id="data"
        title="Data & Backup"
        subtitle="Export · Seed master list"
        icon={<Database size={20} weight="duotone" />}
      >
        <div className="pt-4 space-y-3">
          <ToolRow title="Full Database Backup" desc="JSON export of all collections (credentials redacted).">
            <button data-testid="full-backup-btn" onClick={downloadFullBackup} disabled={backingUp} className="btn btn-secondary text-sm">
              {backingUp ? <span className="spinner" /> : "Export Backup"}
            </button>
          </ToolRow>
          <ToolRow title="Seed Master Data" desc="Sync therapists & clients from master list. Safe to re-run.">
            <button data-testid="seed-master-btn" onClick={() => setSeedConfirm(true)} disabled={seeding} className="btn btn-gold text-sm">
              {seeding ? <span className="spinner" /> : "Run Seed"}
            </button>
          </ToolRow>
          {seedResult && (
            <div className="text-xs p-2 rounded-lg" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
              Therapists: +{seedResult.therapists.created.length} · Clients: +{seedResult.clients.created.length}
            </div>
          )}
        </div>
      </AdminSection>

      {/* Migrations */}
      <AdminSection
        id="tools"
        title="Migrations & Maintenance"
        subtitle="One-time tools · use with care"
        icon={<Wrench size={20} weight="duotone" />}
      >
        <div className="pt-4">
          <ToolRow title="Seed Apr 2026 Progress Reports" desc="Import April report records (idempotent).">
            <button data-testid="seed-apr-reports-btn" onClick={seedAprReports} disabled={prSeeding} className="btn btn-primary text-sm">
              {prSeeding ? <span className="spinner" /> : "Seed Reports"}
            </button>
          </ToolRow>
          {prSeedResult && <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1" }}>{prSeedResult.message}</div>}

          <ToolRow title="Migrate Apr 2026 Drive URLs" desc="Set Drive links on existing reports.">
            <button onClick={migrateProgressUrls} disabled={migratingUrls} className="btn btn-secondary text-sm">
              {migratingUrls ? <span className="spinner" /> : "Migrate URLs"}
            </button>
          </ToolRow>
          {migrateUrlsResult && <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1" }}>{migrateUrlsResult.message}</div>}

          <ToolRow title="Repair Session Invoice Links" desc="Backfill invoice_id on sessions.">
            <button onClick={repairSessionInvoices} disabled={repairingSessions} className="btn btn-secondary text-sm">
              {repairingSessions ? <span className="spinner" /> : "Repair"}
            </button>
          </ToolRow>
          {repairSessionsResult && (
            <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1" }}>
              Linked: {repairSessionsResult.invoice_ids_linked ?? 0} · Fixed types: {repairSessionsResult.service_types_fixed ?? 0}
            </div>
          )}

          <ToolRow title="Clear All Leave Requests" desc="Delete all test leave data." danger>
            <button data-testid="clear-leaves-btn" onClick={clearAllLeaves} disabled={clearingLeaves}
              className="btn text-sm" style={{ background: "#C97B5C", color: "#fff" }}>
              {clearingLeaves ? <span className="spinner" /> : "Clear Leaves"}
            </button>
          </ToolRow>
          {clearLeavesResult && <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1" }}>{clearLeavesResult.message}</div>}

          <ToolRow title="Clear All Test Requests" desc="Deletes ALL requests + leave requests. Type DELETE to confirm." danger>
            <div className="flex gap-2 items-center flex-wrap">
              <input className="input text-sm w-28" placeholder="DELETE" value={clearRequestsConfirm}
                onChange={e => { setClearRequestsConfirm(e.target.value); setClearRequestsResult(null); }} />
              <button type="button" onClick={clearAllRequests} disabled={clearingRequests || clearRequestsConfirm !== "DELETE"}
                className="btn text-sm" style={{ background: "#C97B5C", color: "#fff" }}>
                {clearingRequests ? <span className="spinner" /> : "Clear All"}
              </button>
            </div>
          </ToolRow>
          {clearRequestsResult && <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1" }}>{clearRequestsResult.message}</div>}

          <ToolRow title="Delete Client Sessions & Invoices" desc="By file no. — keeps client profile. Before re-import." danger>
            <div className="flex gap-2 items-center flex-wrap">
              <input data-testid="delete-client-file-no" className="input text-sm w-24" placeholder="009"
                value={deleteFileNo} onChange={e => { setDeleteFileNo(e.target.value); setDeletePreview(null); setDeleteResult(null); }}
                onKeyDown={e => e.key === "Enter" && lookupDeleteClient()} />
              <button type="button" onClick={lookupDeleteClient} className="btn btn-secondary text-sm">Look up</button>
              {deletePreview && (
                <button data-testid="delete-client-sessions-btn" onClick={confirmDeleteSessionsInvoices} disabled={deleting}
                  className="btn text-sm" style={{ background: "#C97B5C", color: "#fff" }}>
                  {deleting ? <span className="spinner" /> : "Delete"}
                </button>
              )}
            </div>
          </ToolRow>
          {deletePreview && (
            <div className="text-xs p-2 rounded-lg mb-2" style={{ background: "#FAE8C8" }}>
              {deletePreview.name} — {deletePreview.sessions_count} sessions, {deletePreview.invoices_count} invoices
            </div>
          )}
          {deleteResult && <div className="text-xs p-2 rounded-lg" style={{ background: "#E5EBE1" }}>{deleteResult.message}</div>}
        </div>
      </AdminSection>

      {/* Links */}
      <AdminSection id="links" title="Quick Links" subtitle="External resources" icon={<LinkSimple size={20} weight="duotone" />}>
        <div className="pt-4 grid sm:grid-cols-2 gap-2">
          <a href="https://docs.google.com/spreadsheets/d/1D2DQX0M4ieeKz4Z7c-QdO67XbDl1llnlXolLOrDXopk" target="_blank" rel="noreferrer" className="btn btn-outline justify-start text-sm">📊 Master Sheet</a>
          <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start text-sm">📁 Client Files</a>
          <a href="https://boost-growthsa.com" target="_blank" rel="noreferrer" className="btn btn-outline justify-start text-sm">🌱 Website</a>
          <a href="https://app.brevo.com/senders/list" target="_blank" rel="noreferrer" className="btn btn-outline justify-start text-sm">📧 Brevo Senders</a>
        </div>
      </AdminSection>

      {/* Modals */}
      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Therapist" : "New Therapist"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <label className="label">Name</label>
            <input data-testid="therapist-name-input" className="input mb-2" placeholder="Ms. Sarah" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <label className="label">Email</label>
            <input className="input mb-2" type="email" value={edit.email || ""} onChange={e => setEdit({ ...edit, email: e.target.value })} />
            <label className="label">Phone</label>
            <input className="input mb-2" value={edit.phone || ""} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
            <label className="label">Color</label>
            <input type="color" value={edit.color} onChange={e => setEdit({ ...edit, color: e.target.value })} className="w-12 h-10 rounded-lg border mb-2" />
            <label className="label">PIN</label>
            <input data-testid="therapist-pin-input" className="input mb-4" type="password" placeholder={edit.id ? "Leave empty to keep" : "0000"} value={edit.pin} onChange={e => setEdit({ ...edit, pin: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="therapist-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {seedConfirm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={() => setSeedConfirm(false)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e => e.stopPropagation()}>
            <div className="font-display text-xl mb-2">Run Master Data Seed?</div>
            <p className="text-sm mb-3" style={{ color: "#5C6853" }}>Updates existing records and creates missing ones. Never deletes data.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSeedConfirm(false)} className="btn btn-outline">Cancel</button>
              <button data-testid="confirm-seed-btn" onClick={runSeed} disabled={seeding} className="btn btn-primary">
                {seeding ? <span className="spinner" /> : "Yes, run seed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetInfo && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={() => setResetInfo(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e => e.stopPropagation()}>
            <div className="font-display text-xl mb-2">Temporary Password</div>
            <p className="text-sm mb-3">Share with <strong>{resetInfo.name}</strong></p>
            <div className="p-3 rounded-lg mb-3" style={{ background: "#F0E9D8" }}>
              <div className="font-mono text-lg font-bold" data-testid="temp-password-value">{resetInfo.temp_password}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => navigator.clipboard?.writeText(resetInfo.temp_password)} className="btn btn-outline text-xs">Copy</button>
              <button onClick={() => setResetInfo(null)} className="btn btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
