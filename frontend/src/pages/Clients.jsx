import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth, isStaffAdmin, hasOpsAccess } from "../auth";
import { Plus, PencilSimple, Trash, MagnifyingGlass, MapPin, User, Phone, Hash, ArrowSquareOut } from "@phosphor-icons/react";
import { PackageStatusBadge } from "../components/PackageStatusBadge";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = isStaffAdmin(user);
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [panelClient, setPanelClient] = useState(null); // { client, section }
  const [prSummaries, setPrSummaries] = useState({});
  const [pkgByClient, setPkgByClient] = useState({});
  const navigate = useNavigate();

  const refreshPrSummaries = () => {
    api.get("/progress-reports/summary").then(r => setPrSummaries(r.data || {})).catch(() => {});
  };

  const openPanel = (client, section) => setPanelClient({ client, section });
  const closePanel = () => {
    const wasProgress = panelClient?.section === "progress";
    setPanelClient(null);
    if (wasProgress) refreshPrSummaries();
  };

  const load = async () => {
    const [c, t] = await Promise.all([api.get("/clients"), api.get("/therapists").catch(() => ({data:[]}))]);
    setItems(c.data); setTherapists(t.data);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    refreshPrSummaries();
    api.get("/clients/package-status").then(r => {
      const map = {};
      for (const row of r.data || []) {
        if (!map[row.client_id]) map[row.client_id] = [];
        map[row.client_id].push(row);
      }
      setPkgByClient(map);
    }).catch(() => setPkgByClient({}));
  }, [items]);

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
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-lg truncate flex-1" style={{color: "#2C3625"}}>{c.name}</div>
                    <div className="flex flex-col items-end gap-1 shrink-0 max-w-[48%]">
                      {(pkgByClient[c.id] || []).map(row => (
                        <PackageStatusBadge key={`${c.id}-${row.service_type}`} row={row} clientId={c.id}
                          onClick={() => navigate(`/attendance?client=${c.id}&service=${row.service_type}`)} />
                      ))}
                    </div>
                  </div>
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

              {/* Four equal section buttons */}
              <div className="mt-3 pt-3 border-t border-[#F0EDE9] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <SectionBtn icon="📍" label="Location" testId={`btn-loc-${c.id}`} onClick={() => openPanel(c, "location")} />
                <SectionBtn icon="📎" label="Attachments" testId={`btn-att-${c.id}`} onClick={() => openPanel(c, "attachments")} />
                <SectionBtn icon="📋" label="Case Details" testId={`btn-details-${c.id}`} onClick={() => openPanel(c, "details")} />
                <ProgressTracker clientId={c.id} summary={prSummaries[c.id]} onOpen={() => openPanel(c, "progress")} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {panelClient?.section === "location" && (
        <LocationPanelModal client={panelClient.client} onClose={closePanel} />
      )}
      {panelClient?.section === "attachments" && (
        <AttachmentsPanelModal client={panelClient.client} isAdmin={isAdmin} onClose={closePanel} onSaved={() => { closePanel(); load(); }} />
      )}
      {panelClient?.section === "details" && (
        <CaseDetailsPanelModal client={panelClient.client} therapists={therapists} isAdmin={isAdmin}
          onClose={closePanel} onSaved={() => { closePanel(); load(); }} />
      )}
      {panelClient?.section === "progress" && (
        <ProgressReportPanelModal client={panelClient.client} isAdmin={isAdmin} onClose={closePanel} />
      )}

      {edit && (
        <ModalBase
          title={edit.id ? "Edit Client" : "Add New Client"}
          subtitle="Client profile and service information"
          onClose={() => setEdit(null)}
          size="lg"
          footer={
            <>
              <ModalBtnSecondary type="button" onClick={() => setEdit(null)}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary data-testid="client-save-btn" type="button" onClick={save}>Save</ModalBtnPrimary>
            </>
          }
        >
          <FormSection title="Personal Information">
            <FormField label="Full name" required>
              <input data-testid="client-name-input" className="modal-input" required value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="File number">
                <input className="modal-input" value={edit.file_no || ""} onChange={e => setEdit({ ...edit, file_no: e.target.value })} placeholder="009" />
              </FormField>
              <FormField label="Age">
                <input className="modal-input" value={edit.age || ""} onChange={e => setEdit({ ...edit, age: e.target.value })} />
              </FormField>
              <FormField label="Parent name">
                <input className="modal-input" value={edit.parent_name || ""} onChange={e => setEdit({ ...edit, parent_name: e.target.value })} />
              </FormField>
              <FormField label="Parent phone">
                <input className="modal-input" value={edit.parent_phone || ""} onChange={e => setEdit({ ...edit, parent_phone: e.target.value })} />
              </FormField>
              <FormField label="Color">
                <div className="flex items-center gap-2">
                  <input type="color" value={edit.color || "#A2C4C9"} onChange={e => setEdit({ ...edit, color: e.target.value })} className="w-10 h-10 rounded-lg border" style={{ borderColor: "#DDD8D0" }} />
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{edit.color}</span>
                </div>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Service Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Service type">
                <select data-testid="client-service-type-select" className="modal-input" value={edit.service_type || ""} onChange={e => setEdit({ ...edit, service_type: e.target.value || null })}>
                  <option value="">—</option>
                  <option value="HS">HS (Home Session)</option>
                  <option value="SS">SS (School Support)</option>
                  <option value="HS+SS">HS + SS</option>
                  <option value="AVC">AVC</option>
                </select>
              </FormField>
              <FormField label="Status">
                <select data-testid="client-status-select" className="modal-input" value={edit.status || "Active"} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </FormField>
              <FormField label="Billing mode">
                <select className="modal-input" value={edit.billing_mode || "hours"} onChange={e => setEdit({ ...edit, billing_mode: e.target.value })} data-testid="billing-mode-select">
                  <option value="hours">Hours-based (Home Sessions)</option>
                  <option value="weeks">Weeks-based (School Service · 4-week cycle)</option>
                </select>
              </FormField>
              {(edit.billing_mode || "hours") === "hours" ? (
                <FormField label="Package hours">
                  <input type="number" className="modal-input" value={edit.package_hours || 24} onChange={e => setEdit({ ...edit, package_hours: parseFloat(e.target.value) || 24 })} />
                </FormField>
              ) : (
                <>
                  <FormField label="Cycle length (weeks)">
                    <input type="number" min="1" max="12" className="modal-input" value={edit.cycle_weeks || 4} onChange={e => setEdit({ ...edit, cycle_weeks: parseInt(e.target.value) || 4 })} />
                  </FormField>
                  <FormField label="Cycle start date" hint="First day of week 1 (Sun, Wed, etc.)">
                    <input type="date" className="modal-input" value={edit.cycle_start_date || ""} onChange={e => setEdit({ ...edit, cycle_start_date: e.target.value })} />
                  </FormField>
                </>
              )}
            </div>
            <FormField label="Notes">
              <textarea className="modal-input" rows={2} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
            </FormField>
          </FormSection>

          <FormSection title="Team Assignment">
            <FormField label="Main therapist">
              <select className="modal-input" value={edit.main_therapist_id || ""} onChange={e => setEdit({ ...edit, main_therapist_id: e.target.value || null })}>
                <option value="">— None —</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Co-therapists">
              <div className="flex flex-wrap gap-1.5">
                {therapists.map(t => {
                  const sel = (edit.co_therapist_ids || []).includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEdit({ ...edit, co_therapist_ids: sel ? edit.co_therapist_ids.filter(x => x !== t.id) : [...(edit.co_therapist_ids || []), t.id] })}
                      className={`pill text-xs px-2 py-1 ${sel ? "bg-[#7A8A6A] text-white" : "bg-white border"}`}
                      style={!sel ? { borderColor: "#DDD8D0" } : undefined}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </FormField>
            <FormField label="Supervisor">
              <input className="modal-input" value={edit.supervisor || ""} onChange={e => setEdit({ ...edit, supervisor: e.target.value })} />
            </FormField>
          </FormSection>

          <FormSection title="Location">
            <div className="space-y-2">
              {(edit.locations || []).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select className="modal-input w-24 flex-shrink-0" value={l.service} onChange={e => { const ll = [...edit.locations]; ll[i] = { ...ll[i], service: e.target.value }; setEdit({ ...edit, locations: ll }); }}>
                    <option value="HS">HS</option><option value="SS">SS</option><option value="OS">OS</option>
                  </select>
                  <input className="modal-input flex-1" placeholder="Address" value={l.address} onChange={e => { const ll = [...edit.locations]; ll[i] = { ...ll[i], address: e.target.value }; setEdit({ ...edit, locations: ll }); }} />
                  <button type="button" onClick={() => setEdit({ ...edit, locations: edit.locations.filter((_, j) => j !== i) })} className="btn btn-ghost p-2 text-red-700"><Trash size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setEdit({ ...edit, locations: [...(edit.locations || []), { service: "HS", address: "" }] })} className="btn btn-outline text-xs"><Plus size={14} /> Add location</button>
            </div>
          </FormSection>
        </ModalBase>
      )}
    </div>
  );
}

