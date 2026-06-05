import { useEffect, useState } from "react";
import api from "../api";
import { ModalBase, FormField, ModalBtnPrimary, ModalBtnSecondary } from "./Modal";
import { Plus, Trash } from "@phosphor-icons/react";

export default function ScheduleHolidaysModal({ weekStartISO, weekEndISO, onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/schedule/closures", { params: { from_date: weekStartISO, to_date: weekEndISO } });
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, [weekStartISO, weekEndISO]);

  const add = async () => {
    if (!date || !label.trim()) return;
    setBusy(true);
    try {
      await api.post("/schedule/closures", { date, label: label.trim() });
      setDate("");
      setLabel("");
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/schedule/closures/${id}`);
    await load();
    onChanged?.();
  };

  return (
    <ModalBase
      title="Official Holidays & Closures"
      subtitle="Closed days appear shaded on the schedule for all therapists"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Done</ModalBtnSecondary>
          <ModalBtnPrimary type="button" onClick={add} disabled={busy || !date || !label.trim()}>Add closure</ModalBtnPrimary>
        </>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <FormField label="Date">
          <input type="date" className="modal-input" value={date} onChange={e => setDate(e.target.value)} />
        </FormField>
        <FormField label="Label">
          <input className="modal-input" placeholder="National Day, Eid…" value={label} onChange={e => setLabel(e.target.value)} />
        </FormField>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {items.length === 0 && <p className="ui-caption text-center py-4">No closures this week</p>}
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E4DE] bg-[#FAFAF7]">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{it.date}</div>
              <div className="text-[11px]" style={{ color: "#5C6853" }}>{it.label}</div>
            </div>
            <button type="button" onClick={() => remove(it.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14} /></button>
          </div>
        ))}
      </div>
    </ModalBase>
  );
}
