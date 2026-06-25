import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../api";
import {
  ShoppingBag, Bell, CheckCircle, Hourglass, Clock, FloppyDisk, PaperPlaneTilt,
} from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import { getTherapistScheduleName } from "../scheduleConstants";
import { yearMonthTabs } from "../monthTabs";
import "../clientInfoLayout.css";

const STATUS_META = {
  pending: { label: "Pending", cls: "bg-[#FAF0D1] text-[#6B5218]", icon: <Hourglass size={14} weight="duotone"/> },
  approved: { label: "Approved", cls: "bg-[#EAF0F3] text-[#375568]", icon: <Clock size={14} weight="duotone"/> },
  reimbursed: { label: "Reimbursed", cls: "bg-[#E5EBE1] text-[#3D4F35]", icon: <CheckCircle size={14} weight="duotone"/> },
};

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(p) {
  if (p.total_display) return p.total_display;
  if (p.total != null) return `${p.total} SR`;
  return "—";
}

export default function Purchases() {
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterTherapist, setFilterTherapist] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const tabs = yearMonthTabs();
    const now = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    return tabs.some((m) => m.value === now) ? now : tabs[0]?.value || "";
  });
  const [settings, setSettings] = useState({ day_of_month: 25, enabled: true, therapist_ids: [] });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const params = {};
    if (filterTherapist) params.therapist_id = filterTherapist;
    if (filterStatus) params.status = filterStatus;
    if (filterMonth) params.month = filterMonth;
    const { data } = await api.get("/purchases", { params });
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, [filterTherapist, filterStatus, filterMonth]);

  useEffect(() => {
    Promise.all([
      api.get("/therapists"),
      api.get("/purchases/categories"),
      api.get("/purchases/reminder-settings"),
    ]).then(([t, c, s]) => {
      setTherapists(t.data || []);
      setCategories(c.data || []);
      setSettings(s.data || { day_of_month: 25, enabled: true, therapist_ids: [] });
    }).catch(() => {});
  }, []);

  const totals = useMemo(() => {
    const sum = items.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
    const byStatus = { pending: 0, approved: 0, reimbursed: 0 };
    items.forEach(p => { if (byStatus[p.status] != null) byStatus[p.status]++; });
    return { sum, byStatus, count: items.length };
  }, [items]);

  const toggleTherapist = (id) => {
    setSettings(s => {
      const ids = new Set(s.therapist_ids || []);
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      return { ...s, therapist_ids: [...ids] };
    });
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data } = await api.put("/purchases/reminder-settings", settings);
      setSettings(data);
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const sendReminders = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/purchases/send-reminders");
      alert(`Reminders sent to ${data.sent || 0} therapist(s).`);
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/purchases/${id}`, {
        status,
        reimbursement_date: status === "reimbursed" ? new Date().toISOString().slice(0, 10) : undefined,
      });
      load();
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    }
  };

  const monthTabs = useMemo(() => yearMonthTabs(), []);

  return (
    <div className="page-enter">
      <PageBanner
        title="Purchases"
        subtitle="Staff reimbursements · Jan – Jul"
        className="editorial-banner--compact-mobile"
      />

      <div className="card overflow-hidden mb-4">
        <div className="flex gap-0 overflow-x-auto border-b" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          {monthTabs.map((m) => {
            const active = filterMonth === m.value;
            const count = items.filter((p) => p.purchase_month === m.value).length;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setFilterMonth(m.value)}
                className={`shrink-0 px-4 py-2.5 text-xs font-bold border-b-2 transition min-h-[44px] ${
                  active ? "border-[#7A8A6A] text-[#2C3625] bg-white" : "border-transparent text-[#8B9E7A] hover:text-[#5C6853]"
                }`}
              >
                {m.short}
                {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="p-3 flex flex-wrap gap-2 items-center border-b" style={{ borderColor: "#EDE9E3" }}>
          <ShoppingBag size={18} style={{ color: "#7A8A6A" }}/>
          <select className="input text-sm w-auto" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
            <option value="">All therapists</option>
            {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
          </select>
          <select className="input text-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
        </div>

        <div className="intake-table-wrap" style={{ margin: 0, borderRadius: 0, border: "none" }}>
          <table className="intake-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Category</th>
                <th>Purchaser</th>
                <th>QTY</th>
                <th>Unit</th>
                <th>Total</th>
                <th>Status</th>
                <th>Reimb. date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8" style={{ color: "#8B9E7A" }}>No purchases found</td></tr>
              )}
              {items.map((p, i) => {
                const st = STATUS_META[p.status] || STATUS_META.pending;
                return (
                  <tr key={p.id}>
                    <td>{p.row_no || i + 1}</td>
                    <td>
                      <div className="font-semibold">{p.item}</div>
                      {p.description && p.description !== "-" && (
                        <div className="text-[10px]" style={{ color: "#8B9E7A" }}>{p.description}</div>
                      )}
                    </td>
                    <td>{p.category}</td>
                    <td>{p.purchaser_name || p.therapist_name || "—"}</td>
                    <td>{p.qty || "—"}</td>
                    <td>{p.unit_price || "—"}</td>
                    <td>{fmtMoney(p)}</td>
                    <td><span className={`pill text-[10px] ${st.cls}`}>{st.icon} {st.label}</span></td>
                    <td>{fmtDate(p.reimbursement_date)}</td>
                    <td>
                      {p.status !== "approved" && (
                        <button type="button" className="text-[10px] underline mr-2" onClick={() => updateStatus(p.id, "approved")}>Approve</button>
                      )}
                      {p.status !== "reimbursed" && (
                        <button type="button" className="text-[10px] underline" onClick={() => updateStatus(p.id, "reimbursed")}>Reimburse</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {categories.length > 0 && (
          <div className="text-[10px] p-3 border-t" style={{ color: "#8B9E7A", borderColor: "#EDE9E3" }}>
            Categories: {categories.join(" · ")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-1">
          <div className="text-xs font-bold tracking-wider mb-2" style={{ color: "#8B9E7A" }}>SUMMARY</div>
          <div className="font-display text-2xl font-semibold" style={{ color: "#2C3625" }}>{totals.count} entries</div>
          <div className="text-sm mt-1" style={{ color: "#606E52" }}>{totals.sum.toLocaleString()} SR total (parsed)</div>
          <div className="flex gap-2 flex-wrap mt-3 text-[10px]">
            {Object.entries(totals.byStatus).map(([k, v]) => (
              <span key={k} className={`pill ${STATUS_META[k]?.cls || ""}`}>{STATUS_META[k]?.label}: {v}</span>
            ))}
          </div>
        </div>

        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} weight="duotone" style={{ color: "#7A8A6A" }}/>
            <h3 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Monthly reminder</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: "#5C6853" }}>
            Remind selected therapists to log their purchases before month-end. Notifications appear in the portal bell.
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <label className="text-xs">
              <span className="label block mb-1">Day of month</span>
              <input
                type="number"
                min={1}
                max={28}
                className="input w-20"
                value={settings.day_of_month || 25}
                onChange={e => setSettings(s => ({ ...s, day_of_month: parseInt(e.target.value, 10) || 25 }))}
              />
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={settings.enabled !== false}
                onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}
              />
              Auto-send on that day each month
            </label>
          </div>
          <div className="text-xs font-bold mb-2" style={{ color: "#8B9E7A" }}>Send reminders to</div>
          <div className="flex flex-wrap gap-2 mb-3 max-h-28 overflow-y-auto">
            {therapists.map(t => (
              <label key={t.id} className="flex items-center gap-1.5 pill cursor-pointer text-[11px] px-2 py-1 border border-[#E2DDD4]">
                <input
                  type="checkbox"
                  checked={(settings.therapist_ids || []).includes(t.id)}
                  onChange={() => toggleTherapist(t.id)}
                />
                {getTherapistScheduleName(t)}
              </label>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-primary text-xs" onClick={saveSettings} disabled={savingSettings}>
              <FloppyDisk size={14}/> {savingSettings ? "Saving…" : "Save settings"}
            </button>
            <button type="button" className="btn btn-outline text-xs" onClick={sendReminders} disabled={sending}>
              <PaperPlaneTilt size={14}/> {sending ? "Sending…" : "Send reminders now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
