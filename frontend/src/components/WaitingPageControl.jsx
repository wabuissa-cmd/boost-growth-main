import { useEffect, useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_WAITING_PAGE, mergeWaitingPageSettings } from "../pageSettings";

/**
 * Self-serve control panel for Waiting (Intake + School).
 */
export default function WaitingPageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergeWaitingPageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/waiting");
      setSettings(mergeWaitingPageSettings(data));
    } catch {
      setSettings(mergeWaitingPageSettings(null));
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
      const { data } = await api.put("/admin/page-settings/waiting", { settings });
      const merged = mergeWaitingPageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/waiting");
      setMessage("Saved. Waiting will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Waiting page settings to defaults?")) return;
    setSettings(mergeWaitingPageSettings(DEFAULT_WAITING_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="waiting-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Edit Waiting titles, mode labels, and queue headings for Intake and School lists.
      </p>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Intake Waiting</div>
        {field("intake_title", "Title")}
        {field("intake_subtitle", "Subtitle", { textarea: true })}
        {field("pre_tab_label", "Pre-Intake tab")}
        {field("post_tab_label", "Post-Intake tab")}
        {field("intake_queue_label", "Pre-Intake queue heading")}
        {field("post_queue_label", "Post-Intake queue heading")}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>School Waiting</div>
        {field("school_title", "Title")}
        {field("school_subtitle", "Subtitle", { textarea: true })}
        {field("school_queue_label", "Queue heading")}
        {field("school_list_label", "List caption")}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Mode switch & actions</div>
        {field("mode_intake_label", "Intake mode pill")}
        {field("mode_school_label", "School mode pill")}
        {field("sync_label", "Sync button")}
        {field("add_pre_label", "Add Pre-Intake button")}
        {field("add_post_label", "Add Post-Intake button")}
        {field("add_school_label", "Add School case button")}
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_sync_button !== false} onChange={(e) => patch({ show_sync_button: e.target.checked })} />
          Show Sync from Sheet
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_add_buttons !== false} onChange={(e) => patch({ show_add_buttons: e.target.checked })} />
          Show Add buttons
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-waiting-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
