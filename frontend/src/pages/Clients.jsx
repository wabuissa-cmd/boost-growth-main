import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X, MagnifyingGlass, MapPin, User, Phone, Hash, ClipboardText, ChartLine, IdentificationCard, ArrowSquareOut } from "@phosphor-icons/react";

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [previewClient, setPreviewClient] = useState(null);
  const [detailsClient, setDetailsClient] = useState(null);

  const load = async () => {
    const [c, t] = await Promise.all([api.get("/clients"), api.get("/therapists").catch(() => ({data:[]}))]);
    setItems(c.data); setTherapists(t.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) await api.put(`/clients/${edit.id}`, edit);
    else await api.post("/clients", edit);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete client and all their files?")) return; await api.delete(`/clients/${id}`); load(); };
  const findT = id => therapists.find(t => t.id === id);

  const filtered = items.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.file_no || "").includes(search)
  );

  return (
    <div>
      <div className="flex items-center mb-5 gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Clients</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>{items.length} clients · all profile information</div>
        </div>
        <div className="relative">
          <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
          <input className="input pl-10 max-w-sm" placeholder="Search by name or file #..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {isAdmin && <button data-testid="add-client-btn" onClick={() => setEdit({ name: "", file_no: "", package_hours: 24, color: "#A2C4C9", main_therapist_id: "", co_therapist_ids: [], locations: [] })} className="btn btn-primary"><Plus size={16}/> New Child</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center col-span-full" style={{color: "#8B9E7A"}}>No clients</div>}
        {filtered.map(c => (
          <div key={c.id} className="card card-hover p-0 overflow-hidden">
            <div className="h-2" style={{background: c.color || "#7A8A6A"}}/>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0" style={{background: c.color || "#E5EBE1", color: "#2C3625"}}>
                  {c.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg truncate" style={{color: "#2C3625"}}>{c.name}</div>
                  <div className="text-xs flex items-center gap-1 flex-wrap" style={{color: "#8B9E7A"}}>
                    <Hash size={10}/>{c.file_no || "—"}
                    {c.billing_mode === "weeks" ? (
                      <span className="pill text-[9px] px-1.5 py-0.5" style={{background:"#FAF0D1", color:"#6B5218"}}>📅 {c.cycle_weeks || 4}-week cycle</span>
                    ) : (
                      <span>· Pkg {c.package_hours || 24}h</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEdit({...c, co_therapist_ids: c.co_therapist_ids || [], locations: c.locations || []})} className="btn btn-ghost p-1.5"><PencilSimple size={14}/></button>
                    <button onClick={() => remove(c.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14}/></button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                {c.supervisor && <div style={{color: "#5C6853"}}><User size={12} className="inline mr-1.5"/><strong>Supervisor:</strong> {c.supervisor}</div>}
                {c.main_therapist_id && <div style={{color: "#5C6853"}}><User size={12} className="inline mr-1.5"/><strong>Main:</strong> {findT(c.main_therapist_id)?.name || "—"}</div>}
                {c.co_therapist_ids?.length > 0 && (
                  <div style={{color: "#5C6853"}}><User size={12} className="inline mr-1.5"/><strong>Co:</strong> {c.co_therapist_ids.map(id => findT(id)?.name?.replace("Ms. ", "")).filter(Boolean).join(", ")}</div>
                )}
                {c.parent_phone && <div style={{color: "#5C6853"}}><Phone size={12} className="inline mr-1.5"/>{c.parent_phone}</div>}
              </div>

              {c.locations?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#F0EDE9] space-y-1.5">
                  {c.locations.map((l, i) => (
                    <div key={i} className="text-xs flex items-start gap-1.5">
                      <span className="pill text-[9px] py-0.5 px-1.5" style={{background: l.service === "SS" ? "#E5EBE1" : "#EAF0F3", color: l.service === "SS" ? "#3D4F35" : "#375568"}}>{l.service}</span>
                      <span style={{color: "#5C6853"}}><MapPin size={11} className="inline mr-0.5"/>{l.address}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons row */}
              <div className="mt-3 pt-3 border-t border-[#F0EDE9] grid grid-cols-2 gap-1.5">
                <ClientActionBtn icon="📍" label="Location" testId={`btn-loc-${c.id}`}
                  available={!!c.locations?.[0]?.address}
                  href={c.locations?.[0]?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.locations[0].address)}` : null}
                  preview={false}/>
                <ClientActionBtn icon="📋" label="Case Summary" testId={`btn-case-${c.id}`}
                  available={!!c.drive_url}
                  href={c.drive_url || null}
                  preview={true}
                  onPreview={() => setPreviewClient({ client: c, kind: "case" })}/>
                <ClientActionBtn icon="📊" label="Progress Report" testId={`btn-prog-${c.id}`}
                  available={!!c.drive_url}
                  href={c.drive_url || null}
                  preview={true}
                  onPreview={() => setPreviewClient({ client: c, kind: "progress" })}/>
                <ClientActionBtn icon="👤" label="Details" testId={`btn-details-${c.id}`}
                  available={true}
                  preview={true}
                  onPreview={() => setDetailsClient(c)}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Embedded preview modal (Drive/Doc) */}
      {previewClient && (
        <ClientPreviewModal client={previewClient.client} kind={previewClient.kind} onClose={() => setPreviewClient(null)}/>
      )}
      {/* Details modal */}
      {detailsClient && (
        <ClientDetailsModal client={detailsClient} therapists={therapists} isAdmin={isAdmin}
          onClose={() => setDetailsClient(null)}
          onSaved={() => { setDetailsClient(null); load(); }}/>
      )}

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-2xl modal-card max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Client" : "New Client"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Full Name</label><input data-testid="client-name-input" className="input" required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/></div>
              <div><label className="label">File #</label><input className="input" value={edit.file_no || ""} onChange={e=>setEdit({...edit, file_no: e.target.value})} placeholder="009"/></div>
              <div><label className="label">Billing Mode</label>
                <select className="select" value={edit.billing_mode || "hours"} onChange={e=>setEdit({...edit, billing_mode: e.target.value})} data-testid="billing-mode-select">
                  <option value="hours">Hours-based (Home Sessions)</option>
                  <option value="weeks">Weeks-based (School Service · 4-week cycle)</option>
                </select>
              </div>
              {(edit.billing_mode || "hours") === "hours" ? (
                <div><label className="label">Package (hours)</label><input type="number" className="input" value={edit.package_hours || 24} onChange={e=>setEdit({...edit, package_hours: parseFloat(e.target.value) || 24})}/></div>
              ) : (
                <>
                  <div><label className="label">Cycle Length (weeks)</label><input type="number" min="1" max="12" className="input" value={edit.cycle_weeks || 4} onChange={e=>setEdit({...edit, cycle_weeks: parseInt(e.target.value) || 4})}/></div>
                  <div className="col-span-2"><label className="label">Cycle Start Date (Sunday of first billing week)</label><input type="date" className="input" value={edit.cycle_start_date || ""} onChange={e=>setEdit({...edit, cycle_start_date: e.target.value})}/></div>
                </>
              )}
              <div>
                <label className="label">Color</label>
                <div className="flex items-center gap-2"><input type="color" value={edit.color || "#A2C4C9"} onChange={e=>setEdit({...edit, color: e.target.value})} className="w-10 h-10 rounded-lg border border-[#E8E4DE]"/><span className="text-xs" style={{color: "#8B9E7A"}}>{edit.color}</span></div>
              </div>
              <div>
                <label className="label">Supervisor</label>
                <input className="input" value={edit.supervisor || ""} onChange={e=>setEdit({...edit, supervisor: e.target.value})}/>
              </div>
              <div>
                <label className="label">Age</label>
                <input className="input" value={edit.age || ""} onChange={e=>setEdit({...edit, age: e.target.value})}/>
              </div>
              <div>
                <label className="label">Parent Name</label>
                <input className="input" value={edit.parent_name || ""} onChange={e=>setEdit({...edit, parent_name: e.target.value})}/>
              </div>
              <div>
                <label className="label">Parent Phone</label>
                <input className="input" value={edit.parent_phone || ""} onChange={e=>setEdit({...edit, parent_phone: e.target.value})}/>
              </div>
              <div className="col-span-2">
                <label className="label">Main Therapist</label>
                <select className="select" value={edit.main_therapist_id || ""} onChange={e=>setEdit({...edit, main_therapist_id: e.target.value || null})}>
                  <option value="">— None —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Co-Therapists (multi)</label>
                <div className="flex flex-wrap gap-1.5">
                  {therapists.map(t => {
                    const sel = (edit.co_therapist_ids || []).includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => setEdit({...edit, co_therapist_ids: sel ? edit.co_therapist_ids.filter(x=>x!==t.id) : [...(edit.co_therapist_ids||[]), t.id]})}
                              className={`pill text-xs px-2 py-1 ${sel ? "bg-[#7A8A6A] text-white" : "bg-white border border-[#E8E4DE]"}`}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Locations (Service + Address)</label>
                <div className="space-y-2">
                  {(edit.locations || []).map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <select className="select w-24" value={l.service} onChange={e => { const ll = [...edit.locations]; ll[i] = {...ll[i], service: e.target.value}; setEdit({...edit, locations: ll}); }}>
                        <option value="HS">HS</option><option value="SS">SS</option><option value="OS">OS</option>
                      </select>
                      <input className="input flex-1" placeholder="Address" value={l.address} onChange={e => { const ll = [...edit.locations]; ll[i] = {...ll[i], address: e.target.value}; setEdit({...edit, locations: ll}); }}/>
                      <button type="button" onClick={() => setEdit({...edit, locations: edit.locations.filter((_,j)=>j!==i)})} className="btn btn-ghost p-2 text-red-700"><Trash size={14}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEdit({...edit, locations: [...(edit.locations||[]), {service:"HS", address:""}]})} className="btn btn-outline text-xs"><Plus size={14}/> Add location</button>
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select data-testid="client-status-select" className="select" value={edit.status || "Active"} onChange={e=>setEdit({...edit, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="label">Service Type</label>
                <select data-testid="client-service-type-select" className="select" value={edit.service_type || ""} onChange={e=>setEdit({...edit, service_type: e.target.value || null})}>
                  <option value="">—</option>
                  <option value="HS">HS (Home Session)</option>
                  <option value="SS">SS (School Support)</option>
                  <option value="HS+SS">HS + SS</option>
                  <option value="AVC">AVC</option>
                </select>
              </div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" rows={2} value={edit.notes || ""} onChange={e=>setEdit({...edit, notes: e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="client-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Helper components for client cards -----
function ClientActionBtn({ icon, label, available, href, preview, onPreview, testId }) {
  if (!available) {
    return (
      <button data-testid={testId} disabled className="text-[10px] py-1.5 px-2 rounded-lg border" style={{borderColor: "#F0EDE9", color: "#B8C0AC", background: "#FAFAF7"}}>
        {icon} {label} <span className="opacity-60">— Not available</span>
      </button>
    );
  }
  if (preview) {
    return (
      <button data-testid={testId} onClick={onPreview} className="text-[11px] py-1.5 px-2 rounded-lg border hover:bg-[#F0EDE9] transition" style={{borderColor: "#E0DCC4", color: "#3D4F35", background: "white"}}>
        {icon} {label}
      </button>
    );
  }
  return (
    <a data-testid={testId} href={href} target="_blank" rel="noreferrer" className="text-[11px] py-1.5 px-2 rounded-lg border hover:bg-[#F0EDE9] transition flex items-center justify-center gap-1" style={{borderColor: "#E0DCC4", color: "#3D4F35", background: "white"}}>
      {icon} {label}
    </a>
  );
}

function ClientPreviewModal({ client, kind, onClose }) {
  const url = client.drive_url;
  const isDriveFolder = url && url.includes("/folders/");
  const embedUrl = isDriveFolder
    ? url.replace("/folders/", "/embeddedfolderview?id=").replace(/\?.*$/, "") + "#grid"
    : url;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-0 w-full max-w-5xl modal-card max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E4DE]">
          <div>
            <div className="font-bold text-sm" style={{color: "#2C3625"}}>{kind === "case" ? "Case Summary" : "Progress Report"} · {client.name}</div>
            <div className="text-[11px]" style={{color: "#8B9E7A"}}>Internal preview · Drive folder</div>
          </div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-outline text-xs"><ArrowSquareOut size={14}/> Open externally</a>
            <button onClick={onClose} className="btn btn-ghost p-2"><X size={18}/></button>
          </div>
        </div>
        <div className="flex-1 bg-[#FAFAF7]">
          <iframe src={embedUrl} title={`${kind}-${client.id}`} className="w-full h-full" style={{minHeight: 540, border: 0}}/>
        </div>
      </div>
    </div>
  );
}

function ClientDetailsModal({ client, therapists, onClose, isAdmin, onSaved }) {
  const findT = id => therapists.find(t => t.id === id);
  const [tab, setTab] = useState("info"); // info | attachments
  const [att, setAtt] = useState({
    intake_file_url: client.intake_file_url || "",
    attendance_sheet_url: client.attendance_sheet_url || client.drive_url || "",
    progress_reports_url: client.progress_reports_url || "",
    case_summary_url: client.case_summary_url || "",
  });
  const [saving, setSaving] = useState(false);
  const saveAttachments = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${client.id}`, { ...client, ...att });
      onSaved && onSaved();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-0 w-full max-w-xl modal-card max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-[#E8E4DE]">
          <div>
            <div className="font-display text-2xl" style={{color: "#2C3625"}}>{client.name}</div>
            <div className="text-xs flex items-center gap-2" style={{color: "#8B9E7A"}}>
              <span>File #{client.file_no || "—"}</span>
              {client.service_type && <span className="pill text-[10px] px-1.5 py-0.5" style={{background: "#E5EBE1", color: "#3D4F35"}}>{client.service_type}</span>}
              <span className="pill text-[10px] px-1.5 py-0.5" style={{background: client.status === "Inactive" ? "#F8EBE7" : "#E5EBE1", color: client.status === "Inactive" ? "#8A3F27" : "#3D4F35"}}>{client.status || "Active"}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2"><X size={18}/></button>
        </div>
        <div className="flex gap-1 px-5 pt-3 border-b border-[#E8E4DE]">
          <button data-testid="tab-info" onClick={() => setTab("info")} className={`px-3 py-2 text-sm font-bold ${tab === "info" ? "border-b-2" : "opacity-60"}`} style={{borderColor: "#7A8A6A", color: tab === "info" ? "#2C3625" : "#8B9E7A"}}>Info</button>
          <button data-testid="tab-attachments" onClick={() => setTab("attachments")} className={`px-3 py-2 text-sm font-bold ${tab === "attachments" ? "border-b-2" : "opacity-60"}`} style={{borderColor: "#7A8A6A", color: tab === "attachments" ? "#2C3625" : "#8B9E7A"}}>Attachments</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {tab === "info" && (
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="opacity-70">Main therapist</dt>
              <dd className="col-span-2 font-medium">{findT(client.main_therapist_id)?.name || <span className="opacity-50">Not assigned</span>}</dd>
              <dt className="opacity-70">Co therapists</dt>
              <dd className="col-span-2 font-medium">{client.co_therapist_ids?.length ? client.co_therapist_ids.map(id => findT(id)?.name).filter(Boolean).join(", ") : <span className="opacity-50">—</span>}</dd>
              <dt className="opacity-70">Supervisor</dt>
              <dd className="col-span-2 font-medium">{client.supervisor || <span className="opacity-50">—</span>}</dd>
              <dt className="opacity-70">Program</dt>
              <dd className="col-span-2 font-medium">{client.billing_mode === "weeks" ? `${client.cycle_weeks || 4}-week cycle (school)` : `${client.package_hours || 24}h package`}</dd>
              <dt className="opacity-70">Service Type</dt>
              <dd className="col-span-2 font-medium">{client.service_type || <span className="opacity-50">—</span>}</dd>
              <dt className="opacity-70">Parent name</dt>
              <dd className="col-span-2 font-medium">{client.parent_name || <span className="opacity-50">—</span>}</dd>
              <dt className="opacity-70">Parent phone</dt>
              <dd className="col-span-2 font-medium">{client.parent_phone || <span className="opacity-50">—</span>}</dd>
              <dt className="opacity-70">Age</dt>
              <dd className="col-span-2 font-medium">{client.age || <span className="opacity-50">—</span>}</dd>
              <dt className="opacity-70">Locations</dt>
              <dd className="col-span-2 font-medium">
                {client.locations?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {client.locations.map((loc, i) => (
                      <span key={i} className="pill text-[10px] px-2 py-1" style={{background: "#F0E9D8", color: "#2C3625"}}>
                        <strong>{loc.service}</strong> · {loc.address}
                      </span>
                    ))}
                  </div>
                ) : <span className="opacity-50">—</span>}
              </dd>
              <dt className="opacity-70">Notes</dt>
              <dd className="col-span-2">{client.notes || <span className="opacity-50">—</span>}</dd>
            </dl>
          )}
          {tab === "attachments" && (
            <div className="space-y-3">
              {[
                { key: "intake_file_url", label: "Intake File", hint: "Paste a Google Drive link to the intake document" },
                { key: "attendance_sheet_url", label: "Attendance Sheet", hint: "Paste the Google Sheets URL inside the client's 'Attendance Sheets' Drive folder (used by Sync from Drive)" },
                { key: "progress_reports_url", label: "Progress Reports Folder", hint: "Paste the Drive folder link for this client's Progress Reports" },
                { key: "case_summary_url", label: "Case Summary (ملخص الحالة)", hint: "Paste the Drive folder or document link" },
              ].map(f => (
                <div key={f.key} className="p-3 rounded-xl border" style={{borderColor: "#E8E4DE"}}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-bold" style={{color: "#2C3625"}}>{f.label}</div>
                    {att[f.key] && (
                      <a href={att[f.key]} target="_blank" rel="noreferrer" className="text-[11px] underline" style={{color: "#7A8A6A"}}>
                        <ArrowSquareOut size={12} className="inline"/> Open
                      </a>
                    )}
                  </div>
                  <div className="text-[10px] mb-2" style={{color: "#8B9E7A"}}>{f.hint}</div>
                  {isAdmin ? (
                    <input data-testid={`att-${f.key}`} className="input text-xs" placeholder="https://drive.google.com/..."
                           value={att[f.key]} onChange={e => setAtt(s => ({ ...s, [f.key]: e.target.value }))}/>
                  ) : (
                    <div className="text-xs truncate" style={{color: att[f.key] ? "#2C3625" : "#8B9E7A"}}>{att[f.key] || "— not provided —"}</div>
                  )}
                </div>
              ))}
              {isAdmin && (
                <div className="flex justify-end pt-1">
                  <button data-testid="save-attachments-btn" onClick={saveAttachments} disabled={saving} className="btn btn-primary text-sm">
                    {saving ? <span className="spinner"/> : "Save Links"}
                  </button>
                </div>
              )}
              <ProgressReportsList clientId={client.id} isAdmin={isAdmin}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


const PR_STATUS_META = {
  uploaded: { label: "Uploaded", bg: "#FAF0D1", color: "#6B5218", border: "#E5C387" },
  reviewed: { label: "Reviewed", bg: "#E5EAF1", color: "#3A5572", border: "#A8C0D3" },
  resolved: { label: "Resolved", bg: "#E5EBE1", color: "#3D4F35", border: "#B8C8A8" },
};

// ═══════════════════════════════════════════════════════════
// PROGRESS REPORTS — 3-STEP COMPONENT
// Replace the entire ProgressReportsList function in Clients.jsx
// (from line ~416 to end of file)
// ═══════════════════════════════════════════════════════════

// Supervisors map — who supervises which clients
const SUPERVISOR_CLIENTS = {
  msMaha:  ["035","037","038","040","041","042","047","052","054","060","063","065","070"],
  msFahda: ["009","011","018","023","024","027","030","034","061","062","068","072","079"],
};

// ═══════════════════════════════════════════════════════════
// PROGRESS REPORTS — 3-STEP COMPONENT
// Replace the entire ProgressReportsList function in Clients.jsx
// (from line ~416 to end of file)
// ═══════════════════════════════════════════════════════════

// Supervisors map — who supervises which clients
const SUPERVISOR_CLIENTS = {
  msMaha:  ["035","037","038","040","041","042","047","052","054","060","063","065","070"],
  msFahda: ["009","011","018","023","024","027","030","034","061","062","068","072","079"],
};

function ProgressReportsList({ clientId, isAdmin }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", url: "", report_date: "", notes: "" });
  const [busy, setBusy] = useState(null);

  // Permission logic
  const isSupervisorOfClient = () => {
    if (isAdmin) return true;
    if (!user) return false;
    const key = user.key || user.email?.split("@")[0];
    const supervised = SUPERVISOR_CLIENTS[key] || [];
    return supervised.includes(String(clientId).padStart(3,"0"));
  };

  const canMarkUploaded   = isAdmin || isSupervisorOfClient() ||
    (user?.main_client_ids || []).includes(clientId);
  const canMarkReviewed   = isAdmin || isSupervisorOfClient();
  const canMarkResolved   = isAdmin || isSupervisorOfClient();
  const canAddReport      = isAdmin || isSupervisorOfClient();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/clients/${clientId}/progress-reports`);
      setItems(data || []);
    } catch (_e) { setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const addReport = async () => {
    if (!draft.title.trim()) { alert("Title is required"); return; }
    setBusy("add");
    try {
      await api.post(`/clients/${clientId}/progress-reports`, {
        ...draft,
        uploaded: false, reviewed: false, resolved: false
      });
      setDraft({ title: "", url: "", report_date: "", notes: "" });
      setAdding(false);
      await load();
    } catch (e) {
      alert("Add failed: " + (e.response?.data?.detail || e.message));
    } finally { setBusy(null); }
  };

  // Toggle one of the 3 steps
  const toggleStep = async (rid, step, currentValue) => {
    setBusy(rid + step);
    try {
      await api.put(`/progress-reports/${rid}/steps`, {
        [step]: !currentValue,
        [`${step}_by`]: user?.name || user?.email || "Admin",
        [`${step}_at`]: new Date().toISOString(),
      });
      await load();
    } catch (e) {
      alert("Update failed: " + (e.response?.data?.detail || e.message));
    } finally { setBusy(null); }
  };

  const removeReport = async (rid) => {
    if (!window.confirm("Delete this progress report?")) return;
    setBusy(rid);
    try { await api.delete(`/progress-reports/${rid}`); await load(); }
    finally { setBusy(null); }
  };

  const StepBadge = ({ rid, step, label, value, enabled, by, at }) => {
    const colors = {
      uploaded: { on: "#D97706", bg: "#FEF3C7", border: "#FCD34D" },
      reviewed:  { on: "#2563EB", bg: "#DBEAFE", border: "#93C5FD" },
      resolved:  { on: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
    };
    const c = colors[step];
    const isBusy = busy === rid + step;
    return (
      <button
        disabled={!enabled || isBusy}
        onClick={() => toggleStep(rid, step, value)}
        title={value && by ? `${label} by ${by} on ${at ? new Date(at).toLocaleDateString() : ""}` : `Mark as ${label}`}
        className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all"
        style={{
          background: value ? c.bg : "#F9F9F7",
          color: value ? c.on : "#9CA3AF",
          borderColor: value ? c.border : "#E5E7EB",
          cursor: enabled ? "pointer" : "default",
          opacity: (!enabled && !value) ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: 13 }}>{value ? "✓" : "○"}</span>
        {label}
      </button>
    );
  };

  return (
    <div className="p-3 rounded-xl border mt-3" style={{ borderColor: "#E8E4DE" }} data-testid="progress-reports-section">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold" style={{ color: "#2C3625" }}>Progress Reports</div>
          <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
            {items.length} report{items.length === 1 ? "" : "s"} · 3 steps per report
          </div>
        </div>
        {canAddReport && !adding && (
          <button data-testid="add-progress-report-btn" onClick={() => setAdding(true)} className="btn btn-outline text-xs">
            <Plus size={12} /> Add Report
          </button>
        )}
      </div>

      {adding && (
        <div className="p-3 rounded-lg mb-3 space-y-2" style={{ background: "#FAFAF7", border: "1px solid #E8E4DE" }}>
          <input data-testid="pr-title" className="input text-xs" placeholder="Report title (e.g. Progress Report — Apr 2026)"
            value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <input data-testid="pr-url" className="input text-xs" placeholder="Drive/Doc URL (optional)"
            value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} />
          <div className="flex gap-2">
            <input data-testid="pr-date" type="date" className="input text-xs flex-1"
              value={draft.report_date} onChange={e => setDraft({ ...draft, report_date: e.target.value })} />
            <input className="input text-xs flex-1" placeholder="Notes (optional)"
              value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setDraft({ title: "", url: "", report_date: "", notes: "" }); }}
              className="btn btn-ghost text-xs">Cancel</button>
            <button data-testid="pr-save" onClick={addReport} disabled={busy === "add"} className="btn btn-primary text-xs">
              {busy === "add" ? <span className="spinner" /> : "Save Report"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-xs italic py-2" style={{ color: "#8B9E7A" }}>Loading…</div>}
      {!loading && items.length === 0 && (
        <div className="text-xs italic py-3 text-center" style={{ color: "#8B9E7A" }}>No progress reports yet</div>
      )}

      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} data-testid={`pr-row-${r.id}`}
            className="p-3 rounded-lg border" style={{ borderColor: "#E8E4DE", background: "white" }}>

            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs" style={{ color: "#2C3625" }}>{r.title}</div>
                <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: "#8B9E7A" }}>
                  {r.report_date && <span>📅 {r.report_date}</span>}
                  {r.notes && <span>· {r.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer"
                    className="text-[11px] underline whitespace-nowrap" style={{ color: "#7A8A6A" }}>
                    <ArrowSquareOut size={12} className="inline" /> Open
                  </a>
                )}
                {isAdmin && (
                  <button data-testid={`pr-del-${r.id}`} onClick={() => removeReport(r.id)}
                    disabled={busy === r.id} className="btn btn-ghost p-1 text-red-700 ml-1">
                    <Trash size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* 3-Step Badges */}
            <div className="flex gap-2 flex-wrap">
              <StepBadge
                rid={r.id} step="uploaded" label="Uploaded"
                value={r.uploaded} enabled={canMarkUploaded}
                by={r.uploaded_by} at={r.uploaded_at}
              />
              <StepBadge
                rid={r.id} step="reviewed" label="Reviewed"
                value={r.reviewed} enabled={canMarkReviewed}
                by={r.reviewed_by} at={r.reviewed_at}
              />
              <StepBadge
                rid={r.id} step="resolved" label="Resolved"
                value={r.resolved} enabled={canMarkResolved}
                by={r.resolved_by} at={r.resolved_at}
              />
            </div>

            {/* Who did what */}
            {(r.uploaded_by || r.reviewed_by || r.resolved_by) && (
              <div className="mt-2 text-[10px] space-y-0.5" style={{ color: "#9CA3AF" }}>
                {r.uploaded_by && <div>✓ Uploaded by {r.uploaded_by}</div>}
                {r.reviewed_by && <div>✓ Reviewed by {r.reviewed_by}</div>}
                {r.resolved_by && <div>✓ Resolved by {r.resolved_by}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
