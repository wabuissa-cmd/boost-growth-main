import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess, hasFullClientAccess } from "../auth";
import { Plus, MagnifyingGlass, MapPin, ArrowSquareOut, Trash, PencilSimple } from "@phosphor-icons/react";
import ClientInfoLayout from "../components/ClientInfoLayout";
import PageBanner from "../components/PageBanner";
import { enrichClientForCardView } from "../attendanceUtils";
import { getMapsHref, isMapsLink } from "../mapsUtils";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";

export default function Clients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = showAdminNav(user);
  const hasOps = hasOpsAccess(user);
  const canDeleteClient = hasFullClientAccess(user);
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("active");
  const [therapistFilter, setTherapistFilter] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [panelClient, setPanelClient] = useState(null); // { client, section }
  const [pkgByClient, setPkgByClient] = useState({});

  const closePanel = () => setPanelClient(null);

  const load = async () => {
    const [c, t] = await Promise.all([
      cachedGet("/clients"),
      cachedGet("/therapists").catch(() => []),
    ]);
    setItems(Array.isArray(c) ? c : []);
    setTherapists(Array.isArray(t) ? t : []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    cachedGet("/clients/package-status").then(rows => {
      const map = {};
      for (const row of rows || []) {
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
  const remove = async (client) => {
    if (!window.confirm(`Remove ${client.name} from the active list?\n\nThis is a soft delete — restore from Admin → Deleted Clients if needed.`)) return;
    await api.delete(`/clients/${client.id}`);
    if (selectedClientId === client.id) setSelectedClientId(null);
    load();
  };
  const findT = id => therapists.find(t => t.id === id);

  const activeCount = items.filter(c => (c.status || "Active") !== "Inactive").length;

  const packageRows = useMemo(
    () => Object.values(pkgByClient).flat(),
    [pkgByClient]
  );

  const enrichedClients = useMemo(
    () => items.map(c => enrichClientForCardView(c, packageRows)),
    [items, packageRows]
  );

  const filtered = enrichedClients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) || (c.file_no || "").includes(search);
    const isActive = (c.status || "Active") !== "Inactive";
    const matchTab = statusTab === "active" ? isActive : !isActive;
    const matchTherapist = !therapistFilter || c.main_therapist_id === therapistFilter;
    return matchSearch && matchTab && matchTherapist;
  });

  const attentionCount = enrichedClients.filter(c => {
    const rows = pkgByClient[c.id] || [];
    return rows.some(r => ["critical", "low"].includes(r.status));
  }).length;

  const layoutCounts = {
    all: items.length,
    active: activeCount,
    attention: attentionCount,
  };

  const selectedClient = filtered.find(c => c.id === selectedClientId) || filtered[0] || null;

  const openSection = (section) => {
    if (!selectedClient) return;
    setPanelClient({ client: selectedClient, section });
  };

  return (
    <div>
      <PageBanner
        title="Client Info"
        toolbar={(
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex rounded-lg border border-[#E2DDD4] p-0.5 bg-[#FAFAF7]">
              {["active", "inactive"].map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusTab(id)}
                  className={`pill px-2.5 py-1 text-[11px] font-semibold border-0 min-h-0 capitalize ${
                    statusTab === id ? "bg-[#7A8A6A] text-white" : "bg-transparent text-[#5C6853]"
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
            {isAdmin && (
              <select className="select text-[11px] min-h-0 h-7 py-0 max-w-[140px]" value={therapistFilter} onChange={e => setTherapistFilter(e.target.value)}>
                <option value="">All therapists</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.name?.replace("Ms. ", "")}</option>)}
              </select>
            )}
            <div className="relative flex-1 min-w-[120px] max-w-[200px]">
              <MagnifyingGlass size={13} className="absolute top-1/2 -translate-y-1/2 left-2" style={{color: "#8B9E7A"}}/>
              <input className="input pl-7 w-full text-[11px] min-h-0 h-7" placeholder="Search name or file #…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            {isAdmin && (
              <button data-testid="add-client-btn" onClick={() => setEdit({ name: "", file_no: "", package_hours: 24, color: "#A2C4C9", main_therapist_id: "", co_therapist_ids: [], locations: [] })} className="btn btn-primary text-[11px] px-2.5 py-1 min-h-0 ml-auto"><Plus size={14}/> New Child</button>
            )}
          </div>
        )}
      />

      <ClientInfoLayout
        clients={filtered}
        selectedId={selectedClientId}
        onSelect={setSelectedClientId}
        pkgByClient={pkgByClient}
        findTherapist={findT}
        counts={layoutCounts}
        isAdmin={isAdmin}
        hasOps={hasOps}
        canDeleteClient={canDeleteClient}
        onOpenSection={openSection}
        onEdit={(c) => setEdit({ ...c, co_therapist_ids: c.co_therapist_ids || [], locations: c.locations || [] })}
        onRemove={remove}
        onBilling={() => selectedClient && navigate(`/billing?client=${selectedClient.id}`)}
        onPhoneSave={async (client, phone) => {
          await api.put(`/clients/${client.id}`, { ...client, parent_phone: phone || null });
          await load();
        }}
      />

      {panelClient?.section === "location" && (
        <LocationPanelModal client={panelClient.client} onClose={closePanel} />
      )}
      {panelClient?.section === "attachments" && (
        <AttachmentsPanelModal client={panelClient.client} canSyncDrive={hasFullClientAccess(user)} onClose={closePanel} onRefresh={load} onSaved={() => { closePanel(); load(); }} />
      )}
      {panelClient?.section === "details" && (
        <CaseDetailsPanelModal client={panelClient.client} therapists={therapists} isAdmin={isAdmin}
          onClose={closePanel} onSaved={() => { closePanel(); load(); }} />
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
                  <input className="modal-input flex-1" placeholder="Address or Google Maps link" value={l.address} onChange={e => { const ll = [...edit.locations]; ll[i] = { ...ll[i], address: e.target.value }; setEdit({ ...edit, locations: ll }); }} />
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
                  <a href={getMapsHref(l.address)}
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

function AttachmentsPanelModal({ client, canSyncDrive, onClose, onSaved, onRefresh }) {
  const [att, setAtt] = useState({
    intake_file_url: client.intake_file_url || "",
    attendance_sheet_url: client.attendance_sheet_url || client.drive_url || "",
    case_summary_url: client.case_summary_url || "",
  });
  const [syncing, setSyncing] = useState(false);
  const [driveLinks, setDriveLinks] = useState(
    (client.drive_links || []).filter(l => l.url && !/attendance/i.test(l.title || ""))
  );
  const [saving, setSaving] = useState(false);

  const syncFromDrive = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post(`/clients/${client.id}/sync-drive-links`);
      setDriveLinks((data.links || []).filter(l => l.url && !/attendance/i.test(l.title || "")));
      if (data.case_summary_url) setAtt(s => ({ ...s, case_summary_url: data.case_summary_url }));
      if (data.intake_file_url) setAtt(s => ({ ...s, intake_file_url: data.intake_file_url }));
      onRefresh && onRefresh();
      const note = data.message || (data.parent_phone ? `Parent phone: ${data.parent_phone}` : "Sync complete — no phone found in Drive files");
      alert(note);
    } catch (e) {
      alert("Drive sync failed: " + (e.response?.data?.detail || e.message));
    } finally { setSyncing(false); }
  };

  const saveAttachments = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${client.id}`, { ...client, ...att, drive_links: driveLinks });
      onSaved && onSaved();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const manualFields = [
    { key: "intake_file_url", label: "Intake File", hint: "Google Drive link to the intake document" },
    { key: "case_summary_url", label: "Case Summary", hint: "Google Doc link for case summary" },
  ];

  const kindLabel = (kind) => {
    if (kind === "doc") return "Document";
    if (kind === "sheet") return "Spreadsheet";
    if (kind === "folder") return "Folder";
    if (kind === "file") return "File";
    return "Link";
  };

  return (
    <ModalBase title="Records & Files" subtitle={`${client.name} · Google Drive links`} onClose={onClose} size="lg"
      footer={
        <>
          <ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>
          {canSyncDrive && (
            <ModalBtnSecondary type="button" onClick={syncFromDrive} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync from Drive"}
            </ModalBtnSecondary>
          )}
          {canSyncDrive ? (
            <ModalBtnPrimary data-testid="save-attachments-btn" type="button" onClick={saveAttachments} disabled={saving}>
              {saving ? <span className="spinner" /> : "Save Links"}
            </ModalBtnPrimary>
          ) : null}
        </>
      }>
      <div className="space-y-4">
        {driveLinks.length > 0 && (
          <div>
            <div className="text-xs font-bold mb-2 tracking-wide" style={{ color: "#8B9E7A" }}>KEY DOCUMENTS</div>
            <div className="space-y-2">
              {driveLinks.filter(l => l.group !== "photos").map((link, i) => (
                <div key={i} className="p-3 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: "#1C2617" }}>{link.title}</div>
                    <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{kindLabel(link.kind)}</div>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-[11px] underline shrink-0 flex items-center gap-1" style={{ color: "#5C8A47" }}>
                    Open ↗ <ArrowSquareOut size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {driveLinks.some(l => l.group === "photos") && (
          <div>
            <div className="text-xs font-bold mb-2 tracking-wide" style={{ color: "#8B9E7A" }}>ATTACHED PHOTOS</div>
            <div className="space-y-2">
              {driveLinks.filter(l => l.group === "photos").map((link, i) => (
                <div key={i} className="p-3 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: "#E5EBE1", background: "#F5FAF3" }}>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: "#1C2617" }}>{link.title}</div>
                    <div className="text-[10px]" style={{ color: "#6B8270" }}>Open folder — individual photos are not listed here</div>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-[11px] underline shrink-0 flex items-center gap-1" style={{ color: "#5C8A47" }}>
                    Open folder ↗ <ArrowSquareOut size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {driveLinks.length === 0 && (
          <div className="text-sm py-4 text-center rounded-xl border" style={{ color: "#8B9E7A", borderColor: "#EDE9E3", background: "#FAFAF7" }}>
            No Drive links synced yet.{canSyncDrive ? " Use Sync from Drive to pull links from the child's folder." : ""}
          </div>
        )}

        {canSyncDrive && manualFields.map(f => (
          <div key={f.key} className="p-3 rounded-xl border" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold" style={{ color: "#1C2617" }}>{f.label}</div>
              {att[f.key] && (
                <a href={att[f.key]} target="_blank" rel="noreferrer" className="text-[11px] underline flex items-center gap-1" style={{ color: "#5C8A47" }}>
                  Open ↗ <ArrowSquareOut size={12} />
                </a>
              )}
            </div>
            <div className="text-[10px] mb-2" style={{ color: "#9CA3AF" }}>{f.hint}</div>
            <input data-testid={`att-${f.key}`} className="modal-input text-xs" placeholder="https://drive.google.com/..."
              value={att[f.key]} onChange={e => setAtt(s => ({ ...s, [f.key]: e.target.value }))} />
          </div>
        ))}

        {!canSyncDrive && manualFields.map(f => att[f.key] && (
          <div key={f.key} className="p-3 rounded-xl border" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
            <div className="text-sm font-bold mb-1" style={{ color: "#1C2617" }}>{f.label}</div>
            <a href={att[f.key]} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: "#5C8A47" }}>{att[f.key]}</a>
          </div>
        ))}
      </div>
    </ModalBase>
  );
}

function CaseSummaryView({ sections, url }) {
  if (!sections?.length) {
    return (
      <div className="text-sm py-6 text-center rounded-xl border" style={{ color: "#8B9E7A", borderColor: "#EDE9E3", background: "#FAFAF7" }}>
        No case summary content yet.{url ? " Open the linked document or sync from Drive." : " Add a Case Summary link in Records & Files."}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline" style={{ color: "#5C8A47" }}>
          Open source document ↗ <ArrowSquareOut size={12} />
        </a>
      )}
      {sections.map((sec, i) => (
        <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2DDD4" }}>
          <div className="px-4 py-2 text-xs font-bold tracking-wide" style={{ background: "#EDF4E8", color: "#2C5035" }}>
            {sec.heading || "Section"}
          </div>
          <div className="px-4 py-3 space-y-2 text-sm" style={{ background: "#FAFAF7", color: "#2C3625" }}>
            {(sec.paragraphs || []).map((p, j) => (
              <p key={j} className="leading-relaxed">{p}</p>
            ))}
            {(sec.bullets || []).length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {sec.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            )}
            {(sec.tables || []).map((table, ti) => (
              <div key={ti} className="overflow-x-auto rounded-lg border" style={{ borderColor: "#E2DDD4" }}>
                <table className="w-full text-xs">
                  <tbody>
                    {table.map((row, ri) => (
                      <tr key={ri} style={{ background: ri === 0 ? "#E5EBE1" : "white" }}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 border-b" style={{ borderColor: "#EDE9E3", fontWeight: ri === 0 ? 700 : 400 }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState({
    sections: client.case_summary_sections?.sections || [],
    url: client.case_summary_url || null,
  });

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    api.get(`/clients/${client.id}/case-summary`, { params: { refresh: true } })
      .then(r => { if (!cancelled) setSummary({ sections: r.data?.sections || [], url: r.data?.url || client.case_summary_url }); })
      .catch(() => { if (!cancelled) setSummary({ sections: client.case_summary_sections?.sections || [], url: client.case_summary_url }); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [client.id, client.case_summary_url, client.case_summary_sections]);

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
    <ModalBase title="Case Summary" subtitle={`${client.name} · File #${client.file_no || "—"}`} onClose={onClose} size="lg"
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
        <div className="space-y-6">
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
                    <span key={i} className="pill text-[10px] px-2 py-1 inline-flex items-center gap-1" style={{ background: "#F0E9D8", color: "#2C3625" }}>
                      <strong>{loc.service}</strong>
                      {isMapsLink(loc.address) ? (
                        <a href={getMapsHref(loc.address)} target="_blank" rel="noreferrer" className="underline" style={{ color: "#5C8A47" }}>Maps ↗</a>
                      ) : (
                        <> · {loc.address}</>
                      )}
                    </span>
                  ))}
                </div>
              ) : "—"}
            </Field>
          </dl>

          <div>
            <div className="text-xs font-bold mb-3 tracking-wide" style={{ color: "#8B9E7A" }}>CASE SUMMARY</div>
            {summaryLoading ? (
              <div className="text-sm italic py-4 text-center" style={{ color: "#8B9E7A" }}>Loading case summary…</div>
            ) : (
              <CaseSummaryView sections={summary.sections} url={summary.url} />
            )}
          </div>
        </div>
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
                  <input className="modal-input flex-1" placeholder="Address or Google Maps link" value={l.address} onChange={e => { const ll = [...form.locations]; ll[i] = { ...ll[i], address: e.target.value }; setForm({ ...form, locations: ll }); }} />
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
