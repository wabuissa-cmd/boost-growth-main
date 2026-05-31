import { useEffect, useState } from "react";
import api, { startOfWeek, toISODate } from "../api";
import { UploadSimple, Download, CheckCircle, X, FileXls, CalendarBlank, UserList } from "@phosphor-icons/react";

export default function ImportPage() {
  const [type, setType] = useState("clients"); // clients, intake, historical, schedule
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historicalWeeks, setHistoricalWeeks] = useState([]);
  const [clearExisting, setClearExisting] = useState(false);
  const [scheduleWeekStart, setScheduleWeekStart] = useState(toISODate(startOfWeek(new Date())));
  const [sheetName, setSheetName] = useState("");
  const [availableSheets, setAvailableSheets] = useState([]);

  // When schedule file is picked, list its sheet names so user can choose
  useEffect(() => {
    if (type !== "schedule" || !file) { setAvailableSheets([]); return; }
    (async () => {
      try {
        const fd = new FormData(); fd.append("file", file);
        const { data } = await api.post("/import/list-sheets", fd, { headers: {"Content-Type": "multipart/form-data"}});
        setAvailableSheets(data.sheets || []);
        if (data.sheets?.length) setSheetName(data.sheets[0]);
      } catch { setAvailableSheets([]); }
    })();
  }, [file, type]);

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
      const { data } = await api.post(endpoint, fd, { headers: {"Content-Type": "multipart/form-data"}});
      const msg = type === "schedule"
        ? `${data.cells_inserted} cells inserted for week ${data.week_start}`
        : type === "intake"
        ? (data.message || `${data.updated || 0} updated, ${data.created || 0} added, ${data.skipped || 0} skipped`)
        : `${data.created} created, ${data.skipped} skipped`;
      setResult({ ok: true, msg });
      setFile(null);
    } catch (e) { setResult({ ok: false, msg: e.response?.data?.detail || e.message }); }
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

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Import Data</h1>
        <div className="text-sm" style={{color: "#5C6853"}}>Bulk-import clients, intake records, or historical schedules</div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { id: "clients", label: "Clients", desc: "Excel/CSV with name, file_no, package_hours, etc.", icon: <UserList size={26} weight="duotone"/>, color: "#7A8A6A", bg: "#E5EBE1" },
          { id: "intake", label: "Intake", desc: "Pre/Post intake list (Excel/CSV)", icon: <FileXls size={26} weight="duotone"/>, color: "#D4A64A", bg: "#FAF0D1" },
          { id: "schedule", label: "Schedule (xlsx/csv)", desc: "Therapists' Schedule Excel or CSV file", icon: <CalendarBlank size={26} weight="duotone"/>, color: "#8B3A55", bg: "#FCE0E8" },
          { id: "historical", label: "Historical", desc: `${historicalWeeks.length} weeks ready from Base44`, icon: <CalendarBlank size={26} weight="duotone"/>, color: "#375568", bg: "#EAF0F3" },
        ].map(x => (
          <button key={x.id} onClick={() => { setType(x.id); setResult(null); }}
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
            <div className="text-xs mb-4 p-3 rounded-xl border border-[#E8E4DE]" style={{background: "#FAFAF7", color: "#5C6853"}}>
              The file must contain therapist names (e.g. "Ms. Maha") followed by Sunday-Thursday rows with 10 time-slot columns.
              Cell content like <code>SS | Sulaiman</code>, <code>HS | Omar</code>, <code>Meeting w/ Walaa</code>, <code>AVC</code>, <code>Supervision W/ Khalid</code> will be auto-parsed.
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
              <span style={{color: "#5C6853"}}>Clear existing cells for this week first</span>
            </label>
            <button onClick={upload} disabled={!file || loading} className="btn btn-primary w-full disabled:opacity-50">
              {loading ? <span className="spinner"/> : <><UploadSimple size={16}/> Import Schedule</>}
            </button>
          </div>
        ) : type !== "historical" ? (
          <div>
            <div className="font-bold mb-3" style={{color: "#2C3625"}}>Upload {type === "clients" ? "Clients" : "Intake"} File</div>
            <div className="text-sm mb-3" style={{color: "#5C6853"}}>
              Accepted formats: <code className="px-1.5 py-0.5 bg-[#F0E9D8] rounded">.xlsx</code> <code className="px-1.5 py-0.5 bg-[#F0E9D8] rounded">.csv</code>
            </div>
            <div className="text-xs mb-4 p-3 rounded-xl border border-[#E8E4DE]" style={{background: "#FAFAF7", color: "#5C6853"}}>
              <strong>Required column for {type}:</strong> {type === "clients" ? "name (required), file_no, package_hours, supervisor, parent_name, phone, color, age, notes, main_therapist (matches Ms. Name)" : "child_name (required), parent_name, phone, intake_type (pre/post), status, intake_date, age, notes"}
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
              <div className="flex flex-wrap gap-1.5 mb-4 max-h-32 overflow-y-auto p-3 bg-[#FAFAF7] rounded-xl border border-[#E8E4DE]">
                {historicalWeeks.map(w => <span key={w} className="pill bg-white border border-[#E8E4DE] text-xs">{w}</span>)}
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
    </div>
  );
}
