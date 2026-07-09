import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api";
import { useAuth, canEditIntake } from "../../auth";
import { Plus, Trash, PencilSimple, Star, Phone, MapPin, ArrowsClockwise, Buildings, ClipboardText, CaretDown, CalendarBlank } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../../components/Modal";
import PageBanner from "../../components/PageBanner";
import "../../clientInfoLayout.css";
import "../../dashboardLayout.css";

import { WAITING_LIST_SHEET_URL, SCHOOL_WAITING_SHEET_URL } from "../../constants/waiting";

const STATUS = { new: "New", contacted: "Contacted", scheduled: "Scheduled", completed: "Completed" };
const STATUS_COLORS = {
  new: "#A4BCCB", contacted: "#D4A64A", scheduled: "#7A8A6A", completed: "#3D4F35",
};

function emptyItem(type, category = "intake") {
  return {
    child_name: "", parent_name: "", phone: "", intake_type: type,
    list_category: category,
    status: "new",
    notes: "", intake_date: "", birth_date: "", age: "", service: type === "school" ? "SS" : "HS", district: "",
    time_pref: "", diagnosis: "", language: "", priority: false, school_start_date: "",
  };
}

function itemCategory(i) {
  return i.list_category || (i.intake_type === "school" ? "school" : "intake");
}

function englishNamePart(name) {
  return (name || "").replace(/\([^)]*\)/g, "").trim();
}

function isDualEnglishName(name) {
  const parts = englishNamePart(name).split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}

function formatDOB(item) {
  const raw = (item.birth_date || "").trim();
  if (raw) {
    const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    return raw.slice(0, 10);
  }
  const age = String(item.age || "").trim();
  if (/^\d{4}$/.test(age)) return age;
  return "";
}

function ageFromDOB(item) {
  const raw = (item.birth_date || "").trim().slice(0, 10);
  if (!raw) return "";
  const born = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(born.getTime())) return "";
  const today = new Date();
  let years = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) years -= 1;
  return years >= 0 ? String(years) : "";
}

function serviceMatches(item, filter) {
  if (!filter) return true;
  const svc = (item.service || "").toUpperCase();
  if (filter === "HS") return svc.includes("HS");
  if (filter === "SS") return svc.includes("SS");
  return true;
}

function FilterTh({ active, onClick, children, title }) {
  return (
    <th>
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`intake-th-filter${active ? " is-active" : ""}`}
      >
        {children}
      </button>
    </th>
  );
}

