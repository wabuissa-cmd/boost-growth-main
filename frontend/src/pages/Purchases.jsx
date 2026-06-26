import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../api";
import {
  ShoppingBag, Bell, CheckCircle, Hourglass, Clock, FloppyDisk, PaperPlaneTilt, ArrowsClockwise, Plus, Trash,
} from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import { getTherapistScheduleName } from "../scheduleConstants";
import { yearMonthTabs, formatMonthValue } from "../monthTabs";
import { canAccessPurchases, canManagePurchaseStatus, isJenan, isWalaaOps, showAdminNav, showSystemAdmin, useAuth } from "../auth";
import "../clientInfoLayout.css";

const PURCHASES_SHEET_URL = "https://docs.google.com/spreadsheets/d/10ZGq3ABQ1t-w32jrGZIu6Gxa2wevIJU2GLe9YWGdkIQ/edit";

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

function emptyPurchaseForm() {
  return {
    therapist_id: "",
    item: "",
    category: "",
    description: "",
    qty: "1",
    unit_price: "",
    total: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

export default function Purchases({ embedded = false }) {
  const { user } = useAuth();
  const canManageStatus = canManagePurchaseStatus(user);
  const canDelete = showSystemAdmin(user);
  const canSyncSheet = isJenan(user) || isWalaaOps(user) || showAdminNav(user);
  const [items, setItems] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [therapists, setTherapists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyPurchaseForm);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const tabs = yearMonthTabs();
    const now = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    return tabs.some((m) => m.value === now) ? now : tabs[0]?.value || "";
  });
  const [settings, setSettings] = useState({ day_of_month: 25, enabled: true, therapist_ids: [] });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterMonth) params.month = filterMonth;
    const [listRes, pendingRes] = await Promise.all([
      api.get("/purchases", { params }),
      canManageStatus ? api.get("/purchases", { params: { status: "pending" } }) : Promise.resolve({ data: [] }),
    ]);
    setItems(Array.isArray(listRes.data) ? listRes.data : []);
    setPendingQueue(Array.isArray(pendingRes.data) ? pendingRes.data : []);
  };

  useEffect(() => {
    load();
  }, [filterStatus, filterMonth]);

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
      const lines = [
        `Portal notifications sent: ${data.sent || 0}`,
      ];
      if (data.provider_configured === false) {
        lines.push("⚠ No email provider configured — emails were queued but not delivered. Check Admin → Email settings.");
      }
      if (data.email_results?.length) {
        lines.push("", "Email delivery:");
        data.email_results.forEach((e) => {
          lines.push(`• ${e.to}: ${e.status}${e.error ? ` (${e.error})` : ""}${e.hint ? `\n  ${e.hint}` : ""}`);
        });
      } else {
        lines.push("", "No therapist emails on file for selected recipients.");
      }
      alert(lines.join("\n"));
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSending(false);
    }
  };

  const syncFromSheet = async () => {
    if (!window.confirm("Sync purchases from the official Google Sheet?\n\nMay–Jul tabs replace existing imported rows for those months.")) return;
    setSyncing(true);
    try {
      const { data } = await api.post("/import/purchases-google", { sheet_url: PURCHASES_SHEET_URL });
      const tabLine = data.tabs_found?.length ? `\n\nTabs: ${data.tabs_found.join(", ")}` : "";
      const monthLine = data.months?.length ? `\nMonths: ${data.months.join(", ")}` : "";
      alert((data.message || `Imported ${data.inserted} rows`) + monthLine + tabLine);
      load();
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSyncing(false);
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

  const deletePurchase = async (id) => {
    if (!window.confirm("Delete this purchase record permanently?")) return;
    try {
      await api.delete(`/purchases/${id}`);
      if (selectedId === id) setSelectedId("");
      load();
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    }
  };

  const submitPurchase = async () => {
    if (!form.therapist_id) {
      alert("Select who made the purchase");
      return;
    }
    if (!form.item.trim() || !form.category) {
      alert("Item and category are required");
      return;
    }
    setSubmitting(true);
    try {
      const total = form.total ? parseFloat(String(form.total).replace(/[^\d.]/g, "")) : null;
      await api.post("/purchases", {
        therapist_id: form.therapist_id,
        item: form.item,
        category: form.category,
        description: form.description,
        qty: form.qty,
        unit_price: form.unit_price,
        total: Number.isFinite(total) ? total : null,
        purchase_date: form.purchase_date,
        notes: form.notes,
      });
      setAddOpen(false);
      setForm(emptyPurchaseForm());
      load();
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const monthTabs = useMemo(() => yearMonthTabs(), []);
  const selected = useMemo(
    () => items.find(p => p.id === selectedId) || pendingQueue.find(p => p.id === selectedId) || null,
    [items, pendingQueue, selectedId]
  );

  return (
    <div className="page-enter">
      {!embedded && (
      <PageBanner
        title="Purchases"
        subtitle="Payment requests from therapists & supervisors · review & reimburse"
        className="editorial-banner--compact-mobile"
        toolbar={(
          <div className="flex flex-wrap gap-2">
            {canAccessPurchases(user) && (
              <button type="button" className="btn btn-primary text-xs min-h-[36px]" onClick={() => setAddOpen(true)}>
                <Plus size={14}/> Log Purchase
              </button>
            )}
            {canSyncSheet && (
              <button type="button" className="btn btn-secondary text-xs min-h-[36px]" onClick={syncFromSheet} disabled={syncing}>
                <ArrowsClockwise size={14} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing…" : "Sync from Sheet"}
              </button>
            )}
          </div>
        )}
      />
      )}

      {canManageStatus && pendingQueue.length > 0 && (
        <div className="card p-3 rounded-[20px] mb-4">
          <div className="text-xs font-bold tracking-wider mb-2 flex items-center gap-2" style={{ color: "#8A3F27" }}>
            <Hourglass size={16} weight="duotone"/> Needs attention · {pendingQueue.length} pending
          </div>
          <p className="text-[11px] mb-3 m-0" style={{ color: "#8B9E7A" }}>
            Submissions awaiting review & reimbursement
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingQueue.map(p => {
              const active = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`text-left p-3 rounded-xl border transition min-w-[10rem] flex-1 max-w-[14rem] ${active ? "border-[#7A8A6A] bg-[#E5EBE1]" : "border-[#EDE9E3] bg-[#FAFAF7]"}`}
                >
                  <div className="font-semibold text-sm truncate" style={{ color: "#2C3625" }}>{p.item}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#8B9E7A" }}>
                    {p.purchaser_name || p.therapist_name || "—"} · {formatMonthValue(p.purchase_month)}
                  </div>
                  <div className="text-[10px] font-bold mt-1" style={{ color: "#6B5218" }}>{fmtMoney(p)}</div>
                </button>
              );
            })}
          </div>
          {selected && selected.status === "pending" && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: "#EDE9E3" }}>
              <button type="button" className="btn btn-secondary text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "approved")}>Approve</button>
              <button type="button" className="btn btn-primary text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "reimbursed")}>Reimburse</button>
            </div>
          )}
        </div>
      )}

      <div className="min-w-0">
      <div className="card overflow-hidden mb-4">
        <div className="px-3 py-2 border-b text-[10px] font-bold tracking-wider" style={{ borderColor: "#E2DDD4", background: "#FAFAF7", color: "#5C6853" }}>
          CALENDAR MONTHS · JAN – JUL {new Date().getFullYear()}
        </div>
        <div className="flex gap-0 overflow-x-auto border-b" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          {monthTabs.map((m) => {
            const active = filterMonth === m.value;
            const count = items.filter((p) => p.purchase_month === m.value).length;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setFilterMonth(m.value)}
                className={`shrink-0 px-4 py-3 text-xs font-bold border-b-2 transition min-h-[48px] min-w-[5.5rem] ${
                  active ? "border-[#7A8A6A] text-[#2C3625] bg-white" : "border-transparent text-[#8B9E7A] hover:text-[#5C6853]"
                }`}
              >
                <span className="block text-[11px] leading-tight">{m.label}</span>
                <span className="block text-[9px] font-semibold opacity-70 mt-0.5">{m.short}</span>
                {count > 0 && <span className="block text-[9px] mt-0.5 opacity-80">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="p-3 flex flex-wrap gap-2 items-center border-b" style={{ borderColor: "#EDE9E3" }}>
          <ShoppingBag size={18} style={{ color: "#7A8A6A" }}/>
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
                <th>Month</th>
                <th>Status</th>
                <th>Reimb. date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-8" style={{ color: "#8B9E7A" }}>No purchases found</td></tr>
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
                    <td className="text-xs whitespace-nowrap" title={p.purchase_month || ""}>
                      {formatMonthValue(p.purchase_month)}
                      {filterMonth && p.purchase_month && p.purchase_month !== filterMonth && (
                        <span className="block text-[9px] font-semibold mt-0.5" style={{ color: "#C97B5C" }}>
                          ≠ selected tab
                        </span>
                      )}
                    </td>
                    <td><span className={`pill text-[10px] ${st.cls}`}>{st.icon} {st.label}</span></td>
                    <td>{fmtDate(p.reimbursement_date)}</td>
                    <td>
                      {canManageStatus && p.status !== "approved" && (
                        <button type="button" className="text-[10px] underline mr-2" onClick={() => updateStatus(p.id, "approved")}>Approve</button>
                      )}
                      {canManageStatus && p.status !== "reimbursed" && (
                        <button type="button" className="text-[10px] underline" onClick={() => updateStatus(p.id, "reimbursed")}>Reimburse</button>
                      )}
                      {canDelete && (
                        <button type="button" className="text-[10px] text-red-700 underline ml-2" onClick={() => deletePurchase(p.id)} title="Delete">
                          <Trash size={12} className="inline"/> Delete
                        </button>
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

      {!embedded && (
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
            Remind selected therapists to log purchases before month-end. Sends a <strong>portal notification</strong> and <strong>email</strong> to each selected therapist.
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
      )}
      </div>

      {addOpen && (
        <ModalBase
          title="Log Purchase"
          subtitle="Same as therapist submissions — notifies Jenan, Walaa, Maha & Fahda"
          onClose={() => { setAddOpen(false); setForm(emptyPurchaseForm()); }}
          size="md"
          footer={(
            <>
              <ModalBtnSecondary type="button" onClick={() => { setAddOpen(false); setForm(emptyPurchaseForm()); }}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary type="button" onClick={submitPurchase} disabled={submitting}>
                {submitting ? "Saving…" : "Submit"}
              </ModalBtnPrimary>
            </>
          )}
        >
          <FormSection title="Purchase details">
            <FormField label="Purchaser" required>
              <select className="modal-input" value={form.therapist_id} onChange={e => setForm({ ...form, therapist_id: e.target.value })}>
                <option value="">Select therapist…</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
              </select>
            </FormField>
            <FormField label="Item" required>
              <input className="modal-input" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g. Frames, Flowers…" />
            </FormField>
            <FormField label="Category" required>
              <select className="modal-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Description">
              <textarea className="modal-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="QTY">
                <input className="modal-input" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
              </FormField>
              <FormField label="Unit price">
                <input className="modal-input" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} placeholder="e.g. 64 SR" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Total">
                <input className="modal-input" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} placeholder="e.g. 380" />
              </FormField>
              <FormField label="Purchase date">
                <input type="date" className="modal-input" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className="modal-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </FormField>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
