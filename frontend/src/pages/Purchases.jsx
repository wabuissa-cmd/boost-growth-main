import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../api";
import {
  ShoppingBag, Bell, CheckCircle, Hourglass, Clock, FloppyDisk, PaperPlaneTilt, ArrowsClockwise, Plus, Trash, XCircle,
} from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import { getTherapistScheduleName } from "../scheduleConstants";
import { yearMonthTabs, formatMonthValue, purchaseMonthKey, resolvePurchaseYear } from "../monthTabs";
import { canAccessPurchases, canManagePurchaseStatus, canSupervisorReviewPurchases, canManagerFinalizePurchases, isJenan, isWalaaOps, showAdminNav, showSystemAdmin, useAuth } from "../auth";
import "../clientInfoLayout.css";

const PURCHASES_SHEET_URL = "https://docs.google.com/spreadsheets/d/10ZGq3ABQ1t-w32jrGZIu6Gxa2wevIJU2GLe9YWGdkIQ/edit";

const STATUS_META = {
  pending: { label: "Pending supervisor", cls: "bg-[#FAF0D1] text-[#6B5218]", icon: <Hourglass size={14} weight="duotone"/> },
  supervisor_approved: { label: "Supervisor approved", cls: "bg-[#EAF0F3] text-[#375568]", icon: <Clock size={14} weight="duotone"/> },
  supervisor_rejected: { label: "Supervisor rejected", cls: "bg-[#F8EBE7] text-[#8A3F27]", icon: <XCircle size={14} weight="duotone"/> },
  pending_manager: { label: "With manager Jenan", cls: "bg-[#FAF0D1] text-[#6B5218]", icon: <Hourglass size={14} weight="duotone"/> },
  manager_approved: { label: "Manager approved", cls: "bg-[#EAF0F3] text-[#375568]", icon: <CheckCircle size={14} weight="duotone"/> },
  manager_rejected: { label: "Manager rejected", cls: "bg-[#F8EBE7] text-[#8A3F27]", icon: <XCircle size={14} weight="duotone"/> },
  approved: { label: "Approved", cls: "bg-[#EAF0F3] text-[#375568]", icon: <Clock size={14} weight="duotone"/> },
  rejected: { label: "Rejected", cls: "bg-[#F8EBE7] text-[#8A3F27]", icon: <XCircle size={14} weight="duotone"/> },
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
  const canSupervisorReview = canSupervisorReviewPurchases(user);
  const canManagerFinalize = canManagerFinalizePurchases(user);
  const canDelete = showSystemAdmin(user);
  const canSyncSheet = isJenan(user) || isWalaaOps(user) || showAdminNav(user);
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [therapists, setTherapists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyPurchaseForm);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("");
  const [settings, setSettings] = useState({ day_of_month: 25, enabled: true, therapist_ids: [] });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const therapistOptions = useMemo(() => {
    const arr = Array.isArray(therapists) ? therapists : [];
    return arr
      .map((t) => ({ ...t, id: t.id, label: getTherapistScheduleName(t) }))
      .filter((t) => t.id);
  }, [therapists]);

  const resolvePurchaserName = (p) => {
    if (!p) return "—";
    const direct =
      (p.therapist_name || "").trim() ||
      (p.purchaser_name || "").trim() ||
      (p.submitter_name || "").trim();
    if (direct) return direct;
    const id = p.therapist_id || p.purchaser_id || p.user_id;
    if (!id) return "—";
    const t = therapistOptions.find((x) => x.id === id);
    return t ? t.label : String(id);
  };

  const displayedItems = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return (items || []).filter((p) => {
      if (!p) return false;
      if (filterCategory && (p.category || "") !== filterCategory) return false;
      if (filterTherapist && String(p.therapist_id || "") !== String(filterTherapist)) return false;
      if (!q) return true;
      const hay = [
        p.item,
        p.category,
        p.description,
        p.notes,
        p.purchase_month,
        p.therapist_name,
        resolvePurchaserName(p),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, filterCategory, filterTherapist, therapistOptions]);

  const load = async () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterMonth) params.month = filterMonth;
    try {
      const [listRes, allRes, pendingRes] = await Promise.all([
        api.get("/purchases", { params }),
        api.get("/purchases"),
        canManageStatus ? api.get("/purchases", { params: { status: "pending" } }) : Promise.resolve({ data: [] }),
      ]);
      setItems(Array.isArray(listRes.data) ? listRes.data : []);
      setAllItems(Array.isArray(allRes.data) ? allRes.data : []);
      setPendingQueue(Array.isArray(pendingRes.data) ? pendingRes.data : []);
    } catch (e) {
      setItems([]);
      setAllItems([]);
      setPendingQueue([]);
      console.warn("Purchases load failed", e);
    }
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

  const [reviewNote, setReviewNote] = useState("");

  const updateStatus = async (id, status, opts = {}) => {
    try {
      await api.put(`/purchases/${id}`, {
        status,
        supervisor_note: opts.note || reviewNote || undefined,
        forward_to_manager: opts.forward || false,
        reimbursement_date: status === "reimbursed" ? new Date().toISOString().slice(0, 10) : undefined,
      });
      setReviewNote("");
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

  const purchaseYear = useMemo(() => resolvePurchaseYear(allItems), [allItems]);
  const monthTabs = useMemo(() => yearMonthTabs(purchaseYear), [purchaseYear]);
  const selected = useMemo(
    () => items.find(p => p.id === selectedId) || pendingQueue.find(p => p.id === selectedId) || null,
    [items, pendingQueue, selectedId]
  );

  return (
    <div className="page-enter">
      {!embedded && (
      <PageBanner
        title="Employees' Purchases"
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
                    {resolvePurchaserName(p)} · {formatMonthValue(p.purchase_month)}
                  </div>
                  <div className="text-[10px] font-bold mt-1" style={{ color: "#6B5218" }}>{fmtMoney(p)}</div>
                </button>
              );
            })}
          </div>
          {selected && (
            <div className="mt-3 pt-3 border-t flex flex-col gap-2" style={{ borderColor: "#EDE9E3" }}>
              {(selected.approval_trail || []).length > 0 && (
                <div className="text-[10px]" style={{ color: "#5C6853" }}>
                  {(selected.approval_trail || []).map((t, i) => (
                    <div key={i}>{t.by_name}: {t.action}{t.note ? ` — ${t.note}` : ""}</div>
                  ))}
                </div>
              )}
              {canSupervisorReview && ["pending", "supervisor_approved"].includes(selected.status) && (
                <>
                  <textarea className="modal-input text-xs" rows={2} placeholder="Note to therapist (optional)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "supervisor_approved")}>Approve</button>
                    <button type="button" className="btn btn-outline text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "supervisor_rejected")}>Reject</button>
                    <button type="button" className="btn btn-primary text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "supervisor_approved", { forward: true })}>Forward to Jenan</button>
                  </div>
                </>
              )}
              {canManagerFinalize && ["pending_manager", "supervisor_approved", "manager_approved"].includes(selected.status) && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "manager_approved")}>Final approve</button>
                  <button type="button" className="btn btn-outline text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "manager_rejected")}>Reject</button>
                  <button type="button" className="btn btn-primary text-[10px] py-1 px-2" onClick={() => updateStatus(selected.id, "reimbursed")}>Mark reimbursed</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="req-split">
        <aside className="req-panel-sidebar">
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0 flex items-center gap-1.5" style={{ color: "#2C3625" }}>
              <ShoppingBag size={16} weight="duotone" style={{ color: "#7A8A6A" }}/> Browse
            </h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>
              Months, filters, and quick totals
            </p>
          </div>

          <div className="p-3">
            <div className="text-[10px] font-bold tracking-wider mb-2" style={{ color: "#8B9E7A" }}>MONTH</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFilterMonth("")}
                className={`p-3 rounded-xl border text-left transition ${!filterMonth ? "border-[#7A8A6A] bg-[#E5EBE1]" : "border-[#E2DDD4] bg-white hover:bg-[#FAFAF7]"}`}
              >
                <div className="text-xs font-bold" style={{ color: "#2C3625" }}>All months</div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8B9E7A" }}>{allItems.length} entries</div>
              </button>
              {monthTabs.map((m) => {
                const active = filterMonth === m.value;
                const count = allItems.filter((p) => purchaseMonthKey(p) === m.value).length;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setFilterMonth(m.value)}
                    className={`p-3 rounded-xl border text-left transition ${active ? "border-[#7A8A6A] bg-[#E5EBE1]" : "border-[#E2DDD4] bg-white hover:bg-[#FAFAF7]"}`}
                  >
                    <div className="text-xs font-bold" style={{ color: "#2C3625" }}>{m.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#8B9E7A" }}>{m.short} · {count}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 border-t" style={{ borderColor: "#E2DDD4" }}>
            <div className="text-[10px] font-bold tracking-wider mb-2" style={{ color: "#8B9E7A" }}>FILTERS</div>
            <div className="flex flex-col gap-2">
              <input
                className="input text-sm"
                placeholder="Search item, category, name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="reimbursed">Reimbursed</option>
              </select>
              <select className="input text-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {canManageStatus && (
                <select className="input text-sm" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
                  <option value="">All therapists</option>
                  {therapistOptions.map((t) => (
                    <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => { setSearch(""); setFilterStatus(""); setFilterCategory(""); setFilterTherapist(""); }}
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="p-3 border-t" style={{ borderColor: "#E2DDD4" }}>
            <div className="text-[10px] font-bold tracking-wider mb-2" style={{ color: "#8B9E7A" }}>RESULTS</div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="pill bg-[#FAFAF7]" style={{ color: "#5C6853", border: "1px solid #E2DDD4" }}>
                Showing {displayedItems.length}
              </span>
              {filterMonth && (
                <span className="pill bg-[#FAFAF7]" style={{ color: "#5C6853", border: "1px solid #E2DDD4" }}>
                  {formatMonthValue(filterMonth)}
                </span>
              )}
            </div>
          </div>
        </aside>

        <section className="req-panel-left">
          <div className="card overflow-hidden mb-4">
            <div className="px-3 py-2 border-b text-[10px] font-bold tracking-wider" style={{ borderColor: "#E2DDD4", background: "#FAFAF7", color: "#5C6853" }}>
              PURCHASES · {purchaseYear}
            </div>

            <div className="intake-table-wrap" style={{ margin: 0, borderRadius: 0, border: "none" }}>
              <table className="intake-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Purchase</th>
                    <th>Purchaser</th>
                    <th>Date</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Month</th>
                    <th>Status</th>
                    <th>Reimb. date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8" style={{ color: "#8B9E7A" }}>No purchases found</td></tr>
                  )}
                  {displayedItems.map((p, i) => {
                    const st = STATUS_META[p.status] || STATUS_META.pending;
                    const active = selectedId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={active ? "bg-[#FAFAF7]" : ""}
                        onClick={() => setSelectedId(p.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{p.row_no || i + 1}</td>
                        <td>
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {p.category && (
                              <span className="pill text-[10px] bg-[#F3EFE8]" style={{ color: "#606E52" }}>{p.category}</span>
                            )}
                            {(p.line_items || []).length > 1 && (
                              <span className="pill text-[10px] bg-[#EAF0F3]" style={{ color: "#375568" }}>
                                {p.line_items.length} items
                              </span>
                            )}
                          </div>
                          <div className="font-semibold" style={{ color: "#2C3625" }}>{p.item}</div>
                          {p.description && p.description !== "-" && (
                            <div className="text-[10px] line-clamp-2" style={{ color: "#8B9E7A" }}>{p.description}</div>
                          )}
                        </td>
                        <td>{resolvePurchaserName(p)}</td>
                        <td className="text-xs whitespace-nowrap">{fmtDate(p.purchase_date)}</td>
                        <td>{p.qty || "—"}</td>
                        <td className="text-xs font-bold" style={{ color: "#6B5218" }}>{fmtMoney(p)}</td>
                        <td className="text-xs whitespace-nowrap" title={p.purchase_month || ""}>{formatMonthValue(p.purchase_month)}</td>
                        <td><span className={`pill text-[10px] ${st.cls}`}>{st.icon} {st.label}</span></td>
                        <td className="text-xs whitespace-nowrap">{fmtDate(p.reimbursement_date)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {canSupervisorReview && ["pending", "supervisor_approved"].includes(p.status) && (
                            <button type="button" className="text-[10px] underline mr-2" onClick={() => updateStatus(p.id, "supervisor_approved")}>Approve</button>
                          )}
                          {canManagerFinalize && ["pending_manager", "manager_approved"].includes(p.status) && (
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
        </section>
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
