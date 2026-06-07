import { useState } from "react";
import api from "../api";
import { Megaphone, PaperPlaneTilt, PencilSimple, Trash, Check, X } from "@phosphor-icons/react";

export default function PlatformUpdates({ items = [], canPost = false, onPosted }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");

  const post = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.post("/center-updates", { title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      onPosted?.();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditTitle(u.title || "");
    setEditBody(u.body || "");
    setEditDate(u.date || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
    setEditDate("");
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editingId) return;
    setSaving(true);
    try {
      await api.put(`/center-updates/${editingId}`, {
        title: editTitle.trim(),
        body: editBody.trim(),
        date: editDate || undefined,
      });
      cancelEdit();
      onPosted?.();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this platform update?")) return;
    setSaving(true);
    try {
      await api.delete(`/center-updates/${id}`);
      if (editingId === id) cancelEdit();
      onPosted?.();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="updates-panel" data-testid="platform-updates">
      <div className="updates-panel-title">
        <Megaphone size={18} weight="duotone" style={{ color: "#D4A64A" }} />
        Platform Updates
      </div>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "#8B9E7A" }}>No updates posted yet.</p>
      ) : (
        items.slice(0, 6).map(u => (
          <div key={u.id} className="update-item">
            {editingId === u.id ? (
              <div className="space-y-2">
                <input className="input text-xs py-1.5" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                <input className="input text-xs py-1.5" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                <textarea className="input text-xs py-1.5 min-h-[52px]" value={editBody} onChange={e => setEditBody(e.target.value)} placeholder="Message…" />
                <div className="flex gap-1.5">
                  <button type="button" className="btn btn-primary text-[10px] py-1 px-2 gap-1" disabled={saving || !editTitle.trim()} onClick={saveEdit}>
                    <Check size={12} /> Save
                  </button>
                  <button type="button" className="btn btn-ghost text-[10px] py-1 px-2 gap-1" onClick={cancelEdit}>
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {u.date && <div className="update-date">{u.date}</div>}
                    <div className="update-title">{u.title}</div>
                    {u.body && <div className="update-body">{u.body}</div>}
                  </div>
                  {canPost && (
                    <div className="flex gap-0.5 shrink-0">
                      <button type="button" title="Edit" className="btn btn-ghost p-1.5" onClick={() => startEdit(u)}>
                        <PencilSimple size={14} style={{ color: "#7A8A6A" }} />
                      </button>
                      <button type="button" title="Delete" className="btn btn-ghost p-1.5" onClick={() => remove(u.id)}>
                        <Trash size={14} style={{ color: "#C97B5C" }} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))
      )}
      {canPost && (
        <div className="mt-3 pt-3 border-t border-[#E2DDD4] space-y-2">
          <input className="input text-xs py-1.5" placeholder="Update title…" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="input text-xs py-1.5 min-h-[52px]" placeholder="Message for therapists…" value={body} onChange={e => setBody(e.target.value)} />
          <button type="button" className="btn btn-primary text-xs w-full min-h-[36px] gap-1" disabled={saving || !title.trim()} onClick={post}>
            <PaperPlaneTilt size={14} /> Post update
          </button>
        </div>
      )}
    </div>
  );
}
