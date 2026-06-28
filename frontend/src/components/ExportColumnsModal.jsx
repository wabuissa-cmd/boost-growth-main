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
];

/** Optional columns not in standard attendance Excel sheets */
export const EXPORT_EXTRA_COLUMN_DEFS = [
  { id: "service", label: "Service type" },
  { id: "location", label: "Location" },
];

const COL_LABELS = Object.fromEntries(
  [...EXPORT_COLUMN_DEFS, ...EXPORT_EXTRA_COLUMN_DEFS].map(c => [c.id, c.label])
);

/** Columns for invoice sheet tables (screen + print) — matches Excel payment file order. */
export function buildInvoiceSheetColumns(selectedIds, { isSchool = false, includeAction = false } = {}) {
  const fallback = EXPORT_COLUMN_DEFS.map(c => c.id).filter(id => !(isSchool && id === "hours"));
  const ids = (selectedIds?.length ? selectedIds : fallback).filter(id => !(isSchool && id === "hours"));
  const cols = ids.map(id => ({ id, label: COL_LABELS[id] || id }));
  if (includeAction) cols.push({ id: "_action", label: "" });
  return cols;
}

export default function ExportColumnsModal({
  initial,
  onClose,
  onExport,
  confirmLabel = "Export Excel",
  showSealOption = false,
  initialIncludeSeal = false,
  initialSealPosition = "right",
}) {
  const [selected, setSelected] = useState(() => {
    const set = new Set(initial || EXPORT_COLUMN_DEFS.map(c => c.id));
    return EXPORT_COLUMN_DEFS.map(c => ({ ...c, on: set.has(c.id) }));
  });
  const [includeSeal, setIncludeSeal] = useState(initialIncludeSeal);
  const [sealPosition, setSealPosition] = useState(initialSealPosition === "left" ? "left" : "right");

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
          <ModalBtnPrimary
            type="button"
            onClick={() => onExport(
              selected.filter(c => c.on).map(c => c.id),
              showSealOption ? { includeSeal, sealPosition } : undefined,
            )}
          >
            {confirmLabel}
          </ModalBtnPrimary>
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
        {EXPORT_EXTRA_COLUMN_DEFS.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[#FAFAF7] opacity-80">
            <input
              type="checkbox"
              checked={selected.find(x => x.id === c.id)?.on}
              onChange={() => {
                const inList = selected.some(x => x.id === c.id);
                if (inList) setSelected(s => s.map(x => (x.id === c.id ? { ...x, on: !x.on } : x)));
                else setSelected(s => [...s, { ...c, on: true }]);
              }}
            />
            {c.label} <span className="text-[10px] text-[#8B9E7A]">(extra)</span>
          </label>
        ))}
      </div>
      {showSealOption && (
        <div className="mt-4 pt-4 border-t border-[#EDE9E3] space-y-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 accent-[#5C8A47]"
              checked={includeSeal}
              onChange={e => setIncludeSeal(e.target.checked)}
            />
            <span>
              <span className="font-semibold" style={{ color: "#2C3625" }}>Include company seal on PDF</span>
              <span className="block text-xs mt-0.5" style={{ color: "#8B9E7A" }}>
                Uses <code className="text-[10px]">/brand-assets/company-seal.png</code> when uploaded
              </span>
            </span>
          </label>
          {includeSeal && (
            <div className="flex gap-2">
              {["left", "right"].map(pos => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setSealPosition(pos)}
                  className={`pill border text-xs px-3 py-1.5 ${sealPosition === pos ? "bg-[#E5EBE1] border-[#5C8A47]" : "border-[#DDD8D0]"}`}
                >
                  Seal on {pos}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ModalBase>
  );
}
