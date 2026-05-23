import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X, ChatCircleText, CalendarBlank, Tag, Lightning, Clock, CheckCircle, XCircle, Hourglass, Spinner, Trophy, Briefcase, Calendar, Package } from "@phosphor-icons/react";

const STATUS_MAP = {
  pending:    { label: "Pending",     cls: "bg-[#FAF0D1] text-[#6B5218] border-[#E6C983]", icon: <Hourglass size={14} weight="duotone"/>, color: "#E6C983" },
  in_progress:{ label: "In Progress", cls: "bg-[#EAF0F3] text-[#375568] border-[#A4BCCB]", icon: <Spinner size={14} weight="duotone"/>, color: "#A4BCCB" },
  approved:   { label: "Approved",    cls: "bg-[#E5EBE1] text-[#3D4F35] border-[#B4C2A9]", icon: <CheckCircle size={14} weight="duotone"/>, color: "#B4C2A9" },
  rejected:   { label: "Rejected",    cls: "bg-[#F8EBE7] text-[#8A3F27] border-[#ECA6A6]", icon: <XCircle size={14} weight="duotone"/>, color: "#ECA6A6" },
  done:       { label: "Completed",   cls: "bg-[#7A8A6A] text-white border-[#7A8A6A]",     icon: <CheckCircle size={14} weight="fill"/>, color: "#7A8A6A" },
};

const TYPES = [
  { id: "leave", label: "Time Off", icon: <Calendar size={20} weight="duotone"/>, color: "#A4BCCB" },
  { id: "supplies", label: "Supplies / Materials", icon: <Package size={20} weight="duotone"/>, color: "#D4A64A" },
  { id: "schedule_change", label: "Schedule Change", icon: <CalendarBlank size={20} weight="duotone"/>, color: "#7A8A6A" },
  { id: "reward", label: "Reward / Recognition", icon: <Trophy size={20} weight="duotone"/>, color: "#C97B5C" },
  { id: "general", label: "General", icon: <Briefcase size={20} weight="duotone"/>, color: "#8B7BA8" },
];

