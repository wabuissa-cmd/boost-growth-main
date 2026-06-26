import { useMemo, useState } from "react";
import api from "../api";
import { ModalBase, FormSection, FormField, ModalBtnPrimary, ModalBtnSecondary } from "./Modal";
import { formatMoney } from "../billingUtils";
import { formatServiceTypeDisplay } from "../attendanceUtils";

function toDateInput(val) {
  return (val || "").slice(0, 10);
}

export default function InvoiceEditModal({ invoice, clientName, onClose, onSaved }) {
  const isSchool = (invoice?.service_type || "").toUpperCase() === "SS";
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number || "");
  const [paymentStatus, setPaymentStatus] = useState(invoice?.payment_status || "pending");
  const [isClosed, setIsClosed] = useState(!!invoice?.is_closed);
  const [closeDate, setCloseDate] = useState(toDateInput(invoice?.close_date));
  const [startDate, setStartDate] = useState(toDateInput(invoice?.start_date || invoice?.created_at));
  const [periodTo, setPeriodTo] = useState(toDateInput(invoice?.period_to));
  const [packageSize, setPackageSize] = useState(invoice?.package_size ?? "");
  const [amount, setAmount] = useState(invoice?.amount ?? "");
  const [installmentPct, setInstallmentPct] = useState(invoice?.installment_percent ?? "");
  const [amountPaid, setAmountPaid] = useState(invoice?.amount_paid ?? "");
  const [reminder, setReminder] = useState(toDateInput(invoice?.next_payment_reminder_at));
  const [paymentNotes, setPaymentNotes] = useState(invoice?.payment_notes || "");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [saving, setSaving] = useState(false);

  const computedPaid = useMemo(() => {
    const a = parseFloat(amount);
    const p = parseFloat(installmentPct);
    if (Number.isFinite(a) && Number.isFinite(p) && p > 0) return (a * p / 100).toFixed(2);
    return amountPaid;
  }, [amount, installmentPct, amountPaid]);

  const save = async () => {
    const trimmed = (invoiceNumber || "").trim();
    if (!trimmed) {
      alert("Invoice number is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        invoice_number: trimmed,
        payment_status: paymentStatus,
        is_closed: isClosed,
        close_date: isClosed ? (closeDate || new Date().toISOString().slice(0, 10)) : null,
        start_date: startDate || invoice?.start_date || null,
        period_to: periodTo || null,
        package_size: packageSize === "" ? invoice?.package_size : parseFloat(packageSize),
        amount: amount === "" ? null : parseFloat(amount),
        next_payment_reminder_at: reminder || null,
        payment_notes: paymentNotes || null,
        notes: notes || null,
        service_type: invoice?.service_type || null,
        period_from: invoice?.period_from || null,
      };
      if (installmentPct !== "" && installmentPct != null) {
        payload.installment_percent = parseFloat(installmentPct);
        const a = parseFloat(amount);
        if (Number.isFinite(a) && Number.isFinite(payload.installment_percent)) {
          payload.amount_paid = round2(a * payload.installment_percent / 100);
        }
      } else {
        payload.amount_paid = amountPaid === "" ? null : parseFloat(amountPaid);
      }
      const r = await api.put(`/invoices/${invoice.id}`, payload);
      onSaved(r.data);
      onClose();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not save invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBase
      title={`Edit Invoice · ${clientName || ""}`}
      subtitle={invoice?.invoice_number}
      onClose={onClose}
      size="sm"
      elevated
      footer={
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary type="button" onClick={save} disabled={saving} data-testid="save-invoice-btn">
            {saving ? "Saving…" : "Save"}
          </ModalBtnPrimary>
        </>
      }
    >
      <FormSection title="Invoice">
        <FormField label="Invoice number" required>
          <input
            className="modal-input"
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
            data-testid="edit-inv-number"
          />
        </FormField>
        <FormField label="Service">
          <input
            className="modal-input"
            readOnly
            value={formatServiceTypeDisplay(invoice?.service_type) || invoice?.service_type || "—"}
          />
        </FormField>
        <FormField label="Invoice status">
          <select
            className="modal-input"
            value={isClosed ? "closed" : "open"}
            onChange={e => setIsClosed(e.target.value === "closed")}
            data-testid="edit-inv-status"
          >
            <option value="open">Open — sessions can be edited</option>
            <option value="closed">Closed — view only</option>
          </select>
        </FormField>
        {isClosed && (
          <FormField label="Close date">
            <input
              type="date"
              className="modal-input"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
            />
          </FormField>
        )}
        <FormField label="Start date">
          <input
            type="date"
            className="modal-input"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </FormField>
        <FormField label="Package end date">
          <input
            type="date"
            className="modal-input"
            value={periodTo}
            onChange={e => setPeriodTo(e.target.value)}
          />
        </FormField>
        <FormField label={isSchool ? "Package size (weeks/sessions)" : "Package size (hours)"}>
          <input
            type="number"
            min="0"
            step={isSchool ? "1" : "0.5"}
            className="modal-input"
            value={packageSize}
            onChange={e => setPackageSize(e.target.value)}
          />
        </FormField>
        <FormField label="Notes">
          <textarea
            className="modal-input"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Internal invoice notes"
          />
        </FormField>
      </FormSection>

      <FormSection title="Payment">
        <FormField label="Payment status">
          <select
            className="modal-input"
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            data-testid="edit-payment-status"
          >
            <option value="pending">Unpaid — no payment received</option>
            <option value="partial">Partial — installment, balance remaining</option>
            <option value="complete">Paid in full</option>
          </select>
        </FormField>
        <FormField label="Invoice total (SAR)">
          <input
            type="number"
            min="0"
            step="1"
            className="modal-input"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Installment (%)">
          <select className="modal-input" value={installmentPct} onChange={e => setInstallmentPct(e.target.value)}>
            <option value="">Custom amount paid</option>
            <option value="25">25% paid</option>
            <option value="50">50% paid</option>
            <option value="75">75% paid</option>
            <option value="100">100% paid in full</option>
          </select>
        </FormField>
        <FormField label={installmentPct ? "Calculated amount paid (SAR)" : "Amount paid (SAR)"}>
          <input
            type="number"
            min="0"
            step="0.01"
            className="modal-input"
            value={installmentPct ? computedPaid : amountPaid}
            readOnly={Boolean(installmentPct)}
            onChange={e => setAmountPaid(e.target.value)}
          />
        </FormField>
        {amount && computedPaid && installmentPct && parseFloat(installmentPct) < 100 && (
          <p className="ui-caption">Remaining: {formatMoney(parseFloat(amount) - parseFloat(computedPaid))}</p>
        )}
        {(paymentStatus === "partial" || paymentStatus === "pending") && (
          <>
            <FormField label="Next payment reminder date">
              <input type="date" className="modal-input" value={reminder} onChange={e => setReminder(e.target.value)} />
            </FormField>
            <FormField label="Payment notes">
              <textarea
                className="modal-input"
                rows={2}
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="e.g. 2nd installment due after Eid"
              />
            </FormField>
          </>
        )}
      </FormSection>
    </ModalBase>
  );
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