export default function WaitingPage({ mode }) {
  const isSchool = mode === "school";
  const { user } = useAuth();
  const canManage = canEditIntake(user);
  const [loadError, setLoadError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState(() => searchParams.get("tab") === "post" ? "post" : "pre");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [filterService, setFilterService] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [listMeta, setListMeta] = useState({ last_updated: null, updated_by: null });
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const load = async () => {
    try {
      const [intakeRes, metaRes] = await Promise.all([
        api.get("/intake"),
        api.get("/intake/meta").catch(() => ({ data: {} })),
      ]);
      setItems(intakeRes.data);
      setListMeta(metaRes.data || {});
      setLoadError(null);
    } catch (e) {
      setItems([]);
      setLoadError(e.response?.data?.detail || e.message || "Could not load waiting list");
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (isSchool) return;
    const next = tab === "post" ? "post" : "pre";
    if (searchParams.get("tab") !== next) {
      setSearchParams({ tab: next }, { replace: true });
    }
  }, [tab, isSchool, searchParams, setSearchParams]);

  const save = async () => {
    if (edit.id) await api.put(`/intake/${edit.id}`, edit);
    else await api.post("/intake", edit);
    setEdit(null);
    load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    await api.delete(`/intake/${id}`);
    load();
  };

  const syncFromGoogle = async () => {
    const confirmMsg = isSchool
      ? "Sync school waiting list from the SS Waiting sheet?\n\nOnly school placement rows are updated. Pre/Post intake lists are not changed."
      : "Sync waiting list from the official Google Sheet?\n\nOnly names currently in the sheet will remain. Stale rows are removed.";
    if (!window.confirm(confirmMsg)) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const endpoint = isSchool ? "/import/school-waiting-google" : "/import/intake-google";
      const sheetUrl = isSchool ? SCHOOL_WAITING_SHEET_URL : WAITING_LIST_SHEET_URL;
      const { data } = await api.post(endpoint, { sheet_url: sheetUrl });
      const schoolNote = data.school_count != null ? ` · ${data.school_count} school` : "";
      setSyncResult({ ok: true, msg: `${data.message || "Sync complete"}${schoolNote}` });
      load();
    } catch (e) {
      setSyncResult({ ok: false, msg: e.response?.data?.detail || e.message });
    }
    setSyncing(false);
  };

  const saveLastUpdated = async () => {
    setSavingDate(true);
    try {
      const { data } = await api.put("/intake/meta", { last_updated: dateDraft || null });
      setListMeta(data);
      setEditingDate(false);
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSavingDate(false);
    }
  };

  const moveToPost = async (item) => {
    if (!window.confirm(`Move "${item.child_name}" to Post-Intake?\n\nThe original Pre-Intake record will be kept for reference.`)) return;
    const copy = { ...item, intake_type: "post", list_category: "intake", status: "new" };
    delete copy.id;
    delete copy.created_at;
    await api.post("/intake", copy);
    load();
    setTab("post");
  };

  const intakeItems = useMemo(
    () => items.filter(i => itemCategory(i) !== "school" && i.intake_type !== "school"),
    [items]
  );
  const schoolItems = useMemo(
    () => items.filter(i => itemCategory(i) === "school" || i.intake_type === "school"),
    [items]
  );

  const filtered = useMemo(() => {
    if (isSchool) return schoolItems;
    return intakeItems.filter(i => i.intake_type === tab);
  }, [isSchool, schoolItems, intakeItems, tab]);

  const displayed = useMemo(() => {
    let list = filtered.filter(i => serviceMatches(i, filterService));
    if (priorityOnly) list = list.filter(i => i.priority);
    list = [...list];
    if (priorityOnly) {
      list.sort((a, b) => (a.child_name || "").localeCompare(b.child_name || ""));
    }
    return list;
  }, [filtered, priorityOnly, filterService]);

  const nameIssues = useMemo(() => {
    const byKey = {};
    for (const i of items) {
      const key = englishNamePart(i.child_name).toLowerCase();
      if (!key) continue;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(i);
    }
    const duplicates = Object.values(byKey).filter((group) => group.length > 1);
    const singleName = items.filter((i) => i.child_name && !isDualEnglishName(i.child_name));
    return { duplicates, singleName };
  }, [items]);

  const cycleServiceFilter = () => {
    setFilterService((prev) => (prev === "" ? "HS" : prev === "HS" ? "SS" : ""));
  };

  const totalPre = intakeItems.filter(i => i.intake_type === "pre").length;
  const totalPost = intakeItems.filter(i => i.intake_type === "post").length;
  const totalSchool = schoolItems.length;
  const hsCount = filtered.filter(i => (i.service || "").toUpperCase().includes("HS")).length;
  const ssCount = filtered.filter(i => (i.service || "").toUpperCase().includes("SS")).length;
  const priCount = filtered.filter(i => i.priority).length;

  const priorityList = useMemo(
    () => filtered.filter(i => i.priority).slice(0, 6),
    [filtered]
  );

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const k of Object.keys(STATUS)) counts[k] = 0;
    for (const i of filtered) counts[i.status] = (counts[i.status] || 0) + 1;
    return counts;
  }, [filtered]);

  const title = isSchool ? "School Waiting" : "Intake Waiting";
  const subtitle = isSchool
    ? "School support placement queue — synced from the SS waiting sheet"
    : "Pre- and post-intake queues for home-based services";

  const adminBadge = canManage ? (
    <>
      <button
        type="button"
        onClick={() => setActionsOpen(o => !o)}
        className="editorial-pill text-[11px] px-2.5 py-1 min-h-0"
      >
        Actions <CaretDown size={12} className="inline ml-0.5" />
      </button>
      {actionsOpen && (
        <>
          <div className="waiting-actions-backdrop" onClick={() => setActionsOpen(false)} aria-hidden />
          <div className="waiting-actions-menu">
            <button type="button" onClick={() => { syncFromGoogle(); setActionsOpen(false); }} disabled={syncing}
              className="w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] flex items-center gap-1.5">
              {syncing ? <span className="spinner" /> : <ArrowsClockwise size={13} />} Sync Sheet
            </button>
            <a href={isSchool ? SCHOOL_WAITING_SHEET_URL : WAITING_LIST_SHEET_URL} target="_blank" rel="noreferrer"
              className="block w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] border-t no-underline"
              style={{ color: "#374151", borderColor: "#EDE9E3" }}>
              Open Google Sheet
            </a>
            {isSchool ? (
              <button data-testid="add-school-waiting" type="button"
                onClick={() => { setEdit(emptyItem("school", "school")); setActionsOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] border-t flex items-center gap-1.5"
                style={{ borderColor: "#EDE9E3" }}>
                <Plus size={13} /> Add Case
              </button>
            ) : (
              <>
                <button data-testid="add-pre-intake" type="button"
                  onClick={() => { setEdit(emptyItem("pre", "intake")); setActionsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] border-t flex items-center gap-1.5"
                  style={{ borderColor: "#EDE9E3" }}>
                  <Plus size={13} /> Pre-Intake
                </button>
                <button data-testid="add-post-intake" type="button"
                  onClick={() => { setEdit(emptyItem("post", "intake")); setActionsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-[#FAFAF7] border-t flex items-center gap-1.5"
                  style={{ borderColor: "#EDE9E3" }}>
                  <Plus size={13} /> Post-Intake
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  ) : null;

  const tabToolbar = isSchool ? (
    <div className="editorial-pill-row">
      <span className="editorial-pill is-active" style={{ cursor: "default" }}>
        <Buildings size={14} weight="duotone" /> {totalSchool} in queue
      </span>
      <button
        type="button"
        title={priorityOnly ? "Show all" : "Priority first"}
        onClick={() => setPriorityOnly(v => !v)}
        className={`editorial-pill${priorityOnly ? " is-active" : ""}`}
      >
        <Star size={14} weight={priorityOnly ? "fill" : "regular"} /> Priority
      </button>
    </div>
  ) : null;

  const bannerTabs = !isSchool ? [
    { id: "pre", label: "Pre-Intake", count: totalPre, testId: "tab-pre" },
    { id: "post", label: "Post-Intake", count: totalPost, testId: "tab-post" },
    {
      id: "priority",
      label: "Priority",
      icon: <Star size={13} weight={priorityOnly ? "fill" : "regular"} />,
      testId: "tab-priority",
    },
  ] : undefined;

  const handleBannerTab = (id) => {
    if (id === "priority") {
      setPriorityOnly(v => !v);
      return;
    }
    setPriorityOnly(false);
    setTab(id);
  };

  const bannerActiveTab = priorityOnly ? "priority" : tab;

  const queueLabel = isSchool
    ? "School placement waiting list"
    : tab === "pre"
      ? "Before formal intake"
      : "After intake, awaiting placement";

  return (
    <div className="page-enter">
      {canManage && (
        <div className="waiting-actions-bar flex justify-end mb-2 relative">
          {adminBadge}
        </div>
      )}
      <PageBanner
        title={title}
        subtitle={subtitle}
        className="editorial-banner--compact-mobile"
        tabs={bannerTabs}
        activeTab={bannerActiveTab}
        onTabChange={handleBannerTab}
        stats={[
          { label: "Total", n: filtered.length, color: "#2A3328" },
          { label: "HS", n: hsCount, color: "#4A5D42" },
          { label: "SS", n: ssCount, color: "#5C6B52" },
          { label: "Priority", n: priCount, color: "#8B6B4E" },
        ]}
        toolbar={tabToolbar}
      />

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs px-1">
          <CalendarBlank size={14} style={{ color: "#8B9E7A" }} />
          <span style={{ color: "#5C6853" }}>Last updated:</span>
          {editingDate ? (
            <>
              <input
                type="date"
                className="input text-xs py-1 h-8"
                value={dateDraft}
                onChange={e => setDateDraft(e.target.value)}
              />
              <button type="button" className="btn btn-primary text-[10px] px-2 py-1 min-h-0" onClick={saveLastUpdated} disabled={savingDate}>
                {savingDate ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-secondary text-[10px] px-2 py-1 min-h-0" onClick={() => setEditingDate(false)}>Cancel</button>
            </>
          ) : (
            <>
              <strong style={{ color: "#2C3625" }}>{listMeta.last_updated || "—"}</strong>
              {listMeta.updated_by && <span style={{ color: "#8B9E7A" }}>by {listMeta.updated_by}</span>}
              <button
                type="button"
                className="text-[10px] underline"
                onClick={() => { setDateDraft(listMeta.last_updated || new Date().toISOString().slice(0, 10)); setEditingDate(true); }}
              >
                Edit date
              </button>
            </>
          )}
        </div>
      )}

      {loadError && (
        <div className="mb-4 p-3 rounded-xl border text-sm font-semibold bg-[#F8EBE7] border-[#ECA6A6] text-[#8A3F27]">
          {loadError}
        </div>
      )}

      {syncResult && (
        <div className={`mb-4 p-3 rounded-xl border text-sm font-semibold ${syncResult.ok ? "bg-[#E5EBE1] border-[#B4C2A9] text-[#3D4F35]" : "bg-[#F8EBE7] border-[#ECA6A6] text-[#8A3F27]"}`}>
          {syncResult.msg}
        </div>
      )}

      <div className="req-split">
        <section className="req-panel-left">
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0 flex items-center gap-1.5" style={{ color: "#2C3625" }}>
              {isSchool ? <Buildings size={16} weight="duotone" /> : <ClipboardText size={16} weight="duotone" />}
              {isSchool ? "School Waiting Queue" : tab === "pre" ? "Pre-Intake Queue" : "Post-Intake Queue"}
            </h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>
              {displayed.length} case{displayed.length !== 1 ? "s" : ""} · {queueLabel}
            </p>
          </div>

          {displayed.length === 0 ? (
            <div className="p-12 text-center text-sm m-3 rounded-xl border border-dashed border-[#E2DDD4]" style={{ color: "#8B9E7A" }}>
              No records in this queue
            </div>
          ) : (
            <div className="px-3 pb-4 overflow-x-auto">
              <div className="intake-table-wrap">
                <table className="intake-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }} aria-label="Priority">
                        <button
                          type="button"
                          onClick={() => setPriorityOnly(v => !v)}
                          title={priorityOnly ? "Show all" : "Show priority only"}
                          className={`intake-th-filter p-1${priorityOnly ? " is-active" : ""}`}
                        >
                          <Star size={14} weight={priorityOnly ? "fill" : "regular"} style={{ color: priorityOnly ? "#D4A64A" : "#8B9E7A" }} />
                        </button>
                      </th>
                      <th>Child</th>
                      <FilterTh
                        active={!!filterService}
                        onClick={cycleServiceFilter}
                        title={filterService ? `Filtered: ${filterService} (click to change)` : "Filter by service: HS / SS"}
                      >
                        Service{filterService ? ` · ${filterService}` : ""}
                      </FilterTh>
                      <th>Status</th>
                      <th>Phone</th>
                      <th>{isSchool ? "District" : "District"}</th>
                      {isSchool ? (
                        <>
                          <th>Language</th>
                          <th>Start Date</th>
                        </>
                      ) : tab === "pre" ? (
                        <th>Timing</th>
                      ) : (
                        <th>Language</th>
                      )}
                      <th>Notes</th>
                      {canManage && <th style={{ width: 140 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(i => (
                      <tr key={i.id} className={i.priority ? "priority-row" : ""}>
                        <td>
                          {canManage ? (
                            <button type="button" onClick={() => api.put(`/intake/${i.id}`, { ...i, priority: !i.priority }).then(load)} className="btn btn-ghost p-1">
                              <Star size={16} weight={i.priority ? "fill" : "regular"} style={{ color: i.priority ? "#D4A64A" : "#C5C0B7" }} />
                            </button>
                          ) : i.priority ? <Star size={16} weight="fill" style={{ color: "#D4A64A" }} /> : null}
                        </td>
                        <td>
                          <div className="font-bold">{i.child_name}</div>
                          {formatDOB(i) && (
                            <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
                              DOB {formatDOB(i)}
                              {ageFromDOB(i) ? ` · ${ageFromDOB(i)} yrs` : ""}
                            </div>
                          )}
                          {!isDualEnglishName(i.child_name) && (
                            <div className="text-[10px] font-semibold" style={{ color: "#B45309" }}>Single name</div>
                          )}
                        </td>
                        <td><span className="pill text-[10px]">{i.service || "—"}</span></td>
                        <td><span className="pill text-[10px]" style={{ background: `${STATUS_COLORS[i.status]}25`, color: STATUS_COLORS[i.status] }}>{STATUS[i.status] || i.status}</span></td>
                        <td>{i.phone ? <a href={`tel:${i.phone}`} className="hover:text-[#7A8A6A]">{i.phone}</a> : "—"}</td>
                        <td>{i.district || "—"}</td>
                        {isSchool ? (
                          <>
                            <td>{i.language || "—"}</td>
                            <td>{i.school_start_date || i.intake_date || "—"}</td>
                          </>
                        ) : (
                          <td>{tab === "pre" ? (i.time_pref || "—") : (i.language || "—")}</td>
                        )}
                        <td className="text-[11px] max-w-[180px]" style={{ color: "#5C6853" }}>
                          {i.notes ? <span title={i.notes}>{i.notes.length > 80 ? `${i.notes.slice(0, 80)}…` : i.notes}</span> : "—"}
                        </td>
                        {canManage && (
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              {!isSchool && tab === "pre" && (
                                <button type="button" onClick={() => moveToPost(i)} className="btn btn-secondary text-[10px] px-2 py-1 min-h-0">→ Post</button>
                              )}
                              <button type="button" onClick={() => setEdit({ ...i })} className="btn btn-outline text-[10px] px-2 py-1 min-h-0"><PencilSimple size={12} /></button>
                              <button type="button" onClick={() => remove(i.id)} className="btn btn-ghost text-[10px] px-1 py-1 text-red-700"><Trash size={12} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <aside className="req-panel-sidebar">
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Pipeline Overview</h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>Status breakdown for this queue</p>
          </div>
          <div className="req-panel-list">
            {Object.entries(STATUS).map(([k, label]) => (
              <div key={k} className="req-item flex items-center justify-between gap-2">
                <span className="pill text-[10px]" style={{ background: `${STATUS_COLORS[k]}25`, color: STATUS_COLORS[k] }}>{label}</span>
                <span className="font-display font-bold text-lg" style={{ color: "#2C3625" }}>{statusCounts[k] || 0}</span>
              </div>
            ))}
          </div>

          <div className="req-panel-head border-t border-[#E2DDD4]">
            <h2 className="font-bold text-sm m-0 flex items-center gap-1" style={{ color: "#2C3625" }}>
              <Star size={14} weight="fill" style={{ color: "#D4A64A" }} /> Priority Cases
            </h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>Flagged for urgent follow-up</p>
          </div>
          <div className="req-panel-list">
            {priorityList.length === 0 ? (
              <div className="p-6 text-center text-xs" style={{ color: "#8B9E7A" }}>No priority cases</div>
            ) : priorityList.map(i => (
              <div key={i.id} className="req-item">
                <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{i.child_name}</div>
                <div className="text-[10px] mt-0.5 flex flex-wrap gap-2" style={{ color: "#8B9E7A" }}>
                  <span>{i.service || "—"}</span>
                  {i.district && <span className="flex items-center gap-0.5"><MapPin size={10} /> {i.district}</span>}
                  {i.phone && <span className="flex items-center gap-0.5"><Phone size={10} /> {i.phone}</span>}
                </div>
              </div>
            ))}
          </div>

          {(nameIssues.duplicates.length > 0 || nameIssues.singleName.length > 0) && (
            <>
              <div className="req-panel-head border-t border-[#E2DDD4]">
                <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>Name check</h2>
                <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>
                  Duplicates: {nameIssues.duplicates.length} · Single names: {nameIssues.singleName.length}
                </p>
              </div>
              <div className="req-panel-list text-xs" style={{ color: "#5C6853" }}>
                {nameIssues.duplicates.slice(0, 5).map((group) => (
                  <div key={group[0].id} className="req-item">
                    <div className="font-semibold" style={{ color: "#B45309" }}>Duplicate: {group[0].child_name}</div>
                    <div style={{ color: "#8B9E7A" }}>{group.length} records</div>
                  </div>
                ))}
                {nameIssues.singleName.slice(0, 5).map((i) => (
                  <div key={`single-${i.id}`} className="req-item">
                    <div className="font-semibold" style={{ color: "#B45309" }}>Not dual: {i.child_name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {edit && (
        <ModalBase
          title={edit.id ? "Edit Case" : isSchool ? "New School Case" : "New Intake Case"}
          subtitle={isSchool ? "School support waiting list entry" : "Pre-intake or post-intake waiting list entry"}
          onClose={() => setEdit(null)}
          size="lg"
          footer={
            <>
              <ModalBtnSecondary type="button" onClick={() => setEdit(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="intake-save-btn" type="button" onClick={save}>Save</ModalBtnPrimary>
            </>
          }
        >
          <p className="text-xs -mt-2 mb-2 font-semibold" style={{ color: "#8B9E7A" }}>
            {edit.intake_type === "school" ? "School Waiting" : edit.intake_type === "pre" ? "Pre-Intake" : "Post-Intake"}
          </p>

          <FormSection title="Child Information">
            <FormField label="Child name" required>
              <input data-testid="intake-name-input" className="modal-input" value={edit.child_name} onChange={e => setEdit({ ...edit, child_name: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Birth date">
                <input
                  type="date"
                  className="modal-input"
                  value={edit.birth_date || ""}
                  onChange={e => setEdit({ ...edit, birth_date: e.target.value })}
                />
              </FormField>
              <FormField label={isSchool ? "School start date" : "Intake date"}>
                <input
                  type={isSchool ? "text" : "date"}
                  className="modal-input"
                  placeholder={isSchool ? "e.g. 23/08/2026" : undefined}
                  value={(isSchool ? edit.school_start_date : edit.intake_date) || ""}
                  onChange={e => setEdit(isSchool
                    ? { ...edit, school_start_date: e.target.value }
                    : { ...edit, intake_date: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Diagnosis" hint="ASD / ADHD / Speech delay / NA">
              <input className="modal-input" placeholder="ASD / ADHD / Speech delay / NA" value={edit.diagnosis || ""} onChange={e => setEdit({ ...edit, diagnosis: e.target.value })} />
            </FormField>
            {(edit.intake_type === "post" || isSchool) && (
              <FormField label="Language" hint="English / Arabic">
                <input className="modal-input" placeholder="English / Arabic" value={edit.language || ""} onChange={e => setEdit({ ...edit, language: e.target.value })} />
              </FormField>
            )}
          </FormSection>

          <FormSection title="Contact & Location">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Phone">
                <input className="modal-input" value={edit.phone || ""} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
              </FormField>
              <FormField label="Parent name">
                <input className="modal-input" value={edit.parent_name || ""} onChange={e => setEdit({ ...edit, parent_name: e.target.value })} />
              </FormField>
              <FormField label="District / school">
                <input className="modal-input" value={edit.district || ""} onChange={e => setEdit({ ...edit, district: e.target.value })} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Service Request">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Service type">
                <select className="modal-input" value={edit.service || (isSchool ? "SS" : "HS")} onChange={e => setEdit({ ...edit, service: e.target.value })}>
                  <option value="HS">HS</option>
                  <option value="SS">SS</option>
                  <option value="HS / SS">HS / SS</option>
                  <option value="SS / HS">SS / HS</option>
                  <option value="ABA">ABA</option>
                </select>
              </FormField>
              {edit.intake_type === "pre" && !isSchool ? (
                <FormField label="Preferred timing">
                  <select className="modal-input" value={edit.time_pref || ""} onChange={e => setEdit({ ...edit, time_pref: e.target.value })}>
                    <option value="">—</option>
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Any">Any</option>
                  </select>
                </FormField>
              ) : (
                <FormField label="Status">
                  <select className="modal-input" value={edit.status || "new"} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </FormField>
              )}
            </div>
            {edit.intake_type === "pre" && !isSchool && (
              <FormField label="Status">
                <select className="modal-input" value={edit.status || "new"} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
            )}
          </FormSection>

          <FormSection title="Notes">
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={edit.priority || false} onChange={e => setEdit({ ...edit, priority: e.target.checked })} />
              <span className="flex items-center gap-1 font-bold text-sm" style={{ color: "#D4A64A" }}>
                <Star size={16} weight="fill" /> Priority client
              </span>
            </label>
            <FormField label="Case notes" hint="e.g. schedule not finished, not suitable, waiting for meeting">
              <textarea
                className="modal-input"
                rows={3}
                placeholder="Write a short note about this child’s status or next step…"
                value={edit.notes || ""}
                onChange={e => setEdit({ ...edit, notes: e.target.value })}
              />
            </FormField>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
