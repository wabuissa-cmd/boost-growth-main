import { useState, useRef } from "react";
import { X, FloppyDisk, ArrowSquareOut, Trash, UploadSimple, Link as LinkIcon } from "@phosphor-icons/react";
import api from "../api";
import { ModalBtnPrimary, ModalBtnSecondary } from "./Modal";

function kindLabel(kind) {
  if (kind === "doc") return "Document";
  if (kind === "sheet") return "Spreadsheet";
  if (kind === "folder") return "Folder";
  if (kind === "file") return "File";
  return "Link";
}

export default function ClientRecordsPanel({
  client,
  canEdit,
  canSyncDrive,
  onClose,
  onSaved,
  onRefresh,
}) {
  const [driveLinks, setDriveLinks] = useState(
    (client.drive_links || []).filter((l) => l.url && !/attendance/i.test(l.title || ""))
  );
  const [recordFiles, setRecordFiles] = useState(client.record_files || []);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const syncFromDrive = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post(`/clients/${client.id}/sync-drive-links`);
      setDriveLinks((data.links || []).filter((l) => l.url && !/attendance/i.test(l.title || "")));
      await onRefresh?.();
      alert(data.message || "Drive sync complete");
    } catch (e) {
      alert("Drive sync failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSyncing(false);
    }
  };

  const saveRecords = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${client.id}`, {
        name: client.name,
        drive_links: driveLinks,
        record_files: recordFiles,
      });
      onSaved?.();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const addCustomLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    setDriveLinks((links) => [
      ...links,
      { title: newLinkTitle.trim() || url, url, kind: "link", group: "custom" },
    ]);
    setNewLinkTitle("");
    setNewLinkUrl("");
  };

  const removeLink = (index) => {
    setDriveLinks((links) => links.filter((_, i) => i !== index));
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (uploadTitle.trim()) form.append("title", uploadTitle.trim());
      const { data } = await api.post(`/clients/${client.id}/records/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRecordFiles((files) => [...files, data]);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onRefresh?.();
    } catch (e) {
      alert("Upload failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const removeRecordFile = (fid) => {
    setRecordFiles((files) => files.filter((f) => f.id !== fid));
  };

  const docLinks = driveLinks
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => link.group !== "photos");
  const photoLinks = driveLinks.filter((l) => l.group === "photos");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 no-print" onClick={onClose} aria-hidden />
      <aside
        className="client-records-panel fixed top-0 right-0 z-50 h-[100dvh] w-full max-w-[440px] flex flex-col shadow-2xl no-print"
        style={{ background: "#FFFFFF", borderLeft: "1px solid #EDE9E3" }}
      >
        <div className="px-5 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight" style={{ color: "#1C2617" }}>
                Records &amp; Files
              </h2>
              <p className="text-xs mt-1" style={{ color: "#8B9E7A" }}>
                {client.name} · File #{client.file_no || "—"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white transition" style={{ color: "#9CA3AF" }}>
              <X size={22} weight="bold" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {docLinks.length > 0 && (
            <div className="log-session-card">
              <div className="log-session-label">Key documents</div>
              <div className="space-y-2">
                {docLinks.map(({ link, index }) => (
                  <div
                    key={`${link.url}-${index}`}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border"
                    style={{ borderColor: "#EDE9E3", background: "#FFFFFF" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate" style={{ color: "#1C2617" }}>{link.title}</div>
                      <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{kindLabel(link.kind)}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-[#F5F5F0]" style={{ color: "#5C8A47" }} title="Open">
                        <ArrowSquareOut size={16} />
                      </a>
                      {canEdit && link.group === "custom" && (
                        <button type="button" onClick={() => removeLink(index)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Remove">
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {photoLinks.length > 0 && (
            <div className="log-session-card">
              <div className="log-session-label">Attached photos</div>
              <div className="space-y-2">
                {photoLinks.map((link, i) => (
                  <div key={`photo-${i}`} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: "#E5EBE1", background: "#F5FAF3" }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "#1C2617" }}>{link.title}</div>
                      <div className="text-[10px]" style={{ color: "#6B8270" }}>Open folder in Drive</div>
                    </div>
                    <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 shrink-0" style={{ color: "#5C8A47" }}>
                      <ArrowSquareOut size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {driveLinks.length === 0 && (
            <div className="log-session-card text-center text-sm py-4" style={{ color: "#8B9E7A" }}>
              No Drive links yet.{canSyncDrive ? " Use Sync from Drive below." : ""}
            </div>
          )}

          {canEdit && (
            <div className="log-session-card">
              <div className="log-session-label">Add custom link</div>
              <div className="space-y-2">
                <input
                  className="modal-input log-session-input"
                  placeholder="Link title"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                />
                <input
                  className="modal-input log-session-input"
                  placeholder="https://…"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                />
                <button type="button" className="log-session-add-co-btn w-full justify-center" onClick={addCustomLink} disabled={!newLinkUrl.trim()}>
                  <LinkIcon size={14} /> Add link
                </button>
              </div>
            </div>
          )}

          <div className="log-session-card">
            <div className="log-session-label">Uploaded session files</div>
            {recordFiles.length === 0 ? (
              <p className="text-xs m-0" style={{ color: "#8B9E7A" }}>No files uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {recordFiles.map((rf) => (
                  <div key={rf.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: "#EDE9E3", background: "#FFFFFF" }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate" style={{ color: "#1C2617" }}>{rf.title || rf.file_name}</div>
                      <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{rf.file_name}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/api/clients/${client.id}/records/${rf.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg hover:bg-[#F5F5F0]"
                        style={{ color: "#5C8A47" }}
                        title="Download"
                      >
                        <ArrowSquareOut size={16} />
                      </a>
                      {canEdit && (
                        <button type="button" onClick={() => removeRecordFile(rf.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Remove">
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "#EDE9E3" }}>
                <input
                  className="modal-input log-session-input log-session-input-sm"
                  placeholder="File title (optional)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => uploadFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="log-session-add-co-btn w-full justify-center"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadSimple size={14} /> {uploading ? "Uploading…" : "Upload session file"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-4 border-t flex gap-2 flex-shrink-0 flex-wrap" style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}>
          <ModalBtnSecondary type="button" className="flex-1 log-session-btn-secondary" onClick={onClose}>Close</ModalBtnSecondary>
          {canSyncDrive && (
            <ModalBtnSecondary type="button" className="flex-1" onClick={syncFromDrive} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync Drive"}
            </ModalBtnSecondary>
          )}
          {canEdit && (
            <ModalBtnPrimary type="button" className="flex-1 log-session-btn-primary" data-testid="save-attachments-btn" onClick={saveRecords} disabled={saving}>
              <FloppyDisk size={16} className="inline mr-1" />
              {saving ? "Saving…" : "Save"}
            </ModalBtnPrimary>
          )}
        </div>
      </aside>
    </>
  );
}
