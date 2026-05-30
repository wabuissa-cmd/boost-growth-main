import { useEffect, useMemo, useState, useCallback } from "react";
import api, { DAYS_EN, DAYS_SHORT, TIME_SLOTS, SERVICE_CODES, startOfWeek, addDays, toISODate, formatDateRange } from "../api";
import { readable } from "../childColors";
import {
  getCellStyle, META_SERVICE_CODES, MERGE_QUICK, SCHEDULE_COLOR_SWATCHES,
  SERVICE_CELL_COLORS, buildSlotRange, isSlotSelectable, slotIndex,
  resolveClientScheduleColor,
} from "../scheduleUtils";
import { useAuth } from "../auth";
import {
  CaretLeft, CaretRight, Trash, Copy, BellRinging, X, House, MagnifyingGlass,
  MagnifyingGlassPlus, MagnifyingGlassMinus, Printer, Info, GridFour,
  CopySimple, Table, CalendarBlank, ArrowLeft, ArrowRight, ArrowsMerge
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary, ModalBtnDanger,
} from "../components/Modal";

const STATES = [
  { id: "normal", label: "Normal", swatch: "#E5EBE1" },
  { id: "cancel_therapist", label: "Therapist Cancel", swatch: "#FFF4C4" },
  { id: "cancel_child", label: "Client Cancel", swatch: "#FCE0E8" },
];

function CellContent({ cell, sc }) {
  if (!cell) return null;
  if (cell.state === "available") {
    return <div className="text-[10px] font-semibold opacity-70">Available</div>;
  }
  const isMeta = META_SERVICE_CODES.has(cell.service_code) || !cell.child_name;
  const label = cell.note && isMeta ? cell.note : null;
  return (
    <div className="leading-tight text-center w-full flex flex-col items-center justify-center">
      <div className="font-bold text-[11px] text-center w-full">
        {label || (isMeta ? (cell.note || sc?.short) : (
          <>{sc?.short || cell.service_code}{cell.child_name && <> | {cell.child_name}</>}</>
        ))}
      </div>
      {cell.custom_time && <div className="text-[9px] opacity-80 text-center w-full">({cell.custom_time})</div>}
    </div>
  );
}

function cellClassName(cell, isAdmin, leaveInfo, selected) {
  const parts = ["sheet-td sheet-slot"];
  if (cell) {
    parts.push("has-event");
    if (cell.state === "available") parts.push("cell-available");
  } else {
    parts.push("cell-empty");
  }
  if (isAdmin) parts.push("editable");
  if (leaveInfo) parts.push("on-leave-cell");
  if (selected) parts.push("cell-selected");
  return parts.join(" ");
}

