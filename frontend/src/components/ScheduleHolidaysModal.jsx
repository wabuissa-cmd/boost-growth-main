import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { ModalBase, FormField, ModalBtnPrimary, ModalBtnSecondary } from "./Modal";
import { Trash } from "@phosphor-icons/react";
import { getTherapistScheduleName, sortTherapistsForSchedule } from "../scheduleConstants";

export default function ScheduleHolidaysModal({ weekStartISO, weekEndISO, therapists = [], onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const sortedTherapists = useMemo(
    () => sortTherapistsForSchedule(therapists),
    [therapists]
  );

  const therapistName = useCallback(
    (id) => getTherapistScheduleName(sortedTherapists.find(t => t.id === id)) || "—",
    [sortedTherapists]
  );

  const load = useCallback(async () => {
    const { data } = await api.get("/schedule/closures", { params: { from_date: weekStartISO, to_date: weekEndISO } });
    setItems(Array.isArray(data) ? data : []);
  }, [weekStartISO, weekEndISO]);

  useEffect(() => { load(); }, [load]);

  const toggleTherapist = (id) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const add = async () => {
    if (!date || !label.trim()) return;
    if (scope === "selected" && selectedIds.length === 0) {
      alert("Select at least one therapist");
      return;
    }
    setBusy(true);
    try {
      await api.post("/schedule/closures", {
        date,
        label: label.trim(),
        therapist_ids: scope === "all" ? [] : selectedIds,
      });
      setDate("");
      setLabel("");
      setScope("all");
      setSelectedIds([]);
      await load();
      onChanged?.();
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not save closure");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/schedule/closures/${id}`);
    await load();
    onChanged?.();
  };

  const scopeSummary = (it) => {
    const ids = it.therapist_ids || [];
    if (!ids.length) return "All therapists";
    if (ids.length <= 2) return ids.map(therapistName).join(", ");
    return `${ids.length} therapists`;
  };

  return (
    <ModalBase
      title="Official Holidays & Closures"
      subtitle="Apply to everyone or selected therapists only (e.g. school support days)"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Done</ModalBtnSecondary>
          <ModalBtnPrimary
            type="button"
            onClick={add}
            disabled={busy || !date || !label.trim() || (scope === "selected" && selectedIds.length === 0)}
          >
            Add closure
          </ModalBtnPrimary>
        </>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <FormField label="Date">
          <input type="date" className="modal-input" value={date} onChange={e => setDate(e.target.value)} />
        </FormField>
        <FormField label="Label">
          <input className="modal-input" placeholder="National Day, Eid…" value={label} onChange={e => setLabel(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Applies to">
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => { setScope("all"); setSelectedIds([]); }}
            className={`pill px-3 py-1.5 text-xs font-semibold border ${scope === "all" ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E8E4DE]"}`}
          >
            All therapists
          </button>
          <button
            type="button"
            onClick={() => setScope("selected")}
            className={`pill px-3 py-1.5 text-xs font-semibold border ${scope === "selected" ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E8E4DE]"}`}
          >
            Selected only
          </button>
        </div>
        {scope === "selected" && (
          <div className="max-h-40 overflow-y-auto border border-[#E8E4DE] rounded-xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {sortedTherapists.map(t => (
              <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1 rounded-lg hover:bg-[#FAFAF7]">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleTherapist(t.id)}
                />
                <span className="truncate">{getTherapistScheduleName(t)}</span>
              </label>
            ))}
          </div>
        )}
      </FormField>

      <div className="space-y-2 max-h-48 overflow-y-auto mt-4">
        {items.length === 0 && <p className="ui-caption text-center py-4">No closures this week</p>}
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E4DE] bg-[#FAFAF7]">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{it.date}</div>
              <div className="text-[11px] font-semibold truncate" style={{ color: "#2C3625" }}>{it.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "#8B9E7A" }}>{scopeSummary(it)}</div>
            </div>
            <button type="button" onClick={() => remove(it.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14} /></button>
          </div>
        ))}
      </div>
    </ModalBase>
  );
}
