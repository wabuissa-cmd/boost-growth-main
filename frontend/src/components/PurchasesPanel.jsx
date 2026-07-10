import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../api";
import { Plus, ShoppingBag, CheckCircle, Hourglass, Clock, Trash } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";
import { computePurchaseTotal, formatPurchaseTotal, parsePurchaseNumber, sumLineItems } from "../purchaseUtils";

const STATUS_META = {
  pending: { label: "Pending", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={12} weight="duotone"/> },
  supervisor_approved: { label: "Supervisor approved", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Clock size={12} weight="duotone"/> },
  supervisor_rejected: { label: "Rejected", cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <Hourglass size={12} weight="duotone"/> },
  pending_manager: { label: "With manager", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={12} weight="duotone"/> },
  manager_approved: { label: "Manager approved", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <CheckCircle size={12} weight="duotone"/> },
  approved: { label: "Approved", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Clock size={12} weight="duotone"/> },
  reimbursed: { label: "Reimbursed", cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={12} weight="duotone"/> },
};

function emptyLineItem() {
  return { item: "", qty: "1", unit_price: "", total: "" };
}

function emptyForm() {
  return {
    item: "",
    category: "",
    description: "",
    qty: "1",
    unit_price: "",
    total: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
    line_items: [emptyLineItem()],
    invoiceFile: null,
  };
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function PurchaseTotalGrid({ purchase }) {
  const total = computePurchaseTotal(purchase);
  const lines = purchase?.line_items || [];
  const linesSum = sumLineItems(lines);
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="p-2.5 rounded-xl border col-span-2" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
        <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>TOTAL</div>
        <div className="text-base font-bold" style={{ color: "#2C3625" }}>{formatPurchaseTotal(purchase)}</div>
      </div>
      {lines.length > 0 && (
        <div className="p-2 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>LINE ITEMS</div>
          <div className="text-sm font-bold" style={{ color: "#2C3625" }}>{lines.length}</div>
        </div>
      )}
      {linesSum != null && lines.length > 1 && (
        <div className="p-2 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>ITEMS SUM</div>
          <div className="text-sm font-bold" style={{ color: "#2C3625" }}>{linesSum.toLocaleString()} SR</div>
        </div>
      )}
      {purchase?.qty && (
        <div className="p-2 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>QTY</div>
          <div className="text-sm font-bold" style={{ color: "#2C3625" }}>{purchase.qty}</div>
        </div>
      )}
      {total != null && purchase?.unit_price && (
        <div className="p-2 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>UNIT</div>
          <div className="text-sm font-bold" style={{ color: "#2C3625" }}>{purchase.unit_price} SR</div>
        </div>
      )}
    </div>
  );
}

