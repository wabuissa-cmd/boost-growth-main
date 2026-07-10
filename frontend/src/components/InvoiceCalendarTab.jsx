import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { ModalBase, FormSection, FormField, ModalBtnPrimary, ModalBtnSecondary } from "./Modal";
import { fmtDate } from "../attendanceUtils";
import { formatMoney, paymentStatusLabel } from "../billingUtils";

function isoMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(y, m1) {
  // m1 is 1..12
  return new Date(y, m1, 0).getDate();
}

function startDowSundayZero(y, m1) {
  return new Date(y, m1 - 1, 1).getDay(); // 0=Sun
}

function addMonths(month, delta) {
  const [yS, mS] = (month || "").split("-");
  const y = parseInt(yS, 10);
  const m = parseInt(mS, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return isoMonth(new Date());
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return isoMonth(d);
}

function buildDayKey(month, day) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function severityForDue(e, todayISO) {
  const due = (e?.due_date || e?.date || "").slice(0, 10);
  if (!due) return "normal";
  const deltaDays = Math.floor((Date.parse(due) - Date.parse(todayISO)) / 86400000);
  if (deltaDays < 0) return "overdue";
  if (deltaDays <= 2) return "soon";
  return "normal";
}

function EventPill({ e, onEdit }) {
  const today = new Date().toISOString().slice(0, 10);
  const sev = severityForDue(e, today);
  const bg = sev === "overdue" ? "#F8EBE7" : sev === "soon" ? "#FAF0D1" : "#E5EBE1";
  const color = sev === "overdue" ? "#8A3F27" : sev === "soon" ? "#6B5218" : "#2C5035";
  const label = e.kind === "manual"
    ? (e.title || "Manual")
    : `${e.client_name || "Client"} · ${e.invoice_number || "Invoice"}`;
  const hint = e.kind === "forecast"
    ? `Remaining ${Number(e.hours_remaining ?? 0).toFixed(1)}h`
    : (e.notes || "");
  return (
    <button
      type="button"
      className="w-full text-left pill px-2 py-1 border text-[10px] font-bold truncate hover:opacity-90"
      style={{ background: bg, color, borderColor: "#DDD8D0" }}
      title={hint || label}
      onClick={() => onEdit?.(e)}
    >
      {label}
    </button>
  );
}

function ForecastDetailModal({ event, onClose }) {
  const balance = (() => {
    const amount = parseFloat(event?.amount);
    const paid = parseFloat(event?.amount_paid);
    if (!Number.isFinite(amount)) return null;
    return Math.max(0, amount - (Number.isFinite(paid) ? paid : 0));
  })();

  return (
    <ModalBase
      title={`${event?.client_name || "Client"} · ${event?.invoice_number || "Invoice"}`}
      subtitle={`Forecast due ${fmtDate(event?.date)}`}
      onClose={onClose}
      size="sm"
      elevated
      footer={<ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>}
    >
      <FormSection title="Package">
        <FormField label="Package size">
          <input className="modal-input" readOnly value={event?.package_size != null ? `${event.package_size}h` : "—"} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hours used">
            <input className="modal-input" readOnly value={event?.hours_used != null ? `${Number(event.hours_used).toFixed(1)}h` : "—"} />
          </FormField>
          <FormField label="Hours remaining">
            <input className="modal-input" readOnly value={event?.hours_remaining != null ? `${Number(event.hours_remaining).toFixed(1)}h` : "—"} />
          </FormField>
        </div>
        {event?.weekly_hours != null && (
          <FormField label="Est. weekly hours">
            <input className="modal-input" readOnly value={`${Number(event.weekly_hours).toFixed(1)}h`} />
          </FormField>
        )}
      </FormSection>
      <FormSection title="Account">
        <FormField label="Payment status">
          <input className="modal-input" readOnly value={paymentStatusLabel(event?.payment_status)} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Invoice total">
            <input className="modal-input" readOnly value={formatMoney(event?.amount)} />
          </FormField>
          <FormField label="Paid">
            <input className="modal-input" readOnly value={formatMoney(event?.amount_paid)} />
          </FormField>
          <FormField label="Balance">
            <input className="modal-input" readOnly value={formatMoney(balance)} />
          </FormField>
        </div>
      </FormSection>
    </ModalBase>
  );
}

function ManualModal({ initial, month, onClose, onSaved }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState((initial?.date || `${month}-01`).slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload = { title: (title || "").trim(), date, notes: (notes || "").trim() || null };
    if (!payload.title) {
      alert("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (initial?.id) {
        await api.put(`/billing/invoice-calendar/manual/${initial.id}`, payload);
      } else {
        await api.post("/billing/invoice-calendar/manual", payload);
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not save entry");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!initial?.id) return;
    if (!window.confirm("Delete this calendar entry?")) return;
    setSaving(true);
    try {
      await api.delete(`/billing/invoice-calendar/manual/${initial.id}`);
      onSaved?.();
      onClose?.();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not delete entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBase
      title={initial?.id ? "Edit calendar entry" : "Add calendar entry"}
      subtitle="Manual entries show on the invoice calendar"
      onClose={onClose}
      size="sm"
      elevated
      footer={
        <>
          {initial?.id && (
            <button type="button" className="btn btn-ghost text-sm text-red-700 mr-auto" onClick={del} disabled={saving}>
              Delete
            </button>
          )}
          <ModalBtnSecondary type="button" onClick={onClose} disabled={saving}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</ModalBtnPrimary>
        </>
      }
    >
      <FormSection title="Entry">
        <FormField label="Title" required>
          <input className="modal-input" value={title} onChange={e => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Date" required>
          <input type="date" className="modal-input" value={date} onChange={e => setDate(e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <textarea className="modal-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </FormField>
      </FormSection>
    </ModalBase>
  );
}

export default function InvoiceCalendarTab({ embedded = false }) {
  const [month, setMonth] = useState(() => isoMonth(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/billing/invoice-calendar", { params: { month } });
      setData(r.data || null);
    } catch (e) {
      setData({ month, events: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventsByDay = useMemo(() => {
    const map = {};
    (data?.events || []).forEach((e) => {
      const key = (e.date || "").slice(0, 10);
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push(e);
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (a.kind || "").localeCompare(b.kind || "") || (a.client_name || "").localeCompare(b.client_name || ""));
    });
    return map;
  }, [data]);

  const [yS, mS] = month.split("-");
  const y = parseInt(yS, 10);
  const m1 = parseInt(mS, 10);
  const dim = Number.isFinite(y) && Number.isFinite(m1) ? daysInMonth(y, m1) : 30;
  const pad = Number.isFinite(y) && Number.isFinite(m1) ? startDowSundayZero(y, m1) : 0;
  const totalCells = Math.ceil((pad + dim) / 7) * 7;

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={embedded ? "" : "portal-content-panel portal-page-body"}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="font-display text-lg font-semibold" style={{ color: "#2C3625" }}>Invoice Calendar</div>
          <div className="text-xs" style={{ color: "#8B9E7A" }}>
            Forecasted invoice end dates (HS) based on remaining hours + schedule/sessions, plus manual entries.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary text-xs" onClick={() => setMonth(addMonths(month, -1))}>←</button>
          <input
            type="month"
            className="input text-xs"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          <button type="button" className="btn btn-secondary text-xs" onClick={() => setMonth(addMonths(month, 1))}>→</button>
          <button type="button" className="btn btn-primary text-xs" onClick={() => setModal({ kind: "manual", initial: null })}>
            + Add
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center"><div className="spinner mx-auto" /></div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dow.map(d => (
              <div key={d} className="text-[10px] font-bold tracking-wider text-center" style={{ color: "#5C6853" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - pad + 1;
              const inMonth = dayNum >= 1 && dayNum <= dim;
              const key = inMonth ? buildDayKey(month, dayNum) : "";
              const list = key ? (eventsByDay[key] || []) : [];
              return (
                <div
                  key={i}
                  className="rounded-xl border p-2 min-h-[88px] flex flex-col gap-1"
                  style={{
                    borderColor: "#E2DDD4",
                    background: inMonth ? "#FFFFFF" : "#FAFAF7",
                    opacity: inMonth ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold" style={{ color: "#2C3625" }}>
                      {inMonth ? dayNum : "—"}
                    </div>
                    {inMonth && (
                      <button
                        type="button"
                        className="text-[10px] underline"
                        style={{ color: "#6B8F71" }}
                        onClick={() => setModal({ kind: "manual", initial: { date: key, title: "" } })}
                        title="Add manual entry"
                      >
                        Add
                      </button>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                    {list.slice(0, 4).map((e) => (
                      <EventPill
                        key={e.id}
                        e={e}
                        onEdit={(ev) => {
                          if (ev.kind === "manual") setModal({ kind: "manual", initial: ev });
                          else if (ev.kind === "forecast") setModal({ kind: "forecast", initial: ev });
                        }}
                      />
                    ))}
                    {list.length > 4 && (
                      <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
                        +{list.length - 4} more…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-xs" style={{ color: "#5C6853" }}>
            <span className="font-bold">Soon</span> (≤2 days) and <span className="font-bold">overdue</span> due dates are highlighted.
            Forecast items use <span className="font-bold">invoice “Package end date”</span> when set; otherwise they estimate from schedule + recent session history.
          </div>

          <div className="mt-3">
            <div className="text-xs font-bold tracking-wider mb-2" style={{ color: "#5C6853" }}>UPCOMING THIS MONTH</div>
            {(data?.events || []).length === 0 ? (
              <div className="text-xs" style={{ color: "#8B9E7A" }}>No calendar items in this month.</div>
            ) : (
              <div className="space-y-2">
                {(data?.events || []).map((e) => (
                  <div key={e.id} className="p-3 rounded-xl border flex items-start justify-between gap-3" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate" style={{ color: "#2C3625" }}>
                        {e.kind === "manual" ? (e.title || "Manual") : `${e.client_name || "Client"} · ${e.invoice_number || "Invoice"}`}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#8B9E7A" }}>
                        {fmtDate(e.date)}{e.kind === "forecast" && e.hours_remaining != null ? ` · ${Number(e.hours_remaining).toFixed(1)}h remaining` : ""}
                      </div>
                      {e.kind === "manual" && e.notes && (
                        <div className="text-xs mt-1" style={{ color: "#5C6853" }}>{e.notes}</div>
                      )}
                    </div>
                    {e.kind === "manual" ? (
                      <button type="button" className="btn btn-secondary text-xs shrink-0" onClick={() => setModal({ kind: "manual", initial: e })}>
                        Edit
                      </button>
                    ) : (
                      <button type="button" className="btn btn-secondary text-xs shrink-0" onClick={() => setModal({ kind: "forecast", initial: e })}>
                        Details
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {modal?.kind === "manual" && (
        <ManualModal
          initial={modal.initial}
          month={month}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {modal?.kind === "forecast" && (
        <ForecastDetailModal event={modal.initial} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