const REWARD_TYPES = [
  { id: "certificate", label: "Certificate of Appreciation" },
  { id: "monetary", label: "Monetary Bonus" },
  { id: "day_off", label: "Extra Day Off" },
  { id: "other", label: "Other" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#8B9E7A" },
  { id: "normal", label: "Normal", color: "#7A8A6A" },
  { id: "high", label: "High", color: "#D4A64A" },
  { id: "urgent", label: "Urgent", color: "#C97B5C" },
];

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState(null);
  const [statusEdit, setStatusEdit] = useState(null);
  const [step, setStep] = useState(1);

  const load = async () => { const { data } = await api.get("/requests"); setItems(data); };
  useEffect(() => { load(); }, []);

  const submitNew = async () => {
    await api.post("/requests", edit);
    setEdit(null); setStep(1); load();
  };
  const updateStatus = async () => {
    await api.put(`/requests/${statusEdit.id}/status`, { status: statusEdit.status, admin_note: statusEdit.admin_note });
    setStatusEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete this request?")) return; await api.delete(`/requests/${id}`); load(); };

  const filtered = items.filter(r => filter === "all" || r.status === filter);

  return (
    <div>
      <div className="flex items-center mb-5 gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Requests</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>{isAdmin ? "Manage all team requests" : "Track and submit your requests"}</div>
        </div>
        {!isAdmin && <button data-testid="new-request-btn" onClick={() => { setEdit({ title: "", description: "", request_type: "general", priority: "normal" }); setStep(1); }} className="btn btn-primary"><Plus size={16}/> New Request</button>}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilter("all")} className={`pill ${filter==="all" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>All ({items.length})</button>
        {Object.entries(STATUS_MAP).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`pill border ${filter===k ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : v.cls}`}>{v.icon} {v.label} ({items.filter(r=>r.status===k).length})</button>
        ))}
      </div>

      <div className="space-y-3 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>No requests yet</div>}
        {filtered.map(r => {
          const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
          const tp = TYPES.find(t => t.id === r.request_type) || TYPES[4];
          return (
            <div key={r.id} className="card overflow-hidden">
              <div className="status-bar" style={{background: st.color}}/>
              <div className="p-5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background: `${tp.color}25`, color: tp.color}}>{tp.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`pill border ${st.cls}`}>{st.icon} {st.label}</span>
                      <span className="pill" style={{background: `${tp.color}20`, color: tp.color}}><Tag size={12}/> {tp.label}</span>
                      {r.priority && r.priority !== "normal" && (
                        <span className="pill" style={{background: `${PRIORITIES.find(p=>p.id===r.priority)?.color}20`, color: PRIORITIES.find(p=>p.id===r.priority)?.color}}>
                          <Lightning size={12}/> {PRIORITIES.find(p=>p.id===r.priority)?.label}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-lg" style={{color: "#2C3625"}}>{r.title}</div>
                    {r.description && <div className="text-sm mt-1 whitespace-pre-wrap" style={{color: "#5C6853"}}>{r.description}</div>}

                    <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
                      {(r.date_from || r.date_to) && (
                        <div className="flex items-center gap-2" style={{color: "#5C6853"}}>
                          <CalendarBlank size={16}/> {r.date_from || "?"} {r.date_to && `→ ${r.date_to}`}
                        </div>
                      )}
                      {r.reward_type && (
                        <div className="flex items-center gap-2" style={{color: "#5C6853"}}>
                          <Trophy size={16}/> {REWARD_TYPES.find(rw=>rw.id===r.reward_type)?.label || r.reward_type}
                        </div>
                      )}
                    </div>
                    {r.extra_notes && <div className="text-xs mt-2 italic" style={{color: "#8B9E7A"}}>"{r.extra_notes}"</div>}

                    {isAdmin && r.therapist_name && <div className="text-xs mt-3 flex items-center gap-1" style={{color: "#8B9E7A"}}>From: <strong style={{color: "#5C6853"}}>{r.therapist_name}</strong></div>}
                    <div className="text-[11px] mt-1 flex items-center gap-1" style={{color: "#8B9E7A"}}><Clock size={11}/> {new Date(r.created_at).toLocaleString('en-US')}</div>

                    {r.admin_note && (
                      <div className="mt-3 p-3 bg-[#E5EBE1] rounded-xl border border-[#B4C2A9]">
                        <div className="text-xs font-bold flex items-center gap-1 mb-1" style={{color: "#3D4F35"}}><ChatCircleText size={14}/> ADMIN RESPONSE</div>
                        <div className="text-sm" style={{color: "#2C3625"}}>{r.admin_note}</div>
                      </div>
                    )}

                    {/* Timeline */}
                    {r.timeline && r.timeline.length > 1 && (
                      <details className="mt-3">
                        <summary className="text-xs cursor-pointer hover:underline" style={{color: "#7A8A6A"}}>Activity timeline ({r.timeline.length})</summary>
                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-[#E5EBE1]">
                          {r.timeline.map((ev, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-bold" style={{color: "#2C3625"}}>{ev.event}</span>
                              <span style={{color: "#8B9E7A"}}> · {ev.by} · {new Date(ev.at).toLocaleString('en-US')}</span>
                              {ev.note && <div className="italic" style={{color: "#5C6853"}}>"{ev.note}"</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isAdmin && <button data-testid={`update-status-${r.id}`} onClick={() => setStatusEdit({...r})} className="btn btn-secondary"><PencilSimple size={16}/> Update</button>}
                    <button onClick={() => remove(r.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Request Modal — multi-step */}
      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-xl modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="font-display text-2xl" style={{color: "#2C3625"}}>New Request</div>
                <div className="text-sm" style={{color: "#5C6853"}}>Step {step} of 3 · {step===1 ? "Choose type" : step===2 ? "Provide details" : "Review & submit"}</div>
              </div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 mb-5">
              {[1,2,3].map(i => <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{background: i <= step ? "#7A8A6A" : "#E8E4DE"}}/>)}
            </div>

            {step === 1 && (
              <div>
                <label className="label">Request Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {TYPES.map(t => (
                    <button key={t.id} type="button" onClick={() => setEdit({...edit, request_type: t.id})}
                            className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all hover:bg-[#E5EBE1]/30 ${edit.request_type === t.id ? "border-[#7A8A6A] bg-[#E5EBE1]" : "border-[#E8E4DE]"}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `${t.color}25`, color: t.color}}>{t.icon}</div>
                      <div className="font-bold" style={{color: "#2C3625"}}>{t.label}</div>
                    </button>
                  ))}
                </div>
                <label className="label">Priority</label>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {PRIORITIES.map(p => (
                    <button key={p.id} type="button" onClick={() => setEdit({...edit, priority: p.id})}
                            className={`pill border-2 ${edit.priority === p.id ? "bg-[#E5EBE1]" : ""}`}
                            style={{borderColor: edit.priority === p.id ? p.color : "#E8E4DE", color: p.color}}>
                      <Lightning size={12} weight={edit.priority === p.id ? "fill" : "regular"}/> {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setStep(2)} className="btn btn-primary">Next →</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="label">Title</label>
                <input data-testid="req-title" className="input mb-3" value={edit.title} onChange={e=>setEdit({...edit, title: e.target.value})} placeholder="Brief title..."/>

                {edit.request_type === "leave" && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="label">From</label>
                      <input type="date" className="input" value={edit.date_from || ""} onChange={e=>setEdit({...edit, date_from: e.target.value})}/>
                    </div>
                    <div>
                      <label className="label">To</label>
                      <input type="date" className="input" value={edit.date_to || ""} onChange={e=>setEdit({...edit, date_to: e.target.value})}/>
                    </div>
                  </div>
                )}

                {edit.request_type === "schedule_change" && (
                  <div className="mb-3">
                    <label className="label">Date Affected</label>
                    <input type="date" className="input" value={edit.date_from || ""} onChange={e=>setEdit({...edit, date_from: e.target.value})}/>
                  </div>
                )}

                {edit.request_type === "reward" && (
                  <div className="mb-3">
                    <label className="label">Reward Type</label>
                    <select className="select" value={edit.reward_type || ""} onChange={e=>setEdit({...edit, reward_type: e.target.value})}>
                      <option value="">— Select —</option>
                      {REWARD_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                )}

                <label className="label">Description</label>
                <textarea data-testid="req-description" className="textarea mb-3" rows={4} value={edit.description} onChange={e=>setEdit({...edit, description: e.target.value})} placeholder="Provide details..."/>

                <label className="label">Additional Notes (optional)</label>
                <textarea className="textarea mb-4" rows={2} value={edit.extra_notes || ""} onChange={e=>setEdit({...edit, extra_notes: e.target.value})}/>

                <div className="flex justify-between">
                  <button onClick={() => setStep(1)} className="btn btn-outline">← Back</button>
                  <button onClick={() => setStep(3)} disabled={!edit.title} className="btn btn-primary disabled:opacity-50">Review →</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="bg-[#F6F4F0] rounded-xl p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span style={{color: "#8B9E7A"}}>Type:</span><strong>{TYPES.find(t=>t.id===edit.request_type)?.label}</strong></div>
                  <div className="flex justify-between"><span style={{color: "#8B9E7A"}}>Priority:</span><strong>{PRIORITIES.find(p=>p.id===edit.priority)?.label}</strong></div>
                  <div className="flex justify-between"><span style={{color: "#8B9E7A"}}>Title:</span><strong>{edit.title}</strong></div>
                  {edit.date_from && <div className="flex justify-between"><span style={{color: "#8B9E7A"}}>Date:</span><strong>{edit.date_from} {edit.date_to && `→ ${edit.date_to}`}</strong></div>}
                  {edit.reward_type && <div className="flex justify-between"><span style={{color: "#8B9E7A"}}>Reward:</span><strong>{REWARD_TYPES.find(r=>r.id===edit.reward_type)?.label}</strong></div>}
                  {edit.description && <div><div style={{color: "#8B9E7A"}}>Description:</div><div className="whitespace-pre-wrap mt-1">{edit.description}</div></div>}
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep(2)} className="btn btn-outline">← Back</button>
                  <button data-testid="req-submit-btn" onClick={submitNew} className="btn btn-primary">Submit Request 🌱</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Update status (admin) */}
      {statusEdit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setStatusEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="font-display text-2xl">Update Status</div>
              <button onClick={() => setStatusEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="text-sm mb-3" style={{color: "#5C6853"}}>The therapist will be auto-notified.</div>
            <label className="label">New Status</label>
            <div className="grid grid-cols-1 gap-2 mb-3">
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <button key={k} onClick={() => setStatusEdit({...statusEdit, status: k})}
                        className={`pill border-2 justify-start py-2 ${statusEdit.status === k ? "ring-2 ring-[#7A8A6A]" : ""} ${v.cls}`}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <label className="label">Response / Note (optional)</label>
            <textarea className="textarea mb-4" rows={3} value={statusEdit.admin_note || ""} onChange={e=>setStatusEdit({...statusEdit, admin_note: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="status-save-btn" onClick={updateStatus} className="btn btn-primary">Save & Notify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
