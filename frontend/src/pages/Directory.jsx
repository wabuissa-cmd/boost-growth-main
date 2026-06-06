import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, X, Trash, Phone, Envelope, PencilSimple, IdentificationCard } from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";

const ROLE_COLORS = {
  "Direct Manager": "#D4A64A",
  "Operations": "#7A8A6A",
  "Supervisor": "#8FA481",
  "Coordinator": "#A4BCCB",
};

function roleBadgeColor(role) {
  if (!role) return "#E5EBE1";
  for (const key in ROLE_COLORS) {
    if (role.toLowerCase().includes(key.toLowerCase())) return ROLE_COLORS[key];
  }
  return "#E5EBE1";
}

export default function Directory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = async () => { const { data } = await api.get("/directory"); setItems(data); };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!edit.name) return;
    if (edit.id) await api.put(`/directory/${edit.id}`, { name: edit.name, role: edit.role, phone: edit.phone, email: edit.email });
    else await api.post("/directory", { name: edit.name, role: edit.role, phone: edit.phone, email: edit.email });
    setEdit(null); load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this contact?")) return;
    await api.delete(`/directory/${id}`); load();
  };

  return (
    <div>
      <PageBanner
        title="Directory"
        subtitle="Internal contacts · managers · supervisors · coordinators"
        badge={isAdmin ? (
          <button data-testid="add-contact-btn" onClick={() => setEdit({ name: "", role: "", phone: "", email: "" })} className="btn btn-primary text-sm">
            <Plus size={16} /> New Contact
          </button>
        ) : null}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {items.length === 0 && (
          <div className="card p-12 text-center col-span-full" style={{ color: "#8B9E7A" }}>
            <IdentificationCard size={42} weight="duotone" className="mx-auto mb-2 opacity-60" />
            No contacts yet
          </div>
        )}
        {items.map(c => (
          <div key={c.id} className="card card-hover p-0 overflow-hidden" data-testid={`contact-card-${c.id}`}>
            <div className="h-2" style={{ background: roleBadgeColor(c.role) }} />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl shrink-0" style={{ background: `${roleBadgeColor(c.role)}33`, color: "#2C3625" }}>{c.name?.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg truncate" style={{ color: "#2C3625" }}>{c.name}</div>
                  {c.role && <div className="text-xs inline-block pill mt-1 px-2 py-0.5" style={{ background: `${roleBadgeColor(c.role)}25`, color: "#2C3625" }}>{c.role}</div>}
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEdit({ ...c })} className="btn btn-ghost p-1.5" data-testid={`edit-contact-${c.id}`}><PencilSimple size={14} /></button>
                    <button onClick={() => remove(c.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14} /></button>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-[#7A8A6A]" style={{ color: "#5C6853" }}><Phone size={16} /> {c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-[#7A8A6A] truncate" style={{ color: "#5C6853" }}><Envelope size={16} /> {c.email}</a>}
                {!c.phone && !c.email && <div className="text-xs italic" style={{ color: "#8B9E7A" }}>No contact info yet</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Contact" : "New Contact"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <label className="label">Name</label>
            <input data-testid="contact-name-input" className="input mb-2" placeholder="Genan Almuhaisen" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <label className="label">Role / Title</label>
            <input className="input mb-2" placeholder="Direct Manager / Operations / Supervisor" value={edit.role || ""} onChange={e => setEdit({ ...edit, role: e.target.value })} />
            <label className="label">Phone</label>
            <input className="input mb-2" placeholder="+966 5X XXX XXXX" value={edit.phone || ""} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
            <label className="label">Email</label>
            <input className="input mb-4" placeholder="name@boostgrowthsa.com" value={edit.email || ""} onChange={e => setEdit({ ...edit, email: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="contact-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
