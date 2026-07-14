import { useEffect, useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_SCHEDULE_PAGE, mergeSchedulePageSettings } from "../pageSettings";

/**
 * Self-serve control panel for the Weekly Schedule page.
 */
export default function SchedulePageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergeSchedulePageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/schedule");
      setSettings(mergeSchedulePageSettings(data));
    } catch {
      setSettings(mergeSchedulePageSettings(null));
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
      const { data } = await api.put("/admin/page-settings/schedule", { settings });
      const merged = mergeSchedulePageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/schedule");
      setMessage("Saved. Schedule will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Schedule page settings to defaults?")) return;
    setSettings(mergeSchedulePageSettings(DEFAULT_SCHEDULE_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="schedule-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Edit Schedule wording, view tabs, banners, and which toolbar actions show. Grid logic stays in code.
      </p>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Page header & tabs</div>
        {field("page_title", "Title")}
        {field("sheet_tab_label", "Team schedule tab")}
        {field("blocks_tab_label", "My schedule tab")}
        {field("admin_subtitle", "Admin subtitle", { textarea: true })}
        {field("therapist_blocks_subtitle", "Therapist (My schedule) subtitle", { textarea: true })}
        {field("team_sheet_subtitle", "Team schedule subtitle", { textarea: true })}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Panel headings</div>
        {field("sheet_panel_title", "Team table title")}
        {field("sheet_panel_desc", "Team table description", { textarea: true })}
        {field("blocks_panel_title", "Blocks title")}
        {field("blocks_panel_desc", "Blocks description", { textarea: true })}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Badges & banners</div>
        {field("draft_badge_label", "Draft badge")}
        {field("published_badge_label", "Published badge")}
        {field("leave_banner_label", "Leave day banner")}
        {field("absent_banner_label", "Absent day banner")}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Legend</div>
        <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_legend !== false} onChange={(e) => patch({ show_legend: e.target.checked })} />
          Show legend
        </label>
        {field("legend_hint", "Legend hint", { textarea: true })}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Toolbar actions</div>
        {field("search_placeholder", "Search placeholder")}
        {field("sync_prep_label", "Sync prep button")}
        {field("save_draft_label", "Save as Draft")}
        {field("publish_week_label", "Publish Week")}
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_sync_prep !== false} onChange={(e) => patch({ show_sync_prep: e.target.checked })} />
          Show Sync prep
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_parent_whatsapp !== false} onChange={(e) => patch({ show_parent_whatsapp: e.target.checked })} />
          Show Parent WhatsApp messages
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-schedule-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
