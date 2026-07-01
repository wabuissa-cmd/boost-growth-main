import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  Plus, PencilSimple, Trash, X, UserPlus, Key, EnvelopeSimple, CheckCircle, Warning,
  Database, SignOut, CaretDown, CaretUp, Users, Wrench, LinkSimple, Heartbeat,
} from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import { getTherapistScheduleName } from "../scheduleConstants";

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
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: "#E2DDD4" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ToolRow({ title, desc, children, danger }) {
  return (
    <div className={`rounded-xl p-4 mb-3 last:mb-0 border ${danger ? "border-[#E8C4C4]" : "border-[#E2DDD4]"}`}
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
    resend_api_key: "", brevo_api_key: "", mailgun_api_key: "", mailgun_domain: "",
    from_email: "", email_provider: "mailgun",
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
  const [storedBackups, setStoredBackups] = useState([]);
  const [backupMeta, setBackupMeta] = useState(null);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [storingBackup, setStoringBackup] = useState(false);
  const [restoringBackupId, setRestoringBackupId] = useState(null);
  const [restoreUploadResult, setRestoreUploadResult] = useState(null);
  const [restoreUploading, setRestoreUploading] = useState(false);
  const [therapistSearch, setTherapistSearch] = useState("");
  const [purgeResult, setPurgeResult] = useState(null);
  const [purging, setPurging] = useState(false);
  const [clearRequestsConfirm, setClearRequestsConfirm] = useState("");
  const [clearRequestsResult, setClearRequestsResult] = useState(null);
  const [clearingRequests, setClearingRequests] = useState(false);
  const [deletedClients, setDeletedClients] = useState([]);
  const [intakeSeedResult, setIntakeSeedResult] = useState(null);
  const [intakeSeeding, setIntakeSeeding] = useState(false);
  const [launchCreds, setLaunchCreds] = useState(null);
  const [launchGenerating, setLaunchGenerating] = useState(false);
  const [unifiedLaunchResult, setUnifiedLaunchResult] = useState(null);
  const [unifiedLaunchSetting, setUnifiedLaunchSetting] = useState(false);
  const [forcePwChangeResult, setForcePwChangeResult] = useState(null);
  const [forcingPwChange, setForcingPwChange] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState(null);
  const [clientImportFile, setClientImportFile] = useState(null);
  const [clientImporting, setClientImporting] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveSingleFileNo, setDriveSingleFileNo] = useState("");
  const [driveSingleDryRun, setDriveSingleDryRun] = useState(true);
  const [driveSingleSyncing, setDriveSingleSyncing] = useState(false);
  const [driveSingleResult, setDriveSingleResult] = useState(null);
  const [fullRestoring, setFullRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState("");
  const [markingPayments, setMarkingPayments] = useState(false);
  const [markPaymentsResult, setMarkPaymentsResult] = useState(null);

  const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const mergeDriveSyncResults = (acc, data) => {
    const prev = acc?.drive?.results || [];
    const next = data?.results || [];
    const merged = {
      ...(acc || {}),
      drive: {
        ...(acc?.drive || {}),
        ...data,
        results: [...prev, ...next],
        synced: (acc?.drive?.synced || 0) + (data?.synced || 0),
        meta_synced: (acc?.drive?.meta_synced || 0) + (data?.meta_synced || 0),
        skipped: (acc?.drive?.skipped || 0) + (data?.skipped || 0),
        errors: (acc?.drive?.errors || 0) + (data?.errors || 0),
        sessions_total: (acc?.drive?.sessions_total || 0) + (data?.sessions_total || 0),
      },
    };
    const lines = (merged.drive.results || []).map((r) => {
      const fn = r.file_no || "?";
      if (r.status === "synced") {
        return `#${fn}: ${r.sessions_added || 0} جلسة · ${(r.invoices_added || []).length} فاتورة`;
      }
      if (r.status === "skipped") return `#${fn}: تخطّي — ${r.reason || ""}`;
      if (r.status === "error") return `#${fn}: خطأ — ${(r.error || "").slice(0, 60)}`;
      return `#${fn}: ${r.status}`;
    });
    merged.summary_ar = [
      `Drive: ${merged.drive.synced} مزامنة · ${merged.drive.sessions_total} جلسة · ${merged.drive.errors} أخطاء`,
      ...lines,
    ].join("\n");
    return merged;
  };

  const loadDeletedClients = async () => {
    try {
      const { data } = await api.get("/admin/clients/deleted");
      setDeletedClients(data || []);
    } catch {
      setDeletedClients([]);
    }
  };

  const restoreClient = async (id, name) => {
    if (!window.confirm(`Restore ${name}?`)) return;
    await api.post(`/admin/clients/${id}/restore`);
    loadDeletedClients();
  };

  const permanentDeleteClient = async (id, name) => {
    if (!window.confirm(`Permanently delete ${name} and ALL their sessions/invoices? This cannot be undone.`)) return;
    await api.delete(`/admin/clients/${id}/permanent`);
    loadDeletedClients();
  };

  const seedIntakeMaster = async () => {
    if (!window.confirm("Replace ALL intake records with the official 31-case list (16 pre + 15 post)?")) return;
    setIntakeSeeding(true);
    setIntakeSeedResult(null);
    try {
      const { data } = await api.post("/admin/seed-intake-master?replace=true");
      setIntakeSeedResult(data);
    } catch (e) {
      setIntakeSeedResult({ message: e.response?.data?.detail || e.message, ok: false });
    } finally {
      setIntakeSeeding(false);
    }
  };

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
      mailgun_api_key: "",
      mailgun_domain: e.data?.mailgun_domain || "",
      from_email: e.data?.from_email || "Boost Growth <notifications@boostgrowth.org>",
      email_provider: e.data?.provider || "mailgun",
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
    if (emailForm.email_provider === "mailgun") {
      if (!emailForm.mailgun_api_key?.trim() && !emailSettings.mailgun_configured) {
        alert("Enter your Mailgun API key"); return;
      }
      if (!emailForm.mailgun_domain?.trim() && !emailSettings.mailgun_domain) {
        alert("Enter your Mailgun domain (e.g. sandboxXXX.mailgun.org)"); return;
      }
      if (emailForm.mailgun_api_key?.trim()) payload.mailgun_api_key = emailForm.mailgun_api_key.trim();
      if (emailForm.mailgun_domain?.trim()) payload.mailgun_domain = emailForm.mailgun_domain.trim();
    } else if (emailForm.email_provider === "smtp") {
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
    if (!emailSettings.mailgun_configured && !emailSettings.smtp_configured && !emailSettings.resend_configured && !emailSettings.brevo_configured) {
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
    !therapistSearch.trim() || getTherapistScheduleName(t).toLowerCase().includes(therapistSearch.toLowerCase()) || t.name?.toLowerCase().includes(therapistSearch.toLowerCase())
  );

  const resetPassword = async (t) => {
    if (!window.confirm(`Generate a new temporary password for ${getTherapistScheduleName(t)}?`)) return;
    try {
      const { data } = await api.post(`/therapists/${t.id}/reset-password`);
      setResetInfo({ ...data, name: getTherapistScheduleName(t) });
    } catch (e) {
      alert("Reset failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const setUnifiedLaunchPassword = async () => {
    if (!window.confirm(
      "Set password growth2026 for ALL therapists with email?\n\n" +
      "Everyone can log in with this password. They will be asked to set a new password on next login.\n" +
      "Existing passwords will stop working."
    )) return;
    setUnifiedLaunchSetting(true);
    setUnifiedLaunchResult(null);
    try {
      const { data } = await api.post("/admin/set-unified-launch-password", { force_change: true });
      setUnifiedLaunchResult(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setUnifiedLaunchSetting(false);
    }
  };

  const forceTherapistPasswordChange = async () => {
    if (!window.confirm(
      "إجبار جميع الأخصائيين (ذوي البريد) على تغيير كلمة المرور عند الدخول القادم؟\n\n" +
      "Force all therapists with email to change password on next login?\n\n" +
      "Does NOT reset passwords — they keep growth2026 (or their current password) until they choose a new one."
    )) return;
    setForcingPwChange(true);
    setForcePwChangeResult(null);
    try {
      const { data } = await api.post("/admin/force-therapist-password-change");
      setForcePwChangeResult(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setForcingPwChange(false);
    }
  };

  const markAllPaymentsPaid = async () => {
    if (!window.confirm(
      "Mark ALL invoices as PAID?\n\nException: Fahad Suliman (#079) stays PARTIAL (half paid).\n\nRe-runnable."
    )) return;
    setMarkingPayments(true);
    setMarkPaymentsResult(null);
    try {
      const { data } = await api.post("/admin/mark-all-payments-complete");
      setMarkPaymentsResult(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setMarkingPayments(false);
    }
  };

  const generateLaunchCredentials = async (force = false) => {
    const msg = force
      ? "Regenerate launch passwords for ALL therapists with email? Existing passwords will stop working."
      : "Generate launch passwords for therapists who don't have them yet?\n\nPasswords stay valid until each therapist changes theirs (deploys won't reset them).";
    if (!window.confirm(msg)) return;
    setLaunchGenerating(true);
    try {
      const { data } = await api.post("/admin/generate-launch-credentials", { force });
      setLaunchCreds(data);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setLaunchGenerating(false);
    }
  };

  const downloadLaunchCsv = () => {
    const rows = launchCreds?.generated || [];
    if (!rows.length) return;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      "name,email,temp_password",
      ...rows.map((r) => [esc(r.name), esc(r.email), esc(r.temp_password)].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boost-launch-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const loadStoredBackups = async () => {
    setLoadingBackups(true);
    try {
      const { data } = await api.get("/admin/backups");
      setStoredBackups(data?.backups || []);
      setBackupMeta(data);
    } catch (e) {
      setStoredBackups([]);
      alert("Could not load backups: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoadingBackups(false);
    }
  };

  const storeBackupNow = async () => {
    setStoringBackup(true);
    try {
      const { data } = await api.post("/admin/store-backup");
      alert(`Backup saved (${data.id?.slice(0, 8)}…)`);
      loadStoredBackups();
      checkDataHealth();
    } catch (e) {
      alert("Store backup failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setStoringBackup(false);
    }
  };

  const checkDataHealth = async () => {
    setLoadingHealth(true);
    try {
      const { data } = await api.get("/admin/data-health");
      setHealthData(data);
    } catch (e) {
      setHealthData({ ok: false, error: e.response?.data?.detail || e.message });
    } finally {
      setLoadingHealth(false);
    }
  };

  const runAutoRecover = async () => {
    if (!window.confirm("تشغيل الإصلاح التلقائي؟ (دمج المعالجين المكررين + إصلاح التحضير)")) return;
    setRecovering(true);
    setRecoverResult(null);
    try {
      const { data } = await api.post("/admin/auto-recover");
      setRecoverResult(data);
      setHealthData(data.health_after || null);
    } catch (e) {
      setRecoverResult({ ok: false, summary_ar: e.response?.data?.detail || e.message });
    } finally {
      setRecovering(false);
    }
  };

  const importActiveClientsAndSync = async () => {
    if (!clientImportFile) {
      alert("اختر ملف Active Clients (Excel أو CSV) أولاً");
      return;
    }
    if (!window.confirm(
      "استيراد ملف Active Clients ثم مزامنة التحضير تلقائياً؟\n\n"
      + "يُحدّث بيانات الأطفال (الاسم، رقم الملف، الخدمة، المشرف). "
      + "الفواتير والجلسات تحتاج Sync من Drive أو رفع Excel لكل طفل."
    )) return;
    setClientImporting(true);
    setRecoverResult(null);
    try {
      const fd = new FormData();
      fd.append("file", clientImportFile);
      const { data } = await api.post("/admin/import-clients-and-sync", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRecoverResult(data);
      setHealthData(data.health_after || null);
      setClientImportFile(null);
    } catch (e) {
      setRecoverResult({ ok: false, summary_ar: e.response?.data?.detail || e.message });
    } finally {
      setClientImporting(false);
    }
  };

  const syncDriveInvoices = async () => {
    if (!window.confirm(
      "مزامنة الفواتير والجلسات من مجلد Active Clients على Drive؟\n\n"
      + "يستورد أحدث Attendance Sheet لكل طفل موجود في البوابة."
    )) return;
    setDriveSyncing(true);
    setRecoverResult(null);
    setRestoreProgress("جاري جلب قائمة مجلدات Drive…");
    try {
      const { data: folderData } = await api.get("/admin/drive-client-folders");
      const fileNos = (folderData?.folders || []).map((f) => f.file_no).filter(Boolean);
      const batches = chunkArray(fileNos, 4);
      let merged = null;
      for (let i = 0; i < batches.length; i++) {
        setRestoreProgress(`مزامنة Drive — دفعة ${i + 1} من ${batches.length}…`);
        const { data } = await api.post(
          "/admin/sync-active-clients-from-drive",
          { file_nos: batches[i], ensure_missing_clients: true },
          { timeout: 300000 },
        );
        merged = mergeDriveSyncResults(merged, data);
      }
      setRecoverResult({ ok: true, ...(merged || {}), summary_ar: merged?.summary_ar || "اكتملت المزامنة" });
      checkDataHealth();
    } catch (e) {
      setRecoverResult({ ok: false, summary_ar: e.response?.data?.detail || e.message });
    } finally {
      setDriveSyncing(false);
      setRestoreProgress("");
    }
  };

  const syncSingleDriveClient = async () => {
    const raw = (driveSingleFileNo || "").trim();
    const fileNo = raw ? String(raw).padStart(3, "0") : "";
    if (!fileNo) {
      alert("أدخل رقم ملف الطفل أولاً (مثال: 061)");
      return;
    }
    setDriveSingleSyncing(true);
    setDriveSingleResult(null);
    try {
      const { data } = await api.post(
        "/admin/sync-active-clients-from-drive",
        {
          file_nos: [fileNo],
          ensure_missing_clients: true,
          dry_run: driveSingleDryRun,
        },
        { timeout: 300000 },
      );
      const row = (data?.results || [])[0] || null;
      setDriveSingleResult({ ...(data || {}), file_no: fileNo, row });
      if (row?.status === "error") {
        alert(`Drive sync error for #${fileNo}: ${(row.error || "").slice(0, 140)}`);
      } else if (row?.status === "skipped") {
        alert(`Drive sync skipped for #${fileNo}: ${row.reason || "client not in portal"}`);
      } else if (row?.status === "meta_synced") {
        alert(`#${fileNo}: تم تحديث روابط Drive فقط (لا يوجد Attendance Sheet داخل الفولدر).`);
      } else if (row?.status === "synced") {
        alert(`#${fileNo}: synced · ${row.sessions_added || 0} جلسة · ${(row.invoices_added || []).length} فاتورة`);
      } else {
        alert(`#${fileNo}: ${row?.status || "done"}`);
      }
      checkDataHealth();
    } catch (e) {
      setDriveSingleResult({ ok: false, file_no: fileNo, error: e.response?.data?.detail || e.message });
      alert("Sync failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setDriveSingleSyncing(false);
    }
  };

  const runFullRestoreFromDrive = async () => {
    if (!window.confirm(
      "استعادة كاملة من Drive؟\n\n"
      + "١) Active Clients من Master Sheet\n"
      + "٢) فواتير وجلسات من مجلد Drive (دفعات — لتجنب انقطاع الاتصال)\n"
      + "٣) جدول أسبوع ٢٨ يونيو\n"
      + "٤) إصلاح التحضير وعلامات ✓\n\n"
      + "قد يستغرق ٥–١٥ دقيقة."
    )) return;
    setFullRestoring(true);
    setRecoverResult(null);
    const weekStart = "2026-06-28";
    let payload = { ok: true, week_start: weekStart };
    try {
      setRestoreProgress("١/٤ — استيراد Active Clients من Master Sheet…");
      const { data: clientsStep } = await api.post(
        "/admin/full-restore-from-drive",
        { week_start: weekStart, skip_drive: true, skip_schedule: true, skip_recover: true },
        { timeout: 180000 },
      );
      payload.clients = clientsStep.clients;

      setRestoreProgress("٢/٤ — جلب مجلدات Drive…");
      const { data: folderData } = await api.get("/admin/drive-client-folders");
      const fileNos = (folderData?.folders || []).map((f) => f.file_no).filter(Boolean);
      const batches = chunkArray(fileNos, 3);
      let driveMerged = null;
      for (let i = 0; i < batches.length; i++) {
        setRestoreProgress(`٢/٤ — مزامنة فواتير/جلسات (${i + 1}/${batches.length})…`);
        const { data: driveStep } = await api.post(
          "/admin/sync-active-clients-from-drive",
          { file_nos: batches[i], ensure_missing_clients: true },
          { timeout: 300000 },
        );
        driveMerged = mergeDriveSyncResults(driveMerged, driveStep);
      }
      payload.drive = driveMerged?.drive;

      setRestoreProgress("٣/٤ — استيراد جدول الأسبوع…");
      const { data: schedStep } = await api.post(
        "/admin/full-restore-from-drive",
        { week_start: weekStart, skip_clients: true, skip_drive: true, skip_recover: true },
        { timeout: 180000 },
      );
      payload.schedule = schedStep.schedule;

      setRestoreProgress("٤/٤ — إصلاح التحضير وربط علامات ✓…");
      const { data: recoverStep } = await api.post("/admin/auto-recover", {}, { timeout: 180000 });
      payload.recover = recoverStep;
      payload.health_after = recoverStep.health_after;
      payload.summary_ar = [
        clientsStep.summary_ar || `أطفال: ${clientsStep.clients?.created || 0} جديد`,
        driveMerged?.summary_ar || "",
        schedStep.summary_ar || "",
        recoverStep.summary_ar || "",
      ].filter(Boolean).join("\n");
      setRecoverResult(payload);
      setHealthData(recoverStep.health_after || null);
      if (!recoverStep.health_after) checkDataHealth();
    } catch (e) {
      setRecoverResult({ ok: false, summary_ar: e.response?.data?.detail || e.message });
    } finally {
      setFullRestoring(false);
      setRestoreProgress("");
    }
  };

  const restoreStoredBackup = async (backupId, dryRun = true) => {
    if (!dryRun && !window.confirm("Restore this backup into the live database? Existing records with same IDs will be overwritten.")) return;
    setRestoringBackupId(backupId);
    try {
      const { data } = await api.post(`/admin/restore-backup/${backupId}`, { dry_run: dryRun, mode: "merge" });
      const lines = Object.entries(data.collections || {}).map(([k, v]) => `${k}: +${v.would_insert ?? v.inserted ?? 0} / ~${v.would_update ?? v.updated ?? 0}`);
      alert((dryRun ? "Dry run — nothing written.\n" : "Restore applied.\n") + lines.join("\n"));
      if (!dryRun) loadStoredBackups();
    } catch (e) {
      alert("Restore failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setRestoringBackupId(null);
    }
  };

  const uploadRestoreBackup = async (file, dryRun = true) => {
    if (!file) return;
    if (!dryRun && !window.confirm("Apply uploaded backup to live database?")) return;
    setRestoreUploading(true);
    setRestoreUploadResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dry_run", dryRun ? "true" : "false");
      form.append("mode", "merge");
      const { data } = await api.post("/admin/restore-from-backup", form);
      setRestoreUploadResult(data);
    } catch (e) {
      setRestoreUploadResult({ ok: false, recovery_note_ar: e.response?.data?.detail || e.message });
    } finally {
      setRestoreUploading(false);
    }
  };

  const emailBadge = emailSettings.configured
    ? (emailSettings.active_provider === "brevo" ? "Brevo ✓" : emailSettings.active_provider || "On")
    : "Not set";

  return (
    <div className="max-w-4xl mx-auto">
      <PageBanner
        title="Admin Panel"
        subtitle="Choose a section from the menu below"
        badge={(
          <button data-testid="admin-logout-btn" onClick={logout} className="btn btn-outline text-sm">
            <SignOut size={16} /> Log Out
          </button>
        )}
      />

      {/* Health & Recovery — one-click tools */}
      <AdminSection
        id="health"
        title="صحة البيانات والاستعادة"
        subtitle="فحص · نسخ احتياطي · إصلاح تلقائي"
        icon={<Heartbeat size={20} weight="duotone" />}
        defaultOpen
        badge={healthData?.ok ? "✓" : healthData ? "!" : null}
      >
        <div className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="data-health-btn"
              onClick={checkDataHealth}
              disabled={loadingHealth}
              className="btn btn-primary text-sm"
            >
              {loadingHealth ? <span className="spinner" /> : "فحص البيانات"}
            </button>
            <button
              type="button"
              data-testid="store-backup-now-btn"
              onClick={storeBackupNow}
              disabled={storingBackup}
              className="btn btn-secondary text-sm"
            >
              {storingBackup ? <span className="spinner" /> : "حفظ نسخة احتياطية الآن"}
            </button>
            <button
              type="button"
              data-testid="auto-recover-btn"
              onClick={runAutoRecover}
              disabled={recovering || clientImporting || fullRestoring}
              className="btn btn-gold text-sm"
            >
              {recovering ? <span className="spinner" /> : "إصلاح تلقائي"}
            </button>
            <button
              type="button"
              data-testid="full-restore-drive-btn"
              onClick={runFullRestoreFromDrive}
              disabled={fullRestoring || recovering || clientImporting || driveSyncing}
              className="btn btn-primary text-sm"
            >
              {fullRestoring ? <span className="spinner" /> : "استعادة كاملة من Drive"}
            </button>
          </div>

          <ToolRow
            title="استيراد Active Clients + مزامنة"
            desc="ارفع ملف Active Clients (Excel) — يُحدّث الأطفال ثم يُصلح التحضير ويربط علامات ✓ من prep_history. الفواتير: Sync من Drive أو Import لكل طفل."
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn btn-outline text-xs cursor-pointer">
                {clientImportFile ? clientImportFile.name.slice(0, 28) : "اختر ملف Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  data-testid="active-clients-import-file"
                  onChange={(e) => setClientImportFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                data-testid="import-active-clients-sync-btn"
                onClick={importActiveClientsAndSync}
                disabled={!clientImportFile || clientImporting || recovering || driveSyncing || fullRestoring}
                className="btn btn-primary text-xs"
              >
                {clientImporting ? <span className="spinner" /> : "استيراد + مزامنة"}
              </button>
              <button
                type="button"
                data-testid="sync-drive-invoices-btn"
                onClick={syncDriveInvoices}
                disabled={driveSyncing || clientImporting || recovering || fullRestoring}
                className="btn btn-secondary text-xs"
              >
                {driveSyncing ? <span className="spinner" /> : "مزامنة Drive (فواتير)"}
              </button>
              <button
                type="button"
                data-testid="mark-all-payments-btn"
                onClick={markAllPaymentsPaid}
                disabled={markingPayments || clientImporting || recovering || fullRestoring}
                className="btn btn-outline text-xs"
              >
                {markingPayments ? <span className="spinner" /> : "تعليم الفواتير مدفوعة"}
              </button>
            </div>
          </ToolRow>
          {markPaymentsResult && (
            <div className="text-xs p-3 rounded-lg mb-3" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
              <div><strong>{markPaymentsResult.message}</strong></div>
              <button type="button" onClick={() => setMarkPaymentsResult(null)} className="btn btn-outline text-xs mt-1">Dismiss</button>
            </div>
          )}

          <ToolRow
            title="مزامنة طفل واحد من Drive"
            desc="تشخيص سريع: أدخل رقم الملف ثم نفّذ Sync لهذا الطفل فقط. فعّل Dry run أولاً لمعرفة هل يوجد Attendance Sheet داخل فولدره."
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                data-testid="drive-single-file-no"
                className="input text-xs w-[120px]"
                placeholder="File # (061)"
                value={driveSingleFileNo}
                onChange={(e) => setDriveSingleFileNo(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1 rounded-lg border"
                style={{ borderColor: "#E2DDD4", background: "#fff", color: "#5C6853" }}
              >
                <input
                  type="checkbox"
                  checked={driveSingleDryRun}
                  onChange={(e) => setDriveSingleDryRun(e.target.checked)}
                />
                Dry run
              </label>
              <button
                type="button"
                data-testid="drive-single-sync-btn"
                onClick={syncSingleDriveClient}
                disabled={driveSingleSyncing || driveSyncing || clientImporting || recovering || fullRestoring}
                className="btn btn-gold text-xs"
              >
                {driveSingleSyncing ? <span className="spinner" /> : "Sync الطفل"}
              </button>
            </div>
            {driveSingleResult && (
              <div className="mt-2 text-[11px] whitespace-pre-wrap rounded-lg p-2 border"
                style={{
                  borderColor: driveSingleResult?.row?.status === "error" ? "#E8C4C4" : "#E2DDD4",
                  background: driveSingleResult?.row?.status === "error" ? "#FDF8F8" : "#FFFFFF",
                  color: driveSingleResult?.row?.status === "error" ? "#8A3F27" : "#3D4F35",
                }}
              >
                <div className="font-bold mb-1">
                  #{driveSingleResult.file_no} · {driveSingleResult?.row?.client_name || "—"} · {driveSingleResult?.row?.status || "—"}
                </div>
                {driveSingleResult?.row?.sheet_url && (
                  <div>sheet_url: {driveSingleResult.row.sheet_url}</div>
                )}
                {driveSingleResult?.row?.reason && <div>reason: {driveSingleResult.row.reason}</div>}
                {driveSingleResult?.row?.error && <div>error: {driveSingleResult.row.error}</div>}
                {driveSingleResult?.row?.status === "synced" && (
                  <div>
                    sessions_added: {driveSingleResult.row.sessions_added || 0} · invoices_added: {(driveSingleResult.row.invoices_added || []).length}
                  </div>
                )}
              </div>
            )}
          </ToolRow>

          {healthData && !healthData.error && (
            <div className="text-xs p-3 rounded-xl space-y-2" style={{ background: "#FAFAF7", border: "1px solid #E2DDD4" }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><span style={{ color: "#8B9E7A" }}>أطفال نشطون</span><br /><strong>{healthData.clients}</strong></div>
                {healthData.clients_inactive > 0 && (
                  <div><span style={{ color: "#8B9E7A" }}>غير نشطين</span><br /><strong>{healthData.clients_inactive}</strong></div>
                )}
                <div><span style={{ color: "#8B9E7A" }}>فواتير</span><br /><strong>{healthData.invoices}</strong></div>
                <div><span style={{ color: "#8B9E7A" }}>جلسات</span><br /><strong>{healthData.sessions}</strong></div>
                <div><span style={{ color: "#8B9E7A" }}>تحضير</span><br /><strong>{healthData.prep_history}</strong></div>
                <div><span style={{ color: "#8B9E7A" }}>معالجون</span><br /><strong>{healthData.therapists}</strong></div>
                <div><span style={{ color: healthData.duplicate_therapist_groups ? "#8A3F27" : "#3D4F35" }}>
                  مكررون
                </span><br /><strong>{healthData.duplicate_therapist_groups}</strong></div>
                <div><span style={{ color: "#8B9E7A" }}>خلايا جدول</span><br /><strong>{healthData.schedule_cells_total}</strong></div>
                <div><span style={{ color: "#8B9E7A" }}>نسخ احتياطية</span><br /><strong>{healthData.stored_backups}</strong></div>
              </div>
              {healthData.missing_invoices?.length > 0 && (
                <div className="p-2 rounded-lg" style={{ background: "#FDF8F3", color: "#8A3F27" }}>
                  <strong>بدون فواتير ({healthData.missing_invoices.length}):</strong>{" "}
                  {healthData.missing_invoices.slice(0, 6).join(" · ")}
                  {healthData.missing_invoices.length > 6 ? ` · +${healthData.missing_invoices.length - 6}` : ""}
                </div>
              )}
              {healthData.last_backup_at && (
                <div style={{ color: "#5C6853" }}>
                  آخر نسخة: {healthData.last_backup_at.slice(0, 19).replace("T", " ")}
                  {healthData.last_backup_id ? ` (${healthData.last_backup_id}…)` : ""}
                </div>
              )}
              {healthData.schedule_weeks?.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-bold" style={{ color: "#3D4F35" }}>أسابيع الجدول</summary>
                  <ul className="mt-1 space-y-0.5" style={{ color: "#5C6853" }}>
                    {healthData.schedule_weeks.slice(0, 8).map((w) => (
                      <li key={w.week_start}>{w.week_start}: {w.cells} خلية · {w.status}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {healthData?.error && (
            <div className="text-xs p-3 rounded-lg" style={{ background: "#FCE0E8", color: "#8B3A55" }}>
              {healthData.error}
            </div>
          )}
          {restoreProgress && (
            <div className="text-xs p-3 rounded-lg" style={{ background: "#FDF8F3", color: "#5C6853" }}>
              {restoreProgress}
            </div>
          )}
          {recoverResult?.summary_ar && (
            <div className="text-xs p-3 rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
              <strong>نتيجة الإصلاح:</strong>
              <div className="mt-1">{recoverResult.summary_ar}</div>
              <button type="button" onClick={() => setRecoverResult(null)} className="btn btn-outline text-xs mt-2 block">إغلاق</button>
            </div>
          )}
        </div>
      </AdminSection>

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
        <ToolRow
          title="Set unified launch password"
          desc="Set growth2026 for every therapist with email. On next login they must choose a new password. Deploys will NOT reset this — run only when you are ready to send credentials."
        >
          <button
            type="button"
            data-testid="set-unified-launch-password-btn"
            onClick={setUnifiedLaunchPassword}
            disabled={unifiedLaunchSetting}
            className="btn btn-gold text-sm"
          >
            {unifiedLaunchSetting ? <span className="spinner" /> : <><Key size={14} className="inline mr-1" /> Set unified launch password</>}
          </button>
        </ToolRow>
        {unifiedLaunchResult && (
          <div className="text-xs p-3 rounded-lg mb-3 space-y-1" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            <div><strong>{unifiedLaunchResult.message}</strong></div>
            {unifiedLaunchResult.no_email?.length > 0 && (
              <div className="text-[11px]" style={{ color: "#6B7A5E" }}>
                {unifiedLaunchResult.no_email.length} therapist(s) skipped (no email).
              </div>
            )}
            <button type="button" onClick={() => setUnifiedLaunchResult(null)} className="btn btn-outline text-xs mt-1">Dismiss</button>
          </div>
        )}
        <ToolRow
          title="إجبار تغيير كلمة المرور عند الدخول القادم"
          desc="For therapists already on growth2026: flags every therapist with email to set a new password on next login. Does not change their current password."
        >
          <button
            type="button"
            data-testid="force-therapist-password-change-btn"
            onClick={forceTherapistPasswordChange}
            disabled={forcingPwChange}
            className="btn btn-outline text-sm"
          >
            {forcingPwChange ? <span className="spinner" /> : <><Key size={14} className="inline mr-1" /> إجبار تغيير كلمة المرور عند الدخول القادم</>}
          </button>
        </ToolRow>
        {forcePwChangeResult && (
          <div className="text-xs p-3 rounded-lg mb-3 space-y-1" style={{ background: "#F0E9D8", color: "#5C4A1F" }}>
            <div><strong>{forcePwChangeResult.message}</strong></div>
            {forcePwChangeResult.no_email?.length > 0 && (
              <div className="text-[11px]" style={{ color: "#6B5218" }}>
                {forcePwChangeResult.no_email.length} therapist(s) skipped (no email).
              </div>
            )}
            <button type="button" onClick={() => setForcePwChangeResult(null)} className="btn btn-outline text-xs mt-1">Dismiss</button>
          </div>
        )}
        <ToolRow
          title="Generate Launch Credentials (per-name)"
          desc="Legacy: individual passwords (Firstname@Launch2026). Prefer unified launch password above for tomorrow's rollout."
        >
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              data-testid="generate-launch-creds-btn"
              onClick={() => generateLaunchCredentials(false)}
              disabled={launchGenerating}
              className="btn btn-outline text-sm"
            >
              {launchGenerating ? <span className="spinner" /> : <><Key size={14} className="inline mr-1" /> Generate</>}
            </button>
            <button
              type="button"
              onClick={() => generateLaunchCredentials(true)}
              disabled={launchGenerating}
              className="btn btn-outline text-sm"
            >
              Regenerate all
            </button>
          </div>
        </ToolRow>
        {launchCreds && (
          <div className="text-xs p-3 rounded-lg mb-3 space-y-2" style={{ background: "#F0E9D8", color: "#5C4A1F" }}>
            <div><strong>{launchCreds.message}</strong></div>
            <div className="text-[11px]" style={{ color: "#6B5218" }}>
              EN: Passwords work until each therapist changes theirs — not a 24h login expiry. Generate once, then send emails.
              <br />
              AR: كلمات المرور تبقى صالحة حتى يغيّرها الأخصائي — وليس انتهاء بعد 24 ساعة. أنشئها مرة واحدة ثم أرسل الإيميلات.
            </div>
            {launchCreds.generated?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={downloadLaunchCsv} className="btn btn-primary text-xs">
                  Download CSV ({launchCreds.generated.length})
                </button>
                <button type="button" onClick={() => setLaunchCreds(null)} className="btn btn-outline text-xs">Dismiss</button>
              </div>
            )}
            {launchCreds.generated?.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded-lg" style={{ borderColor: "#E2DDD4" }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: "#FAFAF7", color: "#8B9E7A" }}>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {launchCreds.generated.map((r) => (
                      <tr key={r.id} className="border-t" style={{ borderColor: "#EDE9E3" }}>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2 font-mono font-bold">{r.temp_password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {purgeResult && (
          <div className="text-xs p-2 rounded-lg mb-3" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            {purgeResult.message || `Removed ${purgeResult.therapists_deleted} therapist(s)`}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredTherapists.map(t => (
            <div key={t.id} className="p-3 rounded-xl border flex items-center gap-3" style={{ borderColor: "#E2DDD4" }}>
              <div className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{ background: t.color }}>
                {getTherapistScheduleName(t)?.replace(/^Ms\.?\s*/i, "").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>{getTherapistScheduleName(t)}</div>
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
        subtitle="Mailgun · works on Railway"
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
                  <option value="mailgun">Mailgun (recommended for Railway)</option>
                  <option value="brevo">Brevo</option>
                  <option value="resend">Resend</option>
                  <option value="smtp">Google Workspace SMTP (blocked on Railway)</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              {emailForm.email_provider === "mailgun" ? (
                <>
                  <div className="sm:col-span-2 text-xs p-3 rounded-lg" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
                    Mailgun uses HTTPS — works on Railway. Free: 100 emails/day.
                    Sign up at <a href="https://www.mailgun.com" target="_blank" rel="noreferrer" className="underline font-bold">mailgun.com</a>
                    → Sending → Domain Settings → copy API key + domain.
                    Sandbox domain only sends to authorized recipients until you verify boostgrowth.org.
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">From Email</label>
                    <input className="input" placeholder="Boost Growth &lt;notifications@boostgrowth.org&gt;" value={emailForm.from_email} onChange={e => setEmailForm({ ...emailForm, from_email: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Mailgun API Key</label>
                    <input data-testid="mailgun-key-input" className="input" type="password" placeholder="key-..." value={emailForm.mailgun_api_key} onChange={e => setEmailForm({ ...emailForm, mailgun_api_key: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Mailgun Domain</label>
                    <input data-testid="mailgun-domain-input" className="input" placeholder="sandbox123.mailgun.org or mg.boostgrowth.org" value={emailForm.mailgun_domain} onChange={e => setEmailForm({ ...emailForm, mailgun_domain: e.target.value })} />
                  </div>
                </>
              ) : emailForm.email_provider === "smtp" ? (
                <>
                  <div className="sm:col-span-2 text-xs p-3 rounded-lg" style={{ background: "#FAE8C8", color: "#8B6918" }}>
                    ⚠️ Railway blocks Gmail SMTP (port 587). Use Mailgun instead — it works on Railway.
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
              <div>Mailgun: <strong>{emailSettings.mailgun_domain || emailSettings.mailgun_key_preview || "—"}</strong></div>
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
            <details className="mt-3 text-xs" open>
              <summary className="cursor-pointer font-bold" style={{ color: "#8B9E7A" }}>
                Email delivery log ({emailQueue.length})
              </summary>
              <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                {emailQueue.slice(0, 50).map(q => {
                  const ok = q.status === "sent";
                  const pending = q.status === "queued" || q.status === "queued_no_key";
                  const stBg = ok ? "#E5EBE1" : pending ? "#F5EBE3" : "#FCE0E8";
                  const stColor = ok ? "#3D4F35" : pending ? "#6B5218" : "#8B3A55";
                  return (
                    <div key={q.id} className="flex flex-wrap items-center gap-2 py-1 border-b last:border-b-0" style={{ borderColor: "#EDE9E3" }}>
                      <span className="pill text-[10px] px-1.5 font-bold shrink-0" style={{ background: stBg, color: stColor }}>
                        {q.status}
                      </span>
                      <span className="truncate flex-1 min-w-0" title={`${q.to} — ${q.subject}`}>
                        <strong>{q.to}</strong> — {q.subject}
                      </span>
                      {q.created_at && (
                        <span className="text-[10px] shrink-0" style={{ color: "#8B9E7A" }}>
                          {String(q.created_at).slice(0, 16).replace("T", " ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {emailQueue.length > 50 && (
                <p className="text-[10px] mt-2 m-0" style={{ color: "#8B9E7A" }}>
                  Showing latest 50 of {emailQueue.length} — full history in database backup.
                </p>
              )}
            </details>
          )}
        </div>
      </AdminSection>

      {/* Data & Backup */}
      <AdminSection
        id="data"
        title="Data & Backup"
        subtitle="Export · Daily backup · Restore"
        icon={<Database size={20} weight="duotone" />}
      >
        <div className="pt-4 space-y-3">
          <ToolRow title="Full Database Backup" desc="Download JSON export of all collections (credentials redacted).">
            <button data-testid="full-backup-btn" onClick={downloadFullBackup} disabled={backingUp} className="btn btn-secondary text-sm">
              {backingUp ? <span className="spinner" /> : "Export Backup"}
            </button>
          </ToolRow>
          <ToolRow
            title="Daily backup (stored in database)"
            desc={`Auto via Railway cron POST /admin/scheduled-backup · keeps ${backupMeta?.retention_days ?? 30} days`}
          >
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={loadStoredBackups} disabled={loadingBackups} className="btn btn-outline text-sm">
                {loadingBackups ? <span className="spinner" /> : "Refresh list"}
              </button>
              <button type="button" onClick={storeBackupNow} disabled={storingBackup} className="btn btn-secondary text-sm">
                {storingBackup ? <span className="spinner" /> : "Save backup now"}
              </button>
            </div>
          </ToolRow>
          {storedBackups.length > 0 && (
            <div className="text-xs space-y-2 max-h-48 overflow-y-auto p-3 rounded-lg" style={{ background: "#FAFAF7" }}>
              {storedBackups.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 border-b border-[#E2DDD4] pb-2 last:border-0">
                  <div>
                    <div className="font-bold" style={{ color: "#2C3625" }}>{b.created_at?.slice(0, 19) || b.id}</div>
                    <div style={{ color: "#8B9E7A" }}>
                      {b.source} · clients {b.totals?.clients ?? "?"} · cells {b.totals?.schedule_cells ?? "?"}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" disabled={restoringBackupId === b.id} onClick={() => restoreStoredBackup(b.id, true)} className="btn btn-outline text-[10px] py-1 px-2">Dry run</button>
                    <button type="button" disabled={restoringBackupId === b.id} onClick={() => restoreStoredBackup(b.id, false)} className="btn btn-gold text-[10px] py-1 px-2">Restore</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ToolRow title="Restore from uploaded JSON" desc="Upload a backup file. Dry-run first to preview counts.">
            <label className="btn btn-outline text-sm cursor-pointer">
              {restoreUploading ? <span className="spinner" /> : "Upload & dry-run"}
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => uploadRestoreBackup(e.target.files?.[0], true)} />
            </label>
          </ToolRow>
          {restoreUploadResult && (
            <div className="text-xs p-2 rounded-lg" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
              <div>{restoreUploadResult.recovery_note_ar || (restoreUploadResult.dry_run ? "Dry run complete" : "Restore applied")}</div>
              <button type="button" onClick={() => setRestoreUploadResult(null)} className="btn btn-outline text-xs mt-1">Dismiss</button>
            </div>
          )}
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
          <ToolRow title="Replace Intake List (31 cases)" desc="Clears intake DB and loads official pre/post waiting list. Safe for production sync.">
            <button type="button" onClick={seedIntakeMaster} disabled={intakeSeeding} className="btn btn-secondary text-sm">
              {intakeSeeding ? <span className="spinner" /> : "Replace Intake"}
            </button>
          </ToolRow>
          {intakeSeedResult && (
            <div className="text-xs p-2 rounded-lg mb-3" style={{ background: intakeSeedResult.ok === false ? "#F8EBE7" : "#E5EBE1", color: "#3D4F35" }}>
              {intakeSeedResult.message || `${intakeSeedResult.created || 0} intake records loaded`}
            </div>
          )}
          <ToolRow title="Deleted Clients" desc="Soft-deleted clients — restore or permanently remove.">
            <button type="button" onClick={loadDeletedClients} className="btn btn-secondary text-sm">Refresh</button>
          </ToolRow>
          {deletedClients.length === 0 ? (
            <div className="text-xs p-3 rounded-lg mb-3" style={{ background: "#FAFAF7", color: "#8B9E7A" }}>
              No deleted clients. Click Refresh to load.
            </div>
          ) : (
            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
              {deletedClients.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[#E2DDD4] text-xs" style={{ background: "#FAFAF7" }}>
                  <div>
                    <span className="font-bold" style={{ color: "#2C3625" }}>{c.name}</span>
                    <span className="ml-2" style={{ color: "#8B9E7A" }}>#{c.file_no || "—"}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => restoreClient(c.id, c.name)} className="btn btn-secondary text-[10px] py-1 px-2">Restore</button>
                    <button type="button" onClick={() => permanentDeleteClient(c.id, c.name)} className="btn text-[10px] py-1 px-2" style={{ background: "#C97B5C", color: "#fff" }}>Delete Forever</button>
                  </div>
                </div>
              ))}
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
