import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { cachedGet, peekCache } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess, hasFullClientAccess, isJenan } from "../auth";
import { Plus, MagnifyingGlass, ArrowSquareOut, Trash, PencilSimple, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import ClientInfoLayout from "../components/ClientInfoLayout";
import ClientPickerSheet from "../components/ClientPickerSheet";
import "../clientInfoLayout.css";
import { enrichClientForCardView } from "../attendanceUtils";
import { getTherapistScheduleName } from "../scheduleConstants";
import LocationList from "../components/LocationList";
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
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [panelClient, setPanelClient] = useState(null); // { client, section }
  const [pkgByClient, setPkgByClient] = useState({});
  const [pageReady, setPageReady] = useState(false);

  const closePanel = () => setPanelClient(null);

  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  const load = async ({ background = false } = {}) => {
    if (!background) setPageReady(false);
    try {
      const [c, t] = await Promise.all([
        cachedGet("/clients").catch(() => peekCache("/clients") || []),
        cachedGet("/therapists").catch(() => peekCache("/therapists") || []),
      ]);
      const clients = Array.isArray(c) ? c : [];
      setItems(clients);
      setTherapists(Array.isArray(t) ? t : []);
      setPanelClient((pc) => {
        if (!pc?.client?.id) return pc;
        const fresh = clients.find((x) => x.id === pc.client.id);
        return fresh ? { ...pc, client: fresh } : pc;
      });
    } catch {
      const stale = peekCache("/clients");
      if (Array.isArray(stale) && stale.length) setItems(stale);
    } finally {
      setPageReady(true);
    }
  };

  useEffect(() => {
    const staleClients = peekCache("/clients");
    const staleTherapists = peekCache("/therapists");
    if (Array.isArray(staleClients) && staleClients.length) {
      setItems(staleClients);
      setPageReady(true);
    }
    if (Array.isArray(staleTherapists)) setTherapists(staleTherapists);
    load({ background: Boolean(staleClients?.length) });
  }, []);

  useEffect(() => {
    const stale = peekCache("/clients/package-status");
    if (Array.isArray(stale) && stale.length) {
      const map = {};
      for (const row of stale) {
        if (!map[row.client_id]) map[row.client_id] = [];
        map[row.client_id].push(row);
      }
      setPkgByClient(map);
    }
    cachedGet("/clients/package-status")
      .then(rows => {
        const map = {};
        for (const row of rows || []) {
          if (!map[row.client_id]) map[row.client_id] = [];
          map[row.client_id].push(row);
        }
        setPkgByClient(map);
      })
      .catch(() => {});
  }, []);

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

  const filteredRaw = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(c => {
    const matchSearch = (c.name || "").toLowerCase().includes(q) || (c.file_no || "").includes(search);
      const isActive = (c.status || "Active") !== "Inactive";
      const matchTab = statusTab === "active" ? isActive : !isActive;
      return matchSearch && matchTab;
    });
  }, [items, search, statusTab]);

  const enrichedClients = useMemo(
    () => filteredRaw.map(c => enrichClientForCardView(c, packageRows)),
    [filteredRaw, packageRows]
  );

  const filtered = enrichedClients;

  const attentionCount = useMemo(() => items.filter(c => {
    const rows = pkgByClient[c.id] || [];
    return rows.some(r => ["critical", "low"].includes(r.status));
  }).length, [items, pkgByClient]);

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

  if (!pageReady && !items.length) {
    return (
      <div className="card p-12 text-center">
        <div className="spinner mx-auto" />
        <p className="text-sm mt-3" style={{ color: "#8B9E7A" }}>Loading clients…</p>
      </div>
    );
  }

  return (
    <div>
      <section className="client-info-strip">
        <div className="client-info-strip__head">
          <h1 className="client-info-strip__title">Client Info</h1>
          <nav className="client-info-strip__tabs" aria-label="Client status">
            {[
              { id: "active", label: "Active", count: activeCount },
              { id: "inactive", label: "Inactive", count: items.length - activeCount },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`client-info-strip__tab${statusTab === t.id ? " is-active" : ""}`}
                onClick={() => setStatusTab(t.id)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </nav>
        </div>
        <div className="client-info-strip__tools">
          {isAdmin && (
            <button
              type="button"
              data-testid="add-client-btn"
              onClick={() => setEdit({ name: "", file_no: "", package_hours: 24, color: "#A2C4C9", main_therapist_id: "", co_therapist_ids: [], locations: [] })}
              className="client-info-tool"
            >
              <Plus size={16} weight="duotone" />
              <span>New Child</span>
            </button>
          )}
          <button
            type="button"
            data-testid="all-clients-btn"
            className="client-info-tool"
            onClick={() => setClientPickerOpen(true)}
          >
            <UsersThree size={16} weight="duotone" />
            <span>{selectedClient ? selectedClient.name : "All Clients"}</span>
          </button>
          <label className="client-info-tool client-info-tool--search">
            <MagnifyingGlass size={15} weight="duotone" />
            <input
              className="client-info-tool__input"
              placeholder="Search name or file #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
        </div>
      </section>

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

      <ClientPickerSheet
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        clients={filtered}
        selectedId={selectedClient?.id}
        onSelect={setSelectedClientId}
        findTherapist={findT}
      />

      {panelClient?.section === "location" && (
        <LocationPanelModal client={panelClient.client} onClose={closePanel} />
      )}
      {panelClient?.section === "attachments" && (
        <AttachmentsPanelModal client={panelClient.client} canSyncDrive={hasFullClientAccess(user)} onClose={closePanel} onRefresh={load} onSaved={() => { closePanel(); load(); }} />
      )}
      {panelClient?.section === "details" && (
        <CaseDetailsPanelModal client={panelClient.client} therapists={therapists} user={user} isAdmin={isAdmin}
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
                {therapists.map(t => <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>)}
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
                      {getTherapistScheduleName(t)}
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
  return (
    <ModalBase title="Locations" subtitle={`${client.name} · File #${client.file_no || "—"}`} onClose={onClose} size="md"
      footer={<ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>}>
      <LocationList locations={client.locations || []} />
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
      await onRefresh?.();
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
          <ModalBtnSecondary type="button" className="records-modal-btn" onClick={onClose}>Close</ModalBtnSecondary>
          {canSyncDrive && (
            <ModalBtnSecondary type="button" className="records-modal-btn" onClick={syncFromDrive} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync from Drive"}
            </ModalBtnSecondary>
          )}
          {canSyncDrive ? (
            <ModalBtnPrimary data-testid="save-attachments-btn" className="records-modal-btn" type="button" onClick={saveAttachments} disabled={saving}>
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

function sectionsToEditableText(sections) {
  const parts = [];
  for (const sec of sections || []) {
    if (sec.heading && sec.heading !== "Overview") parts.push(sec.heading);
    for (const p of sec.paragraphs || []) parts.push(p);
    for (const b of sec.bullets || []) parts.push(`• ${b}`);
    for (const table of sec.tables || []) {
      for (const row of table) parts.push(row.join("\t"));
    }
    if (parts.length) parts.push("");
  }
  return parts.join("\n").trim();
}

function isMostlyArabic(text) {
  const sample = String(text || "");
  const ar = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (sample.match(/[a-zA-Z\u0600-\u06FF]/g) || []).length;
  return letters > 0 && ar / letters > 0.35;
}

function isLongParagraph(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return t.length > 90 || t.split(/\s+/).length > 16 || /[.!?؟]\s/.test(t);
}

const CHILD_NAME_LABEL_RE = /^(اسم\s*(?:الطفل|الطالب)|child(?:'s)?\s*name|student\s*name|name|الاسم)$/i;
const FILE_NO_LABEL_RE = /^(?:رقم\s*الملف|file\s*#?|file\s*no\.?)$/i;
const PARENT_NAME_LABEL_RE = /parent|guardian|ولي|الأم|الأب|mother|father/i;

function isChildNameLabel(text) {
  const t = String(text || "").trim();
  if (!t || FILE_NO_LABEL_RE.test(t) || PARENT_NAME_LABEL_RE.test(t)) return false;
  return CHILD_NAME_LABEL_RE.test(t);
}

function isFileNumberLike(text, fileNo) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (fileNo && t.replace(/^#/, "") === String(fileNo).trim().replace(/^#/, "")) return true;
  return /^#?\d{1,4}$/.test(t);
}

function resolveChildNameValue(label, value, clientName, fileNo) {
  if (!isChildNameLabel(label)) return value;
  const v = String(value || "").trim();
  const canonical = String(clientName || "").trim();
  if (!v || isFileNumberLike(v, fileNo)) return canonical || "—";
  if (canonical && (isFileNumberLike(v, fileNo) || (v.length <= 4 && v.toLowerCase() !== canonical.toLowerCase()))) {
    return canonical;
  }
  return v || canonical || "—";
}

function looksLikeLabel(text) {
  const t = String(text || "").trim();
  if (!t || isLongParagraph(t)) return false;
  if (/[:：]\s*$/.test(t)) return true;
  const hasArabic = /[\u0600-\u06FF]/.test(t);
  if (hasArabic) {
    return t.length <= 72 && t.split(/\s+/).length <= 10 && !/[.!]\s/.test(t);
  }
  return t.length <= 48 && !/[.!?؟]/.test(t);
}

function splitLabelValueCell(text, ctx = {}) {
  const t = String(text || "").trim();
  const parts = t.split(/[:：]\s*/, 2);
  if (parts.length === 2 && parts[0].length > 0 && parts[0].length <= 72 && !isLongParagraph(parts[1])) {
    return resolveLabelValuePair(parts[0].trim(), parts[1].trim(), ctx);
  }
  return null;
}

/** Pick label vs value regardless of source order (fixes reversed Arabic sheet rows). */
function resolveLabelValuePair(a, b, ctx = {}) {
  const { clientName, fileNo } = ctx;
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  const leftIsChildName = isChildNameLabel(left);
  const rightIsChildName = isChildNameLabel(right);
  const leftIsFileNo = FILE_NO_LABEL_RE.test(left) || isFileNumberLike(left, fileNo);
  const rightIsFileNo = FILE_NO_LABEL_RE.test(right) || isFileNumberLike(right, fileNo);

  if (leftIsChildName && rightIsFileNo) {
    return { label: left, value: resolveChildNameValue(left, "", clientName, fileNo) };
  }
  if (rightIsChildName && leftIsFileNo) {
    return { label: right, value: resolveChildNameValue(right, "", clientName, fileNo) };
  }
  if (rightIsChildName && !leftIsChildName && !looksLikeLabel(left)) {
    return { label: right, value: resolveChildNameValue(right, left, clientName, fileNo) };
  }
  if (leftIsChildName && !rightIsChildName && !looksLikeLabel(right)) {
    return { label: left, value: resolveChildNameValue(left, right, clientName, fileNo) };
  }

  const leftIsLabel = looksLikeLabel(left);
  const rightIsLabel = looksLikeLabel(right);
  let pair;
  if (leftIsLabel && !rightIsLabel) pair = { label: left, value: right };
  else if (rightIsLabel && !leftIsLabel) pair = { label: right, value: left };
  else if (leftIsLabel && rightIsLabel) pair = { label: left, value: right };
  else pair = { label: left, value: right };

  if (isChildNameLabel(pair.label)) {
    pair.value = resolveChildNameValue(pair.label, pair.value, clientName, fileNo);
  }
  return pair;
}

function resolveKvFromCells(cells, ctx = {}) {
  const cleaned = (cells || []).map((c) => String(c ?? "").trim()).filter((c) => c && c !== "-");
  if (cleaned.length < 2) return null;
  const [first, second, ...rest] = cleaned;
  const tail = rest.length ? ` — ${rest.join(" — ")}` : "";
  const pair = resolveLabelValuePair(first, second, ctx);
  return { label: pair.label, value: `${pair.value}${tail}`.trim() };
}

const NARRATIVE_LABEL_RE = /ملخص|summary|goals?|objectives?|skills?|progress|تقرير|أهداف|مهارات|توصيات|خطة|interventions?|recommendations?/i;

function isBasicKvItem(item) {
  if (item?.kind !== "kv") return false;
  if (item.bullets?.length) return false;
  if (item.label === "•") return false;
  if (NARRATIVE_LABEL_RE.test(String(item.label || ""))) return false;
  const val = String(item.value || "");
  if (splitValueLines(val).length > 1) return false;
  if (isLongParagraph(val)) return false;
  return val.length <= 120;
}

function splitCaseSummaryRows(rows) {
  const basic = [];
  const narrative = [];
  let inBasic = true;
  for (const item of rows) {
    if (!inBasic) {
      narrative.push(item);
      continue;
    }
    if (item.kind === "section" || item.kind === "heading" || item.kind === "para") {
      inBasic = false;
      narrative.push(item);
      continue;
    }
    if (item.kind === "kv" && isBasicKvItem(item)) {
      basic.push(item);
      continue;
    }
    inBasic = false;
    narrative.push(item);
  }
  return { basic, narrative };
}

/** Normalize Doc vs Sheet table shapes into [[cell, ...], ...]. */
function normalizeSectionTables(tables) {
  if (!tables?.length) return [];
  if (Array.isArray(tables[0]?.[0])) return tables.flat();
  return tables;
}

/** Pair stacked single-column Excel rows into label | value rows. */
function pairTableRows(table, ctx = {}) {
  let rows = table || [];
  if (rows.length && typeof rows[0] === "string") rows = [rows];

  const flat = [];
  for (const row of rows) {
    const cells = (Array.isArray(row) ? row : [row])
      .map((c) => String(c ?? "").trim())
      .filter((c) => c && c !== "-");
    if (!cells.length) continue;
    if (cells.length >= 2) {
      const kv = resolveKvFromCells(cells, ctx);
      if (kv) flat.push({ kind: "kv", ...kv });
    } else {
      const split = splitLabelValueCell(cells[0], ctx);
      if (split) flat.push({ kind: "kv", label: split.label, value: split.value });
      else flat.push({ kind: "cell", text: cells[0] });
    }
  }

  const out = [];
  let i = 0;
  while (i < flat.length) {
    const cur = flat[i];
    if (cur.kind === "kv") {
      const fixed = resolveLabelValuePair(cur.label, cur.value, ctx);
      out.push({ ...cur, ...fixed });
      i += 1;
      continue;
    }
    const text = cur.text;
    const next = flat[i + 1];

    if (
      next?.kind === "cell"
      && !isLongParagraph(text)
      && !isLongParagraph(next.text)
      && text.length <= 80
      && next.text.length <= 240
      && (looksLikeLabel(text) || looksLikeLabel(next.text) || isChildNameLabel(text) || isChildNameLabel(next.text))
    ) {
      const pair = resolveLabelValuePair(text, next.text, ctx);
      out.push({ kind: "kv", ...pair });
      i += 2;
      continue;
    }
    if (isLongParagraph(text)) {
      out.push({ kind: "para", text });
      i += 1;
      continue;
    }
    if (next?.kind === "cell" && looksLikeLabel(next.text) && text.length <= 80 && !looksLikeLabel(text)) {
      out.push({ kind: "heading", text });
      i += 1;
      continue;
    }
    out.push({ kind: "para", text });
    i += 1;
  }
  return out;
}

function pairParagraphRows(paragraphs, ctx = {}) {
  const out = [];
  const items = paragraphs || [];
  let i = 0;
  while (i < items.length) {
    const text = String(items[i] || "").trim();
    const colon = text.split(/[:：]\s*/, 2);
    if (colon.length === 2 && colon[0].length < 48 && !isLongParagraph(colon[1])) {
      out.push({ kind: "kv", ...resolveLabelValuePair(colon[0], colon[1], ctx) });
      i += 1;
      continue;
    }
    const next = String(items[i + 1] || "").trim();
    if (
      next
      && !isLongParagraph(text)
      && !isLongParagraph(next)
      && text.length <= 80
      && next.length <= 240
      && (looksLikeLabel(text) || looksLikeLabel(next) || isChildNameLabel(text) || isChildNameLabel(next))
    ) {
      out.push({ kind: "kv", ...resolveLabelValuePair(text, next, ctx) });
      i += 2;
      continue;
    }
    if (isLongParagraph(text)) {
      out.push({ kind: "para", text });
    } else if (text) {
      out.push({ kind: "para", text });
    }
    i += 1;
  }
  return out;
}

function splitValueLines(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split(/\n+/)
    .flatMap((line) => {
      const t = line.trim();
      if (!t) return [];
      if (/^[•·▪◆\-–]\s/.test(t)) return [t.replace(/^[•·▪◆\-–]\s+/, "")];
      return [t];
    })
    .filter(Boolean);
}

function CaseSummaryValue({ value, bullets }) {
  const items = [];
  (bullets || []).forEach((b) => {
    const t = String(b || "").trim();
    if (t) items.push(t);
  });
  splitValueLines(value).forEach((line) => {
    if (!items.includes(line)) items.push(line);
  });
  if (items.length > 1) {
    return (
      <ul className="case-summary-pr__list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  if (items.length === 1) return <>{items[0]}</>;
  return <>{"—"}</>;
}

function fixChildNameKvRows(rows, clientName, fileNo) {
  return rows.map((item) => {
    if (item.kind !== "kv" || !isChildNameLabel(item.label)) return item;
    return {
      ...item,
      value: resolveChildNameValue(item.label, item.value, clientName, fileNo),
    };
  });
}

function buildCaseSummaryRows(sections, clientName, fileNo) {
  const ctx = { clientName, fileNo };
  const rows = [];
  const clientLabel = isMostlyArabic(clientName) ? "العميل" : "Client";
  const fileLabel = isMostlyArabic(clientName) ? "رقم الملف" : "File #";
  rows.push({ kind: "kv", label: clientLabel, value: clientName || "—", key: "meta-client" });
  rows.push({ kind: "kv", label: fileLabel, value: fileNo || "—", key: "meta-file" });

  sections.forEach((sec, si) => {
    if (sec.heading) rows.push({ kind: "section", text: sec.heading, key: `sec-${si}` });
    const tableRows = normalizeSectionTables(sec.tables);
    if (tableRows.length) {
      pairTableRows(tableRows, ctx).forEach((item, ri) => rows.push({ ...item, key: `t-${si}-${ri}` }));
    }
    pairParagraphRows(sec.paragraphs, ctx).forEach((item, ri) => rows.push({ ...item, key: `p-${si}-${ri}` }));
    const bullets = (sec.bullets || []).map((b) => String(b || "").trim()).filter(Boolean);
    if (bullets.length) {
      rows.push({ kind: "kv", label: "•", bullets, key: `b-${si}` });
    }
  });
  return fixChildNameKvRows(rows, clientName, fileNo);
}

function CaseSummaryView({ sections, clientName, fileNo }) {
  if (!sections?.length) {
    return (
      <div className="case-summary-sheet case-summary-sheet--empty">
        No case summary yet. Use <strong>Edit summary</strong> to add clinical notes here in the portal.
      </div>
    );
  }

  const allText = (sections || []).flatMap((sec) => [
    sec.heading,
    ...(sec.paragraphs || []),
    ...(sec.bullets || []),
    ...(sec.tables || []).flat(2),
  ]).join(" ");
  const rtl = isMostlyArabic(allText);
  const rows = buildCaseSummaryRows(sections, clientName, fileNo);
  const { basic, narrative } = splitCaseSummaryRows(rows);

  return (
    <div className={`case-summary-pr${rtl ? " case-summary-pr--rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      {basic.length > 0 && (
        <div className="case-summary-pr__scroll">
          <table className="case-summary-pr__table case-summary-pr__table--basic">
            <tbody>
              {basic.map((item, i) => (
                <tr key={item.key || `b-${i}`} className="case-summary-pr__kv-row">
                  <th scope="row" className="case-summary-pr__label">{item.label}</th>
                  <td className="case-summary-pr__value">
                    <CaseSummaryValue value={item.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {narrative.length > 0 && (
        <div className="case-summary-pr__body">
          {narrative.map((item, i) => {
            if (item.kind === "section" || item.kind === "heading") {
              return (
                <h4 key={item.key || `sec-${i}`} className="case-summary-pr__subtitle">
                  {item.text}
                </h4>
              );
            }
            if (item.kind === "para") {
              const colon = String(item.text || "").split(/[:：]\s*/, 2);
              if (colon.length === 2 && colon[0].length < 56 && !isLongParagraph(colon[1])) {
                const pair = resolveLabelValuePair(colon[0], colon[1], { clientName, fileNo });
                return (
                  <div key={item.key || `p-${i}`} className="case-summary-pr__block">
                    <div className="case-summary-pr__subtitle">{pair.label}</div>
                    <div className="case-summary-pr__content">
                      <CaseSummaryValue value={pair.value} />
                    </div>
                  </div>
                );
              }
              return (
                <p key={item.key || `p-${i}`} className="case-summary-pr__para">
                  {item.text}
                </p>
              );
            }
            return (
              <div key={item.key || `kv-${i}`} className="case-summary-pr__block">
                {item.label && item.label !== "•" && (
                  <div className="case-summary-pr__subtitle">{item.label}</div>
                )}
                <div className="case-summary-pr__content">
                  <CaseSummaryValue value={item.value} bullets={item.bullets} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CaseDetailsPanelModal({ client, therapists, user, isAdmin, onClose, onSaved }) {
  const userTid = user?.therapist_id || therapists.find(
    (t) => (t.email || "").toLowerCase() === (user?.email || "").toLowerCase()
  )?.id;
  const canEdit = isAdmin || hasFullClientAccess(user) || (
    userTid && (client.main_therapist_id === userTid || (client.co_therapist_ids || []).includes(userTid))
  );
  const canRemind = hasFullClientAccess(user) || isJenan(user) || isAdmin;
  const [editing, setEditing] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState({
    sections: client.case_summary_sections?.sections || [],
  });

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    api.get(`/clients/${client.id}/case-summary`)
      .then(r => { if (!cancelled) setSummary({ sections: r.data?.sections || [] }); })
      .catch(() => { if (!cancelled) setSummary({ sections: client.case_summary_sections?.sections || [] }); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [client.id, JSON.stringify(client.case_summary_sections)]);

  const saveSummary = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/clients/${client.id}/case-summary`, {
        case_summary_text: summaryText,
      });
      setSummary({ sections: r.data?.sections || [] });
      setEditing(false);
      onSaved && onSaved();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const sendReminder = async () => {
    if (!window.confirm(`Send a reminder email to the main therapist to update the case summary for ${client.name}?`)) return;
    setReminding(true);
    try {
      const r = await api.post(`/clients/${client.id}/case-summary/remind`);
      const status = r.data?.email_status || "queued";
      if (status === "sent") {
        alert(`Reminder sent to ${r.data?.to}`);
      } else {
        alert(`Reminder queued for ${r.data?.to} (status: ${status}${r.data?.error ? ` — ${r.data.error}` : ""})`);
      }
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally { setReminding(false); }
  };

  return (
    <ModalBase title="Case Summary" subtitle={`${client.name} · File #${client.file_no || "—"}`} onClose={onClose} size="lg"
      footer={
        editing ? (
          <>
            <ModalBtnSecondary type="button" onClick={() => { setEditing(false); }}>Cancel</ModalBtnSecondary>
            <ModalBtnPrimary type="button" onClick={saveSummary} disabled={saving}>{saving ? "Saving…" : "Save summary"}</ModalBtnPrimary>
          </>
        ) : (
          <>
            <ModalBtnSecondary type="button" onClick={onClose}>Close</ModalBtnSecondary>
            {canRemind && (
              <ModalBtnSecondary type="button" onClick={sendReminder} disabled={reminding}>
                <EnvelopeSimple size={14} className="inline mr-1" /> {reminding ? "Sending…" : "Remind specialist"}
              </ModalBtnSecondary>
            )}
            {canEdit && (
              <ModalBtnPrimary type="button" onClick={() => {
                setSummaryText(sectionsToEditableText(summary.sections));
                setEditing(true);
              }}>
                <PencilSimple size={14} className="inline mr-1" /> Edit summary
              </ModalBtnPrimary>
            )}
          </>
        )
      }>
      {!editing ? (
        summaryLoading ? (
          <div className="text-sm italic py-8 text-center" style={{ color: "#8B9E7A" }}>Loading case summary…</div>
        ) : (
          <CaseSummaryView
            sections={summary.sections}
            clientName={client.name}
            fileNo={client.file_no}
          />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs m-0" style={{ color: "#5C6853" }}>
            Edit the case summary directly here. Use headings (e.g. <strong>Diagnosis:</strong>), bullet lines starting with <strong>•</strong>, or tab-separated columns for tables — same layout as the Excel sheet.
          </p>
          <textarea
            className="modal-input font-sans text-sm leading-relaxed"
            rows={16}
            value={summaryText}
            onChange={e => setSummaryText(e.target.value)}
            placeholder={"Diagnosis:\nAutism Spectrum Disorder\n\nGoals:\n• Improve communication\n• Reduce challenging behavior"}
            style={{ direction: "rtl" }}
          />
        </div>
      )}
    </ModalBase>
  );
}
