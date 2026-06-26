import { useEffect, useMemo, useState } from "react";
import api from "../api";
import {
  Megaphone, PaperPlaneTilt, PencilSimple, Trash, Check, X,
  Star, Warning, CaretDown, CaretUp, CheckCircle,
} from "@phosphor-icons/react";
import { ModalBtnPrimary } from "./Modal";

function playImportantAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* ignore */ }
}

function ImportantAckModal({ update, onAcknowledge, acknowledging }) {
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{ background: "rgba(30,40,25,0.55)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      data-testid="important-update-modal"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-white rounded-[1.25rem] shadow-2xl w-full max-w-lg overflow-hidden"
          style={{ border: "2px solid #E8C572" }}
        >
          <div className="px-6 pt-6 pb-4" style={{ background: "#FFFBF0" }}>
            <div className="flex items-center gap-2 mb-2">
              <Warning size={22} weight="fill" style={{ color: "#D4A64A" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8B6918" }}>
                Important update
              </span>
            </div>
            {update.date && (
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#6B8F71" }}>
                {update.date}
              </div>
            )}
            <h2 className="font-bold text-lg" style={{ color: "#2C3625" }}>{update.title}</h2>
            {update.body && (
              <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: "#5C6853" }}>
                {update.body}
              </p>
            )}
          </div>
          <div className="px-6 py-5 border-t" style={{ borderColor: "#EDE9E3" }}>
            <p className="text-xs mb-4" style={{ color: "#8B9E7A" }}>
              Please confirm you have read this update before continuing.
            </p>
            <ModalBtnPrimary
              type="button"
              className="w-full justify-center"
              disabled={acknowledging}
              onClick={() => onAcknowledge(update.id)}
              data-testid="important-update-ack-btn"
            >
              <CheckCircle size={18} weight="bold" />
              {acknowledging ? "Saving…" : "I have read this update"}
            </ModalBtnPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlatformUpdates({
  items = [],
  canPost = false,
  onPosted,
  therapistMode = false,
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [sendToSpecialists, setSendToSpecialists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editImportant, setEditImportant] = useState(false);
  const [editRequiresAck, setEditRequiresAck] = useState(false);
  const [editSendToSpecialists, setEditSendToSpecialists] = useState(false);
  const [expandedAckId, setExpandedAckId] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const pendingAckUpdates = useMemo(
    () => (therapistMode ? items.filter(u => u.requires_ack && !u.acked_by_me) : []),
    [items, therapistMode]
  );

  const blockingUpdate = pendingAckUpdates[0] || null;

  useEffect(() => {
    if (!therapistMode || pendingAckUpdates.length === 0) return;
    const key = `bg_important_update_sound_${pendingAckUpdates.map(u => u.id).join("_")}`;
    try {
      if (!sessionStorage.getItem(key)) {
        playImportantAlertSound();
        sessionStorage.setItem(key, "1");
      }
    } catch { /* ignore */ }
  }, [therapistMode, pendingAckUpdates]);

  const postPayload = (base) => ({
    ...base,
    is_important: isImportant || requiresAck || sendToSpecialists,
    requires_ack: requiresAck,
    send_to_specialists: sendToSpecialists,
  });

  const editPayload = (base) => ({
    ...base,
    is_important: editImportant || editRequiresAck || editSendToSpecialists,
    requires_ack: editRequiresAck,
    send_to_specialists: editSendToSpecialists,
  });

  const post = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.post("/center-updates", postPayload({ title: title.trim(), body: body.trim() }));
      setTitle("");
      setBody("");
      setIsImportant(false);
      setRequiresAck(false);
      setSendToSpecialists(false);
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
    setEditImportant(!!u.is_important);
    setEditRequiresAck(!!u.requires_ack);
    setEditSendToSpecialists(!!u.send_to_specialists);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
    setEditDate("");
    setEditImportant(false);
    setEditRequiresAck(false);
    setEditSendToSpecialists(false);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editingId) return;
    setSaving(true);
    try {
      await api.put(`/center-updates/${editingId}`, editPayload({
        title: editTitle.trim(),
        body: editBody.trim(),
        date: editDate || undefined,
      }));
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

  const acknowledge = async (id) => {
    setAcknowledging(true);
    try {
      await api.post(`/center-updates/${id}/acknowledge`);
      onPosted?.();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setAcknowledging(false);
    }
  };

  const FlagCheckboxes = ({ important, setImportant, reqAck, setReqAck, sendSpec, setSendSpec, idPrefix }) => (
    <div className="space-y-1.5 pt-1">
      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#5C6853" }}>
        <input
          type="checkbox"
          id={`${idPrefix}-important`}
          checked={important}
          onChange={e => setImportant(e.target.checked)}
        />
        <Star size={14} weight={important ? "fill" : "regular"} style={{ color: "#D4A64A" }} />
        Mark as important
      </label>
      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#5C6853" }}>
        <input
          type="checkbox"
          id={`${idPrefix}-ack`}
          checked={reqAck}
          onChange={e => {
            setReqAck(e.target.checked);
            if (e.target.checked) setImportant(true);
          }}
        />
        Require acknowledgment from therapists
      </label>
      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#5C6853" }}>
        <input
          type="checkbox"
          id={`${idPrefix}-send`}
          checked={sendSpec}
          onChange={e => {
            setSendSpec(e.target.checked);
            if (e.target.checked) setImportant(true);
          }}
        />
        Email all specialists (urgent)
      </label>
    </div>
  );

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      if (a.is_important !== b.is_important) return a.is_important ? -1 : 1;
      return (b.date || "").localeCompare(a.date || "");
    });
    return copy;
  }, [items]);

  return (
    <>
      {blockingUpdate && (
        <ImportantAckModal
          update={blockingUpdate}
          onAcknowledge={acknowledge}
          acknowledging={acknowledging}
        />
      )}

      <div className={`updates-panel${pendingAckUpdates.length > 0 && !blockingUpdate ? " updates-panel-alert" : ""}`} data-testid="platform-updates">
        <div className="updates-panel-title">
          <Megaphone size={18} weight="duotone" style={{ color: "#D4A64A" }} />
          Platform Updates
          {pendingAckUpdates.length > 0 && (
            <span className="updates-urgent-badge">{pendingAckUpdates.length} unread</span>
          )}
        </div>

        {sortedItems.length === 0 ? (
          <p className="text-xs" style={{ color: "#8B9E7A" }}>No updates posted yet.</p>
        ) : (
          sortedItems.slice(0, 6).map(u => (
            <div
              key={u.id}
              className={`update-item${u.is_important ? " update-item-important" : ""}`}
            >
              {editingId === u.id ? (
                <div className="space-y-2">
                  <input className="input text-xs py-1.5" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                  <input className="input text-xs py-1.5" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  <textarea className="input text-xs py-1.5 min-h-[52px]" value={editBody} onChange={e => setEditBody(e.target.value)} placeholder="Message…" />
                  <FlagCheckboxes
                    idPrefix="edit"
                    important={editImportant}
                    setImportant={setEditImportant}
                    reqAck={editRequiresAck}
                    setReqAck={setEditRequiresAck}
                    sendSpec={editSendToSpecialists}
                    setSendSpec={setEditSendToSpecialists}
                  />
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.is_important && (
                          <Star size={14} weight="fill" style={{ color: "#D4A64A" }} aria-label="Important" />
                        )}
                        {u.date && <div className="update-date">{u.date}</div>}
                        {u.requires_ack && therapistMode && u.acked_by_me && (
                          <span className="update-acked-pill"><CheckCircle size={10} weight="fill" /> Read</span>
                        )}
                      </div>
                      <div className="update-title">{u.title}</div>
                      {u.body && <div className="update-body">{u.body}</div>}
                      {canPost && u.requires_ack && (
                        <button
                          type="button"
                          className="text-[10px] mt-1.5 flex items-center gap-1 underline"
                          style={{ color: "#6B8F71" }}
                          onClick={() => setExpandedAckId(expandedAckId === u.id ? null : u.id)}
                        >
                          {(u.ack_read || []).length} / {((u.ack_read || []).length + (u.ack_pending || []).length)} acknowledged
                          {expandedAckId === u.id ? <CaretUp size={12} /> : <CaretDown size={12} />}
                        </button>
                      )}
                      {canPost && expandedAckId === u.id && (
                        <div className="mt-2 p-2 rounded-lg text-[10px] space-y-1" style={{ background: "#F7F3EB" }}>
                          {(u.ack_read || []).length > 0 && (
                            <div>
                              <div className="font-bold mb-0.5" style={{ color: "#2F4A35" }}>Acknowledged</div>
                              {(u.ack_read || []).map(a => (
                                <div key={a.therapist_id} style={{ color: "#5C6853" }}>
                                  {a.name} · {a.at ? new Date(a.at).toLocaleString() : "—"}
                                </div>
                              ))}
                            </div>
                          )}
                          {(u.ack_pending || []).length > 0 && (
                            <div>
                              <div className="font-bold mb-0.5 mt-1" style={{ color: "#8A3F27" }}>Pending</div>
                              {(u.ack_pending || []).map(a => (
                                <div key={a.therapist_id} style={{ color: "#8B6918" }}>{a.name}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {therapistMode && u.requires_ack && !u.acked_by_me && !blockingUpdate && (
                        <button
                          type="button"
                          className="btn btn-primary text-[10px] py-1 px-2 mt-2 gap-1"
                          disabled={acknowledging}
                          onClick={() => acknowledge(u.id)}
                        >
                          <CheckCircle size={12} /> I have read this
                        </button>
                      )}
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
            <FlagCheckboxes
              idPrefix="new"
              important={isImportant}
              setImportant={setIsImportant}
              reqAck={requiresAck}
              setReqAck={setRequiresAck}
              sendSpec={sendToSpecialists}
              setSendSpec={setSendToSpecialists}
            />
            <button type="button" className="btn btn-primary text-xs w-full min-h-[36px] gap-1" disabled={saving || !title.trim()} onClick={post}>
              <PaperPlaneTilt size={14} /> Post update
            </button>
          </div>
        )}
      </div>
    </>
  );
}