function cellClassNameBlock(cell, isAdmin, leaveInfo, selected) {
  const parts = ["cell-base"];
  if (cell) {
    parts.push("has-event");
    if (cell.state === "available") parts.push("cell-available");
  } else {
    parts.push("cell-empty");
  }
  if (isAdmin) parts.push("editable");
  if (leaveInfo) parts.push("on-leave-cell");
  if (selected) parts.push("cell-selected");
  return parts.join(" ");
}

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [view, setView] = useState(() => {
    // Default to "Per Therapist" (blocks) view for all users per business request.
    return "blocks";
  });
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [cells, setCells] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [clients, setClients] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [notify, setNotify] = useState(null);
  const [notifyReceipts, setNotifyReceipts] = useState([]);
  const [zoom, setZoom] = useState(() => {
    if (typeof window === "undefined") return 100;
    const stored = parseInt(localStorage.getItem("scheduleZoom") || "100", 10);
    return Number.isFinite(stored) ? Math.max(70, Math.min(130, stored)) : 100;
  });
  const [showDup, setShowDup] = useState(false);
  const [dupTarget, setDupTarget] = useState(null);
  const [dupClear, setDupClear] = useState(false);
  const [clipboard, setClipboard] = useState(null);  // copied cell content
  const [weekStatus, setWeekStatus] = useState("published");
  const [selection, setSelection] = useState(null); // { therapist_id, day, slots: string[] }
  const [selectAnchor, setSelectAnchor] = useState(null);
  const [mergeModal, setMergeModal] = useState(null);
  const [colorPicker, setColorPicker] = useState(null);
  const [mergeForm, setMergeForm] = useState({ label: "", color: "#E5EBE1", quick: "MEETING" });
  const [colorForm, setColorForm] = useState("#A2C4C9");

  const weekStartISO = toISODate(weekStart);

  const dupWeekToTarget = async () => {
    if (!dupTarget) return;
    await api.post("/schedule/duplicate-week", { source_week: weekStartISO, target_week: dupTarget, clear_target: dupClear });
    setShowDup(false);
    alert(`Week duplicated to ${dupTarget}. Navigate to that week to view.`);
  };

  const load = useCallback(async () => {
    const yr = weekStart.getFullYear();
    const [c, t, cl, lv] = await Promise.all([
      api.get("/schedule", { params: { week_start: weekStartISO } }),
      api.get("/therapists").catch(() => ({ data: [] })),
      api.get("/clients").catch(() => ({ data: [] })),
      api.get("/leaves", { params: { year: yr } }).catch(() => ({ data: [] })),
    ]);
    setCells(c.data); setTherapists(t.data); setClients(cl.data); setLeaves(lv.data || []);
    try {
      const st = await api.get("/schedule/week-status", { params: { week_start: weekStartISO } });
      setWeekStatus(st.data?.status || "published");
    } catch (_) { setWeekStatus("published"); }
  }, [weekStartISO, weekStart]);
  useEffect(() => { load(); }, [load]);

  const setDraft = async () => {
    await api.post("/schedule/set-draft", { week_start: weekStartISO });
    setWeekStatus("draft");
    alert("This week is now in Draft mode (hidden from therapists until published).");
  };
  const publishWeek = async () => {
    if (!window.confirm(`Publish schedule for ${formatDateRange(weekStart)}? All therapists will be emailed.`)) return;
    const r = await api.post("/schedule/publish", { week_start: weekStartISO });
    setWeekStatus("published");
    alert(`Published. Emails sent: ${r.data?.emails_sent ?? 0}`);
    load();
  };

  useEffect(() => {
    const close = () => setCtxMenu(null);
    if (ctxMenu) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxMenu]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setClipboard(null); };
    if (clipboard) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboard]);

  // Auto-scroll to top when opening edit/notify modals (so they're always centered in viewport)
  useEffect(() => {
    if (edit || notify || showDup) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [edit, notify, showDup]);

  const cellMap = useMemo(() => {
    const m = {};
    cells.forEach(c => { m[`${c.therapist_id}_${c.day}_${c.time_slot}`] = c; });
    return m;
  }, [cells]);

  // Leaves intersecting the displayed week (only approved/done count). Map: `${therapist_id}_${dayIdx}` -> leave-info
  const leaveByTherapistDay = useMemo(() => {
    const m = {};
    const weekDates = [0, 1, 2, 3, 4].map(d => toISODate(addDays(weekStart, d)));
    leaves.forEach(l => {
      if (!["approved", "done", "pending"].includes(l.status)) return;
      const start = l.start_date, end = l.end_date;
      if (!start || !end) return;
      weekDates.forEach((iso, dayIdx) => {
        if (iso >= start && iso <= end) {
          const key = `${l.therapist_id}_${dayIdx}`;
          // Prefer approved/done over pending in conflict
          const prev = m[key];
          if (!prev || (prev.status === "pending" && l.status !== "pending")) {
            m[key] = { type: l.leave_type, status: l.status, notes: l.notes };
          }
        }
      });
    });
    return m;
  }, [leaves, weekStart]);

  const coveredSet = useMemo(() => {
    const cov = new Set();
    cells.forEach(c => {
      const dur = c.duration || 1;
      if (dur <= 1) return;
      const startIdx = TIME_SLOTS.indexOf(c.time_slot);
      if (startIdx < 0) return;
      for (let k = 1; k < dur; k++) {
        const idx = startIdx + k;
        if (idx < TIME_SLOTS.length) cov.add(`${c.therapist_id}_${c.day}_${TIME_SLOTS[idx]}`);
      }
    });
    return cov;
  }, [cells]);

  const visibleTherapists = useMemo(() => {
    let list = therapists;
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [therapists, search]);

  // For Per-Therapist (blocks) view: therapist sees ONLY her own block; admin sees all
  const blocksTherapists = useMemo(() => {
    if (!isAdmin && user?.id) {
      return visibleTherapists.filter(t => t.id === user.id);
    }
    return visibleTherapists;
  }, [visibleTherapists, isAdmin, user?.id]);

  const isSelected = (therapist_id, day, time_slot) => {
    if (!selection) return false;
    return selection.therapist_id === therapist_id && selection.day === day && selection.slots.includes(time_slot);
  };

  const clearSelection = () => { setSelection(null); setSelectAnchor(null); };

  const extendSelectionDir = (dir) => {
    if (!selection) return;
    const indices = selection.slots.map(s => slotIndex(s, TIME_SLOTS)).sort((a, b) => a - b);
    const lo = indices[0];
    const hi = indices[indices.length - 1];
    let newSlots = [...selection.slots];
    if (dir === "right") {
      const next = hi + 1;
      if (next >= TIME_SLOTS.length) return;
      const ts = TIME_SLOTS[next];
      if (!isSlotSelectable(selection.therapist_id, selection.day, ts, cellMap, coveredSet)) return;
      newSlots.push(ts);
    } else if (dir === "left") {
      const prev = lo - 1;
      if (prev < 0) return;
      const ts = TIME_SLOTS[prev];
      if (!isSlotSelectable(selection.therapist_id, selection.day, ts, cellMap, coveredSet)) return;
      newSlots.unshift(ts);
    }
    setSelection({ ...selection, slots: [...new Set(newSlots)].sort((a, b) => slotIndex(a, TIME_SLOTS) - slotIndex(b, TIME_SLOTS)) });
  };

  const openEditForSlot = (therapist_id, day, time_slot, existing) => {
    setEdit(existing ? { ...existing }
      : { therapist_id, day, time_slot, service_code: "SS", child_name: "", state: "normal", week_start: weekStartISO, color: null, duration: 1 });
  };

  const handleCellClick = (e, therapist_id, day, time_slot, existing) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (clipboard && !existing) {
      const payload = {
        therapist_id, day, time_slot, week_start: weekStartISO,
        service_code: clipboard.service_code,
        child_name: clipboard.child_name,
        custom_time: clipboard.custom_time,
        note: clipboard.note,
        duration: clipboard.duration || 1,
        state: "normal",
        color: clipboard.color || null,
      };
      api.post("/schedule", payload).then(load);
      return;
    }
    if (existing) {
      clearSelection();
      openEditForSlot(therapist_id, day, time_slot, existing);
      return;
    }
    if (e?.shiftKey && selectAnchor && selectAnchor.therapist_id === therapist_id && selectAnchor.day === day) {
      const range = buildSlotRange(selectAnchor.time_slot, time_slot, TIME_SLOTS);
      const valid = range.filter(ts => isSlotSelectable(therapist_id, day, ts, cellMap, coveredSet));
      if (valid.length) {
        setSelection({ therapist_id, day, slots: valid });
      }
      return;
    }
    setSelectAnchor({ therapist_id, day, time_slot });
    setSelection({ therapist_id, day, slots: [time_slot] });
  };

  const handleCellDoubleClick = (e, therapist_id, day, time_slot, existing) => {
    if (e) e.stopPropagation();
    if (!isAdmin || existing) return;
    clearSelection();
    openEditForSlot(therapist_id, day, time_slot, null);
  };

  const markAvailable = async (therapist_id, day, time_slot, existing) => {
    if (existing?.id) await api.delete(`/schedule/${existing.id}`);
    await api.post("/schedule", {
      therapist_id, day, time_slot, week_start: weekStartISO,
      service_code: "SS", child_name: null, note: "Available",
      state: "available", color: "#FFFFFF", duration: 1,
    });
    setCtxMenu(null);
    clearSelection();
    load();
  };

  const markAvailableSelection = async () => {
    if (!selection) return;
    for (const ts of selection.slots) {
      const key = `${selection.therapist_id}_${selection.day}_${ts}`;
      const ex = cellMap[key];
      if (ex?.id) await api.delete(`/schedule/${ex.id}`);
      await api.post("/schedule", {
        therapist_id: selection.therapist_id, day: selection.day, time_slot: ts,
        week_start: weekStartISO, service_code: "SS", child_name: null, note: "Available",
        state: "available", color: "#FFFFFF", duration: 1,
      });
    }
    setMergeModal(null);
    clearSelection();
    load();
  };

  const openMergeModal = (fromSelection) => {
    const sel = fromSelection || selection;
    if (!sel || sel.slots.length < 1) return;
    setMergeForm({ label: "", color: "#F1ECF7", quick: "MEETING" });
    setMergeModal({ ...sel });
    setCtxMenu(null);
  };

  const applyMerge = async () => {
    if (!mergeModal) return;
    const slots = [...mergeModal.slots].sort((a, b) => slotIndex(a, TIME_SLOTS) - slotIndex(b, TIME_SLOTS));
    const start = slots[0];
    const duration = slots.length;
    const quick = mergeForm.quick;
    if (quick === "AVAILABLE") {
      setSelection(mergeModal);
      await markAvailableSelection();
      setMergeModal(null);
      return;
    }
    const service_code = quick || "MEETING";
    const color = mergeForm.color || SERVICE_CELL_COLORS[service_code]?.background || "#F1ECF7";
    for (const ts of slots) {
      const ex = cellMap[`${mergeModal.therapist_id}_${mergeModal.day}_${ts}`];
      if (ex?.id) await api.delete(`/schedule/${ex.id}`);
    }
    await api.post("/schedule", {
      therapist_id: mergeModal.therapist_id,
      day: mergeModal.day,
      time_slot: start,
      week_start: weekStartISO,
      service_code,
      child_name: null,
      note: mergeForm.label || MERGE_QUICK.find(q => q.id === quick)?.label || service_code,
      custom_time: null,
      state: "normal",
      color,
      duration,
    });
    setMergeModal(null);
    clearSelection();
    load();
  };

  const unmergeCell = async (cell) => {
    if (!cell?.id) return;
    await api.put(`/schedule/${cell.id}`, { ...cell, duration: 1 });
    setCtxMenu(null);
    load();
  };

  const openEditMerge = (cell) => {
    setMergeForm({
      label: cell.note || "",
      color: cell.color || SERVICE_CELL_COLORS[cell.service_code]?.background || "#F1ECF7",
      quick: cell.service_code || "MEETING",
    });
    setMergeModal({
      therapist_id: cell.therapist_id,
      day: cell.day,
      slots: [cell.time_slot],
      editId: cell.id,
      editCell: cell,
    });
    setCtxMenu(null);
  };

  const saveEditMerge = async () => {
    if (!mergeModal?.editId) return applyMerge();
    const cell = mergeModal.editCell;
    const quick = mergeForm.quick;
    const payload = {
      ...cell,
      service_code: quick === "AVAILABLE" ? "SS" : (quick || cell.service_code),
      note: mergeForm.label || cell.note,
      color: quick === "AVAILABLE" ? "#FFFFFF" : (mergeForm.color || cell.color),
      state: quick === "AVAILABLE" ? "available" : (cell.state === "available" ? "normal" : cell.state),
      child_name: quick === "AVAILABLE" ? null : cell.child_name,
    };
    await api.put(`/schedule/${mergeModal.editId}`, payload);
    setMergeModal(null);
    load();
  };

  const openClientColorPicker = (cell) => {
    const client = clients.find(c => cell.child_name && (c.name === cell.child_name.trim() || cell.child_name.startsWith(c.name + " ")));
    const current = client?.schedule_color || client?.color || cell.color || "#A2C4C9";
    setColorForm(current);
    setColorPicker({ cell, client });
    setCtxMenu(null);
  };

  const saveClientColor = async () => {
    if (!colorPicker?.client) {
      if (colorPicker?.cell?.id) {
        await api.put(`/schedule/${colorPicker.cell.id}`, { ...colorPicker.cell, color: colorForm });
      }
      setColorPicker(null);
      load();
      return;
    }
    await api.put(`/clients/${colorPicker.client.id}/schedule-color`, { color: colorForm });
    setColorPicker(null);
    load();
  };

  const resetClientColor = async () => {
    if (!colorPicker?.client) return;
    await api.put(`/clients/${colorPicker.client.id}/schedule-color`, { color: null });
    setColorPicker(null);
    load();
  };

  const copyCell = (cell) => {
    setClipboard({
      service_code: cell.service_code, child_name: cell.child_name,
      custom_time: cell.custom_time, note: cell.note,
      duration: cell.duration || 1, color: cell.color,
    });
  };

  const openNotify = (cell, cancelState = null) => {
    const therapist = therapists.find(t => t.id === cell.therapist_id);
    const defaultMsg = cancelState === "cancel_therapist"
      ? `Your session "${cell.service_code}${cell.child_name ? ' | ' + cell.child_name : ''}" at ${cell.time_slot} on ${DAYS_EN[cell.day]} has been marked as Therapist Cancellation.`
      : cancelState === "cancel_child"
        ? `The session "${cell.service_code}${cell.child_name ? ' | ' + cell.child_name : ''}" at ${cell.time_slot} on ${DAYS_EN[cell.day]} has been marked as Client Cancellation.`
        : `Notice regarding ${cell.service_code}${cell.child_name ? ' | ' + cell.child_name : ''} — ${DAYS_EN[cell.day]} ${cell.time_slot}.`;
    setNotify({
      ...cell,
      message: defaultMsg,
      cancelState,
      recipient_ids: cell.therapist_id ? [cell.therapist_id] : [],
      send_email: false,
      send_in_app: true,
    });
    setNotifyReceipts([]);
    if (cell.id && isAdmin) {
      api.get(`/schedule/${cell.id}/notification-receipts`).then(r => setNotifyReceipts(r.data || [])).catch(() => setNotifyReceipts([]));
    }
  };

  const toggleRecipient = (tid) => {
    setNotify(n => {
      const ids = n.recipient_ids || [];
      return { ...n, recipient_ids: ids.includes(tid) ? ids.filter(x => x !== tid) : [...ids, tid] };
    });
  };

  const save = async () => {
    const payload = { ...edit, week_start: weekStartISO };
    if (edit.id) await api.put(`/schedule/${edit.id}`, payload);
    else await api.post("/schedule", payload);
    setEdit(null); load();
  };
  const remove = async (id) => { await api.delete(`/schedule/${id}`); load(); };
  const sendNotify = async () => {
    const payload = {
      cell_id: notify.id,
      message: notify.message,
      recipient_ids: notify.recipient_ids || [],
      send_email: !!notify.send_email,
      send_in_app: notify.send_in_app !== false,
    };
    if (notify.cancelState) {
      await api.post(`/schedule/cancel-notify`, { ...payload, state: notify.cancelState });
    } else {
      await api.post(`/schedule/${notify.id}/notify`, payload);
    }
    setNotify(null);
    load();
  };
  const setState = async (cell, state) => {
    if (state === "cancel_therapist" || state === "cancel_child") {
      openNotify(cell, state);
      setCtxMenu(null);
      return;
    }
    await api.put(`/schedule/${cell.id}`, { ...cell, state });
    setCtxMenu(null); load();
  };

  const onCtx = (e, cell, therapist_id, day, time_slot) => {
    if (!isAdmin) return;
    e.preventDefault(); e.stopPropagation();
    if (!cell && therapist_id != null) {
      if (!selection || selection.therapist_id !== therapist_id || selection.day !== day) {
        setSelectAnchor({ therapist_id, day, time_slot });
        setSelection({ therapist_id, day, slots: [time_slot] });
      }
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, cell, therapist_id, day, time_slot });
  };

  // === SHEET VIEW === (matches Google Sheet: # | Therapist | Day | 10 time slots)
  const renderSheet = () => (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse sched-sheet" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th className="sheet-th" style={{ minWidth: 38, width: 38 }}>#</th>
              <th className="sheet-th sheet-th-sticky" style={{ minWidth: 110 }}>Therapist</th>
              <th className="sheet-th" style={{ minWidth: 64 }}>Day</th>
              {TIME_SLOTS.map(ts => (
                <th key={ts} className="sheet-th" style={{ minWidth: 78 }}>
                  {ts.replace(' AM', 'a').replace(' PM', 'p').replace(' - ', '–')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTherapists.length === 0 && (
              <tr><td colSpan={13} className="p-12 text-center" style={{ color: "#8B9E7A" }}>No therapists found</td></tr>
            )}
            {visibleTherapists.map((t, ti) => (
              DAYS_EN.map((d, di) => {
                const leaveInfo = leaveByTherapistDay[`${t.id}_${di}`];
                return (
                <tr key={`${t.id}_${di}`} className={di === 4 ? "border-b-2" : ""} style={di === 4 ? { borderBottomColor: "#7A8A6A" } : {}}>
                  {di === 0 && (
                    <>
                      <td rowSpan={5} className="sheet-td sheet-idx font-bold text-center">
                        {ti + 1}
                      </td>
                      <td rowSpan={5} className="sheet-td sheet-therapist" style={{ background: `${t.color}15` }}>
                        <div className="flex flex-col items-center justify-center gap-1.5 text-center px-1">
                          <div className="w-8 h-8 rounded-full text-white text-[11px] flex items-center justify-center font-bold shrink-0" style={{ background: t.color }}>
                            {t.name.replace("Ms. ", "").charAt(0)}
                          </div>
                          <span className="font-bold text-[11px] leading-tight break-words" style={{ color: "#2C3625" }}>{t.name}</span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="sheet-td sheet-day font-bold text-center" style={leaveInfo ? { background: "#FEF9C3" } : {}}>
                    <div className="text-[11px] tracking-wider" style={{ color: "#2C3625" }}>{DAYS_SHORT[di].toUpperCase()}</div>
                    <div className="text-[9px] font-normal" style={{ color: "#8B9E7A" }}>{addDays(weekStart, di).getDate()}/{addDays(weekStart, di).getMonth() + 1}</div>
                    {leaveInfo && (
                      <div className="text-[8px] font-bold mt-0.5" style={{ color: "#8B6918" }}>
                        {leaveInfo.type === "Absence" ? "ABSENT" : "ON LEAVE"}
                      </div>
                    )}
                  </td>
                  {TIME_SLOTS.map(ts => {
                    const cell = cellMap[`${t.id}_${di}_${ts}`];
                    const covered = coveredSet.has(`${t.id}_${di}_${ts}`);
                    if (covered) return null;
                    const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
                    const dur = cell?.duration || 1;
                    return (
                      <td
                        key={ts}
                        colSpan={dur}
                        data-testid={`sheet-cell-${t.id}-${di}-${ts}`}
                        className={cellClassName(cell, isAdmin, leaveInfo, isSelected(t.id, di, ts))}
                        style={getCellStyle(cell, clients)}
                        onClick={(e) => handleCellClick(e, t.id, di, ts, cell)}
                        onDoubleClick={(e) => handleCellDoubleClick(e, t.id, di, ts, cell)}
                        onContextMenu={(e) => onCtx(e, cell, t.id, di, ts)}
                      >
                        {cell && <CellContent cell={cell} sc={sc} />}
                      </td>
                    );
                  })}
                </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // === BLOCKS VIEW (per-therapist) ===
  const renderTherapistBlock = (therapist, idx) => (
    <div key={therapist.id} className="card p-0 overflow-hidden" data-testid={`therapist-block-${therapist.id}`}>
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "#E8E4DE", background: `linear-gradient(90deg, ${therapist.color}15 0%, transparent 100%)` }}>
        <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-sm" style={{ background: therapist.color }}>{idx + 1}</div>
        <div className="flex-1">
          <div className="text-[11px] tracking-[0.2em] font-bold" style={{ color: "#8B9E7A" }}>THERAPIST</div>
          <div className="font-bold text-lg" style={{ color: "#2C3625" }}>{therapist.name}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th className="cell-base text-center font-bold" style={{ minWidth: 90, background: "#F6F4F0", color: "#2C3625" }}>Day</th>
              {TIME_SLOTS.map(ts => (
                <th key={ts} className="cell-base text-center font-bold" style={{ background: "#F6F4F0", color: "#2C3625" }}>
                  {ts.replace(' AM', 'a').replace(' PM', 'p')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS_EN.map((d, di) => {
              const leaveInfo = leaveByTherapistDay[`${therapist.id}_${di}`];
              return (
              <tr key={di} className={leaveInfo ? "schedule-leave-row" : ""}>
                <td className="cell-base text-center font-bold" style={{ background: leaveInfo ? "#FEF9C3" : "#F6F4F0", color: "#2C3625", position: "relative" }}>
                  <div className="text-[11px] tracking-wider">{DAYS_SHORT[di].toUpperCase()}</div>
                  <div className="text-[10px] font-normal" style={{ color: "#8B9E7A" }}>{addDays(weekStart, di).getDate()}/{addDays(weekStart, di).getMonth() + 1}</div>
                  {leaveInfo && (
                    <div className="text-[9px] font-bold mt-0.5" style={{ color: "#8B6918" }}>
                      {leaveInfo.type === "Absence" ? "ABSENT" : "ON LEAVE"}
                    </div>
                  )}
                </td>
                {TIME_SLOTS.map(ts => {
                  const cell = cellMap[`${therapist.id}_${di}_${ts}`];
                  const isCovered = coveredSet.has(`${therapist.id}_${di}_${ts}`);
                  if (isCovered) return null;
                  const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
                  const dur = cell?.duration || 1;
                  return (
                    <td key={ts} className={cellClassNameBlock(cell, isAdmin, leaveInfo, isSelected(therapist.id, di, ts))}
                      colSpan={dur}
                      style={getCellStyle(cell, clients)}
                      data-testid={`cell-${therapist.id}-${di}-${ts}`}
                      onClick={(e) => handleCellClick(e, therapist.id, di, ts, cell)}
                      onDoubleClick={(e) => handleCellDoubleClick(e, therapist.id, di, ts, cell)}
                      onContextMenu={(e) => onCtx(e, cell, therapist.id, di, ts)}>
                      {cell && <CellContent cell={cell} sc={sc} />}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // === MASTER VIEW removed (was "By Day"). Keeping renderTherapistBlock + renderSheet only. ===

  return (
    <div>
      <div className="flex items-start flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[240px]">
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#2C3625" }}>Weekly Schedule</h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>
            {isAdmin ? "Click empty cells to select · Shift+click range · Double-click to add session · Right-click for actions." : "Your weekly schedule (read-only)"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button data-testid="view-sheet-btn" onClick={() => setView("sheet")} className={`btn ${view === "sheet" ? "btn-primary" : "btn-ghost"} text-xs`}><Table size={14} /> Sheet</button>
          <button data-testid="view-blocks-btn" onClick={() => setView("blocks")} className={`btn ${view === "blocks" ? "btn-primary" : "btn-ghost"} text-xs`}><GridFour size={14} /> Per Therapist</button>
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button data-testid="prev-week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-ghost p-2"><CaretLeft size={18} /></button>
          <div className="px-3 py-1.5 text-sm font-bold min-w-[160px] text-center" style={{ color: "#2C3625" }}>{formatDateRange(weekStart)}</div>
          <button data-testid="next-week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn btn-ghost p-2"><CaretRight size={18} /></button>
          <div className="w-px h-6 bg-[#E8E4DE] mx-1" />
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn btn-ghost text-xs"><House size={14} /> Today</button>
          <input type="date" title="Jump to week" className="input text-xs w-[130px] py-1.5"
            onChange={e => { if (e.target.value) setWeekStart(startOfWeek(new Date(e.target.value + "T12:00:00"))); }} />
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button data-testid="zoom-out-btn"
                  onClick={() => setZoom(z => { const n = Math.max(70, z - 10); localStorage.setItem("scheduleZoom", String(n)); return n; })}
                  className="btn btn-ghost p-2"><MagnifyingGlassMinus size={16} /></button>
          <div className="px-2 text-xs font-bold min-w-[40px] text-center" data-testid="zoom-value">{zoom}%</div>
          <button data-testid="zoom-in-btn"
                  onClick={() => setZoom(z => { const n = Math.min(130, z + 10); localStorage.setItem("scheduleZoom", String(n)); return n; })}
                  className="btn btn-ghost p-2"><MagnifyingGlassPlus size={16} /></button>
          <div className="w-px h-6 bg-[#E8E4DE] mx-1" />
          <button onClick={() => window.print()} className="btn btn-ghost p-2"><Printer size={16} /></button>
        </div>
        {isAdmin && (
          <>
            {weekStatus === "draft" ? (
              <span className="pill text-xs px-2 py-1" style={{ background: "#FAF0D1", color: "#6B5218" }}>Draft — not visible to therapists</span>
            ) : (
              <span className="pill text-xs px-2 py-1" style={{ background: "#E5EBE1", color: "#3D4F35" }}>Published</span>
            )}
            <button type="button" onClick={setDraft} className="btn btn-outline text-xs">Save as Draft</button>
            <button type="button" onClick={publishWeek} className="btn btn-primary text-xs">Publish Week</button>
            <button data-testid="duplicate-week-btn" onClick={() => { setDupTarget(toISODate(addDays(weekStart, 7))); setShowDup(true); }} className="btn btn-gold"><CopySimple size={16} /> Duplicate Week →</button>
          </>
        )}
      </div>

      <div className="card p-3 mb-4 flex items-center flex-wrap gap-3 text-xs">
        <div className="font-bold flex items-center gap-1" style={{ color: "#5C6853" }}><Info size={14} /> Legend:</div>
        {SERVICE_CODES.slice(0, 7).map(s => (<span key={s.id} className={`pill ${s.cls}`}>{s.short}</span>))}
        <span className="pill" style={{ background: "#FFF4C4", color: "#6B5218", border: "1px solid #E8C572" }}>✕ Therapist Cancel</span>
        <span className="pill" style={{ background: "#FCE0E8", color: "#8B3A55", border: "1px solid #E8A4BD" }}>✕ Client Cancel</span>
        <span className="ml-auto text-[11px]" style={{ color: "#8B9E7A" }}>Each child = unique color · {clients.length} clients</span>
      </div>

      {clipboard && isAdmin && (
        <div className="card p-3 mb-4 flex items-center gap-3 text-sm" style={{ background: "#FFF7E1", borderColor: "#E8C572" }} data-testid="clipboard-banner">
          <Copy size={18} weight="duotone" style={{ color: "#8B6918" }} />
          <div className="flex-1">
            <div className="font-bold" style={{ color: "#6B5218" }}>📋 Cell copied — click any empty slot to paste</div>
            <div className="text-xs" style={{ color: "#8B6918" }}>{clipboard.service_code}{clipboard.child_name && ` | ${clipboard.child_name}`}{clipboard.custom_time && ` (${clipboard.custom_time})`} {clipboard.duration > 1 && `· ${clipboard.duration}h`}</div>
          </div>
          <button onClick={() => setClipboard(null)} className="btn btn-ghost p-1.5"><X size={16} /></button>
        </div>
      )}

      {isAdmin && (view === "blocks" || view === "sheet") && (
        <div className="relative max-w-sm mb-5">
          <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{ color: "#8B9E7A" }} />
          <input data-testid="schedule-search-input" className="input pl-10" placeholder="Search therapist..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      <div className="sched-zoom" style={{ "--sched-zoom": zoom / 100 }}>
        {cells.length === 0 && (
          <div className="card p-10 text-center mb-4" style={{ background: "linear-gradient(135deg, #FAF5E8 0%, #F0E9D8 100%)", borderColor: "#E8C572" }}>
            <CalendarBlank size={42} weight="duotone" className="mx-auto mb-3" style={{ color: "#8B6918" }} />
            <div className="font-display text-xl mb-2" style={{ color: "#2C3625" }}>No schedule for this week yet</div>
            <div className="text-sm mb-4" style={{ color: "#5C6853" }}>Choose how to fill this week:</div>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-outline text-sm">← Go to previous week</button>
              {isAdmin && (
                <button onClick={() => { setDupTarget(toISODate(weekStart)); setShowDup(true); setWeekStart(addDays(weekStart, -7)); }} className="btn btn-gold text-sm">
                  <CopySimple size={14} /> Duplicate previous week here
                </button>
              )}
            </div>
          </div>
        )}
        {view === "sheet" && renderSheet()}
        {view === "blocks" && (
          <div className="space-y-6 stagger">
            {blocksTherapists.length === 0 && <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>No therapists found</div>}
            {blocksTherapists.map((t, i) => renderTherapistBlock(t, i))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {edit && (
        <ModalBase
          title={edit.id ? "Edit Session" : "Add Session"}
          subtitle={edit.id ? "Update session details or send notifications" : "Add a new session to the schedule"}
          onClose={() => setEdit(null)}
          size="md"
          footer={
            <>
              {edit.id && isAdmin && (
                <>
                  <ModalBtnSecondary
                    data-testid="cell-cancel-therapist-btn"
                    onClick={() => { setState(edit, "cancel_therapist"); setEdit(null); }}
                    style={{ borderColor: "#E8C572", color: "#6B5218" }}
                  >
                    🟡 Cancel (Therapist)
                  </ModalBtnSecondary>
                  <ModalBtnSecondary
                    data-testid="cell-cancel-child-btn"
                    onClick={() => { setState(edit, "cancel_child"); setEdit(null); }}
                    style={{ borderColor: "#E8A4BD", color: "#8B3A55" }}
                  >
                    🩷 Cancel (Client)
                  </ModalBtnSecondary>
                </>
              )}
              {edit.id && (
                <ModalBtnDanger data-testid="cell-delete-btn" onClick={() => { remove(edit.id); setEdit(null); }}>
                  <Trash size={16} className="inline mr-1" /> Delete
                </ModalBtnDanger>
              )}
              {edit.id && edit.state !== "normal" && (
                <ModalBtnSecondary onClick={() => { openNotify(edit); setEdit(null); }}>
                  <BellRinging size={16} className="inline mr-1" /> Notify
                </ModalBtnSecondary>
              )}
              <ModalBtnSecondary onClick={() => setEdit(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="cell-save-btn" onClick={save}>Save</ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Session Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Therapist">
                <input
                  className="modal-input"
                  readOnly
                  value={therapists.find(t => t.id === edit.therapist_id)?.name || ""}
                />
              </FormField>
              <FormField label="Day">
                <input className="modal-input" readOnly value={DAYS_EN[edit.day] || ""} />
              </FormField>
              <FormField label="Time From" hint="Default slot from the schedule grid">
                <input className="modal-input" readOnly value={edit.time_slot || ""} />
              </FormField>
              <FormField label="Time To" hint="Custom range or duration below">
                <input
                  className="modal-input"
                  placeholder="2:30-4:30"
                  value={edit.custom_time || ""}
                  onChange={e => setEdit({ ...edit, custom_time: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Duration (slots)">
              <select
                className="modal-input"
                value={edit.duration || 1}
                onChange={e => setEdit({ ...edit, duration: parseInt(e.target.value) })}
              >
                <option value={1}>1 slot (1 hour)</option>
                <option value={2}>2 slots (merge 2 hours)</option>
                <option value={3}>3 slots (merge 3 hours)</option>
                <option value={4}>4 slots (merge 4 hours)</option>
              </select>
            </FormField>
            <FormField label="Note">
              <input
                className="modal-input"
                value={edit.note || ""}
                onChange={e => setEdit({ ...edit, note: e.target.value })}
              />
            </FormField>
          </FormSection>

          {!["LEAVE", "BREAK", "AVC"].includes(edit.service_code) && (
            <FormSection title="Client">
              <FormField
                label="Client name"
                hint="Select from list or type a custom name (e.g. Amani (2:30-4:30))"
              >
                <input
                  data-testid="cell-child-input"
                  className="modal-input"
                  list="clients-list"
                  value={edit.child_name || ""}
                  onChange={e => setEdit({ ...edit, child_name: e.target.value, color: null })}
                  placeholder="Type or select client name..."
                />
                <datalist id="clients-list">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
              </FormField>
              {edit.child_name && (
                <div className="text-xs flex items-center gap-2" style={{ color: "#5C6853" }}>
                  Auto-color:{" "}
                  <span
                    className="w-5 h-5 rounded border border-[#E8E4DE] inline-block"
                    style={{ background: edit.color || resolveClientScheduleColor(edit.child_name, clients) || "#E5EBE1" }}
                  />
                  <button type="button" onClick={() => setEdit({ ...edit, color: null })} className="text-[11px] underline">
                    use child default
                  </button>
                </div>
              )}
            </FormSection>
          )}

          <FormSection title="Service">
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_CODES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEdit({ ...edit, service_code: s.id })}
                  className={`pill ${s.cls} justify-center py-2 ${edit.service_code === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}
                >
                  {s.short}
                </button>
              ))}
            </div>
          </FormSection>

          {edit.id && (
            <FormSection title="Status">
              <div className="flex gap-2 flex-wrap">
                {STATES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEdit({ ...edit, state: s.id })}
                    className={`pill ${edit.state === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}
                    style={{ background: s.swatch, color: "#2C3625", border: `1px solid ${s.swatch}` }}
                  >
                    {s.id !== "normal" && "✕ "}{s.label}
                  </button>
                ))}
              </div>
            </FormSection>
          )}
        </ModalBase>
      )}

      {ctxMenu && (
        <div className="fixed card p-1 z-50 min-w-52" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
          {ctxMenu.cell ? (
            <>
              <button type="button" onClick={() => { openEditForSlot(ctxMenu.cell.therapist_id, ctxMenu.cell.day, ctxMenu.cell.time_slot, ctxMenu.cell); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm">Edit</button>
              <button type="button" data-testid="copy-cell-btn" onClick={() => { copyCell(ctxMenu.cell); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm" style={{ color: "#7A8A6A" }}><Copy size={14} weight="duotone" /> Copy cell</button>
              {ctxMenu.cell.child_name && (
                <button type="button" onClick={() => openClientColorPicker(ctxMenu.cell)} className="btn btn-ghost w-full justify-start text-sm">🎨 Change Client Color</button>
              )}
              {(ctxMenu.cell.duration || 1) > 1 && (
                <>
                  <button type="button" onClick={() => openEditMerge(ctxMenu.cell)} className="btn btn-ghost w-full justify-start text-sm">Edit Merge</button>
                  <button type="button" onClick={() => { unmergeCell(ctxMenu.cell); }} className="btn btn-ghost w-full justify-start text-sm">Unmerge</button>
                </>
              )}
              <div className="divider my-1" />
              <button type="button" onClick={() => setState(ctxMenu.cell, "cancel_child")} className="btn btn-ghost w-full justify-start text-sm" style={{ color: "#8B3A55" }}>🩷 Mark Client Cancel</button>
              <button type="button" onClick={() => setState(ctxMenu.cell, "cancel_therapist")} className="btn btn-ghost w-full justify-start text-sm" style={{ color: "#8B6918" }}>🟡 Mark Therapist Cancel</button>
              <button type="button" onClick={() => setState(ctxMenu.cell, "normal")} className="btn btn-ghost w-full justify-start text-sm">✓ Mark Normal</button>
              <button type="button" onClick={() => markAvailable(ctxMenu.cell.therapist_id, ctxMenu.cell.day, ctxMenu.cell.time_slot, ctxMenu.cell)} className="btn btn-ghost w-full justify-start text-sm">⬜ Mark as Available</button>
              <div className="divider my-1" />
              <button type="button" onClick={() => { openNotify(ctxMenu.cell); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm"><BellRinging size={14} /> Notify Therapist</button>
              <button type="button" onClick={() => { remove(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm text-red-700"><Trash size={14} /> Delete</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { openEditForSlot(ctxMenu.therapist_id, ctxMenu.day, ctxMenu.time_slot, null); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm">Add Session</button>
              <button type="button" onClick={() => markAvailable(ctxMenu.therapist_id, ctxMenu.day, ctxMenu.time_slot, cellMap[`${ctxMenu.therapist_id}_${ctxMenu.day}_${ctxMenu.time_slot}`])} className="btn btn-ghost w-full justify-start text-sm">⬜ Mark as Available</button>
              {selection && selection.slots.length >= 1 && (
                <button type="button" onClick={() => openMergeModal()} className="btn btn-ghost w-full justify-start text-sm"><ArrowsMerge size={14} /> Merge Cells ({selection.slots.length})</button>
              )}
              <button type="button" onClick={() => { clearSelection(); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm text-xs opacity-70">Clear selection</button>
            </>
          )}
        </div>
      )}

      {selection && selection.slots.length >= 1 && isAdmin && (
        <div className="fixed z-40 card px-3 py-2 flex items-center gap-2 flex-wrap shadow-lg no-print" style={{ bottom: 24, left: "50%", transform: "translateX(-50%)" }}>
          <span className="text-xs font-bold" style={{ color: "#374151" }}>{selection.slots.length} cell{selection.slots.length > 1 ? "s" : ""} selected</span>
          <button type="button" onClick={() => extendSelectionDir("left")} className="btn btn-ghost p-1.5" title="Extend left"><ArrowLeft size={16} /></button>
          <button type="button" onClick={() => extendSelectionDir("right")} className="btn btn-ghost p-1.5" title="Extend right"><ArrowRight size={16} /></button>
          <span className="text-[10px]" style={{ color: "#9CA3AF" }}>Shift+click range</span>
          {selection.slots.length >= 1 && (
            <button type="button" onClick={() => openMergeModal()} className="btn btn-primary text-xs py-1.5"><ArrowsMerge size={14} /> Merge</button>
          )}
          <button type="button" onClick={clearSelection} className="btn btn-outline text-xs py-1.5">Clear</button>
        </div>
      )}

      {mergeModal && (
        <ModalBase
          title={mergeModal.editId ? "Edit Merge" : "Merge Cells"}
          subtitle={`${mergeModal.slots.length} slot(s) · ${DAYS_EN[mergeModal.day]}`}
          onClose={() => setMergeModal(null)}
          size="sm"
          footer={
            <>
              <ModalBtnSecondary onClick={() => setMergeModal(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary onClick={mergeModal.editId ? saveEditMerge : applyMerge}>Merge & Apply</ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Label">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {MERGE_QUICK.map(q => (
                <button key={q.id} type="button" onClick={() => setMergeForm(f => ({ ...f, quick: q.id, label: q.label }))}
                  className={`pill text-xs px-2 py-1 ${mergeForm.quick === q.id ? "ring-2 ring-[#5C8A47]" : ""}`}>
                  {q.label}
                </button>
              ))}
            </div>
            <FormField label="Custom label">
              <input className="modal-input" value={mergeForm.label} onChange={e => setMergeForm(f => ({ ...f, label: e.target.value }))} placeholder="Optional custom text..." />
            </FormField>
          </FormSection>
          <FormSection title="Color">
            <div className="flex flex-wrap gap-2 mb-2">
              {Object.entries(SERVICE_CELL_COLORS).map(([k, v]) => (
                <button key={k} type="button" title={k} onClick={() => setMergeForm(f => ({ ...f, color: v.background }))}
                  className="w-8 h-8 rounded-lg border-2" style={{ background: v.background, borderColor: mergeForm.color === v.background ? "#5C8A47" : v.borderColor }} />
              ))}
            </div>
            <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={mergeForm.color} onChange={e => setMergeForm(f => ({ ...f, color: e.target.value }))} />
          </FormSection>
        </ModalBase>
      )}

      {colorPicker && (
        <ModalBase
          title="Change Client Color"
          subtitle={colorPicker.cell?.child_name || ""}
          onClose={() => setColorPicker(null)}
          size="sm"
          footer={
            <>
              {colorPicker.client && (
                <ModalBtnSecondary onClick={resetClientColor}>Reset to default</ModalBtnSecondary>
              )}
              <ModalBtnSecondary onClick={() => setColorPicker(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary onClick={saveClientColor}>Apply</ModalBtnPrimary>
            </>
          }
        >
          <div className="grid grid-cols-8 gap-2 mb-4">
            {SCHEDULE_COLOR_SWATCHES.map(c => (
              <button key={c} type="button" onClick={() => setColorForm(c)}
                className="w-8 h-8 rounded-lg border-2" style={{ background: c, borderColor: colorForm === c ? "#5C8A47" : "#DDD8D0" }} />
            ))}
          </div>
          <FormField label="Custom color">
            <input type="color" className="modal-input h-10 p-1" value={colorForm} onChange={e => setColorForm(e.target.value)} />
          </FormField>
          {!colorPicker.client && (
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Client not found in database — color will apply to this cell only.</p>
          )}
        </ModalBase>
      )}

      {notify && (
        <ModalBase
          title={
            notify.cancelState === "cancel_therapist" ? "Mark Therapist Cancellation"
              : notify.cancelState === "cancel_child" ? "Mark Client Cancellation"
                : "Send Notification"
          }
          subtitle={
            notify.cancelState
              ? `${therapists.find(t => t.id === notify.therapist_id)?.name} · ${DAYS_EN[notify.day]} · ${notify.time_slot}`
              : "Notify one or more therapists about a schedule change"
          }
          onClose={() => setNotify(null)}
          size="md"
          footer={
            <>
              <ModalBtnSecondary onClick={() => setNotify(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="notify-send-btn" onClick={sendNotify}>
                <BellRinging size={16} className="inline mr-1" />
                {notify.cancelState ? "Confirm & Notify" : "Send"}
              </ModalBtnPrimary>
            </>
          }
        >
          {notify.cancelState && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                background: notify.cancelState === "cancel_therapist" ? "#FFF4C4" : "#FCE0E8",
                color: notify.cancelState === "cancel_therapist" ? "#6B5218" : "#8B3A55",
              }}
            >
              ✕ The session will be marked as{" "}
              <b>{notify.cancelState === "cancel_therapist" ? "Therapist Cancellation" : "Client Cancellation"}</b>.
            </div>
          )}

          <FormSection title="Recipients">
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {therapists.map(t => (
                <label
                  key={t.id}
                  className="flex items-center gap-1.5 text-xs cursor-pointer pill px-2 py-1"
                  style={{
                    background: (notify.recipient_ids || []).includes(t.id) ? "#E5EBE1" : "#fff",
                    border: "1px solid #E8E4DE",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(notify.recipient_ids || []).includes(t.id)}
                    onChange={() => toggleRecipient(t.id)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="Message">
            <textarea
              data-testid="notify-message"
              className="modal-input"
              rows={4}
              placeholder="Notification message..."
              value={notify.message}
              onChange={e => setNotify({ ...notify, message: e.target.value })}
            />
          </FormSection>

          <FormSection title="Delivery">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={notify.send_in_app !== false}
                onChange={e => setNotify({ ...notify, send_in_app: e.target.checked })}
              />
              <span className="text-sm font-semibold" style={{ color: "#374151" }}>Send in-app notification</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                data-testid="notify-send-email-cb"
                type="checkbox"
                checked={!!notify.send_email}
                onChange={e => setNotify({ ...notify, send_email: e.target.checked })}
              />
              <span className="text-sm font-semibold flex items-center gap-1" style={{ color: "#374151" }}>
                <BellRinging size={14} /> Also send email notification
              </span>
            </label>
            {isAdmin && notifyReceipts.length > 0 && (
              <div className="mt-4 rounded-xl border p-3 text-xs" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
                <div className="font-bold mb-2" style={{ color: "#1C2617" }}>Read receipts</div>
                {notifyReceipts.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-1 border-b border-[#F0EDE9] last:border-0">
                    <span>{r.therapist_name || r.user_id}</span>
                    <span style={{ color: r.acknowledged ? "#3D4F35" : "#8B6918" }}>
                      {r.acknowledged ? "✓ Received & Read" : "⏳ Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </ModalBase>
      )}

      {showDup && (
        <ModalBase
          title="Duplicate Week"
          subtitle={`Copy ${formatDateRange(weekStart)} to a target week`}
          onClose={() => setShowDup(false)}
          size="sm"
          footer={
            <>
              <ModalBtnSecondary onClick={() => setShowDup(false)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="dup-confirm-btn" onClick={dupWeekToTarget} disabled={!dupTarget}>
                <CopySimple size={16} className="inline mr-1" /> Duplicate
              </ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Target Week">
            <FormField label="Target week start (Sunday)">
              <input
                type="date"
                className="modal-input"
                value={dupTarget || ""}
                onChange={e => setDupTarget(e.target.value)}
              />
            </FormField>
            <div className="flex gap-2 flex-wrap">
              <ModalBtnSecondary type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => setDupTarget(toISODate(addDays(weekStart, 7)))}>
                Next week
              </ModalBtnSecondary>
              <ModalBtnSecondary type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => setDupTarget(toISODate(addDays(weekStart, 14)))}>
                +2 weeks
              </ModalBtnSecondary>
              <ModalBtnSecondary type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => setDupTarget(toISODate(addDays(weekStart, 28)))}>
                +4 weeks
              </ModalBtnSecondary>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={dupClear} onChange={e => setDupClear(e.target.checked)} />
              <span style={{ color: "#5C6853" }}>Clear target week first (replace existing cells)</span>
            </label>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
