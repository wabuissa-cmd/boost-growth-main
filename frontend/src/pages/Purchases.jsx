import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../api";
import {
  ShoppingBag, Bell, CheckCircle, Hourglass, Clock, FloppyDisk, PaperPlaneTilt, ArrowsClockwise, Plus, Trash, XCircle, ChartBar,
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

function parseNumberLike(v) {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
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
    line_items: [{ item: "", qty: "1", unit_price: "", total: "" }],
  };
}

export default function Purchases({ embedded = false }) {
  const { user } = useAuth();
  const canManageStatus = canManagePurchaseStatus(user);
  const canSupervisorReview = canSupervisorReviewPurchases(user);
  const canManagerFinalize = canManagerFinalizePurchases(user);
  const canDelete = showSystemAdmin(user);
  const canSyncSheet = isJenan(user) || isWalaaOps(user) || showAdminNav(user);
  const canPickPurchaser = showSystemAdmin(user) || showAdminNav(user);
  const ownTherapistId = user?.therapist_id || user?.id || "";
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
  const [pageTab, setPageTab] = useState("purchases");

  const openAddPurchase = () => {
    const base = emptyPurchaseForm();
    if (!canPickPurchaser && ownTherapistId) {
      base.therapist_id = ownTherapistId;
    }
    setForm(base);
    setAddOpen(true);
  };

  const therapistOptions = useMemo(() => {
    const arr = Array.isArray(therapists) ? therapists : [];
    return arr
      .map((t) => ({ ...t, id: t.id, label: getTherapistScheduleName(t) }))
      .filter((t) => t.id);
  }, [therapists]);

  const ownPurchaserLabel = useMemo(() => {
    if (!ownTherapistId) return user?.name || "You";
    const t = therapistOptions.find((x) => x.id === ownTherapistId);
    return t ? t.label : (user?.name || "You");
  }, [ownTherapistId, therapistOptions, user?.name]);

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
    const therapistId = canPickPurchaser ? form.therapist_id : ownTherapistId;
    if (!therapistId) {
      alert(canPickPurchaser ? "Select who made the purchase" : "Could not resolve your therapist profile");
      return;
    }
    if (!form.category) {
      alert("Category is required");
      return;
    }
    setSubmitting(true);
    try {
      const rawLines = Array.isArray(form.line_items) ? form.line_items : [];
      const cleanedLines = rawLines
        .map((li) => ({
          item: (li?.item || "").trim(),
          qty: (li?.qty || "1").trim(),
          unit_price: (li?.unit_price || "").trim(),
          total: parseNumberLike(li?.total),
        }))
        .filter((li) => li.item);

      const linesTotal = cleanedLines.reduce((acc, li) => acc + (li.total || 0), 0);
      const explicitTotal = parseNumberLike(form.total);

      const derivedItemSummary = cleanedLines.length
        ? cleanedLines.slice(0, 3).map((x) => x.item).join(" · ") + (cleanedLines.length > 3 ? ` (+${cleanedLines.length - 3} more)` : "")
        : "";

      const item = (form.item || "").trim() || derivedItemSummary;
      if (!item) {
        alert("Item is required (add at least one item)");
        return;
      }

      await api.post("/purchases", {
        therapist_id: therapistId,
        item,
        category: form.category,
        description: form.description,
        qty: cleanedLines[0]?.qty || form.qty,
        unit_price: cleanedLines[0]?.unit_price || form.unit_price,
        total: explicitTotal ?? (cleanedLines.length ? (linesTotal || null) : null),
        purchase_date: form.purchase_date,
        notes: form.notes,
        ...(cleanedLines.length ? { line_items: cleanedLines.map((x) => ({ ...x, total: x.total ?? null })) } : {}),
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

  const reportSource = useMemo(() => {
    const base = filterMonth
      ? allItems.filter((p) => purchaseMonthKey(p) === filterMonth)
      : allItems;
    return base.filter((p) => {
      if (filterCategory && (p.category || "") !== filterCategory) return false;
      if (filterTherapist && String(p.therapist_id || "") !== String(filterTherapist)) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [allItems, filterMonth, filterCategory, filterTherapist, filterStatus]);

  const reportStats = useMemo(() => {
    const itemCounts = {};
    const categoryTotals = {};
    const monthly = {};
    let sum = 0;
    reportSource.forEach((p) => {
      const itemKey = (p.item || "").trim();
      if (itemKey) itemCounts[itemKey] = (itemCounts[itemKey] || 0) + 1;
      const cat = p.category || "Uncategorized";
      const amt = parseFloat(p.total) || 0;
      sum += amt;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      const mk = purchaseMonthKey(p) || "—";
      if (!monthly[mk]) monthly[mk] = { sum: 0, count: 0 };
      monthly[mk].sum += amt;
      monthly[mk].count += 1;
    });
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, total]) => ({ name, total }));
    const monthlyAvgs = Object.entries(monthly)
      .map(([month, v]) => ({
        month,
        total: v.sum,
        count: v.count,
        avg: v.count ? v.sum / v.count : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    return {
      count: reportSource.length,
      sum,
      avg: reportSource.length ? sum / reportSource.length : 0,
      topItems,
      topCategories,
      monthlyAvgs,
    };
  }, [reportSource]);

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
              <button type="button" className="btn btn-primary text-xs min-h-[36px]" onClick={openAddPurchase}>
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

      <div className="purchases-workspace">
        <div className="editorial-pill-row">
          <button
            type="button"
            className={`editorial-pill${pageTab === "purchases" ? " is-active" : ""}`}
            onClick={() => setPageTab("purchases")}
          >
            <ShoppingBag size={14} weight="duotone" /> Purchases
          </button>
          <button
            type="button"
            className={`editorial-pill${pageTab === "reports" ? " is-active" : ""}`}
            onClick={() => setPageTab("reports")}
          >
            <ChartBar size={14} weight="duotone" /> Reports
          </button>
        </div>

        {pageTab === "purchases" && (
          <>
            {canManageStatus && pendingQueue.length > 0 && (
              <div className="purchases-pending-strip">
                <div className="text-[11px] font-bold mb-1.5 flex items-center gap-1.5" style={{ color: "#8A3F27" }}>
                  <Hourglass size={14} weight="duotone" /> {pendingQueue.length} pending — click to review
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pendingQueue.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] ${selectedId === p.id ? "border-[#7A8A6A] bg-[#E5EBE1]" : "border-[#EDE9E3] bg-white"}`}
                    >
                      <span className="font-semibold">{p.item}</span>
                      <span className="mx-1" style={{ color: "#8B9E7A" }}>·</span>
                      <span style={{ color: "#6B5218" }}>{fmtMoney(p)}</span>
                    </button>
                  ))}
                </div>
                {selected && pendingQueue.some((p) => p.id === selected.id) && (
                  <div className="mt-2 pt-2 border-t flex flex-col gap-2" style={{ borderColor: "#EDE9E3" }}>
                    {canSupervisorReview && ["pending", "supervisor_approved"].includes(selected.status) && (
                      <>
                        <textarea className="modal-input text-xs" rows={2} placeholder="Note (optional)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
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

            <div className="purchases-split">
              <section className="purchases-main-panel">
                <div className="purchases-panel-head">
                  <div>
                    <div className="text-xs font-bold" style={{ color: "#2C3625" }}>Purchases · {purchaseYear}</div>
                    <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
                      {displayedItems.length} shown · {totals.sum.toLocaleString()} SR
                    </div>
                  </div>
                  {filterMonth && (
                    <span className="pill text-[10px] bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>
                      {formatMonthValue(filterMonth)}
                    </span>
                  )}
                </div>
                <div className="purchases-main-scroll">
                  <table className="intake-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Purchase</th>
                        {canPickPurchaser && <th>Purchaser</th>}
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedItems.length === 0 && (
                        <tr><td colSpan={canPickPurchaser ? 7 : 6} className="text-center py-8" style={{ color: "#8B9E7A" }}>No purchases found</td></tr>
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
                              {p.category && (
                                <div className="text-[10px] font-semibold mb-0.5" style={{ color: "#606E52" }}>{p.category}</div>
                              )}
                              <div className="font-semibold text-sm" style={{ color: "#2C3625" }}>{p.item}</div>
                              <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
                                {formatMonthValue(p.purchase_month)} · Qty {p.qty || "—"}
                              </div>
                            </td>
                            {canPickPurchaser && <td className="text-xs">{resolvePurchaserName(p)}</td>}
                            <td className="text-xs whitespace-nowrap">{fmtDate(p.purchase_date)}</td>
                            <td className="text-xs font-bold whitespace-nowrap" style={{ color: "#6B5218" }}>{fmtMoney(p)}</td>
                            <td><span className={`pill text-[10px] ${st.cls}`}>{st.label}</span></td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {canSupervisorReview && ["pending", "supervisor_approved"].includes(p.status) && (
                                <button type="button" className="text-[10px] underline mr-1" onClick={() => updateStatus(p.id, "supervisor_approved")}>Approve</button>
                              )}
                              {canManagerFinalize && ["pending_manager", "manager_approved"].includes(p.status) && (
                                <button type="button" className="text-[10px] underline" onClick={() => updateStatus(p.id, "reimbursed")}>Reimburse</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="purchases-sidebar">
                <div className="purchases-sidebar-section">
                  <div className="text-[10px] font-bold tracking-wider mb-1.5" style={{ color: "#8B9E7A" }}>MONTH</div>
                  <div className="purchases-month-grid">
                    <button
                      type="button"
                      className={`purchases-month-btn${!filterMonth ? " is-active" : ""}`}
                      onClick={() => setFilterMonth("")}
                    >
                      <div className="font-bold">All</div>
                      <div style={{ color: "#8B9E7A" }}>{allItems.length}</div>
                    </button>
                    {monthTabs.map((m) => {
                      const count = allItems.filter((p) => purchaseMonthKey(p) === m.value).length;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          className={`purchases-month-btn${filterMonth === m.value ? " is-active" : ""}`}
                          onClick={() => setFilterMonth(m.value)}
                        >
                          <div className="font-bold">{m.short}</div>
                          <div style={{ color: "#8B9E7A" }}>{count}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="purchases-sidebar-section">
                  <div className="text-[10px] font-bold tracking-wider mb-1.5" style={{ color: "#8B9E7A" }}>FILTER</div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      className="input text-xs py-1.5"
                      placeholder="Search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <select className="input text-xs py-1.5" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="reimbursed">Reimbursed</option>
                    </select>
                    <select className="input text-xs py-1.5" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                      <option value="">All categories</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {canManageStatus && (
                      <select className="input text-xs py-1.5" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
                        <option value="">All staff</option>
                        {therapistOptions.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary text-[10px] py-1"
                      onClick={() => { setSearch(""); setFilterStatus(""); setFilterCategory(""); setFilterTherapist(""); }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="purchases-sidebar-section">
                  <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: "#8B9E7A" }}>SUMMARY</div>
                  <div className="text-lg font-bold" style={{ color: "#2C3625" }}>{totals.count}</div>
                  <div className="text-[10px]" style={{ color: "#8B9E7A" }}>{totals.sum.toLocaleString()} SR total</div>
                </div>
              </aside>
            </div>
          </>
        )}

        {pageTab === "reports" && (
          <div className="purchases-reports-panel">
            <div className="purchases-panel-head">
              <div>
                <div className="text-xs font-bold" style={{ color: "#2C3625" }}>Purchase analytics</div>
                <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
                  {reportStats.count} records · avg {reportStats.avg.toFixed(0)} SR per request
                </div>
              </div>
            </div>
            <div className="purchases-main-scroll">
              <div className="purchases-report-grid">
                <div className="purchases-report-card">
                  <h3>Most repeated items</h3>
                  {reportStats.topItems.length === 0 ? (
                    <div className="text-xs" style={{ color: "#8B9E7A" }}>No data</div>
                  ) : reportStats.topItems.map((row) => (
                    <div key={row.name} className="purchases-report-row">
                      <span className="truncate">{row.name}</span>
                      <strong>{row.count}×</strong>
                    </div>
                  ))}
                </div>
                <div className="purchases-report-card">
                  <h3>Spend by category</h3>
                  {reportStats.topCategories.length === 0 ? (
                    <div className="text-xs" style={{ color: "#8B9E7A" }}>No data</div>
                  ) : reportStats.topCategories.map((row) => (
                    <div key={row.name} className="purchases-report-row">
                      <span className="truncate">{row.name}</span>
                      <strong>{row.total.toLocaleString()} SR</strong>
                    </div>
                  ))}
                </div>
                <div className="purchases-report-card">
                  <h3>Monthly averages</h3>
                  {reportStats.monthlyAvgs.length === 0 ? (
                    <div className="text-xs" style={{ color: "#8B9E7A" }}>No data</div>
                  ) : reportStats.monthlyAvgs.map((row) => (
                    <div key={row.month} className="purchases-report-row">
                      <span>{formatMonthValue(row.month)}</span>
                      <span className="text-right">
                        <strong>{row.avg.toFixed(0)} SR</strong>
                        <span className="block text-[10px] font-normal" style={{ color: "#8B9E7A" }}>
                          {row.count} req · {row.total.toLocaleString()} SR
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {!embedded && canManageStatus && (
                <div className="p-3 border-t m-3 rounded-xl" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Bell size={16} weight="duotone" style={{ color: "#7A8A6A" }} />
                    <h3 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Monthly reminder</h3>
                  </div>
                  <p className="text-[11px] mb-2 m-0" style={{ color: "#5C6853" }}>
                    Remind staff to log purchases before month-end.
                  </p>
                  <div className="flex flex-wrap items-end gap-2 mb-2">
                    <label className="text-[11px]">
                      Day
                      <input
                        type="number"
                        min={1}
                        max={28}
                        className="input w-16 text-xs ml-1"
                        value={settings.day_of_month || 25}
                        onChange={e => setSettings(s => ({ ...s, day_of_month: parseInt(e.target.value, 10) || 25 }))}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px]">
                      <input type="checkbox" checked={settings.enabled !== false} onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))} />
                      Auto-send
                    </label>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" className="btn btn-primary text-[10px] py-1" onClick={saveSettings} disabled={savingSettings}>
                      Save
                    </button>
                    <button type="button" className="btn btn-outline text-[10px] py-1" onClick={sendReminders} disabled={sending}>
                      Send now
                    </button>
                  </div>
                </div>
              )}
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
            {canPickPurchaser ? (
              <FormField label="Purchaser" required>
                <select className="modal-input" value={form.therapist_id} onChange={e => setForm({ ...form, therapist_id: e.target.value })}>
                  <option value="">Select therapist…</option>
                  {therapistOptions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </FormField>
            ) : (
              <FormField label="Purchaser">
                <input className="modal-input" readOnly value={ownPurchaserLabel} />
              </FormField>
            )}
            <FormField label="Category" required>
              <select className="modal-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Items" required>
              <div className="flex flex-col gap-2">
                {(Array.isArray(form.line_items) ? form.line_items : []).map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <input
                        className="modal-input"
                        value={li?.item || ""}
                        onChange={(e) => {
                          const next = [...(form.line_items || [])];
                          next[idx] = { ...(next[idx] || {}), item: e.target.value };
                          setForm({ ...form, line_items: next });
                        }}
                        placeholder="Item name…"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="modal-input"
                        value={li?.qty || "1"}
                        onChange={(e) => {
                          const next = [...(form.line_items || [])];
                          next[idx] = { ...(next[idx] || {}), qty: e.target.value };
                          setForm({ ...form, line_items: next });
                        }}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="modal-input"
                        value={li?.unit_price || ""}
                        onChange={(e) => {
                          const next = [...(form.line_items || [])];
                          next[idx] = { ...(next[idx] || {}), unit_price: e.target.value };
                          setForm({ ...form, line_items: next });
                        }}
                        placeholder="Unit"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        className="modal-input"
                        value={li?.total || ""}
                        onChange={(e) => {
                          const next = [...(form.line_items || [])];
                          next[idx] = { ...(next[idx] || {}), total: e.target.value };
                          setForm({ ...form, line_items: next });
                        }}
                        placeholder="Total"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost p-2"
                        title="Remove item"
                        onClick={() => {
                          const cur = Array.isArray(form.line_items) ? [...form.line_items] : [];
                          if (cur.length <= 1) return;
                          cur.splice(idx, 1);
                          setForm({ ...form, line_items: cur });
                        }}
                        disabled={Array.isArray(form.line_items) && form.line_items.length <= 1}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline text-xs"
                    onClick={() => {
                      const cur = Array.isArray(form.line_items) ? [...form.line_items] : [];
                      cur.push({ item: "", qty: "1", unit_price: "", total: "" });
                      setForm({ ...form, line_items: cur });
                    }}
                  >
                    <Plus size={14} /> Add item
                  </button>
                  <div className="text-[11px]" style={{ color: "#8B9E7A" }}>
                    Tip: add totals per item (or write only one total for the whole purchase below).
                  </div>
                </div>
              </div>
            </FormField>
            <FormField label="Description">
              <textarea className="modal-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Total (optional)">
                <input className="modal-input" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} placeholder="If empty, sum of item totals will be used" />
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