// ----- Helper components for client cards -----
function SectionBtn({ icon, label, onClick, testId }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick}
      className="text-[10px] sm:text-[11px] py-2 px-1.5 rounded-lg border hover:bg-[#F0EDE9] transition text-center min-h-[52px] flex flex-col items-center justify-center gap-0.5"
      style={{ borderColor: "#E0DCC4", color: "#3D4F35", background: "white" }}>
      <span className="text-base leading-none">{icon}</span>
      <span className="font-semibold leading-tight">{label}</span>
    </button>
  );
}

function ProgressTracker({ summary, onOpen }) {
  const s = summary || { uploaded: false, reviewed: false, resolved: false, count: 0 };
  const steps = [
    { key: "uploaded", label: "Uploaded" },
    { key: "reviewed", label: "Reviewed" },
    { key: "resolved", label: "Resolved" },
  ];
  const allDone = s.uploaded && s.reviewed && s.resolved;
  const lastLine = s.count > 0
    ? steps.map(st => `${s[st.key] ? "✓" : "○"} ${st.label}`).join(" · ")
    : "No reports yet";
  return (
    <button type="button" onClick={onOpen}
      className="text-left py-2 px-1.5 rounded-lg border hover:bg-[#F0EDE9] transition w-full min-h-[52px] flex flex-col justify-center"
      style={{ borderColor: allDone ? "#86EFAC" : "#E0DCC4", background: allDone ? "#F0FDF4" : "white" }}>
      <div className="text-[10px] sm:text-[11px] font-bold text-center leading-tight" style={{ color: "#3D4F35" }}>
        <span className="text-base">📊</span> Progress Report
      </div>
      <div className="text-[9px] text-center mt-0.5 leading-snug" style={{ color: "#5C6853" }}>
        {s.count > 0 ? `${s.count} report${s.count !== 1 ? "s" : ""} · Last: ${lastLine}` : lastLine}
      </div>
    </button>
  );
}

