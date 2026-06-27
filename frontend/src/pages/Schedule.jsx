import { useEffect, useMemo, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api, { DAYS_EN, DAYS_SHORT, TIME_SLOTS, SERVICE_CODES, startOfWeek, addDays, toISODate, formatDateRange } from "../api";
import {
  getCellStyle, META_SERVICE_CODES, MERGE_QUICK,
  SERVICE_CELL_COLORS, buildSlotRange, isSlotSelectable, slotIndex, clampMergeSlotCount, clampMergeDuration,
  findCellAt, isHiddenFromSchedule, scheduleDisplaySpan, scheduleCoveredSlotKeys,
  resolveSelfTherapist, findClientForScheduleCell, isScheduleClientLogCell,
} from "../scheduleUtils";
import { MAX_SCHEDULE_MERGE_SLOTS } from "../scheduleConstants";
import { useAuth, showAdminNav, isClientLead, canParentCancellationOps } from "../auth";
import {
  CaretLeft, CaretRight, CaretDown, Trash, Copy, BellRinging, X, House, MagnifyingGlass,
  CopySimple, Table, CalendarBlank, CheckCircle, PencilSimple, GridFour, Printer, WhatsappLogo, UserPlus,
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import ScheduleCellPanel from "../components/ScheduleCellPanel";
import SchedulePageHeader from "../components/SchedulePageHeader";
import ScheduleHolidaysModal from "../components/ScheduleHolidaysModal";
import ParentWhatsAppModal from "../components/ParentWhatsAppModal";
import ParentCancellationModal from "../components/ParentCancellationModal";
import LogSessionModal, { slotToTime24, addHoursToTime } from "../components/LogSessionModal";
import SchedulePrepBadge from "../components/SchedulePrepBadge";
import { buildPrepLookup, isCellPrepComplete, scheduleSlotFromCell } from "../schedulePrepUtils";
import { buildParentMessages } from "../scheduleParentMessages";
import { sortTherapistsForSchedule, getTherapistScheduleName, scheduleOwnBlockOnly, SCHEDULE_CLOSURE_STYLE, closureLabelForTherapist } from "../scheduleConstants";
import { cachedGet } from "../dataCache";
import "../dashboardLayout.css";

const SCHEDULE_MOBILE_BP = 768;
const SCHEDULE_TABLET_BP = 1024;

const SCHEDULE_ZOOM = 80;

function formatSlotHeader(ts) {
  return ts.replace(" AM", "a").replace(" PM", "p").replace(" - ", "–");
}

function getSheetCellStyle(cell, clients) {
  if (!cell) return { background: "#E5E7EB", borderColor: "#D1D5DB", height: 38, minHeight: 38, padding: "2px 1px", fontSize: 10 };
  const base = getCellStyle(cell, clients);
  return { ...base, height: 38, minHeight: 38, padding: "2px 1px", fontSize: 10 };
}

function ClosureBannerCell({ label, className, canEdit, therapist_id, day, onCtx, onTouchStart, onTouchMove, onTouchEnd }) {
  return (
    <td
      colSpan={TIME_SLOTS.length}
      className={className}
      style={{
        ...SCHEDULE_CLOSURE_STYLE,
        height: 38,
        minHeight: 38,
        textAlign: "center",
        verticalAlign: "middle",
      }}
      onContextMenu={canEdit ? (e) => onCtx(e, null, therapist_id, day, TIME_SLOTS[0]) : undefined}
      onTouchStart={canEdit ? (e) => onTouchStart(e, null, therapist_id, day, TIME_SLOTS[0]) : undefined}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <span className="font-bold text-[12px] sm:text-[13px] tracking-wide">{label}</span>
    </td>
  );
}

function positionContextMenu(x, y, menuWidth, menuHeight) {
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + menuWidth > vw - pad) left = vw - menuWidth - pad;
  if (top + menuHeight > vh - pad) top = y - menuHeight;
  if (top < pad) top = pad;
  if (left < pad) left = pad;
  return { left, top };
}

function CellContent({ cell, sc }) {
  if (!cell) return null;
  if (cell.state === "available" || cell.service_code === "AVAILABLE") {
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

function cellClassName(cell, isAdmin, leaveInfo, selected, copied) {
  const parts = ["sheet-td sheet-slot"];
  if (cell) {
    parts.push("has-event");
    if (cell.state === "available" || cell.service_code === "AVAILABLE") parts.push("cell-available");
  } else {
    parts.push("cell-empty");
  }
  if (isAdmin) parts.push("editable");
  if (leaveInfo) parts.push("on-leave-cell");
  if (selected) parts.push("cell-selected");
  if (copied) parts.push("copied-source");
  return parts.join(" ");
}

function cellClassNameBlock(cell, isAdmin, leaveInfo, selected, copied, canQuickLog, prepDone) {
  const parts = ["cell-base"];
  if (cell) {
    parts.push("has-event");
    if (cell.state === "available" || cell.service_code === "AVAILABLE") parts.push("cell-available");
    if (prepDone) parts.push("has-prep-badge");
  } else {
    parts.push("cell-empty");
  }
  if (isAdmin) parts.push("editable");
  if (canQuickLog && isScheduleClientLogCell(cell)) parts.push("schedule-log-clickable");
  if (leaveInfo) parts.push("on-leave-cell");
  if (selected) parts.push("cell-selected");
  if (copied) parts.push("copied-source");
  return parts.join(" ");
}

export default function Schedule() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const scheduleAdmin = showAdminNav(user);
  const scheduleLead = isClientLead(user) && !scheduleAdmin;
  const isAdmin = scheduleAdmin;
  const parentCancelOps = canParentCancellationOps(user);
  const canQuickLog = !scheduleAdmin && !scheduleLead;
  const [view, setView] = useState(() => {
    // Default to "Per Therapist" (blocks) view for all users per business request.
    return "blocks";
  });
  const [isScheduleNarrow, setIsScheduleNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= SCHEDULE_MOBILE_BP,
  );
  const [isScheduleTablet, setIsScheduleTablet] = useState(
    () => typeof window !== "undefined" && window.innerWidth > SCHEDULE_MOBILE_BP && window.innerWidth <= SCHEDULE_TABLET_BP,
  );
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [cells, setCells] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [clients, setClients] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [panelForm, setPanelForm] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSaving, setPanelSaving] = useState(false);
  const [notify, setNotify] = useState(null);
  const [notifyReceipts, setNotifyReceipts] = useState([]);
  const [showDup, setShowDup] = useState(false);
  const [dupSource, setDupSource] = useState(null);
  const [dupTarget, setDupTarget] = useState(null);
  const [dupClear, setDupClear] = useState(false);
  const [clipboard, setClipboard] = useState(null);  // copied cell content
  const [weekStatus, setWeekStatus] = useState("published");
  const [selection, setSelection] = useState(null);
  const [selectAnchor, setSelectAnchor] = useState(null);
  const [mergeForm, setMergeForm] = useState({ label: "", color: "#E5EBE1", quick: "MEETING" });
  const [colorForm, setColorForm] = useState("#A2C4C9");
  const [ctxMenu, setCtxMenu] = useState(null);
  const ctxMenuRef = useRef(null);
  const [ctxMenuPos, setCtxMenuPos] = useState({ left: 0, top: 0, ready: false });
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);
  const [adminEditsOpen, setAdminEditsOpen] = useState(false);
  const [addSpecialistOpen, setAddSpecialistOpen] = useState(false);
  const [addTherapistId, setAddTherapistId] = useState("");
  const [scheduleTherapistBusy, setScheduleTherapistBusy] = useState(false);
  const adminEditsRef = useRef(null);
  const [showHolidays, setShowHolidays] = useState(false);
  const [closures, setClosures] = useState([]);
  const [quickLog, setQuickLog] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSendAll, setPublishSendAll] = useState(true);
  const [publishIds, setPublishIds] = useState([]);
  const [publishSending, setPublishSending] = useState(false);
  const [parentMessagesOpen, setParentMessagesOpen] = useState(false);
  const [parentMessagesNote, setParentMessagesNote] = useState("");
  const [parentCancelOpen, setParentCancelOpen] = useState(false);
  const [parentCancelFocus, setParentCancelFocus] = useState(null);
  const [pendingCancellations, setPendingCancellations] = useState([]);
  const [prepLookup, setPrepLookup] = useState(() => new Set());

  useEffect(() => {
    if (!adminEditsOpen) return;
    const close = (e) => {
      if (adminEditsRef.current && !adminEditsRef.current.contains(e.target)) {
        setAdminEditsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [adminEditsOpen]);

  useEffect(() => {
    const mqNarrow = window.matchMedia(`(max-width: ${SCHEDULE_MOBILE_BP}px)`);
    const mqTablet = window.matchMedia(`(min-width: ${SCHEDULE_MOBILE_BP + 1}px) and (max-width: ${SCHEDULE_TABLET_BP}px)`);
    const sync = () => {
      setIsScheduleNarrow(mqNarrow.matches);
      setIsScheduleTablet(mqTablet.matches);
      if (mqNarrow.matches) setView((v) => (v === "sheet" ? "blocks" : v));
    };
    sync();
    mqNarrow.addEventListener("change", sync);
    mqTablet.addEventListener("change", sync);
    return () => {
      mqNarrow.removeEventListener("change", sync);
      mqTablet.removeEventListener("change", sync);
    };
  }, []);

  const openCtxAt = (x, y, cell, therapist_id, day, time_slot) => {
    if (!canNotifySchedule) return;
    setCtxMenu({ x, y, cell, therapist_id, day, time_slot });
  };

  const onCellTouchStart = (e, cell, therapist_id, day, time_slot) => {
    if (!canNotifySchedule) return;
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    longPressTimer.current = setTimeout(() => {
      openCtxAt(t.clientX, t.clientY, cell, therapist_id, day, time_slot);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };

  const onCellTouchMove = (e) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onCellTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  useLayoutEffect(() => {
    if (!ctxMenu) {
      setCtxMenuPos({ left: 0, top: 0, ready: false });
      return;
    }
    const el = ctxMenuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pos = positionContextMenu(ctxMenu.x, ctxMenu.y, width, height);
    setCtxMenuPos({ ...pos, ready: true });
  }, [ctxMenu]);

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = useMemo(() => toISODate(addDays(weekStart, 4)), [weekStart]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e) => {
      if (ctxMenuRef.current?.contains(e.target)) return;
      setCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  const openDupModal = (sourceISO, targetISO) => {
    setDupSource(sourceISO);
    setDupTarget(targetISO);
    setShowDup(true);
  };

  const dupWeekToTarget = async () => {
    if (!dupTarget || !dupSource) return;
    await api.post("/schedule/duplicate-week", { source_week: dupSource, target_week: dupTarget, clear_target: dupClear });
    setShowDup(false);
    setDupSource(null);
    alert(`Week duplicated: ${dupSource} → ${dupTarget}. Navigate to that week to view.`);
  };

  const loadPreparations = useCallback(async () => {
    if (!canQuickLog && !scheduleAdmin) return;
    try {
      const { data } = await api.get("/schedule/preparations", { params: { week_start: weekStartISO } });
      setPrepLookup(buildPrepLookup(Array.isArray(data) ? data : []));
    } catch {
      setPrepLookup(new Set());
    }
  }, [weekStartISO, canQuickLog, scheduleAdmin]);

  const load = useCallback(async (force = false) => {
    const yr = weekStart.getFullYear();
    const [c, t, cl, lv] = await Promise.all([
      cachedGet("/schedule", { params: { week_start: weekStartISO }, force }),
      cachedGet("/therapists", { force }).catch(() => []),
      cachedGet("/clients", { force }).catch(() => []),
      cachedGet("/leaves", { params: { year: yr }, force }).catch(() => []),
    ]);
    setCells(Array.isArray(c) ? c : []);
    setTherapists(Array.isArray(t) ? t : []);
    setClients(Array.isArray(cl) ? cl : []);
    setLeaves(Array.isArray(lv) ? lv : []);
    try {
      const st = await cachedGet("/schedule/week-status", { params: { week_start: weekStartISO }, force });
      setWeekStatus(st?.status || "published");
    } catch (_) { setWeekStatus("published"); }
    loadPreparations();
  }, [weekStartISO, weekStart, loadPreparations]);

  const loadClosures = useCallback(async () => {
    try {
      const { data } = await api.get("/schedule/closures", { params: { from_date: weekStartISO, to_date: weekEndISO } });
      setClosures(Array.isArray(data) ? data : []);
    } catch {
      setClosures([]);
    }
  }, [weekStartISO, weekEndISO]);

  useEffect(() => { loadClosures(); }, [loadClosures]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refreshPrep = () => loadPreparations();
    window.addEventListener("focus", refreshPrep);
    document.addEventListener("visibilitychange", refreshPrep);
    return () => {
      window.removeEventListener("focus", refreshPrep);
      document.removeEventListener("visibilitychange", refreshPrep);
    };
  }, [loadPreparations]);

  const loadPendingCancellations = useCallback(async () => {
    if (!parentCancelOps) {
      setPendingCancellations([]);
      return;
    }
    try {
      const { data } = await api.get("/tracking/parent-cancellations");
      setPendingCancellations(Array.isArray(data) ? data : []);
    } catch {
      setPendingCancellations([]);
    }
  }, [parentCancelOps]);

  useEffect(() => { loadPendingCancellations(); }, [loadPendingCancellations]);

  useEffect(() => {
    if (searchParams.get("parentCancel") === "1" && parentCancelOps) {
      setParentCancelFocus(null);
      setParentCancelOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("parentCancel");
        return next;
      }, { replace: true });
    }
  }, [searchParams, parentCancelOps, setSearchParams]);

  const setDraft = async () => {
    await api.post("/schedule/set-draft", { week_start: weekStartISO });
    setWeekStatus("draft");
    alert("This week is now in Draft mode (hidden from therapists until published).");
  };

  const therapistsWithEmail = useMemo(
    () => sortTherapistsForSchedule(therapists).filter((t) => (t.email || "").trim()),
    [therapists],
  );

  const openPublishModal = () => {
    setPublishSendAll(true);
    setPublishIds(therapistsWithEmail.map((t) => t.id));
    setPublishOpen(true);
  };

  const togglePublishTherapist = (id) => {
    setPublishIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return [...next];
    });
    setPublishSendAll(false);
  };

  const publishWeek = async () => {
    if (!publishSendAll && publishIds.length === 0) {
      alert("Select at least one therapist to email.");
      return;
    }
    setPublishSending(true);
    try {
      const payload = { week_start: weekStartISO };
      if (!publishSendAll) payload.therapist_ids = publishIds;
      const r = await api.post("/schedule/publish", payload);
      setWeekStatus("published");
      setPublishOpen(false);
      setParentMessagesNote(`Published · ${r.data?.emails_sent ?? 0} therapist email(s) sent`);
      setParentMessagesOpen(true);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message || "Publish failed");
    } finally {
      setPublishSending(false);
    }
  };

  const parentMessages = useMemo(
    () => buildParentMessages(cells, clients),
    [cells, clients]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (panelOpen) { setPanelOpen(false); setPanelForm(null); }
        setClipboard(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (panelOpen || notify || showDup) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [panelOpen, notify, showDup]);

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
      scheduleCoveredSlotKeys(c).forEach(k => cov.add(k));
    });
    return cov;
  }, [cells]);

  const closureLabelFor = useCallback(
    (therapistId, dayISO) => closureLabelForTherapist(closures, dayISO, therapistId),
    [closures]
  );

  const visibleTherapists = useMemo(() => {
    let list = therapists.filter(t => !isHiddenFromSchedule(t));
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    return sortTherapistsForSchedule(list);
  }, [therapists, search]);

  const addableScheduleTherapists = useMemo(
    () => sortTherapistsForSchedule(
      therapists.filter((t) => isHiddenFromSchedule({ ...t, show_on_schedule: false }))
    ),
    [therapists],
  );

  const manuallyShownTherapists = useMemo(
    () => sortTherapistsForSchedule(therapists.filter((t) => t.show_on_schedule === true)),
    [therapists],
  );

  const addTherapistToSchedule = async () => {
    if (!addTherapistId) return;
    setScheduleTherapistBusy(true);
    try {
      const { data } = await api.put(`/therapists/${addTherapistId}`, { show_on_schedule: true });
      setTherapists((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t)));
      setAddTherapistId("");
      setAdminEditsOpen(false);
      setAddSpecialistOpen(false);
    } catch (e) {
      alert(e.response?.data?.detail || "Could not add therapist to schedule");
    } finally {
      setScheduleTherapistBusy(false);
    }
  };

  const removeTherapistFromSchedule = async (tid) => {
    setScheduleTherapistBusy(true);
    try {
      const { data } = await api.put(`/therapists/${tid}`, { show_on_schedule: false });
      setTherapists((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t)));
    } catch (e) {
      alert(e.response?.data?.detail || "Could not remove therapist from schedule");
    } finally {
      setScheduleTherapistBusy(false);
    }
  };

  const selfTherapist = useMemo(
    () => resolveSelfTherapist(user, therapists),
    [user, therapists]
  );

  const canEditRow = useCallback(
    (tid) => scheduleAdmin || (scheduleLead && (view === "sheet" || tid === selfTherapist?.id)),
    [scheduleAdmin, scheduleLead, selfTherapist?.id, view]
  );
  const canNotifySchedule = scheduleAdmin || scheduleLead;

  const renderCellMenuBtn = (cell, therapist_id, day, time_slot) => {
    if (!canEditRow(therapist_id)) return null;
    return (
      <button
        type="button"
        className="schedule-cell-menu-btn"
        aria-label="Cell options"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          openCtxAt(rect.left, rect.bottom, cell, therapist_id, day, time_slot);
        }}
      >
        ⋮
      </button>
    );
  };

  const blocksTherapists = useMemo(() => {
    if (scheduleAdmin) return visibleTherapists;
    // Per Therapist view: ops leads (Walaa, Maha, Fahda, Jenan) and regular therapists see own block only.
    // Sheet view still uses visibleTherapists for the full team grid.
    if (scheduleLead && !scheduleOwnBlockOnly(user)) return visibleTherapists;
    return selfTherapist ? [selfTherapist] : [];
  }, [visibleTherapists, scheduleAdmin, scheduleLead, selfTherapist, user]);

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
    if (indices.length >= MAX_SCHEDULE_MERGE_SLOTS) return;
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
    newSlots = [...new Set(newSlots)].sort((a, b) => slotIndex(a, TIME_SLOTS) - slotIndex(b, TIME_SLOTS));
    setSelection({ ...selection, slots: newSlots.slice(0, MAX_SCHEDULE_MERGE_SLOTS) });
  };

  const openPanel = (therapist_id, day, time_slot, existing) => {
    const form = existing ? { ...existing } : {
      therapist_id, day, time_slot,
      service_code: "SS", child_name: "", state: "normal",
      week_start: weekStartISO, color: null, duration: 1,
    };
    setPanelForm(form);
    setSelection({ therapist_id, day, slots: [time_slot] });
    setSelectAnchor({ therapist_id, day, time_slot });
    setMergeForm({
      label: existing?.note || "",
      color: existing?.color || SERVICE_CELL_COLORS[existing?.service_code]?.background || "#F1ECF7",
      quick: existing?.service_code || "MEETING",
    });
    const client = existing?.child_name
      ? clients.find(c => existing.child_name.trim() === c.name || existing.child_name.startsWith(c.name + " "))
      : null;
    setColorForm(client?.schedule_color || client?.color || existing?.color || "#A2C4C9");
    setPanelOpen(true);
  };

  const closePanel = () => { setPanelOpen(false); setPanelForm(null); clearSelection(); };

  const deleteAtSlot = async (therapist_id, day, time_slot) => {
    const cell = findCellAt(therapist_id, day, time_slot, cellMap, cells);
    if (cell?.id) await api.delete(`/schedule/${cell.id}`);
  };

  const clearTherapistDay = async (therapist_id, day) => {
    const ids = [...new Set(
      cells.filter(c => c.therapist_id === therapist_id && c.day === day).map(c => c.id)
    )];
    for (const id of ids) {
      await api.delete(`/schedule/${id}`);
    }
  };

  const bulkFillAt = async (mode, { therapist_id, day, time_slot }) => {
    const leaveColor = SERVICE_CELL_COLORS.LEAVE.background;
    const therapistName = therapists.find(t => t.id === therapist_id)?.name || "Therapist";
    const fullDaySpan = TIME_SLOTS.length;

    try {
      if (mode === "leave_day") {
        const dayDate = addDays(weekStart, day);
        const dateLabel = `${dayDate.getDate()}/${dayDate.getMonth() + 1}`;
        if (!window.confirm(`Mark ${therapistName} on leave for full ${DAYS_EN[day]} (${dateLabel})?`)) return;
        await clearTherapistDay(therapist_id, day);
        await api.post("/schedule", {
          therapist_id, day, time_slot: TIME_SLOTS[0], duration: fullDaySpan,
          week_start: weekStartISO, service_code: "LEAVE", note: "Leave",
          state: "normal", color: leaveColor, child_name: null,
        });
      } else if (mode === "leave_week") {
        if (!window.confirm(`Mark ${therapistName} on leave for entire week of ${formatDateRange(weekStart)}?`)) return;
        for (let d = 0; d < 5; d++) {
          await clearTherapistDay(therapist_id, d);
          await api.post("/schedule", {
            therapist_id, day: d, time_slot: TIME_SLOTS[0], duration: fullDaySpan,
            week_start: weekStartISO, service_code: "LEAVE", note: "Leave",
            state: "normal", color: leaveColor, child_name: null,
          });
        }
      } else if (mode === "available") {
        await deleteAtSlot(therapist_id, day, time_slot);
        await api.post("/schedule", {
          therapist_id, day, time_slot, duration: 1,
          week_start: weekStartISO, service_code: "AVAILABLE", note: "Available",
          state: "available", color: "#FFFFFF", child_name: null,
        });
      } else if (mode === "clear") {
        await deleteAtSlot(therapist_id, day, time_slot);
      }
      await load(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not update schedule. Please try again.");
    } finally {
      setCtxMenu(null);
    }
  };

  const bulkFill = async (mode) => {
    if (!panelForm) return;
    await bulkFillAt(mode === "available_day" ? "available" : mode, panelForm);
    closePanel();
  };

  const pasteAt = async (therapist_id, day, time_slot) => {
    if (!clipboard) return;
    if (cellMap[`${therapist_id}_${day}_${time_slot}`]) {
      alert("This slot is occupied");
      return;
    }
    await api.post("/schedule", {
      therapist_id, day, time_slot, week_start: weekStartISO,
      service_code: clipboard.service_code,
      child_name: clipboard.child_name,
      custom_time: clipboard.custom_time,
      note: clipboard.note,
      duration: clipboard.duration || 1,
      state: "normal",
      color: clipboard.color || null,
    });
    await load();
  };

  const openQuickLogFromCell = async (cell, therapist_id, day, time_slot) => {
    if (!isScheduleClientLogCell(cell)) return;
    let client = findClientForScheduleCell(cell.child_name, clients);
    if (!client) {
      try {
        const { data } = await api.get("/clients/resolve-schedule-name", {
          params: { child_name: cell.child_name.trim() },
        });
        client = data;
      } catch {
        return;
      }
    }
    if (!client) return;
    const sessionDate = toISODate(addDays(weekStart, day));
    const start = slotToTime24(time_slot);
    const dur = parseFloat(cell.duration) || 1;
    setQuickLog({
      client,
      cell,
      scheduleSlot: scheduleSlotFromCell(cell, therapist_id, day, weekStartISO, client.id),
      prefill: {
        session_date: sessionDate,
        start_time: start,
        end_time: addHoursToTime(start, dur),
        service_type: cell.service_code === "SS" ? "SS" : (cell.service_code === "HS" ? "HS" : client.service_type || "HS"),
      },
    });
  };

  const handleCellClick = (e, therapist_id, day, time_slot, existing) => {
    if (e) e.stopPropagation();
    const cell = existing || findCellAt(therapist_id, day, time_slot, cellMap, cells);
    if (canQuickLog) {
      if (view !== "blocks") return;
      if (!selfTherapist?.id || therapist_id !== selfTherapist.id) return;
      if (isScheduleClientLogCell(cell)) {
        openQuickLogFromCell(cell, therapist_id, day, time_slot);
      }
      return;
    }
    if (!canEditRow(therapist_id)) return;
    if (clipboard && !existing) {
      pasteAt(therapist_id, day, time_slot);
      return;
    }
    if (e?.shiftKey && panelOpen && selectAnchor
        && selectAnchor.therapist_id === therapist_id && selectAnchor.day === day) {
      const range = buildSlotRange(selectAnchor.time_slot, time_slot, TIME_SLOTS);
      const valid = range
        .filter(ts => isSlotSelectable(therapist_id, day, ts, cellMap, coveredSet))
        .slice(0, MAX_SCHEDULE_MERGE_SLOTS);
      if (valid.length) setSelection({ therapist_id, day, slots: valid });
      return;
    }
    openPanel(therapist_id, day, time_slot, existing);
  };

  const applyMerge = async () => {
    const sel = selection || (panelForm ? { therapist_id: panelForm.therapist_id, day: panelForm.day, slots: [panelForm.time_slot] } : null);
    if (!sel?.slots?.length) return;
    const slots = [...sel.slots].sort((a, b) => slotIndex(a, TIME_SLOTS) - slotIndex(b, TIME_SLOTS));
    const start = slots[0];
    const duration = clampMergeSlotCount(slots.length);
    const quick = mergeForm.quick;
    if (quick === "AVAILABLE") {
      for (const ts of slots) {
        await deleteAtSlot(sel.therapist_id, sel.day, ts);
        await api.post("/schedule", {
          therapist_id: sel.therapist_id, day: sel.day, time_slot: ts,
          week_start: weekStartISO, service_code: "SS", note: "Available",
          state: "available", color: "#FFFFFF", child_name: null, duration: 1,
        });
      }
      await load();
      closePanel();
      return;
    }
    const service_code = quick || "MEETING";
    const color = mergeForm.color || SERVICE_CELL_COLORS[service_code]?.background || "#F1ECF7";
    for (const ts of slots) await deleteAtSlot(sel.therapist_id, sel.day, ts);
    await api.post("/schedule", {
      therapist_id: sel.therapist_id,
      day: sel.day,
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
    await load();
    closePanel();
  };

  const markAvailableCurrent = async () => {
    if (!panelForm) return;
    await bulkFillAt("available", panelForm);
    closePanel();
  };

  const unmergeCell = async () => {
    if (!panelForm?.id) return;
    await api.put(`/schedule/${panelForm.id}`, { ...panelForm, duration: 1 });
    await load();
    setPanelForm(f => ({ ...f, duration: 1 }));
  };

  const saveClientColor = async () => {
    if (!panelForm) return;
    const client = panelForm.child_name
      ? clients.find(c => panelForm.child_name.trim() === c.name || panelForm.child_name.startsWith(c.name + " "))
      : null;
    if (!client) {
      if (panelForm.id) {
        await api.put(`/schedule/${panelForm.id}`, { ...panelForm, color: colorForm });
        setPanelForm(f => ({ ...f, color: colorForm }));
      }
      await load();
      return;
    }
    await api.put(`/clients/${client.id}/schedule-color`, { color: colorForm });
    await load();
  };

  const resetClientColor = async () => {
    const client = panelForm?.child_name
      ? clients.find(c => panelForm.child_name.trim() === c.name || panelForm.child_name.startsWith(c.name + " "))
      : null;
    if (!client) return;
    await api.put(`/clients/${client.id}/schedule-color`, { color: null });
    await load();
  };

  const copyCell = ({ cell, therapist_id, day, time_slot }) => {
    if (!cell) return;
    setClipboard({
      service_code: cell.service_code, child_name: cell.child_name,
      custom_time: cell.custom_time, note: cell.note,
      duration: cell.duration || 1, color: cell.color,
      sourceKey: `${therapist_id}_${day}_${time_slot}`,
    });
    setCtxMenu(null);
  };

  const isCopied = (therapist_id, day, time_slot) =>
    clipboard?.sourceKey === `${therapist_id}_${day}_${time_slot}`;

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

  const save = async (opts = {}) => {
    if (!panelForm) return;
    setPanelSaving(true);
    const wasCancelTherapist = panelForm.state === "cancel_therapist";
    try {
      const payload = { ...panelForm, week_start: weekStartISO };
      if (payload.service_code !== "LEAVE" && payload.duration) {
        payload.duration = clampMergeDuration(payload.duration);
      }
      if (payload.service_code === "AVAILABLE") {
        payload.state = "available";
        payload.color = "#FFFFFF";
        payload.note = payload.note || "Available";
        payload.child_name = null;
      }
      let cellId = panelForm.id;
      if (panelForm.id) {
        await api.put(`/schedule/${panelForm.id}`, payload);
      } else {
        const { data } = await api.post("/schedule", payload);
        cellId = data?.id;
      }
      const cn = opts.cancelNotify;
      if (
        cn && (payload.state === "cancel_therapist" || payload.state === "cancel_child") && cellId
        && (cn.send_email || cn.send_in_app)
      ) {
        await api.post("/schedule/cancel-notify", {
          cell_id: cellId,
          state: payload.state,
          message: cn.message,
          recipient_ids: cn.recipient_ids || [],
          send_email: !!cn.send_email,
          send_in_app: cn.send_in_app !== false,
        });
      }
      await load();
      await loadPendingCancellations();
      closePanel();
      if (wasCancelTherapist && payload.state === "cancel_therapist" && parentCancelOps && cellId) {
        setParentCancelFocus(cellId);
        setParentCancelOpen(true);
      }
    } finally {
      setPanelSaving(false);
    }
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
  const onCtx = (e, cell, therapist_id, day, time_slot) => {
    if (!canNotifySchedule) return;
    if (!canEditRow(therapist_id) && !cell) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, cell, therapist_id, day, time_slot });
  };

  const onTherapistNameInteract = (e, therapist_id) => {
    if (!canEditRow(therapist_id)) return;
    e.preventDefault();
    e.stopPropagation();
    const cell = findCellAt(therapist_id, 0, TIME_SLOTS[0], cellMap, cells);
    openCtxAt(e.clientX, e.clientY, cell, therapist_id, 0, TIME_SLOTS[0]);
  };

  const ctxAction = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    Promise.resolve(fn()).catch(err => {
      alert(err?.response?.data?.detail || "Action failed");
    });
  };

  // === SHEET VIEW === (matches Google Sheet: # | Therapist | Day | 10 time slots)
  const renderSheet = () => (
    <div className="card p-0 overflow-hidden">
      <div className="table-scroll overflow-x-auto">
        <table className="text-xs border-collapse sched-sheet sched-sheet-v2" style={{ minWidth: 980 }}>
          {visibleTherapists.map((t, ti) => (
            <tbody key={t.id} className="sheet-therapist-group">
              <tr className="sheet-group-hours">
                <th className="sheet-th sheet-idx" style={{ minWidth: 32, width: 32 }} aria-hidden />
                <th className="sheet-th sheet-therapist" style={{ minWidth: 96 }} aria-hidden />
                <th className="sheet-th sheet-day" style={{ minWidth: 58 }}>Day</th>
                {TIME_SLOTS.map(ts => (
                  <th key={ts} className="sheet-th sheet-time" style={{ minWidth: 68 }}>
                    {formatSlotHeader(ts)}
                  </th>
                ))}
              </tr>
            {DAYS_EN.map((d, di) => {
                const leaveInfo = leaveByTherapistDay[`${t.id}_${di}`];
                const dayISO = toISODate(addDays(weekStart, di));
                const closureLabel = closureLabelFor(t.id, dayISO);
                return (
                <tr key={`${t.id}_${di}`} className={[di === 0 ? "sheet-therapist-start" : "", di === 4 ? "sheet-therapist-divider" : ""].filter(Boolean).join(" ")}>
                  {di === 0 && (
                    <>
                      <td rowSpan={5} className="sheet-td sheet-idx font-bold text-center">
                        {ti + 1}
                      </td>
                      <td
                        rowSpan={5}
                        className={`sheet-td sheet-therapist${canEditRow(t.id) ? " editable" : ""}`}
                        onClick={(e) => onTherapistNameInteract(e, t.id)}
                        onContextMenu={(e) => onTherapistNameInteract(e, t.id)}
                      >
                        <div className="flex flex-col items-center justify-center gap-1 text-center px-1 py-2">
                          <div className="w-7 h-7 rounded-full text-white text-[10px] flex items-center justify-center font-bold shrink-0" style={{ background: t.color }}>
                            {t.name.replace("Ms. ", "").charAt(0)}
                          </div>
                          <span className="font-bold text-[10px] leading-tight break-words" style={{ color: "#2C3625" }}>{getTherapistScheduleName(t)}</span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="sheet-td sheet-day font-bold text-center" style={leaveInfo && !closureLabel ? { background: "#FEF9C3" } : {}}>
                    <div className="text-[11px] tracking-wider" style={{ color: "#2C3625" }}>{DAYS_SHORT[di].toUpperCase()}</div>
                    <div className="text-[9px] font-normal" style={{ color: "#8B9E7A" }}>{addDays(weekStart, di).getDate()}/{addDays(weekStart, di).getMonth() + 1}</div>
                    {leaveInfo && !closureLabel && (
                      <div className="text-[8px] font-bold mt-0.5" style={{ color: "#8B6918" }}>
                        {leaveInfo.type === "Absence" ? "ABSENT" : "ON LEAVE"}
                      </div>
                    )}
                  </td>
                  {closureLabel ? (
                    <ClosureBannerCell
                      label={closureLabel}
                      className="sheet-td sheet-slot schedule-closure-cell"
                      canEdit={canEditRow(t.id)}
                      therapist_id={t.id}
                      day={di}
                      onCtx={onCtx}
                      onTouchStart={onCellTouchStart}
                      onTouchMove={onCellTouchMove}
                      onTouchEnd={onCellTouchEnd}
                    />
                  ) : TIME_SLOTS.map(ts => {
                    const cell = cellMap[`${t.id}_${di}_${ts}`];
                    const covered = coveredSet.has(`${t.id}_${di}_${ts}`);
                    if (covered) return null;
                    const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
                    const colSpan = scheduleDisplaySpan(cell);
                    const baseStyle = getSheetCellStyle(cell, clients);
                    const cellStyle = { ...baseStyle, height: 38, minHeight: 38 };
                    return (
                      <td
                        key={ts}
                        colSpan={colSpan}
                        data-testid={`sheet-cell-${t.id}-${di}-${ts}`}
                        className={cellClassName(cell, canEditRow(t.id), leaveInfo, isSelected(t.id, di, ts), isCopied(t.id, di, ts))}
                        style={cellStyle}
                        onClick={(e) => handleCellClick(e, t.id, di, ts, cell)}
                        onContextMenu={canNotifySchedule ? (e) => onCtx(e, cell, t.id, di, ts) : undefined}
                        onTouchStart={(e) => onCellTouchStart(e, cell, t.id, di, ts)}
                        onTouchMove={onCellTouchMove}
                        onTouchEnd={onCellTouchEnd}
                      >
                        {renderCellMenuBtn(cell, t.id, di, ts)}
                        {cell && <CellContent cell={cell} sc={sc} />}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
              <tr className="sheet-therapist-separator" aria-hidden="true">
                <td colSpan={3 + TIME_SLOTS.length} />
              </tr>
            </tbody>
          ))}
          {visibleTherapists.length === 0 && (
            <tbody>
              <tr><td colSpan={13} className="p-12 text-center" style={{ color: "#8B9E7A" }}>No therapists found</td></tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );

  // === BLOCKS VIEW (per-therapist) ===
  const renderTherapistBlock = (therapist, idx) => (
    <div key={therapist.id} className="card p-0 overflow-hidden rounded-[1.25rem]" data-testid={`therapist-block-${therapist.id}`}>
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "#E2DDD4", background: `linear-gradient(90deg, ${therapist.color}15 0%, transparent 100%)` }}>
        <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-sm" style={{ background: therapist.color }}>{idx + 1}</div>
        <div className="flex-1">
          <div className="text-[11px] tracking-[0.2em] font-bold" style={{ color: "#8B9E7A" }}>THERAPIST</div>
          <div className="font-bold text-lg" style={{ color: "#2C3625" }}>{getTherapistScheduleName(therapist)}</div>
        </div>
      </div>
      <div className="table-scroll overflow-x-auto">
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
              const dayISO = toISODate(addDays(weekStart, di));
              const closureLabel = closureLabelFor(therapist.id, dayISO);
              return (
              <tr key={di} className={leaveInfo ? "schedule-leave-row" : ""}>
                <td className="cell-base text-center font-bold" style={{ background: leaveInfo && !closureLabel ? "#FEF9C3" : "#F6F4F0", color: "#2C3625", position: "relative" }}>
                  <div className="text-[11px] tracking-wider">{DAYS_SHORT[di].toUpperCase()}</div>
                  <div className="text-[10px] font-normal" style={{ color: "#8B9E7A" }}>{addDays(weekStart, di).getDate()}/{addDays(weekStart, di).getMonth() + 1}</div>
                  {leaveInfo && !closureLabel && (
                    <div className="text-[9px] font-bold mt-0.5" style={{ color: "#8B6918" }}>
                      {leaveInfo.type === "Absence" ? "ABSENT" : "ON LEAVE"}
                    </div>
                  )}
                </td>
                {closureLabel ? (
                  <ClosureBannerCell
                    label={closureLabel}
                    className="cell-base schedule-closure-cell"
                    canEdit={canEditRow(therapist.id)}
                    therapist_id={therapist.id}
                    day={di}
                    onCtx={onCtx}
                    onTouchStart={onCellTouchStart}
                    onTouchMove={onCellTouchMove}
                    onTouchEnd={onCellTouchEnd}
                  />
                ) : TIME_SLOTS.map(ts => {
                  const cell = cellMap[`${therapist.id}_${di}_${ts}`];
                  const isCovered = coveredSet.has(`${therapist.id}_${di}_${ts}`);
                  if (isCovered) return null;
                  const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
                  const colSpan = scheduleDisplaySpan(cell);
                  const baseStyle = getSheetCellStyle(cell, clients);
                  const cellStyle = { ...baseStyle, height: 38, minHeight: 38 };
                  const showPrepBadge = view === "blocks"
                    && canQuickLog
                    && therapist.id === selfTherapist?.id
                    && isCellPrepComplete(prepLookup, cell, therapist.id, di, weekStartISO, clients);
                  return (
                    <td key={ts} className={cellClassNameBlock(cell, canEditRow(therapist.id), leaveInfo, isSelected(therapist.id, di, ts), isCopied(therapist.id, di, ts), canQuickLog && therapist.id === selfTherapist?.id, showPrepBadge)}
                      colSpan={colSpan}
                      style={cellStyle}
                      data-testid={`cell-${therapist.id}-${di}-${ts}`}
                      onClick={(e) => handleCellClick(e, therapist.id, di, ts, cell)}
                      onContextMenu={canNotifySchedule ? (e) => onCtx(e, cell, therapist.id, di, ts) : undefined}
                      onTouchStart={(e) => onCellTouchStart(e, cell, therapist.id, di, ts)}
                      onTouchMove={onCellTouchMove}
                      onTouchEnd={onCellTouchEnd}>
                      {renderCellMenuBtn(cell, therapist.id, di, ts)}
                      {showPrepBadge && <SchedulePrepBadge />}
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
    <div className="relative">
        <div className={`transition-all ${panelOpen && isAdmin ? "lg:mr-[420px]" : ""}`}>
      <SchedulePageHeader
        className="no-print"
        toolbarPlacement={isScheduleNarrow ? "outside" : "inline"}
        subtitle={isAdmin
          ? "Right-click any cell for actions · Click to edit · Drag to select multiple slots"
          : scheduleLead && view === "sheet"
            ? "Team schedule — right-click or click therapist name or any cell to edit"
            : view === "blocks"
              ? "My schedule — click your sessions to log preparation"
              : "Team schedule — view all therapists"}
        badge={isScheduleNarrow ? (
          <span className="pill text-[10px] px-2 py-0.5 font-bold bg-white/90 text-[#2F4A35] border border-[#D4DEC8] whitespace-nowrap">
            {formatDateRange(weekStart)}
          </span>
        ) : isAdmin ? (
          weekStatus === "draft" ? (
            <span className="pill text-[10px] px-2 py-1 font-bold bg-[#FAF0D1] text-[#6B5218] border border-[#E5C387]">
              Draft
            </span>
          ) : (
            <span className="pill text-[10px] px-2 py-1 font-bold bg-[#E5EBE1] text-[#3D4F35] border border-[#B8C8A8] flex items-center gap-1">
              <CheckCircle size={12} weight="fill" /> Published
            </span>
          )
        ) : null}
        stats={isScheduleNarrow ? [] : [
          { n: formatDateRange(weekStart), label: "This Week", color: "#2C3625" },
          { n: view === "blocks" ? "My schedule" : "Team schedule", label: "View", color: "#5C6853" },
          { n: visibleTherapists.length, label: "Therapists", color: "#6B5218" },
          { n: clients.length, label: "Clients", color: "#3D4F35" },
        ]}
        toolbar={(
          <div className="flex items-center gap-1.5 flex-wrap schedule-toolbar schedule-toolbar--wrap relative">
            <div className="inline-flex items-center rounded-lg border border-[#E2DDD4] p-0.5 bg-[#FAFAF7] shrink-0 schedule-view-toggle">
              <button data-testid="view-sheet-btn" onClick={() => setView("sheet")} className={`btn ${view === "sheet" ? "btn-primary" : "btn-ghost"} text-[11px] px-2 py-1 min-h-0`} title="جدول الفريق" aria-label="Team schedule"><Table size={13} /> Team schedule</button>
              <button data-testid="view-blocks-btn" onClick={() => setView("blocks")} className={`btn ${view === "blocks" ? "btn-primary" : "btn-ghost"} text-[11px] px-2 py-1 min-h-0`} title="جدولي" aria-label="My schedule"><GridFour size={13} /> My schedule</button>
            </div>
            <div className="inline-flex items-center rounded-lg border border-[#E2DDD4] px-0.5 bg-[#FAFAF7] shrink-0 schedule-toolbar-week-nav">
              <button data-testid="prev-week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-ghost p-1 min-h-0"><CaretLeft size={14} /></button>
              <div className="px-2 text-[11px] font-bold whitespace-nowrap" style={{ color: "#2C3625" }}>{formatDateRange(weekStart)}</div>
              <button data-testid="next-week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn btn-ghost p-1 min-h-0"><CaretRight size={14} /></button>
              <div className="w-px h-4 bg-[#E2DDD4] mx-0.5" />
              <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn btn-ghost text-[10px] px-1.5 py-1 min-h-0"><House size={12} /> Today</button>
              <input type="date" title="Jump to week" className="input text-[10px] w-[108px] py-1 px-1.5 min-h-0 border-0 bg-transparent"
                onChange={e => { if (e.target.value) setWeekStart(startOfWeek(new Date(e.target.value + "T12:00:00"))); }} />
            </div>
            {isAdmin && !isScheduleNarrow && (view === "blocks" || view === "sheet") && (
              <div className="relative flex-1 min-w-[100px] max-w-[160px]">
                <MagnifyingGlass size={13} className="absolute top-1/2 -translate-y-1/2 left-2" style={{ color: "#8B9E7A" }} />
                <input data-testid="schedule-search-input" className="input pl-7 py-1 text-[11px] min-h-0 h-7" placeholder="Search therapist…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            )}
            <div className="schedule-parent-actions flex items-center gap-1.5 flex-wrap shrink-0">
            {canNotifySchedule && (
              <button
                type="button"
                data-testid="parent-whatsapp-messages-btn"
                onClick={() => {
                  setParentMessagesNote("");
                  setParentMessagesOpen(true);
                }}
                className="btn btn-outline text-[11px] flex items-center gap-1 px-2 py-1 min-h-0 shrink-0"
                title="Generate parent WhatsApp messages for this week"
              >
                <WhatsappLogo size={14} weight="fill" />
                Parent WhatsApp
              </button>
            )}
            {parentCancelOps && (
              <button
                type="button"
                data-testid="parent-cancellations-btn"
                onClick={() => {
                  setParentCancelFocus(null);
                  setParentCancelOpen(true);
                }}
                className={`btn text-[11px] flex items-center gap-1 px-2 py-1 min-h-0 shrink-0 ${
                  pendingCancellations.length > 0 ? "btn-gold" : "btn-outline"
                }`}
                title="Pending parent WhatsApp for therapist cancellations"
              >
                <WhatsappLogo size={14} weight="fill" />
                Parent cancellations
                {pendingCancellations.length > 0 ? ` (${pendingCancellations.length})` : ""}
              </button>
            )}
            </div>
            {isAdmin && (
              <>
              <button
                type="button"
                data-testid="schedule-add-specialist-btn"
                onClick={() => { setAddTherapistId(""); setAddSpecialistOpen(true); }}
                className="btn btn-outline text-[11px] flex items-center gap-1 px-2 py-1 min-h-0 shrink-0"
              >
                <UserPlus size={13} />
                Add specialist
              </button>
              <div className="relative ml-auto shrink-0" ref={adminEditsRef}>
                <button
                  type="button"
                  data-testid="schedule-admin-edits"
                  onClick={() => setAdminEditsOpen(o => !o)}
                  className="btn btn-outline text-[11px] flex items-center gap-1 px-2 py-1 min-h-0"
                  aria-expanded={adminEditsOpen}
                >
                  <PencilSimple size={13} />
                  Edits
                  <CaretDown size={11} className={`transition-transform ${adminEditsOpen ? "rotate-180" : ""}`} />
                </button>
                {adminEditsOpen && (
                  <div className="schedule-admin-edits-menu absolute right-0 top-[calc(100%+6px)] z-[200] card p-2.5 min-w-[228px] shadow-lg border border-[#E2DDD4] flex flex-col gap-2 bg-white">
                    {manuallyShownTherapists.length > 0 && (
                      <div className="border-b pb-2 mb-1 space-y-1" style={{ borderColor: "#EDE9E3" }}>
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#8B9E7A" }}>Added specialists</div>
                        {manuallyShownTherapists.map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="truncate" style={{ color: "#2C3625" }}>{getTherapistScheduleName(t)}</span>
                            <button
                              type="button"
                              className="text-[9px] underline shrink-0"
                              disabled={scheduleTherapistBusy}
                              onClick={() => removeTherapistFromSchedule(t.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => { setShowHolidays(true); setAdminEditsOpen(false); }} className="btn btn-outline text-xs w-full justify-start min-h-[36px]">Official holidays</button>
                    <button type="button" onClick={() => { setDraft(); setAdminEditsOpen(false); }} className="btn btn-outline text-xs w-full justify-start min-h-[36px]">Save as Draft</button>
                    <button type="button" onClick={() => { openPublishModal(); setAdminEditsOpen(false); }} className="btn btn-primary text-xs w-full justify-start min-h-[36px]">Publish Week</button>
                    <button
                      type="button"
                      data-testid="duplicate-week-btn"
                      onClick={() => { openDupModal(weekStartISO, toISODate(addDays(weekStart, 7))); setAdminEditsOpen(false); }}
                      className="btn btn-gold text-xs w-full justify-start min-h-[36px]"
                    >
                      <CopySimple size={14} /> Duplicate Week →
                    </button>
                    <button
                      type="button"
                      onClick={() => { window.print(); setAdminEditsOpen(false); }}
                      className="btn btn-outline text-xs w-full justify-start min-h-[36px]"
                    >
                      <Printer size={14} /> Print
                    </button>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}
      />

      {addSpecialistOpen && (
        <ModalBase
          title="Add specialist"
          subtitle="Choose a therapist to show as a column on the weekly schedule"
          onClose={() => setAddSpecialistOpen(false)}
          size="sm"
          footer={(
            <>
              <ModalBtnSecondary type="button" onClick={() => setAddSpecialistOpen(false)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary
                type="button"
                data-testid="schedule-add-therapist-btn"
                onClick={addTherapistToSchedule}
                disabled={!addTherapistId || scheduleTherapistBusy}
              >
                {scheduleTherapistBusy ? "Adding…" : "Add to schedule"}
              </ModalBtnPrimary>
            </>
          )}
        >
          <FormSection title="Therapist">
            <FormField label="Select specialist">
              <select
                className="modal-input"
                value={addTherapistId}
                onChange={(e) => setAddTherapistId(e.target.value)}
                data-testid="schedule-add-therapist-select"
              >
                <option value="">Choose therapist…</option>
                {addableScheduleTherapists.map((t) => (
                  <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>
                ))}
              </select>
            </FormField>
            {addableScheduleTherapists.length === 0 && (
              <p className="text-xs m-0" style={{ color: "#8B9E7A" }}>All therapists are already on the schedule.</p>
            )}
          </FormSection>
        </ModalBase>
      )}

      {clipboard && (isAdmin || (scheduleLead && view === "sheet")) && (
        <div className="card p-3 mb-4 flex items-center gap-3 text-sm no-print" style={{ background: "#FFF7E1", borderColor: "#E8C572" }} data-testid="clipboard-banner">
          <Copy size={18} weight="duotone" style={{ color: "#8B6918" }} />
          <div className="flex-1">
            <div className="font-bold" style={{ color: "#6B5218" }}>📋 Cell copied — right-click empty slot → Paste Here</div>
            <div className="text-xs" style={{ color: "#8B6918" }}>{clipboard.service_code}{clipboard.child_name && ` | ${clipboard.child_name}`}{clipboard.custom_time && ` (${clipboard.custom_time})`} {clipboard.duration > 1 && `· ${clipboard.duration}h`}</div>
          </div>
          <button onClick={() => setClipboard(null)} className="btn btn-ghost p-1.5"><X size={16} /></button>
        </div>
      )}

      <div className="dash-schedule-wrap schedule-printable">
      <div className="schedule-print-title hidden print:block font-display text-lg font-semibold mb-2" style={{ color: "#2F4A35" }}>
        Weekly Schedule · {formatDateRange(weekStart)}
      </div>
      <div className="sched-zoom" style={{ "--sched-zoom": SCHEDULE_ZOOM / 100 }}>
        {cells.length === 0 && (
          <div className="card p-10 text-center mb-4" style={{ background: "linear-gradient(135deg, #FAF5E8 0%, #F0E9D8 100%)", borderColor: "#E8C572" }}>
            <CalendarBlank size={42} weight="duotone" className="mx-auto mb-3" style={{ color: "#8B6918" }} />
            <div className="font-display text-xl mb-2" style={{ color: "#2C3625" }}>No schedule for this week yet</div>
            <div className="text-sm mb-4" style={{ color: "#5C6853" }}>Choose how to fill this week:</div>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-outline text-sm">← Go to previous week</button>
              {isAdmin && (
                <button onClick={() => openDupModal(toISODate(addDays(weekStart, -7)), weekStartISO)} className="btn btn-gold text-sm">
                  <CopySimple size={14} /> Duplicate previous week here
                </button>
              )}
            </div>
          </div>
        )}
        {view === "sheet" && isScheduleTablet && (
          <p className="schedule-sheet-hint no-print">Swipe table horizontally to see all time slots</p>
        )}
        {view === "sheet" && renderSheet()}
        {view === "blocks" && (
          <div className="space-y-6 stagger">
            {blocksTherapists.length === 0 && <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>No therapists found</div>}
            {blocksTherapists.map((t, i) => renderTherapistBlock(t, i))}
          </div>
        )}
      </div>
      </div>

      {panelOpen && panelForm && (
        <ScheduleCellPanel
          form={panelForm}
          setForm={setPanelForm}
          onClose={closePanel}
          onSave={save}
          therapists={therapists}
          clients={clients}
          saving={panelSaving}
          canParentCancellationOps={parentCancelOps}
          weekStart={weekStartISO}
        />
      )}

      {ctxMenu && canNotifySchedule && (
        <div
          ref={ctxMenuRef}
          className="fixed z-[70] schedule-ctx-menu bg-white rounded-xl shadow-2xl border py-1 min-w-[220px] text-sm"
          style={{
            left: ctxMenuPos.ready ? ctxMenuPos.left : ctxMenu.x,
            top: ctxMenuPos.ready ? ctxMenuPos.top : ctxMenu.y,
            visibility: ctxMenuPos.ready ? "visible" : "hidden",
            maxHeight: "calc(100dvh - 16px)",
            overflowY: "auto",
            borderColor: "#E2DDD4",
          }}
          onClick={e => e.stopPropagation()}
          data-testid="schedule-context-menu"
        >
          {canEditRow(ctxMenu.therapist_id) ? (
            <>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8B9E7A" }}>Session Options</div>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
            onClick={ctxAction(() => { openPanel(ctxMenu.therapist_id, ctxMenu.day, ctxMenu.time_slot, ctxMenu.cell); setCtxMenu(null); })}>
            {ctxMenu.cell ? "Edit Session" : "Add Session here"}
          </button>
          {ctxMenu.cell && (
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
              onClick={ctxAction(() => copyCell(ctxMenu))}>
              Copy Cell
            </button>
          )}
          {!ctxMenu.cell && clipboard && canEditRow(ctxMenu.therapist_id) && (
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
              onClick={ctxAction(() => { pasteAt(ctxMenu.therapist_id, ctxMenu.day, ctxMenu.time_slot); setCtxMenu(null); })}>
              Paste Here
            </button>
          )}
          <div className="my-1 border-t" style={{ borderColor: "#EDE9E3" }} />
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8B9E7A" }}>Quick Mark</div>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
            onClick={ctxAction(() => bulkFillAt("available", ctxMenu))}>
            Mark as Available
          </button>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
            onClick={ctxAction(() => bulkFillAt("leave_day", ctxMenu))}>
            Full Day Leave
          </button>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
            onClick={ctxAction(() => bulkFillAt("leave_week", ctxMenu))}>
            Full Week Leave
          </button>
            </>
          ) : null}
          {ctxMenu.cell && (
            <>
              <div className="my-1 border-t" style={{ borderColor: "#EDE9E3" }} />
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8B9E7A" }}>Notifications</div>
              <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#F5F5F0]" style={{ color: "#2C3625" }}
                onClick={ctxAction(() => { openNotify(ctxMenu.cell); setCtxMenu(null); })}>
                Notify Therapist
              </button>
            </>
          )}
          {canEditRow(ctxMenu.therapist_id) && (
          <>
          <div className="my-1 border-t" style={{ borderColor: "#EDE9E3" }} />
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8B9E7A" }}>Remove</div>
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-[#FCE0E8]" style={{ color: "#8A3F27" }}
            onClick={ctxAction(async () => {
              if (ctxMenu.cell?.id) {
                if (!window.confirm("Clear this cell?")) return;
                await remove(ctxMenu.cell.id);
              } else {
                await bulkFillAt("clear", ctxMenu);
              }
              setCtxMenu(null);
            })}>
            Clear Cell
          </button>
          </>
          )}
        </div>
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
              ? `${getTherapistScheduleName(therapists.find(t => t.id === notify.therapist_id))} · ${DAYS_EN[notify.day]} · ${notify.time_slot}`
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
                    border: "1px solid #E2DDD4",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(notify.recipient_ids || []).includes(t.id)}
                    onChange={() => toggleRecipient(t.id)}
                  />
                  {getTherapistScheduleName(t)}
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
                    <div>
                      <span>{r.therapist_name || r.user_id}</span>
                      {r.actor_name && (
                        <span className="block text-[10px]" style={{ color: "#8B9E7A" }}>Sent by {r.actor_name}</span>
                      )}
                    </div>
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
          subtitle={`Copy ${dupSource ? formatDateRange(new Date(`${dupSource}T12:00:00`)) : "…"} → target week below`}
          onClose={() => { setShowDup(false); setDupSource(null); }}
          size="sm"
          footer={
            <>
              <ModalBtnSecondary onClick={() => { setShowDup(false); setDupSource(null); }}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="dup-confirm-btn" onClick={dupWeekToTarget} disabled={!dupTarget || !dupSource}>
                <CopySimple size={16} className="inline mr-1" /> Duplicate
              </ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Target Week">
            {dupSource && (
              <p className="text-xs mb-3" style={{ color: "#5C6853" }}>
                Source week: <strong>{dupSource}</strong> ({formatDateRange(new Date(`${dupSource}T12:00:00`))})
              </p>
            )}
            <FormField label="Target week start (Sunday)">
              <input
                type="date"
                className="modal-input"
                value={dupTarget || ""}
                onChange={e => setDupTarget(e.target.value)}
              />
            </FormField>
            {dupSource && (
              <div className="flex gap-2 flex-wrap">
                <ModalBtnSecondary type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => setDupTarget(toISODate(addDays(new Date(`${dupSource}T12:00:00`), 7)))}>
                  Next week
                </ModalBtnSecondary>
                <ModalBtnSecondary type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => setDupTarget(toISODate(addDays(new Date(`${dupSource}T12:00:00`), 14)))}>
                  +2 weeks
                </ModalBtnSecondary>
                <ModalBtnSecondary type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => setDupTarget(toISODate(addDays(new Date(`${dupSource}T12:00:00`), 28)))}>
                  +4 weeks
                </ModalBtnSecondary>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={dupClear} onChange={e => setDupClear(e.target.checked)} />
              <span style={{ color: "#5C6853" }}>Clear target week first (replace existing cells)</span>
            </label>
          </FormSection>
        </ModalBase>
      )}

      {showHolidays && (
        <ScheduleHolidaysModal
          weekStartISO={weekStartISO}
          weekEndISO={weekEndISO}
          therapists={therapists.filter(t => !isHiddenFromSchedule(t))}
          onClose={() => setShowHolidays(false)}
          onChanged={loadClosures}
        />
      )}

      {quickLog && (
        <LogSessionModal
          client={quickLog.client}
          therapists={therapists}
          currentUser={user}
          prefill={quickLog.prefill}
          scheduleSlot={quickLog.scheduleSlot}
          onClose={() => setQuickLog(null)}
          onSaved={() => { setQuickLog(null); loadPreparations(); }}
          onPrepMarked={loadPreparations}
        />
      )}

      {publishOpen && (
        <ModalBase
          title="Publish schedule"
          subtitle={`Week of ${formatDateRange(weekStart)} — choose who receives the email`}
          onClose={() => setPublishOpen(false)}
          size="md"
          footer={(
            <>
              <ModalBtnSecondary type="button" onClick={() => setPublishOpen(false)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary type="button" onClick={publishWeek} disabled={publishSending}>
                {publishSending ? "Publishing…" : "Publish & send emails"}
              </ModalBtnPrimary>
            </>
          )}
        >
          <FormSection title="Email recipients">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer mb-3 pb-2 border-b border-[#E2DDD4]">
              <input
                type="checkbox"
                checked={publishSendAll}
                onChange={(e) => {
                  const all = e.target.checked;
                  setPublishSendAll(all);
                  if (all) setPublishIds(therapistsWithEmail.map((t) => t.id));
                }}
              />
              Send to all therapists with email ({therapistsWithEmail.length})
            </label>
            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
              {therapistsWithEmail.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-1.5 pill cursor-pointer text-[11px] px-2.5 py-1.5 border ${
                    publishIds.includes(t.id) ? "border-[#7A8A6A] bg-[#EDF4E8]" : "border-[#E2DDD4]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={publishIds.includes(t.id)}
                    disabled={publishSendAll}
                    onChange={() => togglePublishTherapist(t.id)}
                  />
                  {getTherapistScheduleName(t)}
                </label>
              ))}
            </div>
            {therapistsWithEmail.length === 0 && (
              <p className="text-xs m-0" style={{ color: "#8B9E7A" }}>No therapist emails on file.</p>
            )}
          </FormSection>
        </ModalBase>
      )}

      <ParentWhatsAppModal
        open={parentMessagesOpen}
        onClose={() => setParentMessagesOpen(false)}
        messages={parentMessages}
        weekLabel={formatDateRange(weekStart)}
        publishedNote={parentMessagesNote}
      />

      <ParentCancellationModal
        open={parentCancelOpen}
        onClose={() => {
          setParentCancelOpen(false);
          setParentCancelFocus(null);
        }}
        items={pendingCancellations}
        clients={clients}
        focusCellId={parentCancelFocus}
        onMarkedSent={() => loadPendingCancellations()}
      />
    </div>
    </div>
  );
}
