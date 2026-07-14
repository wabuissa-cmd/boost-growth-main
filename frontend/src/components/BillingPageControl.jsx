import { useEffect, useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_BILLING_PAGE, mergeBillingPageSettings } from "../pageSettings";

/**
 * Self-serve control panel for Billing & Payments (Client Invoices).
 */
export default function BillingPageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergeBillingPageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/billing");
      setSettings(mergeBillingPageSettings(data));
    } catch {
      setSettings(mergeBillingPageSettings(null));
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
      const { data } = await api.put("/admin/page-settings/billing", { settings });
      const merged = mergeBillingPageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/billing");
      setMessage("Saved. Billing will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Billing page settings to defaults?")) return;
    setSettings(mergeBillingPageSettings(DEFAULT_BILLING_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="billing-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Edit Billing labels and which alert panels show. Package logic stays in the app; this panel is for wording and visibility.
      </p>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Page header</div>
        {field("page_title", "Title")}
        {field("page_subtitle", "Subtitle", { textarea: true })}
        {field("overview_tab_label", "Overview tab label")}
        {field("calendar_tab_label", "Calendar tab label")}
        {field("directory_heading", "Client list heading")}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Intro & reminders</div>
        {field("intro_caption", "Intro text", { textarea: true, rows: 3 })}
        {field("send_reminders_label", "Send reminders button")}
        <label className="flex items-center gap-2 text-sm" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_send_reminders !== false} onChange={(e) => patch({ show_send_reminders: e.target.checked })} />
          Show Send reminders button
        </label>
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Package ending soon</div>
        <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_ending_soon !== false} onChange={(e) => patch({ show_ending_soon: e.target.checked })} />
          Show this panel
        </label>
        {field("ending_soon_title", "Panel title")}
        {field("ending_soon_empty", "Empty state text")}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Payment follow-up</div>
        <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#2C3625" }}>
          <input type="checkbox" checked={settings.show_payment_followup !== false} onChange={(e) => patch({ show_payment_followup: e.target.checked })} />
          Show this panel
        </label>
        {field("payment_followup_title", "Panel title")}
        {field("payment_followup_empty", "Empty state text")}
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-billing-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