function LocationPanelModal({ client, onClose }) {
  const locs = client.locations || [];
  return (
    <ModalBase title="Location" subtitle={`${client.name} · File #${client.file_no || "—"}`} onClose={onClose} size="md"
      footer={<ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>}>
      {locs.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: "#8B9E7A" }}>No locations on file</div>
      ) : (
        <div className="space-y-3">
          {locs.map((l, i) => (
            <div key={i} className="p-3 rounded-xl border flex items-start gap-3" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
              <span className="pill text-[10px] py-0.5 px-2 shrink-0" style={{ background: l.service === "SS" ? "#E5EBE1" : "#EAF0F3", color: l.service === "SS" ? "#3D4F35" : "#375568" }}>{l.service}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "#2C3625" }}>{l.address || "—"}</div>
                {l.address && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`}
                    target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 underline" style={{ color: "#5C8A47" }}>
                    <MapPin size={12} /> Open in Maps ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalBase>
  );
}

function AttachmentsPanelModal({ client, isAdmin, onClose, onSaved }) {
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
  const fields = [
    { key: "intake_file_url", label: "Intake File", hint: "Google Drive link to the intake document" },
    { key: "attendance_sheet_url", label: "Attendance Sheet", hint: "Google Sheets URL in the client's Attendance Sheets folder" },
    { key: "progress_reports_url", label: "Progress Reports Folder", hint: "Drive folder link for Progress Reports" },
    { key: "case_summary_url", label: "Case Summary", hint: "Drive folder or document link" },
  ];
  return (
    <ModalBase title="Attachments" subtitle={`${client.name} · Google Drive links`} onClose={onClose} size="lg"
      footer={
        isAdmin ? (
          <>
            <ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>
            <ModalBtnPrimary data-testid="save-attachments-btn" type="button" onClick={saveAttachments} disabled={saving}>
              {saving ? <span className="spinner" /> : "Save Links"}
            </ModalBtnPrimary>
          </>
        ) : (
          <ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>
        )
      }>
      <div className="space-y-3">
        {fields.map(f => (
          <div key={f.key} className="p-3 rounded-xl border" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold" style={{ color: "#1C2617" }}>{f.label}</div>
              {att[f.key] && (
                <a href={att[f.key]} target="_blank" rel="noreferrer" className="text-[11px] underline flex items-center gap-1" style={{ color: "#5C8A47" }}>
                  Open in Drive ↗ <ArrowSquareOut size={12} />
                </a>
              )}
            </div>
            <div className="text-[10px] mb-2" style={{ color: "#9CA3AF" }}>{f.hint}</div>
            {isAdmin ? (
              <input data-testid={`att-${f.key}`} className="modal-input text-xs" placeholder="https://drive.google.com/..."
                value={att[f.key]} onChange={e => setAtt(s => ({ ...s, [f.key]: e.target.value }))} />
            ) : (
              <div className="text-xs truncate" style={{ color: att[f.key] ? "#1C2617" : "#9CA3AF" }}>{att[f.key] || "— not provided —"}</div>
            )}
          </div>
        ))}
      </div>
    </ModalBase>
  );
}

function CaseDetailsPanelModal({ client, therapists, isAdmin, onClose, onSaved }) {
  const findT = id => therapists.find(t => t.id === id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ...client,
    co_therapist_ids: client.co_therapist_ids || [],
    locations: client.locations || [],
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${client.id}`, form);
      setEditing(false);
      onSaved && onSaved();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const Field = ({ label, children }) => (
    <>
      <dt className="text-xs font-semibold pt-1" style={{ color: "#9CA3AF" }}>{label}</dt>
      <dd className="col-span-2 pb-2">{children}</dd>
    </>
  );

  return (
    <ModalBase title="Case Details" subtitle={`${client.name} · File #${client.file_no || "—"}`} onClose={onClose} size="lg"
      footer={
        editing ? (
          <>
            <ModalBtnSecondary type="button" onClick={() => { setEditing(false); setForm({ ...client, co_therapist_ids: client.co_therapist_ids || [], locations: client.locations || [] }); }}>Cancel</ModalBtnSecondary>
            <ModalBtnPrimary type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</ModalBtnPrimary>
          </>
        ) : (
          <>
            <ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>
            {isAdmin && <ModalBtnPrimary type="button" onClick={() => setEditing(true)}><PencilSimple size={14} className="inline mr-1" /> Edit</ModalBtnPrimary>}
          </>
        )
      }>
      {!editing ? (
        <dl className="grid grid-cols-3 gap-y-1 text-sm">
          <Field label="Full name"><span className="font-medium" style={{ color: "#1C2617" }}>{client.name}</span></Field>
          <Field label="File number"><span className="font-medium" style={{ color: "#1C2617" }}>{client.file_no || "—"}</span></Field>
          <Field label="Package hours"><span className="font-medium" style={{ color: "#1C2617" }}>{client.billing_mode === "weeks" ? `${client.cycle_weeks || 4}-week cycle` : `${client.package_hours || 24}h`}</span></Field>
          <Field label="Main therapist"><span className="font-medium" style={{ color: "#1C2617" }}>{findT(client.main_therapist_id)?.name || "—"}</span></Field>
          <Field label="Co-therapists"><span className="font-medium" style={{ color: "#1C2617" }}>{client.co_therapist_ids?.length ? client.co_therapist_ids.map(id => findT(id)?.name).filter(Boolean).join(", ") : "—"}</span></Field>
          <Field label="Supervisor"><span className="font-medium" style={{ color: "#1C2617" }}>{client.supervisor || "—"}</span></Field>
          <Field label="Service type"><span className="font-medium" style={{ color: "#1C2617" }}>{client.service_type || "—"}</span></Field>
          <Field label="Status"><span className="font-medium" style={{ color: "#1C2617" }}>{client.status || "Active"}</span></Field>
          <Field label="Age"><span className="font-medium" style={{ color: "#1C2617" }}>{client.age || "—"}</span></Field>
          <Field label="Locations">
            {client.locations?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {client.locations.map((loc, i) => (
                  <span key={i} className="pill text-[10px] px-2 py-1" style={{ background: "#F0E9D8", color: "#2C3625" }}>
                    <strong>{loc.service}</strong> · {loc.address}
                  </span>
                ))}
              </div>
            ) : "—"}
          </Field>
        </dl>
      ) : (
        <div className="space-y-4">
          <FormField label="Full name"><input className="modal-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="File number"><input className="modal-input" value={form.file_no || ""} onChange={e => setForm({ ...form, file_no: e.target.value })} /></FormField>
            <FormField label="Age"><input className="modal-input" value={form.age || ""} onChange={e => setForm({ ...form, age: e.target.value })} /></FormField>
            <FormField label="Package hours"><input type="number" className="modal-input" value={form.package_hours || 24} onChange={e => setForm({ ...form, package_hours: parseFloat(e.target.value) || 24 })} /></FormField>
            <FormField label="Service type">
              <select className="modal-input" value={form.service_type || ""} onChange={e => setForm({ ...form, service_type: e.target.value || null })}>
                <option value="">—</option>
                <option value="HS">HS</option><option value="SS">SS</option><option value="HS+SS">HS+SS</option><option value="AVC">AVC</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select className="modal-input" value={form.status || "Active"} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option><option value="Inactive">Inactive</option>
              </select>
            </FormField>
            <FormField label="Supervisor"><input className="modal-input" value={form.supervisor || ""} onChange={e => setForm({ ...form, supervisor: e.target.value })} /></FormField>
          </div>
          <FormField label="Main therapist">
            <select className="modal-input" value={form.main_therapist_id || ""} onChange={e => setForm({ ...form, main_therapist_id: e.target.value || null })}>
              <option value="">— None —</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </FormField>
          <FormField label="Co-therapists">
            <div className="flex flex-wrap gap-1.5">
              {therapists.map(t => {
                const sel = (form.co_therapist_ids || []).includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() => setForm({ ...form, co_therapist_ids: sel ? form.co_therapist_ids.filter(x => x !== t.id) : [...(form.co_therapist_ids || []), t.id] })}
                    className={`pill text-xs px-2 py-1 ${sel ? "bg-[#7A8A6A] text-white" : "bg-white border"}`}
                    style={!sel ? { borderColor: "#DDD8D0" } : undefined}>{t.name}</button>
                );
              })}
            </div>
          </FormField>
          <FormField label="Locations">
            <div className="space-y-2">
              {(form.locations || []).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select className="modal-input w-24 flex-shrink-0" value={l.service} onChange={e => { const ll = [...form.locations]; ll[i] = { ...ll[i], service: e.target.value }; setForm({ ...form, locations: ll }); }}>
                    <option value="HS">HS</option><option value="SS">SS</option><option value="OS">OS</option>
                  </select>
                  <input className="modal-input flex-1" placeholder="Address" value={l.address} onChange={e => { const ll = [...form.locations]; ll[i] = { ...ll[i], address: e.target.value }; setForm({ ...form, locations: ll }); }} />
                  <button type="button" onClick={() => setForm({ ...form, locations: form.locations.filter((_, j) => j !== i) })} className="btn btn-ghost p-2 text-red-700"><Trash size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, locations: [...(form.locations || []), { service: "HS", address: "" }] })} className="btn btn-outline text-xs"><Plus size={14} /> Add location</button>
            </div>
          </FormField>
        </div>
      )}
    </ModalBase>
  );
}

