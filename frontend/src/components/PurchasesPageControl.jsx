import { useEffect, useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_PURCHASES_PAGE, mergePurchasesPageSettings } from "../pageSettings";

/**
 * Self-serve control panel for Employees' Purchases.
 */
export default function PurchasesPageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergePurchasesPageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/purchases");
      setSettings(mergePurchasesPageSettings(data));
    } catch {
      setSettings(mergePurchasesPageSettings(null));
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
      const { data } = await api.put("/admin/page-settings/purchases", { settings });
      const merged = mergePurchasesPageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/purchases");
      setMessage("Saved. Purchases will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Purchases page settings to defaults?")) return;
    setSettings(mergePurchasesPageSettings(DEFAULT_PURCHASES_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="purchases-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Edit Purchases titles, tabs, and button labels. Approval workflow stays in the app.
      </p>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Page header</div>
        {field("page_title", "Title")}
        {field("page_subtitle", "Subtitle", { textarea: true })}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Main tabs</div>
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
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Labels & actions</div>
        {field("list_heading", "List heading")}
        {field("pending_strip_label", "Pending strip label")}
        {field("search_placeholder", "Search placeholder")}
        {field("empty_list_message", "Empty list message")}
        {field("log_purchase_label", "Log Purchase button")}
        {field("sync_sheet_label", "Sync from Sheet button")}
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_log_purchase !== false} onChange={(e) => patch({ show_log_purchase: e.target.checked })} />
          Show Log Purchase
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_sync_sheet !== false} onChange={(e) => patch({ show_sync_sheet: e.target.checked })} />
          Show Sync from Sheet
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-purchases-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
