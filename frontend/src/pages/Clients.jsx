import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { cachedGet } from "../dataCache";
import { useAuth, showAdminNav, hasOpsAccess, hasFullClientAccess, isJenan } from "../auth";
import { Plus, MagnifyingGlass, MapPin, ArrowSquareOut, Trash, PencilSimple, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import ClientInfoLayout from "../components/ClientInfoLayout";
import ClientPickerSheet from "../components/ClientPickerSheet";
import "../clientInfoLayout.css";
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
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [panelClient, setPanelClient] = useState(null); // { client, section }
  const [pkgByClient, setPkgByClient] = useState({});
  const [pageReady, setPageReady] = useState(false);

  const closePanel = () => setPanelClient(null);

  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  const load = async () => {
    setPageReady(false);
    try {
      const [c, t] = await Promise.all([
        cachedGet("/clients"),
        cachedGet("/therapists").catch(() => []),
      ]);
      const clients = Array.isArray(c) ? c : [];
      setItems(clients);
      setTherapists(Array.isArray(t) ? t : []);
      setPanelClient((pc) => {
        if (!pc?.client?.id) return pc;
        const fresh = clients.find((x) => x.id === pc.client.id);
        return fresh ? { ...pc, client: fresh } : pc;
      });
    } finally {
      setPageReady(true);
    }
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

  if (!pageReady) {
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

function CaseSummaryView({ sections, clientName, fileNo }) {
  if (!sections?.length) {
    return (
      <div className="case-summary-sheet case-summary-sheet--empty">
        No case summary yet. Use <strong>Edit summary</strong> to add clinical notes here in the portal.
      </div>
    );
  }

  const renderTable = (table, key) => {
    if (!table?.length) return null;
    const headerRow = table[0] || [];
    const bodyRows = table.slice(1);
    const useHeader = headerRow.length > 1 && bodyRows.length > 0;
    return (
      <div key={key} className="case-summary-sheet__table-wrap">
        <table className="case-summary-sheet__table">
          {useHeader ? (
            <thead>
              <tr>
                {headerRow.map((cell, ci) => (
                  <th key={ci}>{cell}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {(useHeader ? bodyRows : table).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={!useHeader && ci === 0 ? "case-summary-sheet__label" : ""}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="case-summary-sheet">
      <div className="case-summary-sheet__masthead">
        <div className="case-summary-sheet__brand">
          <img src="/bg-logo.png" alt="" className="case-summary-sheet__logo" />
          <div>
            <div className="case-summary-sheet__brand-title">Boost Growth</div>
            <div className="case-summary-sheet__brand-sub">Case Summary</div>
          </div>
        </div>
        <div className="case-summary-sheet__meta">
          <div><span>Client</span><strong>{clientName || "—"}</strong></div>
          <div><span>File #</span><strong>{fileNo || "—"}</strong></div>
        </div>
      </div>

      {sections.map((sec, i) => (
        <div key={i} className="case-summary-sheet__section">
          {sec.heading && (
            <div className="case-summary-sheet__section-title">{sec.heading}</div>
          )}
          <div className="case-summary-sheet__section-body">
            {(sec.tables || []).map((table, ti) => renderTable(table, `${i}-${ti}`))}
            {(sec.paragraphs?.length > 0 || sec.bullets?.length > 0) && (
              <div className="case-summary-sheet__table-wrap">
                <table className="case-summary-sheet__table case-summary-sheet__table--kv">
                  <tbody>
                    {(sec.paragraphs || []).map((p, j) => {
                      const parts = String(p).split(/:\s*/, 2);
                      const isKv = parts.length === 2 && parts[0].length < 48;
                      return (
                        <tr key={`p-${j}`}>
                          {isKv ? (
                            <>
                              <td className="case-summary-sheet__label">{parts[0]}</td>
                              <td>{parts[1]}</td>
                            </>
                          ) : (
                            <td colSpan={2}>{p}</td>
                          )}
                        </tr>
                      );
                    })}
                    {(sec.bullets || []).map((b, j) => (
                      <tr key={`b-${j}`}>
                        <td className="case-summary-sheet__label">•</td>
                        <td>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
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
