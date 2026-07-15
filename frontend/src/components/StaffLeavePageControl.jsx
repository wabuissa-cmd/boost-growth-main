import { useEffect, useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_STAFF_LEAVE_PAGE, mergeStaffLeavePageSettings } from "../pageSettings";

/**
 * Self-serve control panel for Staff & Leave.
 */
export default function StaffLeavePageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergeStaffLeavePageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/staff-leave");
      setSettings(mergeStaffLeavePageSettings(data));
    } catch {
      setSettings(mergeStaffLeavePageSettings(null));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const patch = (partial) => setSettings((s) => ({ ...s, ...partial }));

  const field = (key, label, opts = {}) => (
    <div key={key}>
      <label className="label">{label}</label>
      {opts.textarea ? (
        <textarea className="input text-sm" rows={opts.rows || 2} value={settings[key] || ""} onChange={(e) => patch({ [key]: e.target.value })} />
      ) : (
        <input className="input text-sm mb-2" value={settings[key] || ""} onChange={(e) => patch({ [key]: e.target.value })} />
      )}
    </div>
  );

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { data } = await api.put("/admin/page-settings/staff-leave", { settings });
      const merged = mergeStaffLeavePageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/staff-leave");
      setMessage("Saved. Staff & Leave will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Staff & Leave page settings to defaults?")) return;
    setSettings(mergeStaffLeavePageSettings(DEFAULT_STAFF_LEAVE_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="staff-leave-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Edit Staff & Leave titles, tabs, and common action labels. Approval workflows stay in the app.
      </p>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Page header</div>
        {field("page_title", "Title")}
        {field("page_subtitle", "Subtitle", { textarea: true })}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Main tabs</div>
        <p className="text-xs m-0 mb-1" style={{ color: "#5C6853" }}>Hide is still limited by each user’s permissions.</p>
        {(settings.tabs || []).map((tab, i) => (
          <div key={tab.id} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono w-20" style={{ color: "#8B9E7A" }}>{tab.id}</span>
            <input
              className="input text-sm flex-1 min-w-[120px]"
              value={tab.label}
              onChange={(e) => {
                const tabs = settings.tabs.map((t, j) => (j === i ? { ...t, label: e.target.value } : t));
                patch({ tabs });
              }}
            />
            <label className="flex items-center gap-1 text-xs shrink-0">
              <input
                type="checkbox"
                checked={tab.enabled !== false}
                onChange={(e) => {
                  const tabs = settings.tabs.map((t, j) => (j === i ? { ...t, enabled: e.target.checked } : t));
                  patch({ tabs });
                }}
              />
              Show
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Leave queue labels</div>
        {field("active_requests_label", "Active requests tab")}
        {field("history_label", "History tab")}
        {field("search_placeholder", "Search placeholder")}
        {field("mark_absence_label", "Mark Absence button")}
        {field("new_request_label", "New Request (reviewer)")}
        {field("request_leave_label", "Request Leave (personal)")}
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_mark_absence !== false} onChange={(e) => patch({ show_mark_absence: e.target.checked })} />
          Show Mark Absence
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_new_request_button !== false} onChange={(e) => patch({ show_new_request_button: e.target.checked })} />
          Show New / Request Leave button
        </label>
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Other requests tab</div>
        {field("other_heading", "Section heading")}
        {field("other_desc", "Section description", { textarea: true })}
        {field("overview_label", "Overview label")}
        {field("stat_total_label", "Total")}
        {field("stat_pending_label", "Pending")}
        {field("stat_in_progress_label", "In progress")}
        {field("stat_done_label", "Done")}
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-staff-leave-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
