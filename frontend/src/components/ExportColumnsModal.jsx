import { useState } from "react";
import { ModalBase, ModalBtnPrimary, ModalBtnSecondary } from "./Modal";

export const EXPORT_COLUMN_DEFS = [
  { id: "days", label: "Day" },
  { id: "date", label: "Date" },
  { id: "status", label: "Status" },
  { id: "time", label: "Time" },
  { id: "hours", label: "# of Hrs" },
  { id: "therapist", label: "Therapist" },
  { id: "note", label: "Note" },
  { id: "service", label: "Service type" },
  { id: "location", label: "Location" },
];

const COL_LABELS = Object.fromEntries(EXPORT_COLUMN_DEFS.map(c => [c.id, c.label]));

/** Columns for invoice sheet tables (screen + print). */
export function buildInvoiceSheetColumns(selectedIds, { isSchool = false, includeAction = false } = {}) {
  const fallback = EXPORT_COLUMN_DEFS.map(c => c.id).filter(id => !(isSchool && id === "hours"));
  const ids = (selectedIds?.length ? selectedIds : fallback).filter(id => !(isSchool && id === "hours"));
  const cols = ids.map(id => ({ id, label: COL_LABELS[id] || id }));
  if (includeAction) cols.push({ id: "_action", label: "" });
  return cols;
}

export default function ExportColumnsModal({ initial, onClose, onExport, confirmLabel = "Export Excel" }) {
  const [selected, setSelected] = useState(() => {
    const set = new Set(initial || EXPORT_COLUMN_DEFS.map(c => c.id));
    return EXPORT_COLUMN_DEFS.map(c => ({ ...c, on: set.has(c.id) }));
  });

  const toggle = (id) => setSelected(s => s.map(c => (c.id === id ? { ...c, on: !c.on } : c)));

  return (
    <ModalBase
      title="Export columns"
      subtitle="Choose fields for Excel and PDF export"
      onClose={onClose}
      size="sm"
      footer={(
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Cancel</ModalBtnSecondary>
          <ModalBtnPrimary type="button" onClick={() => onExport(selected.filter(c => c.on).map(c => c.id))}>{confirmLabel}</ModalBtnPrimary>
        </>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {selected.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[#FAFAF7]">
            <input type="checkbox" checked={c.on} onChange={() => toggle(c.id)} />
            {c.label}
          </label>
        ))}
      </div>
    </ModalBase>
  );
}
