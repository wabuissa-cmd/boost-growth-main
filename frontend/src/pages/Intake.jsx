import { useEffect, useState, useMemo } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, Trash, PencilSimple, Star, Phone, MapPin, Info, ArrowsClockwise } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import PageBanner from "../components/PageBanner";
import "../clientInfoLayout.css";
import "../dashboardLayout.css";

const WAITING_LIST_SHEET_URL = "https://docs.google.com/spreadsheets/d/14DLxQZOWSRnS_4kWeOsgKfpYMQiZ6hQiv2be_-J_hBg/edit";

const STATUS = { new: "New", contacted: "Contacted", scheduled: "Scheduled", completed: "Completed" };
const STATUS_COLORS = {
  new: "#A4BCCB", contacted: "#D4A64A", scheduled: "#7A8A6A", completed: "#3D4F35"
};

function emptyItem(type) {
  return {
    child_name: "", parent_name: "", phone: "", intake_type: type, status: "new",
    notes: "", intake_date: "", age: "", service: "HS", district: "",
    time_pref: "", diagnosis: "", language: "", priority: false,
  };
}

export default function Intake() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState("pre");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/intake");
      setItems(data);
    } catch (_e) { setItems([]); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) await api.put(`/intake/${edit.id}`, edit);
    else await api.post("/intake", edit);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete this record?")) return; await api.delete(`/intake/${id}`); load(); };

  const syncFromGoogle = async () => {
    if (!window.confirm("Sync waiting list from the official Google Sheet?\n\nExisting cases will be updated by child name + pre/post type.")) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post("/import/intake-google", { sheet_url: WAITING_LIST_SHEET_URL });
      setSyncResult({ ok: true, msg: data.message || "Sync complete" });
      load();
    } catch (e) {
      setSyncResult({ ok: false, msg: e.response?.data?.detail || e.message });
    }
    setSyncing(false);
  };

  const moveToPost = async (item) => {
    if (!window.confirm(`Move "${item.child_name}" to Post-Intake?\n\nThe original Pre-Intake record will be kept for reference.`)) return;
    const copy = { ...item, intake_type: "post", status: "new" };
    delete copy.id;
    delete copy.created_at;
    await api.post("/intake", copy);
    load();
    setTab("post");
  };

  const filtered = items.filter(i => i.intake_type === tab);
  const displayed = useMemo(() => {
    const list = [...filtered];
    if (priorityOnly) {
      list.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        return (a.child_name || "").localeCompare(b.child_name || "");
      });
    }
    return list;
  }, [filtered, priorityOnly]);

  const totalPre = items.filter(i => i.intake_type === "pre").length;
  const totalPost = items.filter(i => i.intake_type === "post").length;
  const hsCount = filtered.filter(i => (i.service || "").toUpperCase().includes("HS")).length;
  const ssCount = filtered.filter(i => (i.service || "").toUpperCase().includes("SS")).length;
  const priCount = filtered.filter(i => i.priority).length;
  const priorityList = useMemo(
    () => items.filter(i => i.priority && i.intake_type === tab).slice(0, 6),
    [items, tab]
  );
  const statusCounts = useMemo(() => {
    const counts = {};
    for (const k of Object.keys(STATUS)) counts[k] = 0;
    for (const i of filtered) counts[i.status] = (counts[i.status] || 0) + 1;
    return counts;
  }, [filtered]);

  return (
    <div className="page-enter">
      <PageBanner
        title="Waiting List"
        subtitle="Pre-Intake & Post-Intake registrations"
        badge={isAdmin ? (
          <div className="flex gap-2 flex-wrap justify-end">
            <button type="button" onClick={syncFromGoogle} disabled={syncing} className="btn btn-outline text-[11px] px-2.5 py-1 min-h-0 border-white/40 text-white hover:bg-white/10">
              {syncing ? <span className="spinner" /> : <><ArrowsClockwise size={13} /> Sync Sheet</>}
            </button>
            <a href={WAITING_LIST_SHEET_URL} target="_blank" rel="noreferrer" className="btn btn-outline text-[11px] px-2.5 py-1 min-h-0 border-white/40 text-white hover:bg-white/10 no-underline">
              Open Sheet
            </a>
            <button data-testid="add-pre-intake" onClick={() => setEdit(emptyItem("pre"))} className="btn btn-secondary text-[11px] px-2.5 py-1 min-h-0">
              <Plus size={13} /> Pre-Intake
            </button>
            <button data-testid="add-post-intake" onClick={() => setEdit(emptyItem("post"))} className="btn btn-outline text-[11px] px-2.5 py-1 min-h-0 border-white/40 text-white hover:bg-white/10">
              <Plus size={13} /> Post-Intake
            </button>
          </div>
        ) : null}
        stats={[
          { label: "Total", n: filtered.length, color: "#2C3625" },
          { label: "HS", n: hsCount, color: "#375568" },
          { label: "SS", n: ssCount, color: "#606E52" },
          { label: "Priority", n: priCount, color: "#6B5218" },
        ]}
      />

      {syncResult && (
        <div className={`mb-4 p-3 rounded-xl border text-sm font-semibold ${syncResult.ok ? "bg-[#E5EBE1] border-[#B4C2A9] text-[#3D4F35]" : "bg-[#F8EBE7] border-[#ECA6A6] text-[#8A3F27]"}`}>
          {syncResult.msg}
        </div>
      )}

      <div className="req-split">
        <section className="req-panel-left">
          <div className="req-panel-head">
            <h2 className="font-bold text-sm m-0" style={{ color: "#2C3625" }}>
              {tab === "pre" ? "Pre-Intake Queue" : "Post-Intake Queue"}
            </h2>
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>
              {displayed.length} case{displayed.length !== 1 ? "s" : ""} · {tab === "pre" ? "Before formal intake" : "After intake, awaiting placement"}
            </p>
            <div className="intake-tabs mt-3 mb-0">
              <button data-testid="tab-pre" type="button" onClick={() => setTab("pre")} className={`intake-tab${tab === "pre" ? " active" : ""}`}>
                Pre-Intake ({totalPre})
              </button>
              <button data-testid="tab-post" type="button" onClick={() => setTab("post")} className={`intake-tab${tab === "post" ? " active" : ""}`}>
                Post-Intake ({totalPost})
              </button>
              <button
                type="button"
                title={priorityOnly ? "Show all" : "Priority first"}
                onClick={() => setPriorityOnly(v => !v)}
                className={`intake-tab${priorityOnly ? " active" : ""}`}
                style={priorityOnly ? {} : { background: "transparent" }}
              >
                <Star size={14} weight={priorityOnly ? "fill" : "regular"} className="inline mr-1" /> Priority
              </button>
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="p-12 text-center text-sm m-3 rounded-xl border border-dashed border-[#E2DDD4]" style={{ color: "#8B9E7A" }}>
              No records in this queue
            </div>
          ) : (
            <div className="px-3 pb-3 overflow-x-auto">
              <div className="intake-table-wrap">
                <table className="intake-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Child</th>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Phone</th>
                      <th>District</th>
                      {tab === "pre" ? <th>Timing</th> : <th>Language</th>}
                      {isAdmin && <th style={{ width: 140 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(i => (
                      <tr key={i.id} className={i.priority ? "priority-row" : ""}>
                        <td>
                          {isAdmin ? (
                            <button type="button" onClick={() => api.put(`/intake/${i.id}`, { ...i, priority: !i.priority }).then(load)} className="btn btn-ghost p-1">
                              <Star size={16} weight={i.priority ? "fill" : "regular"} style={{ color: i.priority ? "#D4A64A" : "#C5C0B7" }} />
                            </button>
                          ) : i.priority ? <Star size={16} weight="fill" style={{ color: "#D4A64A" }} /> : null}
                        </td>
                        <td>
                          <div className="font-bold">{i.child_name}</div>
                          {i.age && <div className="text-[10px]" style={{ color: "#8B9E7A" }}>Age {i.age}</div>}
                        </td>
                        <td><span className="pill text-[10px]">{i.service || "—"}</span></td>
                        <td><span className="pill text-[10px]" style={{ background: `${STATUS_COLORS[i.status]}25`, color: STATUS_COLORS[i.status] }}>{STATUS[i.status] || i.status}</span></td>
                        <td>{i.phone ? <a href={`tel:${i.phone}`} className="hover:text-[#7A8A6A]">{i.phone}</a> : "—"}</td>
                        <td>{i.district || "—"}</td>
                        <td>{tab === "pre" ? (i.time_pref || "—") : (i.language || "—")}</td>
                        {isAdmin && (
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              {tab === "pre" && (
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
            <p className="text-xs mt-1 mb-0" style={{ color: "#8B9E7A" }}>Status breakdown for current tab</p>
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

          <div className="req-panel-head border-t border-[#E2DDD4]">
            <h2 className="font-bold text-sm m-0 flex items-center gap-1" style={{ color: "#2C3625" }}>
              <Info size={14} weight="duotone" style={{ color: "#7A8A6A" }} /> Workflow
            </h2>
          </div>
          <div className="p-3 text-xs space-y-2" style={{ color: "#5C6853", lineHeight: 1.5 }}>
            <p className="m-0"><strong style={{ color: "#606E52" }}>Pre-Intake</strong> — Initial inquiry before the formal intake meeting.</p>
            <p className="m-0"><strong style={{ color: "#606E52" }}>Post-Intake</strong> — After intake; awaiting therapist assignment or start date.</p>
            <p className="m-0"><strong style={{ color: "#606E52" }}>→ Post</strong> — Moves a pre-intake case to the post-intake queue.</p>
          </div>
        </aside>
      </div>

      {edit && (
        <ModalBase
          title={edit.id ? "Edit Case" : "New Intake Case"}
          subtitle="Pre-intake or post-intake waiting list entry"
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
            {edit.intake_type === "pre" ? "Pre-Intake" : "Post-Intake"}
          </p>

          <FormSection title="Child Information">
            <FormField label="Child name" required>
              <input data-testid="intake-name-input" className="modal-input" value={edit.child_name} onChange={e => setEdit({ ...edit, child_name: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Age / year of birth">
                <input className="modal-input" value={edit.age || ""} onChange={e => setEdit({ ...edit, age: e.target.value })} />
              </FormField>
              <FormField label="Intake date">
                <input type="date" className="modal-input" value={edit.intake_date || ""} onChange={e => setEdit({ ...edit, intake_date: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Diagnosis" hint="ASD / ADHD / Speech delay / NA">
              <input className="modal-input" placeholder="ASD / ADHD / Speech delay / NA" value={edit.diagnosis || ""} onChange={e => setEdit({ ...edit, diagnosis: e.target.value })} />
            </FormField>
            {edit.intake_type === "post" && (
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
              <FormField label="District / address">
                <input className="modal-input" value={edit.district || ""} onChange={e => setEdit({ ...edit, district: e.target.value })} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Service Request">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Service type">
                <select className="modal-input" value={edit.service || "HS"} onChange={e => setEdit({ ...edit, service: e.target.value })}>
                  <option value="HS">HS</option>
                  <option value="SS">SS</option>
                  <option value="HS / SS">HS / SS</option>
                  <option value="SS / HS">SS / HS</option>
                  <option value="ABA">ABA</option>
                </select>
              </FormField>
              {edit.intake_type === "pre" ? (
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
            {edit.intake_type === "pre" && (
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
            <FormField label="Additional notes">
              <textarea className="modal-input" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
            </FormField>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}
