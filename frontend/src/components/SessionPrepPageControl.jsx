import { useEffect, useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_SESSION_PREP_PAGE, mergeSessionPrepPageSettings } from "../pageSettings";

/**
 * Self-serve control panel for Session Preparation.
 */
export default function SessionPrepPageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergeSessionPrepPageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/session-prep");
      setSettings(mergeSessionPrepPageSettings(data));
    } catch {
      setSettings(mergeSessionPrepPageSettings(null));
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
      const { data } = await api.put("/admin/page-settings/session-prep", { settings });
      const merged = mergeSessionPrepPageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/session-prep");
      setMessage("Saved. Session Preparation will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Session Preparation page settings to defaults?")) return;
    setSettings(mergeSessionPrepPageSettings(DEFAULT_SESSION_PREP_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="session-prep-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Edit Session Preparation titles, filter tabs, and buttons. Logging rules stay in the app.
      </p>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Page header</div>
        {field("page_eyebrow", "Eyebrow")}
        {field("page_title", "Title")}
        {field("page_subtitle", "Subtitle", { textarea: true })}
        {field("roster_heading", "Roster heading")}
        {field("roster_desc", "Roster description", { textarea: true })}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Filter tabs (admin)</div>
        <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_admin_filter_tabs !== false} onChange={(e) => patch({ show_admin_filter_tabs: e.target.checked })} />
          Show filter tabs for admins
        </label>
        {(settings.filter_tabs || []).map((tab, i) => (
          <div key={tab.id} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono w-16" style={{ color: "#8B9E7A" }}>{tab.id}</span>
            <input
              className="input text-sm flex-1 min-w-[120px]"
              value={tab.label}
              onChange={(e) => {
                const filter_tabs = settings.filter_tabs.map((t, j) => (j === i ? { ...t, label: e.target.value } : t));
                patch({ filter_tabs });
              }}
            />
            <label className="flex items-center gap-1 text-xs shrink-0">
              <input
                type="checkbox"
                checked={tab.enabled !== false}
                onChange={(e) => {
                  const filter_tabs = settings.filter_tabs.map((t, j) => (j === i ? { ...t, enabled: e.target.checked } : t));
                  patch({ filter_tabs });
                }}
              />
              Show
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Stat labels</div>
        {field("stat_total_label", "Total (admin)")}
        {field("stat_urgent_label", "Urgent")}
        {field("stat_warning_label", "Warning")}
        {field("stat_safe_label", "Safe")}
        {field("stat_clients_label", "Clients (therapist view)")}
        {field("stat_on_track_label", "On track (therapist view)")}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Buttons & search</div>
        {field("search_placeholder", "Search placeholder")}
        {field("log_session_label", "Log Session button")}
        {field("add_client_label", "Add Client button")}
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_add_client_button !== false} onChange={(e) => patch({ show_add_client_button: e.target.checked })} />
          Show Add Client (admins)
        </label>
        {field("select_client_title", "Select-client modal title")}
        {field("select_client_subtitle", "Select-client modal subtitle")}
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-session-prep-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
