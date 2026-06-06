import { useEffect, useState, useMemo } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, Trash, PencilSimple, Star, Phone, MapPin, Users, ClipboardText } from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import DashboardStatCard from "../components/DashboardStatCard";
import "../dashboardLayout.css";

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

  return (
    <div className="page-enter">
      <header className="intake-hero">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[0.25em] font-bold mb-1" style={{ color: "#7A8A6A" }}>INTAKE</div>
            <h1 className="font-display text-2xl md:text-3xl m-0" style={{ color: "#2C3625" }}>Waiting List</h1>
            <p className="text-sm mt-1 mb-0" style={{ color: "#5C6853" }}>Pre-Intake & Post-Intake registrations</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <button data-testid="add-pre-intake" onClick={() => setEdit(emptyItem("pre"))} className="home-hero-btn primary text-xs">
                <Plus size={14} /> Pre-Intake
              </button>
              <button data-testid="add-post-intake" onClick={() => setEdit(emptyItem("post"))} className="home-hero-btn outline text-xs">
                <Plus size={14} /> Post-Intake
              </button>
            </div>
          )}
        </div>
        <div className="dash-stat-row mt-4">
          <DashboardStatCard value={filtered.length} label="Total" icon={<Users size={20} weight="fill" style={{ color: "#2C3625", background: "#FAFAF7", borderRadius: 12, padding: 6 }} />} />
          <DashboardStatCard variant="sage" value={hsCount} label="HS" icon={<ClipboardText size={20} weight="fill" style={{ color: "#375568", background: "#EAF0F3", borderRadius: 12, padding: 6 }} />} />
          <DashboardStatCard variant="sage" value={ssCount} label="SS" icon={<ClipboardText size={20} weight="fill" style={{ color: "#606E52", background: "#E5EBE1", borderRadius: 12, padding: 6 }} />} />
          <DashboardStatCard variant="gold" value={priCount} label="Priority" icon={<Star size={20} weight="fill" style={{ color: "#6B5218", background: "#FAF0D1", borderRadius: 12, padding: 6 }} />} />
        </div>
      </header>

      <div className="intake-tabs">
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
          className={`intake-tab ml-auto${priorityOnly ? " active" : ""}`}
          style={priorityOnly ? {} : { background: "transparent" }}
        >
          <Star size={14} weight={priorityOnly ? "fill" : "regular"} className="inline mr-1" /> Priority
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="card p-12 text-center rounded-[22px]" style={{ color: "#8B9E7A" }}>No records</div>
      ) : (
        <div className="stagger">
          {displayed.map(i => (
            <article key={i.id} className={`intake-card${i.priority ? " priority" : ""}`}>
              <div className="intake-card-head">
                <div className="flex items-start gap-2 min-w-0">
                  {isAdmin ? (
                    <button type="button" onClick={() => api.put(`/intake/${i.id}`, { ...i, priority: !i.priority }).then(load)} className="btn btn-ghost p-1 shrink-0">
                      <Star size={20} weight={i.priority ? "fill" : "regular"} style={{ color: i.priority ? "#D4A64A" : "#C5C0B7" }} />
                    </button>
                  ) : i.priority ? (
                    <Star size={20} weight="fill" style={{ color: "#D4A64A" }} className="shrink-0 mt-0.5" />
                  ) : null}
                  <div>
                    <div className="intake-card-name">{i.child_name}</div>
                    <span className="pill text-[10px] px-2 py-0.5 mt-1 inline-block" style={{
                      background: (i.service || "").toUpperCase().includes("SS") ? "#E5EBE1" : "#EAF0F3",
                      color: (i.service || "").toUpperCase().includes("SS") ? "#3D4F35" : "#375568"
                    }}>{i.service || "—"}</span>
                  </div>
                </div>
                <span className="pill shrink-0" style={{ background: `${STATUS_COLORS[i.status]}25`, color: STATUS_COLORS[i.status] }}>
                  {STATUS[i.status] || i.status}
                </span>
              </div>
              <div className="intake-card-meta">
                {i.phone && (
                  <a href={`tel:${i.phone}`} className="flex items-center gap-1 hover:text-[#7A8A6A]">
                    <Phone size={13} />{i.phone}
                  </a>
                )}
                {i.district && (
                  <span className="flex items-center gap-1"><MapPin size={13} />{i.district}</span>
                )}
                {i.age && <span>Age: {i.age}</span>}
                {tab === "pre" && i.time_pref && <span>Pref: {i.time_pref}</span>}
                {tab === "post" && i.language && <span>Lang: {i.language}</span>}
                {i.diagnosis && <span>{i.diagnosis}</span>}
              </div>
              {isAdmin && (
                <div className="intake-card-actions">
                  {tab === "pre" && (
                    <button data-testid={`move-post-${i.id}`} type="button" onClick={() => moveToPost(i)} className="btn btn-secondary text-[11px] px-3 py-1.5">
                      → Post-Intake
                    </button>
                  )}
                  <button type="button" onClick={() => setEdit({ ...i })} className="btn btn-outline text-[11px] px-3 py-1.5" data-testid={`edit-intake-${i.id}`}>
                    <PencilSimple size={14} /> Edit
                  </button>
                  <button type="button" onClick={() => remove(i.id)} className="btn btn-ghost text-[11px] px-2 py-1.5 text-red-700">
                    <Trash size={14} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

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
