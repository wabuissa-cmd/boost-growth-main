import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  Folders, Files, Notebook, ArrowSquareOut, Plus, X, Trash, PencilSimple, GraduationCap,
  FileText, Books, Question
} from "@phosphor-icons/react";

const ICON_MAP = {
  Folders: Folders, Files: Files, Notebook: Notebook,
  GraduationCap: GraduationCap, FileText: FileText, Books: Books,
};

const ICON_CHOICES = ["Folders", "Files", "Notebook", "GraduationCap", "FileText", "Books"];
const VISIBILITY = [
  { id: "all", label: "Everyone" },
  { id: "admin", label: "Admin only" },
  { id: "therapist", label: "Therapists only" },
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "Materials", label: "Materials" },
  { id: "Matching", label: "Matching Objectives" },
  { id: "Programs", label: "Programs" },
  { id: "Worksheets", label: "Worksheets" },
  { id: "Reports", label: "Reports" },
  { id: "drive", label: "Drive / Folders" },
];

function renderIcon(name, size = 28) {
  const Cmp = ICON_MAP[name] || Folders;
  return <Cmp size={size} weight="duotone" />;
}

export default function Resources() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [previewItem, setPreviewItem] = useState(null);

  const matchesFilter = (r) => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || (r.category || "drive") === activeCategory;
    return matchSearch && matchCat;
  };

  const load = async () => {
    const { data } = await api.get("/resources");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit.title || !edit.url) return;
    const payload = {
      title: edit.title,
      description: edit.description || "",
      url: edit.url,
      category: edit.category || "drive",
      visibility: edit.visibility || "all",
      icon: edit.icon || "Folders",
      bg: edit.bg || "#E5EBE1",
      color: edit.color || "#3D4F35",
      sort_order: Number(edit.sort_order) || 100,
    };
    if (edit.id) await api.put(`/resources/${edit.id}`, payload);
    else await api.post("/resources", payload);
    setEdit(null); load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this resource?")) return;
    await api.delete(`/resources/${id}`);
    load();
  };

  // Group: therapist, admin, all (filtered)
  const groups = {
    therapist: items.filter(i => i.visibility === "therapist" && matchesFilter(i)),
    all: items.filter(i => i.visibility === "all" && matchesFilter(i)),
    admin: items.filter(i => i.visibility === "admin" && matchesFilter(i)),
  };

  const GroupTitle = ({ label, hint }) => (
    <div className="mb-3 mt-1">
      <div className="text-[11px] tracking-[0.2em] font-bold" style={{ color: "#8B9E7A" }}>{label}</div>
      <div className="text-xs" style={{ color: "#5C6853" }}>{hint}</div>
    </div>
  );

  const Card = ({ r }) => (
    <div className="card card-hover p-5 group relative" data-testid={`resource-card-${r.id}`}>
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={(e) => { e.preventDefault(); setEdit({ ...r }); }} className="btn btn-ghost p-1.5" data-testid={`resource-edit-${r.id}`}><PencilSimple size={14} /></button>
          <button onClick={(e) => { e.preventDefault(); remove(r.id); }} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14} /></button>
        </div>
      )}
      <a href={r.url} target="_blank" rel="noreferrer" className="block" onClick={(e) => { e.preventDefault(); setPreviewItem(r); }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: r.bg || "#E5EBE1", color: r.color || "#3D4F35" }}>
          {renderIcon(r.icon)}
        </div>
        <div className="font-bold" style={{ color: "#2C3625" }}>{r.title}</div>
        <div className="text-xs" style={{ color: "#8B9E7A" }}>{r.description || "—"}</div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm flex items-center gap-1 opacity-60" style={{ color: "#7A8A6A" }}>
            <ArrowSquareOut size={14} /> Open
          </span>
          {r.category && r.category !== "drive" && (
            <span className="pill text-[9px] px-2 py-0.5" style={{ background: "#F4EDE3", color: "#6B5430" }}>{r.category}</span>
          )}
        </div>
        {isAdmin && (
          <div className="mt-2">
            <span className="pill text-[10px] px-2 py-0.5" style={{ background: r.visibility === "therapist" ? "#EAF0F3" : r.visibility === "admin" ? "#F1ECF7" : "#E5EBE1", color: r.visibility === "therapist" ? "#375568" : r.visibility === "admin" ? "#4E3F70" : "#3D4F35" }}>
              {r.visibility === "therapist" ? "Therapists" : r.visibility === "admin" ? "Admin" : "Everyone"}
            </span>
          </div>
        )}
      </a>
    </div>
  );

  return (
    <div>
      <div className="flex items-center mb-5 flex-wrap gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#2C3625" }}>Resources</h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>Drive folders & shared documents</div>
        </div>
        {isAdmin && (
          <button data-testid="add-resource-btn" onClick={() => setEdit({ title: "", description: "", url: "", visibility: "all", icon: "Folders", bg: "#E5EBE1", color: "#3D4F35", sort_order: 100 })} className="btn btn-primary">
            <Plus size={16} /> New Resource
          </button>
        )}
      </div>

      {/* Search + Category filter bar */}
      <div className="card p-3 mb-5 flex flex-wrap gap-2 items-center">
        <input data-testid="resources-search" type="search" placeholder="Search resources…"
               className="input text-sm flex-1 min-w-[180px]" value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button key={cat.id} data-testid={`cat-${cat.id}`} onClick={() => setActiveCategory(cat.id)}
                    className={`pill text-[11px] px-3 py-1.5 transition ${activeCategory === cat.id ? "" : "opacity-70 hover:opacity-100"}`}
                    style={{
                      background: activeCategory === cat.id ? "#7A8A6A" : "white",
                      color: activeCategory === cat.id ? "white" : "#5C6853",
                      border: "1px solid #E0DCC4"
                    }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>
          <Question size={40} weight="duotone" className="mx-auto mb-2 opacity-60" />
          No resources available yet.
        </div>
      )}

      {isAdmin ? (
        <>
          {groups.therapist.length > 0 && (
            <>
              <GroupTitle label="THERAPIST RESOURCES" hint="Visible to therapists only" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger mb-6">
                {groups.therapist.map(r => <Card key={r.id} r={r} />)}
              </div>
            </>
          )}
          {groups.all.length > 0 && (
            <>
              <GroupTitle label="SHARED WITH EVERYONE" hint="Admin + Therapists" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger mb-6">
                {groups.all.map(r => <Card key={r.id} r={r} />)}
              </div>
            </>
          )}
          {groups.admin.length > 0 && (
            <>
              <GroupTitle label="ADMIN ONLY" hint="HR · Policies · Management" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                {groups.admin.map(r => <Card key={r.id} r={r} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {items.map(r => <Card key={r.id} r={r} />)}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Resource" : "New Resource"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Title</label><input data-testid="resource-title-input" className="input" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Description</label><input className="input" value={edit.description || ""} onChange={e => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">URL (Drive link / doc / website)</label><input data-testid="resource-url-input" className="input" value={edit.url} onChange={e => setEdit({ ...edit, url: e.target.value })} placeholder="https://drive.google.com/..." /></div>
              <div>
                <label className="label">Visibility</label>
                <select data-testid="resource-visibility-select" className="select" value={edit.visibility} onChange={e => setEdit({ ...edit, visibility: e.target.value })}>
                  {VISIBILITY.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <select data-testid="resource-cat-select" className="select" value={edit.category || "drive"} onChange={e => setEdit({ ...edit, category: e.target.value })}>
                  {CATEGORIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Icon</label>
                <select className="select" value={edit.icon} onChange={e => setEdit({ ...edit, icon: e.target.value })}>
                  {ICON_CHOICES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tile BG color</label>
                <input type="color" value={edit.bg || "#E5EBE1"} onChange={e => setEdit({ ...edit, bg: e.target.value })} className="w-full h-10 rounded-lg border border-[#E8E4DE]" />
              </div>
              <div>
                <label className="label">Icon color</label>
                <input type="color" value={edit.color || "#3D4F35"} onChange={e => setEdit({ ...edit, color: e.target.value })} className="w-full h-10 rounded-lg border border-[#E8E4DE]" />
              </div>
              <div className="col-span-2"><label className="label">Sort order (lower = higher)</label><input type="number" className="input" value={edit.sort_order || 100} onChange={e => setEdit({ ...edit, sort_order: parseInt(e.target.value) })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="resource-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Internal preview modal — Drive folder embed or PDF iframe */}
      {previewItem && (
        <ResourcePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </div>
  );
}

function ResourcePreviewModal({ item, onClose }) {
  const url = item.url || "";
  const isDriveFolder = url.includes("/folders/");
  const isDriveFile = url.includes("/file/d/");
  const isPdf = /\.pdf($|\?)/i.test(url);
  const isDoc = /\.(docx?|xlsx?|pptx?)($|\?)/i.test(url);
  let embedUrl = url;
  let canEmbed = true;
  if (isDriveFolder) {
    embedUrl = url.replace("/folders/", "/embeddedfolderview?id=").replace(/\?.*$/, "") + "#grid";
  } else if (isDriveFile) {
    embedUrl = url.replace(/\/view.*$/, "/preview").replace(/\/edit.*$/, "/preview");
  } else if (isDoc && !isPdf) {
    embedUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  } else if (!isPdf && !url.startsWith("https://docs.google.com") && !url.includes("drive.google.com")) {
    canEmbed = false;
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-0 w-full max-w-5xl modal-card max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E4DE]">
          <div>
            <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{item.title}</div>
            <div className="text-[11px]" style={{ color: "#8B9E7A" }}>{item.category && item.category !== "drive" ? item.category : "Resource"} · Internal preview</div>
          </div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-outline text-xs"><ArrowSquareOut size={14} /> Open externally</a>
            <button onClick={onClose} className="btn btn-ghost p-2"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 bg-[#FAFAF7]">
          {canEmbed ? (
            <iframe src={embedUrl} title={item.title} className="w-full h-full" style={{ minHeight: 540, border: 0 }} />
          ) : (
            <div className="p-12 text-center" style={{ color: "#8B9E7A" }}>
              <p className="mb-3">This file cannot be embedded inside the portal.</p>
              <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary"><ArrowSquareOut size={14} /> Open externally</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
