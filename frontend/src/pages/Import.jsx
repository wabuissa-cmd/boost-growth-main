import { useEffect, useState } from "react";
import api, { startOfWeek, toISODate } from "../api";
import { UploadSimple, Download, CheckCircle, X, FileXls, CalendarBlank, UserList, ArrowsClockwise } from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import { WAITING_LIST_SHEET_URL } from "../constants/waiting";

export default function ImportPage() {
  const [type, setType] = useState("clients"); // clients, intake, historical, schedule
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replaceMissingClients, setReplaceMissingClients] = useState(false);
  const [historicalWeeks, setHistoricalWeeks] = useState([]);
  const [clearExisting, setClearExisting] = useState(false);
  const [scheduleWeekStart, setScheduleWeekStart] = useState(toISODate(startOfWeek(new Date())));
  const [sheetName, setSheetName] = useState("");
  const [availableSheets, setAvailableSheets] = useState([]);
  const [googleUrl, setGoogleUrl] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreResult, setRestoreResult] = useState(null);
  const [dedupeResult, setDedupeResult] = useState(null);
  const [deduping, setDeduping] = useState(false);
  const [fixingSchool, setFixingSchool] = useState(false);
  const [fixSchoolResult, setFixSchoolResult] = useState(null);
  const [activeClientsFolderUrl, setActiveClientsFolderUrl] = useState(
    "https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr"
  );
  const [driveSyncResult, setDriveSyncResult] = useState(null);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [waitingSyncing, setWaitingSyncing] = useState(false);
  const [waitingSyncResult, setWaitingSyncResult] = useState(null);

  const dedupeIntake = async () => {
    if (!window.confirm("Remove duplicate intake records (same child name + type)?")) return;
    setDeduping(true);
    setDedupeResult(null);
    try {
      const { data } = await api.post("/admin/dedupe-intake");
      setDedupeResult(data);
    } catch (e) {
      setDedupeResult({ message: e.response?.data?.detail || e.message, ok: false });
    }
    setDeduping(false);
  };

  const fixSchoolIntake = async () => {
    if (!window.confirm("Move SS / school-support children from Pre-Intake to School Waiting?")) return;
    setFixingSchool(true);
    setFixSchoolResult(null);
    try {
      const { data } = await api.post("/admin/fix-school-intake");
      setFixSchoolResult(data);
    } catch (e) {
      setFixSchoolResult({ message: e.response?.data?.detail || e.message, ok: false });
    }
    setFixingSchool(false);
  };

  const pickSheetForWeek = (sheets, weekISO) => {
    if (!sheets?.length || !weekISO) return sheets?.[0] || "";
    const d = new Date(`${weekISO}T12:00:00`);
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[d.getMonth()];
    const pattern = new RegExp(`\\b${day}\\s+${mon}\\b`, "i");
    return sheets.find(s => pattern.test(s)) || sheets[0];
  };

  // When schedule file is picked, list its sheet names so user can choose
  useEffect(() => {
    if (type !== "schedule" || !file) { setAvailableSheets([]); return; }
    (async () => {
      try {
        const fd = new FormData(); fd.append("file", file);
        const { data } = await api.post("/import/list-sheets", fd, { headers: {"Content-Type": "multipart/form-data"}});
        setAvailableSheets(data.sheets || []);
        if (data.sheets?.length) setSheetName(pickSheetForWeek(data.sheets, scheduleWeekStart));
      } catch { setAvailableSheets([]); }
    })();
  }, [file, type, scheduleWeekStart]);

  useEffect(() => {
    api.get("/import/historical-weeks").then(({ data }) => setHistoricalWeeks(data.weeks)).catch(() => {});
  }, []);

  const upload = async () => {
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      let endpoint = `/import/${type}`;
      if (type === "schedule") {
        endpoint = `/import/schedule-excel`;
        fd.append("week_start", scheduleWeekStart);
        if (clearExisting) fd.append("clear_existing", "true");
        if (sheetName) fd.append("sheet_name", sheetName);
      }
      if (type === "clients" && replaceMissingClients) {
        fd.append("replace_missing", "true");
      }
      const { data } = await api.post(endpoint, fd, { headers: {"Content-Type": "multipart/form-data"}});
      const msg = type === "schedule"
        ? `${data.cells_inserted} cells for week ${data.week_start}${data.sheet_used ? ` · sheet "${data.sheet_used}"` : ""}${data.merge_spans_detected != null ? ` · ${data.merge_spans_detected} merged spans detected` : ""}${data.week_start_warning ? ` · ${data.week_start_warning}` : ""}`
        : type === "intake"
        ? [data.message, data.hint].filter(Boolean).join(' — ')
        : `${data.created} created, ${data.skipped} skipped${data.removed_missing ? ` · ${data.removed_missing} removed (missing from file)` : ""}`;
      setResult({ ok: true, msg });
      setFile(null);
    } catch (e) { setResult({ ok: false, msg: e.response?.data?.detail || e.message }); }
    setLoading(false);
  };

  const importFromGoogle = async () => {
    if (!googleUrl.trim()) return;
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/import/schedule-google", {
        sheet_url: googleUrl.trim(),
        week_start: scheduleWeekStart,
        sheet_name: sheetName || undefined,
        clear_existing: clearExisting,
      });
      setResult({
        ok: true,
        msg: `${data.cells_inserted} cells for week ${data.week_start} · sheet "${data.sheet_used}" · ${data.merge_spans_detected} merged spans${data.week_start_warning ? ` · ${data.week_start_warning}` : ""}`,
      });
    } catch (e) {
      setResult({ ok: false, msg: e.response?.data?.detail || e.message });
    }
    setLoading(false);
  };

  const loadHistorical = async () => {
    if (!window.confirm(`Load ${historicalWeeks.length} historical week(s) into schedule?`)) return;
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/import/historical-load", { clear_existing: clearExisting });
      setResult({ ok: true, msg: `${data.weeks_loaded} weeks loaded, ${data.cells_inserted} cells inserted` });
    } catch (e) { setResult({ ok: false, msg: e.response?.data?.detail || e.message }); }
    setLoading(false);
  };

  const restoreOfficialClients = async () => {
    if (restoreConfirm !== "RESTORE") {
      alert('Type RESTORE in the box to confirm');
      return;
    }
    if (!window.confirm("Remove all clients NOT in the official 25-client list and restore known profiles?")) return;
    setLoading(true);
    setRestoreResult(null);
    try {
      const { data } = await api.post("/admin/restore-official-clients", { confirm: "RESTORE" });
      setRestoreResult(data);
      setRestoreConfirm("");
    } catch (e) {
      setRestoreResult({ message: e.response?.data?.detail || e.message, ok: false });
    }
    setLoading(false);
  };

  const syncActiveClientsFromDrive = async (dryRun = false) => {
    if (!dryRun && !window.confirm(
      "Sync all active clients from Google Drive?\n\n"
      + "Updates parent phones, case summaries, and Drive links from each folder. "
      + "Also imports attendance/invoices when an Attendance Sheet is found."
    )) return;
    setDriveSyncing(true);
    setDriveSyncResult(null);
    try {
      const { data } = await api.post("/admin/sync-active-clients-from-drive", {
        folder_url: activeClientsFolderUrl.trim() || undefined,
        dry_run: dryRun,
      });
      setDriveSyncResult(data);
    } catch (e) {
      setDriveSyncResult({ ok: false, message: e.response?.data?.detail || e.message });
    }
    setDriveSyncing(false);
  };

  const syncWaitingFromGoogle = async () => {
    if (!window.confirm(
      "Sync the official Waiting List Google Sheet?\n\n"
      + "This updates Intake + School waiting queues and removes stale rows from the last sync. "
      + "Use this — not the Excel upload above — for the live waiting list."
    )) return;
    setWaitingSyncing(true);
    setWaitingSyncResult(null);
    try {
      const { data } = await api.post("/import/intake-google", { sheet_url: WAITING_LIST_SHEET_URL });
      setWaitingSyncResult({ ok: true, msg: data.message || "Waiting list synced" });
    } catch (e) {
      setWaitingSyncResult({ ok: false, msg: e.response?.data?.detail || e.message });
    }
    setWaitingSyncing(false);
  };

  const exportParentPhones = async () => {
    try {
      const token = localStorage.getItem("bg_token");
      const r = await fetch(`${api.defaults.baseURL}/admin/export-parent-phones`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "parent_phones.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert(e.message || "Could not export parent phones");
    }
  };

  const importParentPhones = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/import-parent-phones", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(data.message || `Updated ${data.updated} phone(s)`);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Import failed");
    }
  };

  return (
    <div>
      <PageBanner
        title="Import Data"
        subtitle="Bulk-import clients, intake records, or historical schedules"
      />

      <div className="card p-5 mb-5 border-2" style={{ borderColor: "#7A8A6A" }}>
        <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Quick Sync (Google)</div>
        <div className="text-sm mb-4" style={{ color: "#5C6853" }}>
          Use these buttons to update the waiting list and pull parent phones + case summaries from Active Clients Drive.
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={syncWaitingFromGoogle} disabled={waitingSyncing} className="btn btn-primary text-sm disabled:opacity-50">
            {waitingSyncing ? <span className="spinner" /> : <><ArrowsClockwise size={16} /> Sync Waiting List</>}
          </button>
          <button type="button" onClick={() => syncActiveClientsFromDrive(false)} disabled={driveSyncing} className="btn btn-secondary text-sm disabled:opacity-50">
            {driveSyncing ? <span className="spinner" /> : <><Download size={16} /> Sync All from Drive</>}
          </button>
          <button type="button" onClick={() => syncActiveClientsFromDrive(true)} disabled={driveSyncing} className="btn btn-outline text-sm disabled:opacity-50">
            Preview Drive Sync
          </button>
          <button type="button" onClick={exportParentPhones} className="btn btn-outline text-sm">
            <Download size={16} /> Export Parent Phones (CSV)
          </button>
          <label className="btn btn-outline text-sm cursor-pointer">
            <UploadSimple size={16} /> Import Parent Phones (CSV)
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={importParentPhones} />
          </label>
        </div>
        {waitingSyncResult && (
          <div className="text-xs p-3 rounded-xl mt-3" style={{ background: waitingSyncResult.ok === false ? "#F8EBE7" : "#E5EBE1", color: "#3D4F35" }}>
            <strong>Waiting:</strong> {waitingSyncResult.msg}
          </div>
        )}
        {driveSyncResult && (
          <div className="text-xs p-3 rounded-xl mt-3" style={{ background: driveSyncResult.ok === false ? "#F8EBE7" : "#E5EBE1", color: "#3D4F35" }}>
            <strong>Drive:</strong> {driveSyncResult.message || `${driveSyncResult.synced ?? 0} synced · ${driveSyncResult.meta_synced ?? 0} phones/links`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5 import-type-grid">
        {[
          { id: "clients", label: "Clients", desc: "Excel/CSV with name, file_no, package_hours, etc.", icon: <UserList size={26} weight="duotone"/>, color: "#7A8A6A", bg: "#E5EBE1" },
          { id: "intake", label: "Intake", desc: "Pre/Post intake list (Excel/CSV)", icon: <FileXls size={26} weight="duotone"/>, color: "#D4A64A", bg: "#FAF0D1" },
          { id: "schedule", label: "Schedule (xlsx/csv)", desc: "Therapists' Schedule Excel or CSV file", icon: <CalendarBlank size={26} weight="duotone"/>, color: "#8B3A55", bg: "#FCE0E8" },
          { id: "historical", label: "Historical", desc: `${historicalWeeks.length} weeks ready from Base44`, icon: <CalendarBlank size={26} weight="duotone"/>, color: "#375568", bg: "#EAF0F3" },
        ].map(x => (
          <button key={x.id} onClick={() => { setType(x.id); setResult(null); if (x.id === "schedule") setClearExisting(true); }}
                  className={`card p-5 text-left transition-all ${type === x.id ? "ring-2 ring-[#7A8A6A]" : ""}`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{background: x.bg, color: x.color}}>{x.icon}</div>
            <div className="font-bold" style={{color: "#2C3625"}}>{x.label}</div>
            <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>{x.desc}</div>
          </button>
        ))}
      </div>

      <div className="card p-6">
        {type === "schedule" ? (
          <div>
            <div className="font-bold mb-3" style={{color: "#2C3625"}}>Upload Therapists' Schedule (.xlsx or .csv)</div>
            <div className="text-xs mb-4 p-3 rounded-xl border border-[#E2DDD4]" style={{background: "#FAFAF7", color: "#5C6853"}}>
              The file must contain therapist names (e.g. "Ms. Maha") followed by Sunday-Thursday rows with 10 time-slot columns.
              Cell content like <code>SS | Sulaiman</code>, <code>HS | Omar</code>, <code>Meeting w/ Walaa</code>, <code>AVC</code>, <code>Supervision W/ Khalid</code> will be auto-parsed.
              Merged cells in Excel (1h vs 2h clients) are preserved — a client merged across two time columns imports as a 2-hour session; optional times in parentheses like <code>HS | Saleh (11:30-1:30)</code> import as 1.5h/2.5h.
            </div>
            <label className="label">Target Week Start (Sunday — e.g. 2026-05-31)</label>
            <input type="date" className="input mb-3" value={scheduleWeekStart} onChange={e => setScheduleWeekStart(e.target.value)}/>
            <label className="btn btn-outline w-full justify-start cursor-pointer mb-3">
              <UploadSimple size={18}/> {file ? file.name : "Choose Excel file..."}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files[0])} className="hidden"/>
            </label>
            {availableSheets.length > 0 && (
              <div className="mb-3">
                <label className="label">Sheet to import (file has multiple sheets)</label>
                <select data-testid="sheet-select" className="input" value={sheetName} onChange={e => setSheetName(e.target.value)}>
                  {availableSheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="text-xs mt-1" style={{color: "#8B6F47"}}>
                  ⚠ Only the selected sheet will be imported. Pick the sheet matching your target week.
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
              <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)}/>
              <span style={{color: "#5C6853"}}>Clear existing cells for this week first (recommended)</span>
            </label>
            <button onClick={upload} disabled={!file || loading} className="btn btn-primary w-full disabled:opacity-50 mb-4">
              {loading ? <span className="spinner"/> : <><UploadSimple size={16}/> Import Schedule</>}
            </button>
            <div className="border-t border-[#E2DDD4] pt-4">
              <div className="font-bold mb-2 text-sm" style={{color: "#2C3625"}}>Or import directly from Google Sheets</div>
              <div className="text-xs mb-3" style={{color: "#5C6853"}}>
                Paste a shared Google Sheets link — merged cells (1h / 2h clients) are read from the file automatically.
              </div>
              <input
                type="url"
                className="input mb-3 text-sm"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={googleUrl}
                onChange={e => setGoogleUrl(e.target.value)}
              />
              <button onClick={importFromGoogle} disabled={!googleUrl.trim() || loading} className="btn btn-secondary w-full disabled:opacity-50">
                {loading ? <span className="spinner"/> : <><Download size={16}/> Import from Google Sheets</>}
              </button>
            </div>
          </div>
        ) : type !== "historical" ? (
          <div>
            <div className="font-bold mb-3" style={{color: "#2C3625"}}>Upload {type === "clients" ? "Clients" : "Intake"} File</div>
            <div className="text-sm mb-3" style={{color: "#5C6853"}}>
              Accepted formats: <code className="px-1.5 py-0.5 bg-[#F0E9D8] rounded">.xlsx</code> <code className="px-1.5 py-0.5 bg-[#F0E9D8] rounded">.csv</code>
            </div>
            <div className="text-xs mb-4 p-3 rounded-xl border border-[#E2DDD4]" style={{background: "#FAFAF7", color: "#5C6853"}}>
              <strong>Required column for {type}:</strong> {type === "clients" ? "name (required), file_no, package_hours, supervisor, parent_name, phone, color, age, notes, main_therapist (matches Ms. Name)" : "Child Name (or name / child_name), phone, service, district, diagnosis, intake_type (pre/post). Header row is auto-detected."}
              {type === "intake" && (
                <div className="mt-2 p-2 rounded-lg" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
                  Re-uploading the same file updates existing cases by name — it should not create duplicates. Intake is separate from Clients.
                </div>
              )}
              {type === "clients" && (
                <div className="mt-2 p-2 rounded-lg border" style={{ background: "#FFFBF0", borderColor: "#E8C572", color: "#6B5218" }}>
                  <div className="font-bold mb-1">Make portal match Excel count</div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={replaceMissingClients} onChange={e => setReplaceMissingClients(e.target.checked)} />
                    <span>Soft-delete clients that are not present in this uploaded file (safe — can be restored)</span>
                  </label>
                </div>
              )}
            </div>
            <label className="btn btn-outline w-full justify-start cursor-pointer mb-3">
              <UploadSimple size={18}/> {file ? file.name : "Choose Excel or CSV..."}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files[0])} className="hidden"/>
            </label>
            <button onClick={upload} disabled={!file || loading} className="btn btn-primary w-full disabled:opacity-50">
              {loading ? <span className="spinner"/> : <><UploadSimple size={16}/> Import</>}
            </button>
          </div>
        ) : (
          <div>
            <div className="font-bold mb-3" style={{color: "#2C3625"}}>Load Historical Schedules</div>
            <div className="text-sm mb-3" style={{color: "#5C6853"}}>
              {historicalWeeks.length === 0 ? "No historical data available." : `${historicalWeeks.length} weeks of past schedules from Base44 are ready to import:`}
            </div>
            {historicalWeeks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 max-h-32 overflow-y-auto p-3 bg-[#FAFAF7] rounded-xl border border-[#E2DDD4]">
                {historicalWeeks.map(w => <span key={w} className="pill bg-white border border-[#E2DDD4] text-xs">{w}</span>)}
              </div>
            )}
            <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
              <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)}/>
              <span style={{color: "#5C6853"}}>Clear existing schedule first (recommended for clean import)</span>
            </label>
            <button onClick={loadHistorical} disabled={loading || historicalWeeks.length === 0} className="btn btn-primary w-full disabled:opacity-50">
              {loading ? <span className="spinner"/> : <><Download size={16}/> Load {historicalWeeks.length} Weeks</>}
            </button>
          </div>
        )}

        {result && (
          <div className={`mt-4 p-3 rounded-xl border flex items-start gap-2 ${result.ok ? "bg-[#E5EBE1] border-[#B4C2A9]" : "bg-[#F8EBE7] border-[#ECA6A6]"}`}>
            {result.ok ? <CheckCircle size={18} weight="fill" style={{color: "#3D4F35"}}/> : <X size={18} style={{color: "#8A3F27"}}/>}
            <div className="text-sm font-bold" style={{color: result.ok ? "#3D4F35" : "#8A3F27"}}>{result.msg}</div>
          </div>
        )}
      </div>

      {type === "intake" && (
        <>
        <div className="card p-6 mt-5 border-2" style={{ borderColor: "#7A8A6A" }}>
          <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Sync Waiting List from Google Sheet</div>
          <div className="text-sm mb-4" style={{ color: "#5C6853" }}>
            Pulls Pre-Intake, Post-Intake, and School Waiting tabs from the official sheet.
            Stale names from previous syncs are removed. This is the correct way to update the waiting list — not the Excel upload above.
          </div>
          <button type="button" onClick={syncWaitingFromGoogle} disabled={waitingSyncing} className="btn btn-primary text-sm disabled:opacity-50">
            {waitingSyncing ? <span className="spinner" /> : <><ArrowsClockwise size={16} /> Sync Waiting List</>}
          </button>
          {waitingSyncResult && (
            <div className="text-xs p-3 rounded-xl mt-3" style={{ background: waitingSyncResult.ok === false ? "#F8EBE7" : "#E5EBE1", color: "#3D4F35" }}>
              {waitingSyncResult.msg}
            </div>
          )}
        </div>
        <div className="card p-6 mt-5 border-2" style={{ borderColor: "#C4D4B8" }}>
          <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Clean Duplicate Intake Records</div>
          <div className="text-sm mb-4" style={{ color: "#5C6853" }}>
            If the intake list grew after repeated imports, this removes duplicates (same child name + pre/post type) and keeps one record each.
          </div>
          <button type="button" onClick={dedupeIntake} disabled={deduping} className="btn btn-secondary text-sm">
            {deduping ? <span className="spinner" /> : "Remove Duplicates"}
          </button>
          {dedupeResult && (
            <div className="text-xs p-3 rounded-xl mt-3" style={{ background: dedupeResult.ok === false ? "#F8EBE7" : "#E5EBE1", color: "#3D4F35" }}>
              {dedupeResult.message}
            </div>
          )}
        </div>
        <div className="card p-6 mt-5 border-2" style={{ borderColor: "#C4D4B8" }}>
          <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Restore Waiting Lists</div>
          <div className="text-sm mb-4" style={{ color: "#5C6853" }}>
            Re-sync <strong>Pre-Intake</strong>, <strong>Post-Intake</strong>, and <strong>School Waiting</strong> from the official Google Sheet. Removes stale names and keeps school queue separate.
          </div>
          <button type="button" onClick={fixSchoolIntake} disabled={fixingSchool} className="btn btn-secondary text-sm">
            {fixingSchool ? <span className="spinner" /> : "Restore from Sheet"}
          </button>
          {fixSchoolResult && (
            <div className="text-xs p-3 rounded-xl mt-3" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
              {fixSchoolResult.message
                || (fixSchoolResult.pre_count != null
                  ? `Pre: ${fixSchoolResult.pre_count} · Post: ${fixSchoolResult.post_count} · School: ${fixSchoolResult.school_count}`
                  : JSON.stringify(fixSchoolResult))}
            </div>
          )}
        </div>
        </>
      )}

      <div className="card p-6 mt-5 border-2" style={{ borderColor: "#B4C2A9" }}>
        <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Sync Active Clients — Drive (phones, summaries, attendance)</div>
        <div className="text-sm mb-4" style={{ color: "#5C6853" }}>
          Reads each child folder in Active Clients Drive: parent phone from Intake file, Case Summary links,
          and Attendance Sheet import when available. Folders without an attendance sheet still get phone + links updated.
        </div>
        <label className="label">Active Clients folder URL</label>
        <input
          type="url"
          className="input mb-3 text-sm"
          value={activeClientsFolderUrl}
          onChange={e => setActiveClientsFolderUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
        />
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => syncActiveClientsFromDrive(true)} disabled={driveSyncing}
            className="btn btn-outline text-sm disabled:opacity-50">
            {driveSyncing ? <span className="spinner" /> : "Preview (dry run)"}
          </button>
          <button type="button" onClick={() => syncActiveClientsFromDrive(false)} disabled={driveSyncing}
            className="btn btn-primary text-sm disabled:opacity-50">
            {driveSyncing ? <span className="spinner" /> : <><Download size={16} /> Sync all from Drive</>}
          </button>
        </div>
        {driveSyncResult && (
          <div className="text-xs p-3 rounded-xl space-y-2" style={{ background: "#E5EBE1", color: "#3D4F35" }}>
            {driveSyncResult.message && <div>{driveSyncResult.message}</div>}
            {driveSyncResult.synced != null && (
              <div>
                <strong>{driveSyncResult.synced}</strong> attendance synced
                {driveSyncResult.meta_synced != null && <> · <strong>{driveSyncResult.meta_synced}</strong> phones/links only</>}
                {" "}· {driveSyncResult.skipped} skipped · {driveSyncResult.errors} errors
                {" "}({driveSyncResult.total_folders} folders)
              </div>
            )}
            {Array.isArray(driveSyncResult.results) && driveSyncResult.results.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
                {driveSyncResult.results.map((r) => (
                  <div key={r.file_no} className="flex justify-between gap-2 border-b border-[#D4DEC8] py-1">
                    <span>{r.file_no} {r.client_name || ""}</span>
                    <span className="font-semibold">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-6 mt-5 border-2" style={{ borderColor: "#C9BB91" }}>
        <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Restore Official Clients (25)</div>
        <div className="text-sm mb-4" style={{ color: "#5C6853" }}>
          Removes clients added by mistake (e.g. from a bad import) and restores the known client list with file numbers, therapists, and locations.
        </div>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <input className="input text-sm max-w-[140px]" placeholder="RESTORE" value={restoreConfirm}
            onChange={e => setRestoreConfirm(e.target.value)} />
          <button type="button" onClick={restoreOfficialClients} disabled={loading || restoreConfirm !== "RESTORE"}
            className="btn btn-gold text-sm disabled:opacity-50">
            Restore Official Clients
          </button>
        </div>
        {restoreResult && (
          <div className="text-xs p-3 rounded-xl" style={{ background: restoreResult.ok !== false ? "#E5EBE1" : "#F8EBE7", color: "#3D4F35" }}>
            {restoreResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