export default function PurchasesPanel({ compact = true, onSubmitted }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    const [p, c] = await Promise.all([
      api.get("/purchases"),
      api.get("/purchases/categories").catch(() => ({ data: [] })),
    ]);
    setItems(Array.isArray(p.data) ? p.data : []);
    setCategories(Array.isArray(c.data) ? c.data : []);
  };

  useEffect(() => { load(); }, []);

  const selected = useMemo(
    () => items.find(p => p.id === selectedId) || null,
    [items, selectedId]
  );

  const formLiveTotal = useMemo(() => {
    const manual = parsePurchaseNumber(form.total);
    if (manual != null) return manual;
    return sumLineItems(form.line_items);
  }, [form.total, form.line_items]);

  const updateLineItem = (idx, patch) => {
    setForm(f => {
      const line_items = [...(f.line_items || [])];
      line_items[idx] = { ...line_items[idx], ...patch };
      return { ...f, line_items };
    });
  };

  const addLineItem = () => {
    setForm(f => ({ ...f, line_items: [...(f.line_items || []), emptyLineItem()] }));
  };

  const removeLineItem = (idx) => {
    setForm(f => ({
      ...f,
      line_items: (f.line_items || []).filter((_, i) => i !== idx),
    }));
  };

  const submit = async () => {
    const lines = (form.line_items || []).filter(li => (li.item || "").trim());
    const primaryItem = (form.item || "").trim() || lines[0]?.item?.trim();
    if (!primaryItem || !form.category) {
      alert("Item and category are required");
      return;
    }
    setSubmitting(true);
    const invoiceFile = form.invoiceFile;
    try {
      const linePayload = lines.map(li => ({
        item: li.item.trim(),
        qty: li.qty || "1",
        unit_price: li.unit_price || "",
        total: li.total ? parseFloat(String(li.total).replace(/[^\d.]/g, "")) : null,
      }));
      const total = form.total
        ? parseFloat(String(form.total).replace(/[^\d.]/g, ""))
        : linePayload.reduce((acc, li) => acc + (Number(li.total) || 0), 0) || formLiveTotal || null;
      const { data: created } = await api.post("/purchases", {
        item: primaryItem,
        category: form.category,
        description: form.description,
        qty: form.qty,
        unit_price: form.unit_price,
        total: Number.isFinite(total) ? total : null,
        purchase_date: form.purchase_date,
        notes: form.notes,
        line_items: linePayload.length > 1 || !form.item ? linePayload : undefined,
      });
      setOpen(false);
      setForm(emptyForm());
      onSubmitted?.();
      void load();
      if (invoiceFile && created?.id) {
        try {
          const fd = new FormData();
          fd.append("file", invoiceFile);
          await api.post(`/purchases/${created.id}/invoice`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          void load();
        } catch (uploadErr) {
          alert(`Purchase saved but invoice upload failed: ${formatErr(uploadErr.response?.data?.detail) || uploadErr.message}`);
        }
      }
    } catch (e) {
      alert(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`req-panel-purchases${compact ? " req-panel-purchases--compact" : ""}`}>
      <div className="req-panel-head req-panel-head--tight">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <div>
            <h2 className="font-bold text-sm m-0 flex items-center gap-1.5" style={{ color: "#2C3625" }}>
              <ShoppingBag size={14} weight="duotone" style={{ color: "#7A8A6A" }}/>
              Employees' Purchases
            </h2>
            <p className="text-xs mt-0.5 mb-0" style={{ color: "#8B9E7A" }}>Your work-related expenses</p>
          </div>
          <span className="text-xs pill bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>{items.length}</span>
        </button>
        {expanded && (
          <button type="button" className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0 mt-2 w-full" onClick={() => setOpen(true)}>
            <Plus size={12}/> Log Purchase
          </button>
        )}
      </div>

      {expanded && (
        <div className="req-panel-list req-panel-list--compact">
          {items.length === 0 && (
            <div className="p-6 text-center text-xs" style={{ color: "#8B9E7A" }}>No purchases logged yet</div>
          )}
          {items.map(p => {
            const st = STATUS_META[p.status] || STATUS_META.pending;
            const active = selectedId === p.id;
            return (
              <div
                key={p.id}
                className={`req-item req-item--compact${active ? " ring-1 ring-[#7A8A6A]" : ""}`}
                onClick={() => setSelectedId(active ? null : p.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`pill border text-[10px] ${st.cls}`}>{st.icon} {st.label}</span>
                  <span className="pill text-[10px] bg-[#F3EFE8]" style={{ color: "#606E52" }}>{p.category}</span>
                </div>
                <div className="font-bold text-xs" style={{ color: "#2C3625" }}>{p.item}</div>
                {(p.line_items || []).length > 1 && (
                  <div className="text-[10px] mt-0.5" style={{ color: "#8B9E7A" }}>{p.line_items.length} line items</div>
                )}
                {p.description && p.description !== "-" && (
                  <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: "#5C6853" }}>{p.description}</div>
                )}
                {(p.approval_trail || []).length > 0 && (
                  <div className="text-[10px] mt-1 italic" style={{ color: "#7A8A6A" }}>
                    {(p.approval_trail || []).slice(-2).map(t => t.action).join(" → ")}
                  </div>
                )}
                <div className="text-[10px] mt-1 flex flex-wrap gap-x-2" style={{ color: "#8B9E7A" }}>
                  {p.qty && <span>Qty {p.qty}</span>}
                  <span className="font-bold" style={{ color: "#6B5218" }}>{formatPurchaseTotal(p)}</span>
                  {p.purchase_date && <span>{fmtDate(p.purchase_date)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && selected && (
        <div className="req-panel-detail mx-2 mb-2 p-3 rounded-xl border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="font-bold text-xs mb-2" style={{ color: "#2C3625" }}>{selected.item}</div>
          <PurchaseTotalGrid purchase={selected} />
          {(selected.line_items || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(selected.line_items || []).map((li, idx) => (
                <div key={idx} className="flex justify-between text-[10px]" style={{ color: "#5C6853" }}>
                  <span className="truncate pr-2">{li.item || `Item ${idx + 1}`}</span>
                  <span className="font-semibold shrink-0" style={{ color: "#6B5218" }}>
                    {li.total != null ? `${li.total} SR` : (li.unit_price ? `${li.qty || 1} × ${li.unit_price}` : "—")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {open && (
        <ModalBase
          title="Log Purchase"
          subtitle="Record a work-related purchase for reimbursement"
          onClose={submitting ? () => {} : () => { setOpen(false); setForm(emptyForm()); }}
          size="md"
          mobileCompact
          compact
          footer={(
            <>
              <ModalBtnSecondary type="button" onClick={() => { setOpen(false); setForm(emptyForm()); }}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary type="button" onClick={submit} disabled={submitting}>
                {submitting ? "Saving…" : "Submit"}
              </ModalBtnPrimary>
            </>
          )}
        >
          <FormSection title="Purchase details">
            <FormField label="Category" required>
              <select className="modal-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Description">
              <textarea className="modal-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: "#5C6853" }}>Line items</span>
                <button type="button" className="btn btn-outline text-[10px] py-1 px-2" onClick={addLineItem}>
                  <Plus size={12}/> Add Item
                </button>
              </div>
              {(form.line_items || []).map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2" style={{ borderColor: "#E2DDD4" }}>
                  <div className="col-span-12 sm:col-span-5">
                    <input className="modal-input text-xs" placeholder="Item name" value={li.item} onChange={e => updateLineItem(idx, { item: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input className="modal-input text-xs" placeholder="Qty" value={li.qty} onChange={e => updateLineItem(idx, { qty: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input className="modal-input text-xs" placeholder="Amount" value={li.total} onChange={e => updateLineItem(idx, { total: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-3 flex justify-end">
                    {(form.line_items || []).length > 1 && (
                      <button type="button" className="btn btn-ghost p-1 text-red-700" onClick={() => removeLineItem(idx)} aria-label="Remove item">
                        <Trash size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <FormField label="Purchase date">
                <input type="date" className="modal-input" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
              </FormField>
              <FormField label="Total (optional)">
                <input className="modal-input" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} placeholder="Auto-sum from items" />
                {formLiveTotal != null && !form.total && (
                  <div className="text-[10px] mt-1 font-bold" style={{ color: "#6B5218" }}>
                    Computed: {formLiveTotal.toLocaleString()} SR
                  </div>
                )}
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className="modal-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </FormField>
            <FormField label="Please upload invoice here (optional)">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="modal-input text-xs"
                onChange={e => setForm({ ...form, invoiceFile: e.target.files?.[0] || null })}
              />
            </FormField>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
