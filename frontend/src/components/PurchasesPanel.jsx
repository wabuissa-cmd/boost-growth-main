import { useEffect, useState } from "react";
import api, { formatErr } from "../api";
import { Plus, ShoppingBag, CheckCircle, Hourglass, Clock } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "./Modal";

const STATUS_META = {
  pending: { label: "Pending", cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={12} weight="duotone"/> },
  approved: { label: "Approved", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Clock size={12} weight="duotone"/> },
  reimbursed: { label: "Reimbursed", cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={12} weight="duotone"/> },
};

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
  };
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function PurchasesPanel({ compact = true }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    const [p, c] = await Promise.all([
      api.get("/purchases"),
      api.get("/purchases/categories").catch(() => ({ data: [] })),
    ]);
    setItems(Array.isArray(p.data) ? p.data : []);
    setCategories(Array.isArray(c.data) ? c.data : []);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.item.trim() || !form.category) {
      alert("Item and category are required");
      return;
    }
    setSubmitting(true);
    try {
      const total = form.total ? parseFloat(String(form.total).replace(/[^\d.]/g, "")) : null;
      await api.post("/purchases", {
        ...form,
        total: Number.isFinite(total) ? total : null,
      });
      setOpen(false);
      setForm(emptyForm());
      load();
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
              <ShoppingBag size={16} weight="duotone" style={{ color: "#7A8A6A" }}/>
              Purchases
            </h2>
            <p className="text-xs mt-0.5 mb-0" style={{ color: "#8B9E7A" }}>Your work-related expenses</p>
          </div>
          <span className="text-xs pill bg-[#E5EBE1]" style={{ color: "#3D4F35" }}>{items.length}</span>
        </button>
        {expanded && (
          <button type="button" className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0 mt-2 w-full" onClick={() => setOpen(true)}>
            <Plus size={13}/> Log Purchase
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
            return (
              <div key={p.id} className="req-item req-item--compact">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`pill border text-[10px] ${st.cls}`}>{st.icon} {st.label}</span>
                  <span className="pill text-[10px] bg-[#F3EFE8]" style={{ color: "#606E52" }}>{p.category}</span>
                </div>
                <div className="font-bold text-xs" style={{ color: "#2C3625" }}>{p.item}</div>
                {p.description && p.description !== "-" && (
                  <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: "#5C6853" }}>{p.description}</div>
                )}
                <div className="text-[10px] mt-1 flex flex-wrap gap-x-2" style={{ color: "#8B9E7A" }}>
                  {p.qty && <span>Qty {p.qty}</span>}
                  {(p.total_display || p.total != null) && (
                    <span>{p.total_display || `${p.total} SR`}</span>
                  )}
                  {p.purchase_date && <span>{fmtDate(p.purchase_date)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <ModalBase
          title="Log Purchase"
          subtitle="Record a work-related purchase for reimbursement"
          onClose={() => { setOpen(false); setForm(emptyForm()); }}
          size="md"
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
