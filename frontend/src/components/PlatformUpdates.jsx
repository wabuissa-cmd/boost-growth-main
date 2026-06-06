import { useState } from "react";
import api from "../api";
import { Megaphone, PaperPlaneTilt } from "@phosphor-icons/react";

export default function PlatformUpdates({ items = [], canPost = false, onPosted }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

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
            {u.date && <div className="update-date">{u.date}</div>}
            <div className="update-title">{u.title}</div>
            {u.body && <div className="update-body">{u.body}</div>}
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