function ProgressReportPanelModal({ client, isAdmin, onClose }) {
  return (
    <ModalBase title="Progress Reports" subtitle={`${client.name} · File #${client.file_no || "—"}`} onClose={onClose} size="lg"
      footer={<ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>}>
      <ProgressReportsList clientId={client.id} fileNo={client.file_no} client={client} isAdmin={isAdmin} embedded />
    </ModalBase>
  );
}


const SUPERVISOR_CLIENTS = {
  msMaha:  ["035","037","038","040","041","042","047","052","054","060","063","065","070"],
  msFahda: ["009","011","018","023","024","027","030","034","061","062","068","072","079"],
};

function ProgressReportsList({ clientId, fileNo, client, isAdmin, embedded }) {
  const { user } = useAuth();
  const [items, setItems]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]  = useState(false);
  const [draft, setDraft]    = useState({ title: "", report_date: "", notes: "", url: "" });
  const [draftFile, setDraftFile] = useState(null);
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [busy, setBusy]      = useState(null);

  const isSupervisor = () => {
    if (hasOpsAccess(user)) return true;
    if (isAdmin) return true;
    if (!user) return false;
    const key = user.key || "";
    const fn = String(fileNo || "").padStart(3, "0");
    return (SUPERVISOR_CLIENTS[key] || []).includes(fn);
  };

  const isAssigned = () => {
    if (isAdmin) return true;
    if (!user || !client) return false;
    return client.main_therapist_id === user.id || (client.co_therapist_ids || []).includes(user.id);
  };

  const canAdd      = isAdmin || isSupervisor() || isAssigned();
  const canUploaded = isAdmin || isSupervisor() || isAssigned();
  const canReviewed = isAdmin || isSupervisor();
  const canResolved = isAdmin || isSupervisor();
  const canDeleteFile = isAdmin || isSupervisor() || isAssigned();
  const canEditLink   = canUploaded;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/clients/${clientId}/progress-reports`);
      setItems(data || []);
    } catch (_) { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const uploadFile = async (rid, file) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post(`/progress-reports/${rid}/file`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    await load();
  };

  const downloadFile = async (rid, fileName) => {
    const res = await api.get(`/progress-reports/${rid}/file`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "progress-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const deleteFile = async (rid) => {
    if (!window.confirm("Delete this file?")) return;
    setBusy(rid + "file");
    try {
      await api.delete(`/progress-reports/${rid}/file`);
      await load();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally { setBusy(null); }
  };

  const saveDriveLink = async (rid, url) => {
    setBusy(rid + "link");
    try {
      await api.put(`/progress-reports/${rid}/link`, { url: (url || "").trim() || null });
      setEditingLinkId(null);
      setLinkDraft("");
      await load();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally { setBusy(null); }
  };

  const addReport = async () => {
    if (!draft.title.trim()) { alert("Please enter a report title"); return; }
    setBusy("add");
    try {
      const { data } = await api.post(`/clients/${clientId}/progress-reports`, {
        ...draft, uploaded: false, reviewed: false, resolved: false,
      });
      if (draftFile && data?.id) {
        await uploadFile(data.id, draftFile);
      }
      setDraft({ title: "", report_date: "", notes: "", url: "" });
      setDraftFile(null);
      setAdding(false);
      await load();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally { setBusy(null); }
  };

  const toggleStep = async (rid, step, currentValue) => {
    setBusy(rid + step);
    try {
      await api.put(`/progress-reports/${rid}/steps`, {
        [step]: !currentValue,
        [`${step}_by`]: user?.name || user?.email || "User",
        [`${step}_at`]: new Date().toISOString(),
      });
      await load();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
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
      reviewed: { on: "#2563EB", bg: "#DBEAFE", border: "#93C5FD" },
      resolved: { on: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
    };
    const c = colors[step];
    const isBusy = busy === rid + step;
    return (
      <button
        disabled={!enabled || isBusy}
        onClick={() => enabled && toggleStep(rid, step, value)}
        title={value && by ? `${label} by ${by}${at ? " · " + new Date(at).toLocaleDateString() : ""}` : (enabled ? `Mark as ${label}` : `Only supervisors can mark ${label}`)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all"
        style={{
          background: value ? c.bg : "#F9F9F7",
          color: value ? c.on : "#9CA3AF",
          borderColor: value ? c.border : "#E5E7EB",
          cursor: enabled ? "pointer" : "default",
          opacity: (!enabled && !value) ? 0.45 : 1,
        }}
      >
        <span style={{ fontSize: 13 }}>{isBusy ? "…" : value ? "✓" : "○"}</span>
        {label}
      </button>
    );
  };

  return (
    <div className={embedded ? "" : "p-3 rounded-xl border mt-3"} style={embedded ? undefined : { borderColor: "#E8E4DE" }}>
      <div className="flex items-center justify-between mb-3">
        {!embedded && (
          <div>
            <div className="text-sm font-bold" style={{ color: "#2C3625" }}>Progress Reports</div>
            <div className="text-[10px]" style={{ color: "#8B9E7A" }}>
              {items.length} report{items.length !== 1 ? "s" : ""}
              {" · "}
              <span style={{ color: "#D97706" }}>Uploaded</span>
              {" → "}
              <span style={{ color: "#2563EB" }}>Reviewed</span>
              {" → "}
              <span style={{ color: "#16A34A" }}>Resolved</span>
            </div>
          </div>
        )}
        {embedded && (
          <div className="text-[10px] flex-1" style={{ color: "#8B9E7A" }}>
            {items.length} report{items.length !== 1 ? "s" : ""} · click steps to update status
          </div>
        )}
        {canAdd && !adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-bold transition hover:bg-[#F0EDE9]"
            style={{ borderColor: "#C4963A", color: "#C4963A", background: "#FBF3E2" }}>
            + Add Report
          </button>
        )}
      </div>

      {adding && (
        <div className="p-3 rounded-lg mb-3 space-y-2 border" style={{ background: "#FAFAF7", borderColor: "#E8E4DE" }}>
          <input className="input text-xs w-full" placeholder="Report title (e.g. Progress Report — Apr 2026)"
            value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <div className="flex gap-2 flex-wrap">
            <input type="date" className="input text-xs flex-1 min-w-[140px]"
              value={draft.report_date} onChange={e => setDraft({ ...draft, report_date: e.target.value })} />
            <label className="text-xs px-3 py-2 rounded-lg border cursor-pointer flex items-center gap-1" style={{ borderColor: "#C4D4B8", color: "#3D5C3A", background: "#F5FAF3" }}>
              📎 {draftFile ? draftFile.name : "Add File (optional)"}
              <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                onChange={e => setDraftFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <input className="input text-xs w-full" placeholder="Google Drive link — Word file for editing (optional)"
            value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} />
          <input className="input text-xs w-full" placeholder="Notes (optional)"
            value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setAdding(false); setDraft({ title: "", report_date: "", notes: "", url: "" }); setDraftFile(null); }}
              className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "#E8E4DE", color: "#6B7280" }}>
              Cancel
            </button>
            <button onClick={addReport} disabled={busy === "add"}
              className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background: "#3D5C3A", color: "white" }}>
              {busy === "add" ? "Saving…" : "Save Report"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-xs italic py-3 text-center" style={{ color: "#8B9E7A" }}>Loading…</div>}
      {!loading && items.length === 0 && (
        <div className="text-xs italic py-4 text-center" style={{ color: "#B8C0AC" }}>
          No progress reports yet
        </div>
      )}

      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} className="p-3 rounded-lg border" style={{ borderColor: "#E8E4DE", background: "white" }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs" style={{ color: "#2C3625" }}>{r.title}</div>
                <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: "#8B9E7A" }}>
                  {r.report_date && <span>📅 {r.report_date}</span>}
                  {r.notes && <span>· {r.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0 flex-wrap justify-end">
                {r.file_path || r.file_name ? (
                  <>
                    <button type="button" onClick={() => downloadFile(r.id, r.file_name)}
                      className="text-[10px] px-1.5 py-0.5 rounded border underline"
                      style={{ color: "#3D5C3A", borderColor: "#C4D4B8" }}>
                      📄 {r.file_name || "Download"}
                    </button>
                    {r.file_uploaded_at && (
                      <span className="text-[9px]" style={{ color: "#9CA3AF" }}>
                        {new Date(r.file_uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                    {canDeleteFile && (
                      <button type="button" onClick={() => deleteFile(r.id)} disabled={busy === r.id + "file"}
                        className="text-[10px] px-1 py-0.5 rounded" style={{ color: "#DC2626" }}>Delete file</button>
                    )}
                  </>
                ) : canUploaded ? (
                  <label className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer"
                    style={{ color: "#3D5C3A", borderColor: "#C4D4B8", background: "#F5FAF3" }}>
                    Add File
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setBusy(r.id + "up");
                        try { await uploadFile(r.id, f); }
                        catch (err) { alert("Upload failed: " + (err.response?.data?.detail || err.message)); }
                        finally { setBusy(null); e.target.value = ""; }
                      }} />
                  </label>
                ) : null}
                {(isAdmin || isSupervisor()) && (
                  <button onClick={() => removeReport(r.id)} disabled={busy === r.id}
                    className="text-[11px] px-1.5 py-0.5 rounded border ml-1"
                    style={{ color: "#DC2626", borderColor: "#FCA5A5", background: "#FEF2F2" }}>
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <StepBadge rid={r.id} step="uploaded" label="Uploaded"
                value={r.uploaded} enabled={canUploaded}
                by={r.uploaded_by} at={r.uploaded_at} />
              <StepBadge rid={r.id} step="reviewed" label="Reviewed"
                value={r.reviewed} enabled={canReviewed}
                by={r.reviewed_by} at={r.reviewed_at} />
              <StepBadge rid={r.id} step="resolved" label="Resolved"
                value={r.resolved} enabled={canResolved}
                by={r.resolved_by} at={r.resolved_at} />
            </div>

            <div className="mt-2 pt-2 border-t space-y-1.5" style={{ borderColor: "#F0EDE9" }}>
              <div className="text-[10px] font-bold" style={{ color: "#5C6853" }}>
                Word file (Drive link for editing)
              </div>
              {editingLinkId === r.id ? (
                <div className="flex gap-1.5 flex-wrap">
                  <input
                    className="input text-xs flex-1 min-w-[200px]"
                    placeholder="https://drive.google.com/file/d/..."
                    value={linkDraft}
                    onChange={e => setLinkDraft(e.target.value)}
                    autoFocus
                  />
                  <button type="button" onClick={() => saveDriveLink(r.id, linkDraft)} disabled={busy === r.id + "link"}
                    className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: "#3D5C3A", color: "white" }}>
                    {busy === r.id + "link" ? "…" : "Save"}
                  </button>
                  <button type="button" onClick={() => { setEditingLinkId(null); setLinkDraft(""); }}
                    className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: "#E8E4DE", color: "#6B7280" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer"
                      className="text-[10px] px-1.5 py-0.5 rounded border underline flex items-center gap-1"
                      style={{ color: "#3D5C3A", borderColor: "#C4D4B8" }}>
                      Open in Drive ↗ <ArrowSquareOut size={10} />
                    </a>
                  ) : (
                    <span className="text-[10px]" style={{ color: "#9CA3AF" }}>— no Drive link —</span>
                  )}
                  {canEditLink && (
                    <button type="button" onClick={() => { setEditingLinkId(r.id); setLinkDraft(r.url || ""); }}
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{ color: "#5C6853", borderColor: "#DDD8D0" }}>
                      {r.url ? "Edit link" : "Add link"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {(r.uploaded_by || r.reviewed_by || r.resolved_by) && (
              <div className="mt-2 text-[10px] space-y-0.5 pt-2 border-t" style={{ color: "#9CA3AF", borderColor: "#F0EDE9" }}>
                {r.uploaded_by && <div>📤 Uploaded by <strong>{r.uploaded_by}</strong></div>}
                {r.reviewed_by && <div>🔍 Reviewed by <strong>{r.reviewed_by}</strong></div>}
                {r.resolved_by && <div>✅ Resolved by <strong>{r.resolved_by}</strong></div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
