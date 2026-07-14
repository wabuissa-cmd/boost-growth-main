import { useEffect, useState } from "react";
import { Plus, Minus, ArrowUp, ArrowDown, FloppyDisk } from "@phosphor-icons/react";
import api from "../api";
import { invalidateCache } from "../dataCache";
import { DEFAULT_CLIENT_INFO_PAGE, mergeClientInfoPageSettings } from "../pageSettings";

function CatalogEditor({ title, hint, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some((x) => String(x).toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
      <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{title}</div>
      {hint && <p className="text-xs m-0" style={{ color: "#5C6853" }}>{hint}</p>}
      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-primary text-sm" onClick={add} disabled={!draft.trim()}>
          <Plus size={16} />
        </button>
      </div>
      <ul className="space-y-1 max-h-40 overflow-y-auto m-0 p-0 list-none">
        {items.map((item) => (
          <li key={item} className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded-lg" style={{ background: "#fff" }}>
            <span>{item}</span>
            <button
              type="button"
              className="btn btn-ghost p-1 text-red-700"
              title="Remove"
              onClick={() => onChange(items.filter((x) => x !== item))}
            >
              <Minus size={14} />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs px-1" style={{ color: "#8B9E7A" }}>Empty — add items with +</li>
        )}
      </ul>
    </div>
  );
}

function moveItem(list, index, dir) {
  const next = [...list];
  const j = index + dir;
  if (j < 0 || j >= next.length) return list;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/**
 * Self-serve control panel for the Client Info page.
 * Used from Admin → Pages and from Client Info (gear) for ops/admin.
 */
export default function ClientInfoPageControl({ onSaved, compact = false }) {
  const [settings, setSettings] = useState(() => mergeClientInfoPageSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [svcDraft, setSvcDraft] = useState({ value: "", label: "" });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/page-settings/client-info");
      setSettings(mergeClientInfoPageSettings(data));
    } catch {
      setSettings(mergeClientInfoPageSettings(null));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const patch = (partial) => setSettings((s) => ({ ...s, ...partial }));

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { data } = await api.put("/admin/page-settings/client-info", { settings });
      const merged = mergeClientInfoPageSettings(data);
      setSettings(merged);
      invalidateCache("/page-settings/client-info");
      setMessage("Saved. Client Info will use these settings.");
      onSaved?.(merged);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset Client Info page settings to defaults?")) return;
    setSettings(mergeClientInfoPageSettings(DEFAULT_CLIENT_INFO_PAGE));
  };

  if (loading) {
    return <div className="py-8 flex justify-center"><span className="spinner" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "pt-2"}`} data-testid="client-info-page-control">
      <p className="text-xs m-0" style={{ color: "#5C6853" }}>
        Change labels, tabs, and dropdown lists for Client Info without code. Bigger layout redesigns still need a developer.
      </p>

      <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Page header</div>
        <label className="label">Badge</label>
        <input className="input text-sm mb-2" value={settings.page_badge} onChange={(e) => patch({ page_badge: e.target.value })} />
        <label className="label">Title</label>
        <input className="input text-sm mb-2" value={settings.page_title} onChange={(e) => patch({ page_title: e.target.value })} />
        <label className="label">Subtitle</label>
        <textarea className="input text-sm" rows={2} value={settings.page_subtitle} onChange={(e) => patch({ page_subtitle: e.target.value })} />
        <label className="label">Directory heading (left list)</label>
        <input className="input text-sm mb-2" value={settings.directory_heading} onChange={(e) => patch({ directory_heading: e.target.value })} />
        <label className="label">Active list heading</label>
        <input className="input text-sm mb-2" value={settings.active_list_heading} onChange={(e) => patch({ active_list_heading: e.target.value })} />
        <label className="label">Inactive list heading</label>
        <input className="input text-sm" value={settings.inactive_list_heading} onChange={(e) => patch({ inactive_list_heading: e.target.value })} />
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Status tabs (Active / Inactive)</div>
        {settings.status_tabs.map((tab, i) => (
          <div key={tab.id} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono w-16" style={{ color: "#8B9E7A" }}>{tab.id}</span>
            <input
              className="input text-sm flex-1 min-w-[120px]"
              value={tab.label}
              onChange={(e) => {
                const status_tabs = settings.status_tabs.map((t, j) => (j === i ? { ...t, label: e.target.value } : t));
                patch({ status_tabs });
              }}
            />
            <label className="flex items-center gap-1 text-xs shrink-0">
              <input
                type="checkbox"
                checked={tab.enabled !== false}
                onChange={(e) => {
                  const status_tabs = settings.status_tabs.map((t, j) => (j === i ? { ...t, enabled: e.target.checked } : t));
                  patch({ status_tabs });
                }}
              />
              Show
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Profile detail tabs</div>
        <p className="text-xs m-0" style={{ color: "#5C6853" }}>Reorder with arrows. Hide a tab without deleting it.</p>
        {settings.detail_tabs.map((tab, i) => (
          <div key={tab.id} className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5">
              <button type="button" className="btn btn-ghost p-1" title="Move up" onClick={() => patch({ detail_tabs: moveItem(settings.detail_tabs, i, -1) })}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className="btn btn-ghost p-1" title="Move down" onClick={() => patch({ detail_tabs: moveItem(settings.detail_tabs, i, 1) })}>
                <ArrowDown size={14} />
              </button>
            </div>
            <span className="text-xs font-mono w-16" style={{ color: "#8B9E7A" }}>{tab.id}</span>
            <input
              className="input text-sm flex-1 min-w-[120px]"
              value={tab.label}
              onChange={(e) => {
                const detail_tabs = settings.detail_tabs.map((t, j) => (j === i ? { ...t, label: e.target.value } : t));
                patch({ detail_tabs });
              }}
            />
            <label className="flex items-center gap-1 text-xs shrink-0">
              <input
                type="checkbox"
                checked={tab.enabled !== false}
                onChange={(e) => {
                  const detail_tabs = settings.detail_tabs.map((t, j) => (j === i ? { ...t, enabled: e.target.checked } : t));
                  patch({ detail_tabs });
                }}
              />
              Show
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Service types (edit form)</div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input text-sm w-24"
            placeholder="Code"
            value={svcDraft.value}
            onChange={(e) => setSvcDraft({ ...svcDraft, value: e.target.value })}
          />
          <input
            className="input text-sm flex-1 min-w-[140px]"
            placeholder="Label"
            value={svcDraft.label}
            onChange={(e) => setSvcDraft({ ...svcDraft, label: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={!svcDraft.value.trim()}
            onClick={() => {
              const value = svcDraft.value.trim();
              const label = (svcDraft.label || value).trim();
              if (settings.service_types.some((s) => s.value.toLowerCase() === value.toLowerCase())) {
                setSvcDraft({ value: "", label: "" });
                return;
              }
              patch({ service_types: [...settings.service_types, { value, label }] });
              setSvcDraft({ value: "", label: "" });
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <ul className="space-y-1 m-0 p-0 list-none">
          {settings.service_types.map((s) => (
            <li key={s.value} className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded-lg" style={{ background: "#fff" }}>
              <span><strong>{s.value}</strong> — {s.label}</span>
              <button
                type="button"
                className="btn btn-ghost p-1 text-red-700"
                onClick={() => patch({ service_types: settings.service_types.filter((x) => x.value !== s.value) })}
              >
                <Minus size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <CatalogEditor
        title="Location service codes"
        hint="Codes shown when adding locations (HS, SS, OS…)."
        items={settings.location_services}
        onChange={(location_services) => patch({ location_services })}
        placeholder="e.g. OS"
      />

      <CatalogEditor
        title="Supervisor list"
        hint="Dropdown options on the client edit form."
        items={settings.supervisors}
        onChange={(supervisors) => patch({ supervisors })}
        placeholder="e.g. Fahda Alghadeeb"
      />

      <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="font-bold text-sm" style={{ color: "#2C3625" }}>Defaults for new clients</div>
        <label className="label">Default package hours</label>
        <input
          type="number"
          min="1"
          step="0.5"
          className="input text-sm mb-2"
          value={settings.default_package_hours}
          onChange={(e) => patch({ default_package_hours: parseFloat(e.target.value) || 24 })}
        />
        <label className="label">Default color</label>
        <input
          type="color"
          className="w-12 h-10 rounded-lg border"
          value={settings.default_new_client_color || "#A2C4C9"}
          onChange={(e) => patch({ default_new_client_color: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm mt-2" style={{ color: "#2C3625" }}>
          <input
            type="checkbox"
            checked={settings.show_new_client_button !== false}
            onChange={(e) => patch({ show_new_client_button: e.target.checked })}
          />
          Show “New Child” button for admins
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        {message && (
          <span className="text-xs flex-1" style={{ color: message.startsWith("Saved") ? "#3D4F35" : "#8B3A55" }}>
            {message}
          </span>
        )}
        <button type="button" className="btn btn-outline text-sm" onClick={resetDefaults}>Reset to defaults</button>
        <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={save} data-testid="save-client-info-page-settings">
          {saving ? <span className="spinner" /> : <><FloppyDisk size={16} /> Save page settings</>}
        </button>
      </div>
    </div>
  );
}
