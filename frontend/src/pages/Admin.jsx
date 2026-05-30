import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X, UserPlus, Key, EnvelopeSimple, CheckCircle, Warning, Database, SignOut } from "@phosphor-icons/react";
import PackageStatusOverview from "../components/PackageStatusOverview";

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
    resend_api_key: "", from_email: "", email_provider: "auto",
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
      from_email: e.data?.from_email || "Boost Growth <hr@boostgrowthsa.com>",
      email_provider: e.data?.provider || "auto",
      smtp_host: e.data?.smtp_host || "smtp.gmail.com",
      smtp_port: e.data?.smtp_port || 587,
      smtp_user: e.data?.smtp_user || "",
      smtp_password: "",
    });
  };
  useEffect(() => { load(); }, []);

  const saveEmail = async () => {
    const payload = {};
    if (emailForm.resend_api_key) payload.resend_api_key = emailForm.resend_api_key;
    if (emailForm.from_email) payload.from_email = emailForm.from_email;
    if (emailForm.email_provider) payload.email_provider = emailForm.email_provider;
    if (emailForm.smtp_host) payload.smtp_host = emailForm.smtp_host;
    if (emailForm.smtp_port) payload.smtp_port = parseInt(emailForm.smtp_port, 10);
    if (emailForm.smtp_user) payload.smtp_user = emailForm.smtp_user;
    if (emailForm.smtp_password) payload.smtp_password = emailForm.smtp_password;
    if (Object.keys(payload).length === 0) { alert("أدخلي بيانات SMTP أو Resend API Key"); return; }
    try {
      await api.post("/admin/email-settings", payload);
      setEditEmail(false); load();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const sendTest = async () => {
    if (!testTo) return;
    setTestResult({ status: "sending" });
    try {
      const r = await api.post("/admin/email-test-send", { to: testTo });
      setTestResult(r.data);
      load();
    } catch (e) {
      setTestResult({ status: "failed", error: e.response?.data?.detail || e.message });
    }
  };

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
  const remove = async (id) => { if (!window.confirm("Delete therapist?")) return; await api.delete(`/therapists/${id}`); load(); };

  const resetPassword = async (t) => {
    if (!window.confirm(`Generate a new temporary password for ${t.name}?\nShe will be required to change it on next login.`)) return;
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
    if (!window.confirm("Seed April 2026 progress reports for all listed clients?\nExisting records (same title + date) will be skipped.")) return;
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
    if (!window.confirm("Delete ALL leave requests from the database?\n\nThis is for clearing test data only.")) return;
    setClearingLeaves(true);
    setClearLeavesResult(null);
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
    if (!window.confirm("Update Drive URLs on existing Apr 2026 progress reports?")) return;
    setMigratingUrls(true);
    setMigrateUrlsResult(null);
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
    if (!window.confirm("Backfill invoice_id on sessions and fix HS service_type for HS-only clients?")) return;
    setRepairingSessions(true);
    setRepairSessionsResult(null);
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
    const msg = `Delete ALL sessions and invoices for ${deletePreview.name} (#${deletePreview.file_no})?\n\n${deletePreview.sessions_count} sessions · ${deletePreview.invoices_count} invoices\n\nThe client record will be kept.`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    setDeleteResult(null);
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

  const [backingUp, setBackingUp] = useState(false);
  const downloadFullBackup = async () => {
    setBackingUp(true);
    try {
      const res = await api.get("/admin/full-backup", { responseType: "blob" });
      const cd = res.headers["content-disposition"] || "";
      const m = cd.match(/filename=([^;]+)/i);
      const fname = m ? m[1].trim().replace(/"/g, "") : `boost-growth-backup-${new Date().toISOString().slice(0,19)}.json`;
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fname; document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Backup failed: " + (e.response?.data?.detail || e.message));
    } finally { setBackingUp(false); }
  };

  return (
    <div>
      <div className="flex items-center mb-5 flex-wrap gap-2">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Admin Panel</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Therapists & system settings</div>
        </div>
        <button data-testid="admin-logout-btn" onClick={logout} className="btn btn-outline"><SignOut size={16}/> Log Out</button>
        <button data-testid="add-therapist-btn" onClick={() => setEdit({ name: "", color: "#7A8A6A", pin: "0000" })} className="btn btn-primary"><UserPlus size={16}/> New Therapist</button>
      </div>

      <div className="card p-5 mb-5" style={{borderColor: "#E0CDB0", background: "#FAF6EE"}}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database size={20} weight="duotone" style={{color: "#8B6918"}}/>
            <div>
              <div className="font-bold" style={{color: "#2C3625"}}>Full Database Backup</div>
              <div className="text-xs" style={{color: "#8B6918"}}>Download a full JSON dump of every collection (therapists, clients, sessions, invoices, leaves, requests, progress reports, schedule cells, intake, notifications). Sensitive credentials are redacted.</div>
            </div>
          </div>
          <button data-testid="full-backup-btn" onClick={downloadFullBackup} disabled={backingUp}
                  className="btn btn-secondary text-sm">
            {backingUp ? <span className="spinner"/> : <><Database size={14}/> Export Full Backup</>}
          </button>
        </div>
      </div>

      <div className="card p-5 mb-5" style={{borderColor: "#E0CDB0", background: "#FAF6EE"}}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database size={20} weight="duotone" style={{color: "#8B6918"}}/>
            <div>
              <div className="font-bold" style={{color: "#2C3625"}}>Seed Master Data</div>
              <div className="text-xs" style={{color: "#8B6918"}}>One-click sync of therapists & clients from the canonical master list. Idempotent — never deletes data.</div>
            </div>
          </div>
          <button data-testid="seed-master-btn" onClick={() => setSeedConfirm(true)} disabled={seeding}
                  className="btn btn-gold text-sm">
            {seeding ? <span className="spinner"/> : <><Database size={14}/> Run Seed</>}
          </button>
        </div>
        {seedResult && (
          <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg" style={{background: "#E5EBE1", color: "#3D4F35"}}>
              <strong>Therapists:</strong> +{seedResult.therapists.created.length} created, {seedResult.therapists.updated.length} updated
            </div>
            <div className="p-2 rounded-lg" style={{background: "#E5EBE1", color: "#3D4F35"}}>
              <strong>Clients:</strong> +{seedResult.clients.created.length} created, {seedResult.clients.updated.length} updated
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 mb-5" style={{ borderColor: "#C4D4B8", background: "#F5FAF3" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-bold" style={{ color: "#2C3625" }}>Seed Apr 2026 Progress Reports</div>
            <div className="text-xs" style={{ color: "#5C6853" }}>
              Import 21 April progress report records with Drive links where available. Statuses stay unchecked — idempotent.
            </div>
          </div>
          <button data-testid="seed-apr-reports-btn" type="button" onClick={seedAprReports} disabled={prSeeding}
            className="btn btn-primary text-sm">
            {prSeeding ? <span className="spinner" /> : "Seed Apr 2026 Reports"}
          </button>
        </div>
        {prSeedResult && (
          <div className="mt-3 p-3 rounded-lg text-xs space-y-1" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            <div><strong>{prSeedResult.message}</strong></div>
            <div>Inserted: {prSeedResult.inserted} · Skipped (already exist): {prSeedResult.skipped ?? 0}</div>
            {prSeedResult.missing_clients?.length > 0 && (
              <div style={{ color: "#8B6918" }}>Clients not found: {prSeedResult.missing_clients.join(", ")}</div>
            )}
          </div>
        )}
      </div>

      <div className="card p-5 mb-5" style={{ borderColor: "#D4C4E8", background: "#FAF7FD" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-bold" style={{ color: "#2C3625" }}>Update Apr 2026 Report Drive Links</div>
            <div className="text-xs" style={{ color: "#5C6853" }}>
              One-time migration — sets Drive URLs on existing Apr 2026 progress reports by client file number.
            </div>
          </div>
          <button type="button" onClick={migrateProgressUrls} disabled={migratingUrls} className="btn btn-secondary text-sm">
            {migratingUrls ? <span className="spinner" /> : "Migrate Drive URLs"}
          </button>
        </div>
        {migrateUrlsResult && (
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            <strong>{migrateUrlsResult.message}</strong>
            {migrateUrlsResult.missing_clients?.length > 0 && (
              <div style={{ color: "#8B6918" }}>Clients not found: {migrateUrlsResult.missing_clients.join(", ")}</div>
            )}
          </div>
        )}
      </div>

      <div className="card p-5 mb-5" style={{ borderColor: "#C4D4B8", background: "#F5FAF3" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-bold" style={{ color: "#2C3625" }}>Repair Session Invoice Links</div>
            <div className="text-xs" style={{ color: "#5C6853" }}>
              Backfill missing invoice_id on sessions and set service_type to HS for HS-only clients.
            </div>
          </div>
          <button type="button" onClick={repairSessionInvoices} disabled={repairingSessions} className="btn btn-primary text-sm">
            {repairingSessions ? <span className="spinner" /> : "Repair Sessions"}
          </button>
        </div>
        {repairSessionsResult && (
          <div className="mt-3 p-3 rounded-lg text-xs space-y-1" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            <div><strong>Repair complete</strong></div>
            <div>Invoice links: {repairSessionsResult.invoice_ids_linked ?? 0} · Service type fixes: {repairSessionsResult.service_types_fixed ?? 0}</div>
          </div>
        )}
      </div>

      <div className="card p-5 mb-5" style={{ borderColor: "#E8C4C4", background: "#FDF5F5" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-bold" style={{ color: "#8A3F27" }}>Clear All Leave Requests (Test Data)</div>
            <div className="text-xs" style={{ color: "#5C6853" }}>
              Permanently deletes every record in the leaves collection. Use once to clear test data.
            </div>
          </div>
          <button data-testid="clear-leaves-btn" type="button" onClick={clearAllLeaves} disabled={clearingLeaves}
            className="btn text-sm" style={{ background: "#C97B5C", color: "#fff", borderColor: "#C97B5C" }}>
            {clearingLeaves ? <span className="spinner" /> : "Clear All Leave Requests"}
          </button>
        </div>
        {clearLeavesResult && (
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            <strong>{clearLeavesResult.message}</strong>
          </div>
        )}
      </div>

      <div className="card p-5 mb-5" style={{ borderColor: "#E8C4C4", background: "#FDF5F5" }}>
        <div className="font-bold mb-1" style={{ color: "#8A3F27" }}>Delete Sessions &amp; Invoices for Client</div>
        <div className="text-xs mb-3" style={{ color: "#5C6853" }}>
          Removes all attendance sessions and invoices for one client (by file number). Client profile is kept — use before re-importing from Excel.
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "#5C6853" }}>File No.</label>
            <input
              data-testid="delete-client-file-no"
              className="input text-sm w-28"
              placeholder="e.g. 009"
              value={deleteFileNo}
              onChange={e => { setDeleteFileNo(e.target.value); setDeletePreview(null); setDeleteResult(null); }}
              onKeyDown={e => e.key === "Enter" && lookupDeleteClient()}
            />
          </div>
          <button type="button" onClick={lookupDeleteClient} className="btn btn-secondary text-sm">Look up</button>
          {deletePreview && (
            <button
              data-testid="delete-client-sessions-btn"
              type="button"
              onClick={confirmDeleteSessionsInvoices}
              disabled={deleting}
              className="btn text-sm"
              style={{ background: "#C97B5C", color: "#fff", borderColor: "#C97B5C" }}
            >
              {deleting ? <span className="spinner" /> : `Delete for ${deletePreview.name}`}
            </button>
          )}
        </div>
        {deletePreview && (
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: "#FAE8C8", color: "#6B5218" }}>
            <strong>{deletePreview.name}</strong> (#{deletePreview.file_no}) — {deletePreview.sessions_count} sessions, {deletePreview.invoices_count} invoices
          </div>
        )}
        {deleteResult && (
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            <strong>{deleteResult.message}</strong>
          </div>
        )}
      </div>

      <PackageStatusOverview />

      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold" style={{color: "#2C3625"}}>Therapists ({therapists.length})</div>
          <div className="text-xs flex items-center gap-1" style={{color: "#8B9E7A"}}><Key size={12}/> Default PIN: 0000</div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {therapists.map(t => (
            <div key={t.id} className="p-4 rounded-xl border flex items-center gap-3" style={{borderColor: "#E8E4DE"}}>
              <div className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{background: t.color}}>{t.name?.replace("Ms. ", "").charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{color: "#2C3625"}}>{t.name}</div>
                <div className="text-xs truncate" style={{color: "#8B9E7A"}}>{t.email || t.phone || "—"}</div>
              </div>
              <button onClick={() => setEdit({...t, pin: ""})} className="btn btn-ghost p-2"><PencilSimple size={16}/></button>
              <button data-testid={`reset-pwd-${t.id}`} onClick={() => resetPassword(t)} className="btn btn-ghost p-2" title="Reset password"><Key size={16}/></button>
              <button onClick={() => remove(t.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <EnvelopeSimple size={20} weight="duotone" style={{ color: "#7A8A6A" }} />
            <div className="font-bold" style={{ color: "#2C3625" }}>Email Notifications</div>
            {emailSettings.configured
              ? <span className="pill text-[10px] px-2 py-0.5" style={{ background: "#E5EBE1", color: "#3D4F35" }}><CheckCircle size={11} weight="fill" /> {emailSettings.active_provider === "smtp" ? "Gmail/SMTP" : emailSettings.active_provider === "resend" ? "Resend" : "Configured"}</span>
              : <span className="pill text-[10px] px-2 py-0.5" style={{ background: "#FAF0D1", color: "#6B5218" }}><Warning size={11} weight="fill" /> Not configured</span>}
          </div>
          <button data-testid="edit-email-settings-btn" onClick={() => setEditEmail(s => !s)} className="btn btn-outline text-xs">
            <PencilSimple size={14} /> {editEmail ? "Cancel" : "Configure"}
          </button>
        </div>

        <div className="text-xs mb-3 px-3 py-3 rounded-lg" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
          <strong>✅ الطريقة الأسهل (موصى بها): Gmail / Google Workspace</strong>
          <p className="mt-1.5">إذا عندكم إيميل <code>hr@boostgrowthsa.com</code> على Google — ما تحتاجين Resend ولا DNS. فقط App Password:</p>
          <ol className="list-decimal pr-5 mt-2 space-y-1">
            <li>افتحي <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-bold">Google App Passwords</a> (لازم 2-Step Verification مفعّل)</li>
            <li>أنشئي App Password جديد → انسخي الرمز (16 حرف)</li>
            <li>Configure → Provider: <strong>Gmail (SMTP)</strong></li>
            <li>SMTP User: <code>hr@boostgrowthsa.com</code> · Password: الرمز · From: <code>Boost Growth &lt;hr@boostgrowthsa.com&gt;</code></li>
            <li>Save → Send Test → أي إيميل (إيميلك أو إيميل الأخصائي)</li>
          </ol>
        </div>

        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FAF0D1", color: "#6B5218" }}>
          <strong>⚠️ Resend (بديل) — ليش ما ضبط معك؟</strong>
          <p className="mt-1">بدون تفعيل الدومين في <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline">resend.com/domains</a>، Resend يرسل <em>فقط</em> لإيميل حسابك المسجّل في Resend — مو لإيميل الأخصائيين. لإرسال لأي شخص لازم تضيفين DNS records لـ <code>boostgrowthsa.com</code>.</p>
        </div>

        {editEmail ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Provider</label>
              <select className="input" value={emailForm.email_provider} onChange={e => setEmailForm({ ...emailForm, email_provider: e.target.value })}>
                <option value="auto">Auto — Gmail first, then Resend</option>
                <option value="smtp">Gmail / SMTP only</option>
                <option value="resend">Resend only</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">From Email</label>
              <input className="input" placeholder="Boost Growth <hr@boostgrowthsa.com>" value={emailForm.from_email} onChange={e => setEmailForm({ ...emailForm, from_email: e.target.value })} />
            </div>
            <div className="col-span-2 text-[11px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>GMAIL / SMTP</div>
            <div>
              <label className="label">SMTP Host</label>
              <input className="input" value={emailForm.smtp_host} onChange={e => setEmailForm({ ...emailForm, smtp_host: e.target.value })} />
            </div>
            <div>
              <label className="label">SMTP Port</label>
              <input className="input" type="number" value={emailForm.smtp_port} onChange={e => setEmailForm({ ...emailForm, smtp_port: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">SMTP User (Gmail address)</label>
              <input className="input" placeholder="hr@boostgrowthsa.com" value={emailForm.smtp_user} onChange={e => setEmailForm({ ...emailForm, smtp_user: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">SMTP Password (Google App Password — 16 chars)</label>
              <input data-testid="smtp-password-input" className="input" type="password" placeholder="xxxx xxxx xxxx xxxx" value={emailForm.smtp_password} onChange={e => setEmailForm({ ...emailForm, smtp_password: e.target.value })} />
            </div>
            <div className="col-span-2 text-[11px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>RESEND (optional)</div>
            <div className="col-span-2">
              <label className="label">Resend API Key</label>
              <input data-testid="resend-key-input" className="input" type="password" placeholder="re_xxxxxxxxxxx" value={emailForm.resend_api_key} onChange={e => setEmailForm({ ...emailForm, resend_api_key: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button onClick={() => setEditEmail(false)} className="btn btn-outline">Cancel</button>
              <button data-testid="save-email-settings-btn" onClick={saveEmail} className="btn btn-primary">Save Settings</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span style={{ color: "#8B9E7A" }}>Active:</span> <span style={{ color: "#2C3625" }}>{emailSettings.active_provider || "none"}</span></div>
            <div><span style={{ color: "#8B9E7A" }}>From:</span> <span style={{ color: "#2C3625" }}>{emailSettings.from_email}</span></div>
            <div><span style={{ color: "#8B9E7A" }}>SMTP:</span> <span style={{ color: "#2C3625" }}>{emailSettings.smtp_configured ? `✓ ${emailSettings.smtp_user}` : "—"}</span></div>
            <div><span style={{ color: "#8B9E7A" }}>Resend:</span> <span className="font-mono" style={{ color: "#2C3625" }}>{emailSettings.key_preview || "—"}</span></div>
          </div>
        )}

        {/* Test send */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: "#E8E4DE" }}>
          <div className="text-[11px] tracking-widest mb-2" style={{ color: "#8B9E7A" }}>SEND A TEST EMAIL</div>
          <div className="flex gap-2 flex-wrap">
            <input data-testid="test-email-input" className="input flex-1 text-sm" placeholder="recipient@example.com" value={testTo} onChange={e=>setTestTo(e.target.value)} />
            <button data-testid="send-test-email-btn" onClick={sendTest} disabled={!testTo || testResult?.status==="sending"} className="btn btn-primary text-sm disabled:opacity-50">
              {testResult?.status === "sending" ? "Sending..." : "Send Test"}
            </button>
          </div>
          {testResult && testResult.status !== "sending" && (
            <div className="mt-2 text-xs px-3 py-2 rounded-lg" style={{
              background: testResult.status === "sent" ? "#E5EBE1" : "#FCE0E8",
              color: testResult.status === "sent" ? "#3D4F35" : "#8B3A55"
            }}>
              {testResult.status === "sent" ? (
                <>✅ <b>تم الإرسال!</b> Provider: <code>{testResult.provider}</code>
                  {testResult.provider_id && <> · ID: <code>{testResult.provider_id}</code></>}
                  . تحققي من inbox: <b>{testResult.to}</b> (وشوفي Spam)</>
              ) : (
                <>❌ <b>فشل:</b> <code>{testResult.error || JSON.stringify(testResult)}</code><br/>
                {(testResult.error || "").includes("testing emails") && <span className="block mt-1">💡 Resend test mode: أرسلي فقط لإيميل حسابك في Resend، أو استخدمي Gmail SMTP.</span>}
                {(testResult.error || "").includes("not verified") && <span className="block mt-1">💡 الدومين غير مفعّل في Resend — استخدمي Gmail SMTP (أسهل).</span>}
                {(testResult.error || "").includes("535") && <span className="block mt-1">💡 Gmail: تأكدي من App Password (مو كلمة مرور الحساب العادية).</span>}
                {testResult.status === "queued_no_key" && <span className="block mt-1">💡 ما في إعدادات — Configure → Gmail SMTP → Save</span>}
                </>
              )}
            </div>
          )}
        </div>
        {emailQueue.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "#E8E4DE" }}>
            <div className="text-[11px] tracking-widest mb-2" style={{ color: "#8B9E7A" }}>RECENT EMAIL ACTIVITY ({emailQueue.length})</div>
            <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
              {emailQueue.slice(0, 10).map(q => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="pill text-[10px] px-1.5 py-0.5" style={{
                    background: q.status === "sent" ? "#E5EBE1" : q.status === "failed" ? "#FCE0E8" : "#FAF0D1",
                    color: q.status === "sent" ? "#3D4F35" : q.status === "failed" ? "#8B3A55" : "#6B5218"
                  }}>{q.status}</span>
                  <span style={{ color: "#5C6853" }}>{q.to}</span>
                  <span className="truncate flex-1" style={{ color: "#8B9E7A" }}>{q.subject}</span>
                  <span className="text-[10px]" style={{ color: "#8B9E7A" }}>{new Date(q.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="font-bold mb-3" style={{color: "#2C3625"}}>Quick Admin Links</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a href="https://docs.google.com/spreadsheets/d/1D2DQX0M4ieeKz4Z7c-QdO67XbDl1llnlXolLOrDXopk" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📊 Master Sheet</a>
          <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📁 Client Files</a>
          <a href="https://boost-growthsa.com" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌱 Website</a>
          <a href="https://app.netlify.com/" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌐 Netlify</a>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Therapist" : "New Therapist"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <label className="label">Name</label>
            <input data-testid="therapist-name-input" className="input mb-2" placeholder="Ms. Sarah" value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
            <label className="label">Email (optional)</label>
            <input className="input mb-2" type="email" value={edit.email || ""} onChange={e=>setEdit({...edit, email: e.target.value})}/>
            <label className="label">Phone (optional)</label>
            <input className="input mb-2" value={edit.phone || ""} onChange={e=>setEdit({...edit, phone: e.target.value})}/>
            <label className="label">Color</label>
            <div className="flex items-center gap-3 mb-2">
              <input type="color" value={edit.color} onChange={e=>setEdit({...edit, color: e.target.value})} className="w-12 h-10 rounded-lg border border-[#E8E4DE]"/>
              <span className="text-xs" style={{color: "#8B9E7A"}}>{edit.color}</span>
            </div>
            <label className="label">PIN (4-6 digits)</label>
            <input data-testid="therapist-pin-input" className="input mb-4" type="password" placeholder={edit.id ? "Leave empty to keep current" : "0000"} value={edit.pin} onChange={e=>setEdit({...edit, pin: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="therapist-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
      {seedConfirm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={() => setSeedConfirm(false)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="font-display text-xl mb-2" style={{color: "#2C3625"}}>Run Master Data Seed?</div>
            <p className="text-sm mb-3" style={{color: "#5C6853"}}>
              This will <strong>update</strong> existing therapists (match by name) and clients (match by file_no), and <strong>create</strong> any missing ones from the canonical list.
              <br/><br/>
              ✓ Existing names, emails, sessions, and invoices are <strong>NEVER touched</strong>.<br/>
              ✓ Idempotent — safe to run multiple times.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSeedConfirm(false)} className="btn btn-outline">Cancel</button>
              <button data-testid="confirm-seed-btn" onClick={runSeed} disabled={seeding} className="btn btn-primary">
                {seeding ? <span className="spinner"/> : "Yes, run seed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetInfo && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={() => setResetInfo(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="font-display text-xl mb-2" style={{color: "#2C3625"}}>Temporary Password Generated</div>
            <p className="text-sm mb-3" style={{color: "#5C6853"}}>
              Share this with <strong>{resetInfo.name}</strong>. She will be required to change it on next login.
            </p>
            <div className="p-3 rounded-lg mb-3" style={{background: "#F0E9D8", color: "#2C3625"}}>
              <div className="text-[11px] tracking-wider font-bold" style={{color: "#8B9E7A"}}>EMAIL</div>
              <div className="font-mono text-sm mb-2">{resetInfo.email || "—"}</div>
              <div className="text-[11px] tracking-wider font-bold" style={{color: "#8B9E7A"}}>TEMPORARY PASSWORD</div>
              <div className="font-mono text-lg font-bold" data-testid="temp-password-value">{resetInfo.temp_password}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(resetInfo.temp_password); }} className="btn btn-outline text-xs">Copy</button>
              <button onClick={() => setResetInfo(null)} className="btn btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
