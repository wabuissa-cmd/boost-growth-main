import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, X, Trash, PencilSimple, Star, Phone, MapPin } from "@phosphor-icons/react";

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

  const load = async () => {
    try {
      const { data } = await api.get("/intake");
      setItems(data);
    } catch (_e) { /* 403 for therapists */ setItems([]); }
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
    // Copy all data, change type to "post" and reset id so a new record is created
    const copy = { ...item, intake_type: "post", status: "new" };
    delete copy.id;
    delete copy.created_at;
    await api.post("/intake", copy);
    load();
    setTab("post");
  };

  const filtered = items.filter(i => i.intake_type === tab);
  const totalPre = items.filter(i => i.intake_type === "pre").length;
  const totalPost = items.filter(i => i.intake_type === "post").length;
  const hsCount = filtered.filter(i => (i.service || "").toUpperCase().includes("HS")).length;
  const ssCount = filtered.filter(i => (i.service || "").toUpperCase().includes("SS")).length;
  const priCount = filtered.filter(i => i.priority).length;

  return (
    <div>
      <div className="flex items-center mb-5 flex-wrap gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#2C3625" }}>Intake List</h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>Pre-Intake & Post-Intake registrations</div>
        </div>
        {isAdmin && (
          <>
            <button data-testid="add-pre-intake" onClick={() => setEdit(emptyItem("pre"))} className="btn btn-primary"><Plus size={16} /> Pre-Intake</button>
            <button data-testid="add-post-intake" onClick={() => setEdit(emptyItem("post"))} className="btn btn-secondary"><Plus size={16} /> Post-Intake</button>
          </>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button data-testid="tab-pre" onClick={() => setTab("pre")} className={`pill px-5 py-2.5 text-sm transition-all ${tab === "pre" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>📋 Pre-Intake ({totalPre})</button>
        <button data-testid="tab-post" onClick={() => setTab("post")} className={`pill px-5 py-2.5 text-sm transition-all ${tab === "post" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>✅ Post-Intake ({totalPost})</button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-[11px] tracking-widest" style={{ color: "#8B9E7A" }}>TOTAL</div>
          <div className="text-2xl font-display font-semibold" style={{ color: "#2C3625" }}>{filtered.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] tracking-widest" style={{ color: "#8B9E7A" }}>HS</div>
          <div className="text-2xl font-display font-semibold" style={{ color: "#375568" }}>{hsCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] tracking-widest" style={{ color: "#8B9E7A" }}>SS</div>
          <div className="text-2xl font-display font-semibold" style={{ color: "#3D4F35" }}>{ssCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] tracking-widest" style={{ color: "#8B9E7A" }}>⭐ PRIORITY</div>
          <div className="text-2xl font-display font-semibold" style={{ color: "#D4A64A" }}>{priCount}</div>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#F0E9D8" }}>
            <tr>
              <th className="p-3 text-center font-bold w-10" style={{ color: "#2C3625" }}>⭐</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Child</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Service</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Phone</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>District</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Age</th>
              {tab === "pre" ? <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Time</th> : <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Language</th>}
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Diagnosis</th>
              <th className="p-3 text-left font-bold" style={{ color: "#2C3625" }}>Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} className="p-12 text-center" style={{ color: "#8B9E7A" }}>No records</td></tr>}
            {filtered.map(i => (
              <tr key={i.id} className="border-t border-[#E8E4DE] hover:bg-[#E5EBE1]/30 transition">
                <td className="p-3 text-center">
                  {isAdmin ? (
                    <button onClick={() => api.put(`/intake/${i.id}`, { ...i, priority: !i.priority }).then(load)}
                      className="btn btn-ghost p-1">
                      <Star size={18} weight={i.priority ? "fill" : "regular"} style={{ color: i.priority ? "#D4A64A" : "#C5C0B7" }} />
                    </button>
                  ) : (i.priority ? <Star size={18} weight="fill" style={{ color: "#D4A64A" }} /> : null)}
                </td>
                <td className="p-3 font-bold" style={{ color: "#2C3625" }}>{i.child_name}</td>
                <td className="p-3">
                  <span className="pill text-[10px] px-2 py-0.5" style={{
                    background: (i.service || "").toUpperCase().includes("SS") ? "#E5EBE1" : "#EAF0F3",
                    color: (i.service || "").toUpperCase().includes("SS") ? "#3D4F35" : "#375568"
                  }}>{i.service || "—"}</span>
                </td>
                <td className="p-3" style={{ color: "#5C6853" }}>
                  {i.phone ? <a href={`tel:${i.phone}`} className="flex items-center gap-1 hover:text-[#7A8A6A]"><Phone size={12} />{i.phone}</a> : "—"}
                </td>
                <td className="p-3" style={{ color: "#5C6853" }}>
                  {i.district ? <span className="flex items-center gap-1"><MapPin size={12} />{i.district}</span> : "—"}
                </td>
                <td className="p-3" style={{ color: "#5C6853" }}>{i.age || "—"}</td>
                {tab === "pre"
                  ? <td className="p-3" style={{ color: "#5C6853" }}>{i.time_pref || "—"}</td>
                  : <td className="p-3" style={{ color: "#5C6853" }}>{i.language || "—"}</td>}
                <td className="p-3 text-xs" style={{ color: "#8B9E7A" }}>{i.diagnosis || "—"}</td>
                <td className="p-3"><span className="pill" style={{ background: `${STATUS_COLORS[i.status]}25`, color: STATUS_COLORS[i.status] }}>{STATUS[i.status] || i.status}</span></td>
                <td className="p-3 text-right whitespace-nowrap">
                  {isAdmin && tab === "pre" && (
                    <button data-testid={`move-post-${i.id}`} onClick={() => moveToPost(i)}
                            className="btn btn-secondary text-[11px] px-2 py-1 mr-1">→ Post-Intake</button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => setEdit({ ...i })} className="btn btn-ghost p-2" data-testid={`edit-intake-${i.id}`}><PencilSimple size={16} /></button>
                      <button onClick={() => remove(i.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-2xl modal-card max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.intake_type === "pre" ? "Pre-Intake" : "Post-Intake"} {edit.id ? "Edit" : "Entry"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={edit.priority || false} onChange={e => setEdit({ ...edit, priority: e.target.checked })} />
                  <span className="flex items-center gap-1 font-bold" style={{ color: "#D4A64A" }}><Star size={16} weight="fill" /> Priority Client</span>
                </label>
              </div>
              <div className="col-span-2"><label className="label">Child Name *</label><input data-testid="intake-name-input" className="input" value={edit.child_name} onChange={e => setEdit({ ...edit, child_name: e.target.value })} /></div>
              <div>
                <label className="label">Service</label>
                <select className="select" value={edit.service || "HS"} onChange={e => setEdit({ ...edit, service: e.target.value })}>
                  <option value="HS">HS</option>
                  <option value="SS">SS</option>
                  <option value="HS / SS">HS / SS</option>
                  <option value="SS / HS">SS / HS</option>
                  <option value="ABA">ABA</option>
                </select>
              </div>
              <div><label className="label">Phone</label><input className="input" value={edit.phone || ""} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></div>
              <div><label className="label">District / Address</label><input className="input" value={edit.district || ""} onChange={e => setEdit({ ...edit, district: e.target.value })} /></div>
              <div><label className="label">Age / Year of Birth</label><input className="input" value={edit.age || ""} onChange={e => setEdit({ ...edit, age: e.target.value })} /></div>
              {edit.intake_type === "pre" ? (
                <div>
                  <label className="label">Time Preference</label>
                  <select className="select" value={edit.time_pref || ""} onChange={e => setEdit({ ...edit, time_pref: e.target.value })}>
                    <option value="">—</option>
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Any">Any</option>
                  </select>
                </div>
              ) : (
                <div><label className="label">Language</label><input className="input" placeholder="English / Arabic" value={edit.language || ""} onChange={e => setEdit({ ...edit, language: e.target.value })} /></div>
              )}
              <div><label className="label">Parent Name</label><input className="input" value={edit.parent_name || ""} onChange={e => setEdit({ ...edit, parent_name: e.target.value })} /></div>
              <div><label className="label">Intake Date</label><input type="date" className="input" value={edit.intake_date || ""} onChange={e => setEdit({ ...edit, intake_date: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Diagnosis</label><input className="input" placeholder="ASD / ADHD / Speech delay / NA" value={edit.diagnosis || ""} onChange={e => setEdit({ ...edit, diagnosis: e.target.value })} /></div>
              <div className="col-span-2">
                <label className="label">Status</label>
                <select className="select" value={edit.status || "new"} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="intake-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
