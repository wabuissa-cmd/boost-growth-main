import { useEffect, useMemo, useState, useRef } from "react";
import api, { API } from "../api";
import { useAuth } from "../auth";
import {
  Plus, X, CheckCircle, XCircle, FilePdf, UploadSimple, Eye, Trash,
  UserMinus, MagnifyingGlass, Export, CaretDown, CaretRight, FileText
} from "@phosphor-icons/react";
import {
  ModalBase, FormSection, FormField,
  ModalBtnPrimary, ModalBtnSecondary,
} from "../components/Modal";
import {
  LEAVE_STATUS, LEAVE_TYPES, DOC_TYPES, documentBadge, leaveRequiresDocument,
  diffDays, fmtDateRange, isActiveLeave, isHistoryLeave, exportLeavesCsv,
  scheduleImpactLabel,
} from "../leaveUtils";

function emptyLeave(therapistId = "") {
  const today = new Date().toISOString().slice(0, 10);
  return {
    therapist_id: therapistId, start_date: today, end_date: today,
    days: 1, leave_type: "Annual", status: "pending", notes: "",
  };
}

function DocumentSection({ leave, isAdmin, onRefresh, canUpload }) {
  const badge = documentBadge(leave);
  const inputRef = useRef(null);
  const [docType, setDocType] = useState(leave.document_type || "medical");
  const [uploading, setUploading] = useState(false);
  const hasFile = !!(leave.document_file_path || leave.document_url);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", docType);
      await api.post(`/leaves/${leave.id}/upload-document`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onRefresh();
    } catch (e) {
      alert("Upload failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async () => {
    if (!window.confirm("Remove this document?")) return;
    await api.delete(`/leaves/${leave.id}/document`);
    onRefresh();
  };

  const verifyDoc = async (verified) => {
    await api.put(`/leaves/${leave.id}/verify-document`, { verified });
    onRefresh();
  };

  const downloadUrl = `${API}/leaves/${leave.id}/document`;

  const viewDoc = async () => {
    try {
      const token = localStorage.getItem("bg_token");
      const r = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!r.ok) throw new Error("Download failed");
      const blob = await r.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      alert("Could not open document");
    }
  };

  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: "#E8E4DE", background: "#FAFAF7" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <span className="text-xs font-bold" style={{ color: "#5C6853" }}>📄 Documents</span>
        <span className="pill text-[10px] px-2 py-0.5 font-bold" style={{ background: badge.bg, color: badge.color }}>
          {badge.icon} {badge.label}
        </span>
      </div>
      {hasFile ? (
        <div className="flex items-center gap-2 flex-wrap">
          <FilePdf size={18} style={{ color: "#6B5430" }} />
          <span className="text-sm font-medium" style={{ color: "#2C3625" }}>
            ✓ {leave.document_file_name || "Document uploaded"}
          </span>
          <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs py-1" onClick={e => { e.preventDefault(); viewDoc(); }}>
            <Eye size={14} /> View
          </a>
          {(isAdmin || canUpload) && (
            <button type="button" onClick={removeDoc} className="btn btn-ghost text-xs py-1 text-red-700">
              <Trash size={14} /> Remove
            </button>
          )}
          {isAdmin && !leave.document_verified && (
            <button type="button" onClick={() => verifyDoc(true)} className="btn btn-primary text-xs py-1">
              Mark Verified
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs italic" style={{ color: "#8B9E7A" }}>No document uploaded</span>
          {canUpload && (
            <>
              <select className="select text-xs" value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
                className="btn btn-secondary text-xs py-1">
                {uploading ? <span className="spinner" /> : <><UploadSimple size={14} /> Upload Doc</>}
              </button>
            </>
          )}
          {isAdmin && leaveRequiresDocument(leave.leave_type) && (
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-outline text-xs py-1">
              Request Doc ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LeaveRequestCard({ leave, isAdmin, user, onRefresh, onEdit, therapists }) {
  const st = LEAVE_STATUS[leave.status] || LEAVE_STATUS.pending;
  const tp = LEAVE_TYPES[leave.leave_type] || { label: leave.leave_type, color: "#7A8A6A" };
  const canUpload = isAdmin || leave.therapist_id === user?.id;
  const [marking, setMarking] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);

  const setStatus = async (status) => {
    await api.put(`/leaves/${leave.id}/status`, { status });
    onRefresh();
  };

  const markAbsent = async () => {
    const msg = `Mark ${leave.therapist_name || "therapist"} as absent on ${fmtDateRange(leave.start_date, leave.end_date)}?\n\nThis will automatically cancel all their sessions on these dates in the schedule.`;
    if (!window.confirm(msg)) return;
    setMarking(true);
    try {
      const { data } = await api.post(`/leaves/${leave.id}/mark-absent`, { cancel_sessions: true });
      alert(data.message || `Done. ${data.cancelled_sessions_count} sessions cancelled.`);
      onRefresh();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="card p-5" data-testid={`leave-card-${leave.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-sm shrink-0"
            style={{ background: leave.therapist_color || "#7A8A6A" }}>
            {(leave.therapist_name || "?").replace("Ms. ", "").charAt(0)}
          </div>
          <div>
            <div className="font-bold text-lg" style={{ color: "#2C3625" }}>{leave.therapist_name || user?.name || "—"}</div>
            <div className="text-sm" style={{ color: "#5C6853" }}>
              <span className="pill text-[10px] px-2 py-0.5 mr-1" style={{ background: `${tp.color}22`, color: tp.color }}>{tp.label}</span>
              · {fmtDateRange(leave.start_date, leave.end_date)} · {leave.days} day{leave.days !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <span className="pill text-xs font-bold px-3 py-1" style={{ background: st.bg, color: st.color }}>
          {st.icon} {st.label.toUpperCase()}
        </span>
      </div>

      <DocumentSection leave={leave} isAdmin={isAdmin} onRefresh={onRefresh} canUpload={canUpload} />

      {leave.notes && (
        <div className="mt-3 text-sm" style={{ color: "#5C6853" }}>
          <span className="font-bold">💬 Note:</span> {leave.notes}
        </div>
      )}

      {(leave.schedule_impact || []).length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setImpactOpen(o => !o)} className="text-xs font-bold flex items-center gap-1" style={{ color: "#5C6853" }}>
            {impactOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
            {scheduleImpactLabel(leave)}
          </button>
          {impactOpen && (
            <ul className="mt-1 text-xs space-y-0.5 pl-4" style={{ color: "#8B9E7A" }}>
              {(leave.schedule_impact || []).map((s, i) => (
                <li key={i}>{s.date} · {s.client_name} · {s.time_slot || "—"}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-2 flex-wrap mt-4 pt-3 border-t border-[#E8E4DE]">
          {leave.status === "pending" && (
            <>
              <button onClick={() => setStatus("approved")} className="btn btn-primary text-xs" data-testid={`approve-${leave.id}`}>
                <CheckCircle size={14} /> Approve
              </button>
              <button onClick={() => setStatus("rejected")} className="btn btn-outline text-xs" data-testid={`reject-${leave.id}`}>
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {(leave.status === "approved" || leave.status === "pending") && leave.status !== "absent" && (
            <button onClick={markAbsent} disabled={marking} className="btn btn-secondary text-xs">
              <UserMinus size={14} /> {marking ? "Processing…" : "Mark as Absent"}
            </button>
          )}
          <button onClick={() => onEdit(leave)} className="btn btn-ghost text-xs">Edit</button>
        </div>
      )}
    </div>
  );
}

function MarkAbsenceModal({ therapists, onClose, onDone }) {
  const [form, setForm] = useState({
    therapist_id: "", date_from: new Date().toISOString().slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10), leave_type: "Absence",
    notes: "", cancel_sessions: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (form.date_from && form.date_to) {
      const d = diffDays(form.date_from, form.date_to);
      if (d) setForm(f => ({ ...f, days: d }));
    }
  }, [form.date_from, form.date_to]);

  const submit = async () => {
    if (!form.therapist_id) { alert("Select a therapist"); return; }
    const t = therapists.find(x => x.id === form.therapist_id);
    const msg = form.cancel_sessions
      ? `Mark ${t?.name} absent ${fmtDateRange(form.date_from, form.date_to)} and cancel schedule sessions?`
      : `Mark ${t?.name} absent ${fmtDateRange(form.date_from, form.date_to)}?`;
    if (!window.confirm(msg)) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/leaves/mark-absence", form);
      alert(data.message || "Absence recorded.");
      onDone();
      onClose();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalBase title="Mark Absence" subtitle="Record absence without a prior request" onClose={onClose} size="md"
      footer={<>
        <ModalBtnSecondary onClick={onClose}>Cancel</ModalBtnSecondary>
        <ModalBtnPrimary onClick={submit} disabled={submitting}>{submitting ? "Saving…" : "Submit"}</ModalBtnPrimary>
      </>}>
      <FormSection title="Details">
        <FormField label="Therapist">
          <select className="modal-input" value={form.therapist_id} onChange={e => setForm({ ...form, therapist_id: e.target.value })}>
            <option value="">— Select —</option>
            {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date from">
            <input type="date" className="modal-input" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} />
          </FormField>
          <FormField label="Date to">
            <input type="date" className="modal-input" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Type">
          <select className="modal-input" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
            <option value="Absence">Absent</option>
            <option value="Permission">Permission (استئذان)</option>
          </select>
        </FormField>
        <FormField label="Note">
          <textarea className="modal-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.cancel_sessions} onChange={e => setForm({ ...form, cancel_sessions: e.target.checked })} />
          Cancel sessions in schedule (recommended)
        </label>
      </FormSection>
    </ModalBase>
  );
}

function HistoryTab({ leaves, therapists, isAdmin, onRefresh }) {
  const [filterTherapist, setFilterTherapist] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [search, setSearch] = useState("");
  const [impactId, setImpactId] = useState(null);

  const months = useMemo(() => {
    const set = new Set(leaves.map(l => (l.start_date || "").slice(0, 7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [leaves]);

  const filtered = useMemo(() => {
    let arr = leaves.filter(isHistoryLeave);
    if (filterTherapist) arr = arr.filter(l => l.therapist_id === filterTherapist);
    if (filterType) arr = arr.filter(l => l.leave_type === filterType);
    if (filterMonth) arr = arr.filter(l => (l.start_date || "").startsWith(filterMonth));
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(l =>
        (l.therapist_name || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q)
      );
    }
    return arr.sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  }, [leaves, filterTherapist, filterType, filterMonth, search]);

  return (
    <div>
      <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
        <select className="select text-sm" value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}>
          <option value="">All Therapists</option>
          {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="select text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {Object.keys(LEAVE_TYPES).map(k => <option key={k} value={k}>{LEAVE_TYPES[k].label}</option>)}
        </select>
        <select className="select text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <MagnifyingGlass size={16} className="absolute left-2 top-2.5" style={{ color: "#8B9E7A" }} />
          <input className="input pl-8 text-sm" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => exportLeavesCsv(filtered)} className="btn btn-gold text-xs ml-auto">
          <Export size={14} /> Export to Excel
        </button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#F0E9D8" }}>
            <tr>
              <th className="p-3 text-left font-bold">Therapist</th>
              <th className="p-3 text-left font-bold">Type</th>
              <th className="p-3 text-left font-bold">Dates</th>
              <th className="p-3 text-center font-bold">Days</th>
              <th className="p-3 text-left font-bold">Status</th>
              <th className="p-3 text-left font-bold">Document</th>
              <th className="p-3 text-left font-bold">Schedule Impact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center" style={{ color: "#8B9E7A" }}>No history records</td></tr>
            )}
            {filtered.map(l => {
              const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
              const doc = documentBadge(l);
              const impact = scheduleImpactLabel(l);
              return (
                <tr key={l.id} className="border-t border-[#E8E4DE] hover:bg-[#FAFAF7]">
                  <td className="p-3 font-bold">{l.therapist_name || "—"}</td>
                  <td className="p-3">{LEAVE_TYPES[l.leave_type]?.label || l.leave_type}</td>
                  <td className="p-3 text-xs">{fmtDateRange(l.start_date, l.end_date)}</td>
                  <td className="p-3 text-center font-bold">{l.days}</td>
                  <td className="p-3">
                    <span className="pill text-[10px]" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-[10px]" style={{ color: doc.color }}>{doc.icon} {doc.label.split("—")[0].trim()}</span>
                  </td>
                  <td className="p-3">
                    {(l.schedule_impact || []).length > 0 ? (
                      <button type="button" className="text-xs underline" style={{ color: "#5C6853" }}
                        onClick={() => setImpactId(impactId === l.id ? null : l.id)}>
                        {impact}
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: "#8B9E7A" }}>{impact}</span>
                    )}
                    {impactId === l.id && (
                      <ul className="mt-1 text-[10px]" style={{ color: "#8B9E7A" }}>
                        {(l.schedule_impact || []).map((s, i) => (
                          <li key={i}>{s.date} · {s.client_name}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LeaveRequests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("active");
  const [leaves, setLeaves] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [showMarkAbsence, setShowMarkAbsence] = useState(false);
  const [myBalance, setMyBalance] = useState(null);

  const load = async () => {
    const [l, t, b] = await Promise.all([
      api.get(`/leaves?year=${year}`),
      api.get("/therapists").catch(() => ({ data: [] })),
      api.get(`/leaves/balance?year=${year}`).catch(() => ({ data: [] })),
    ]);
    setLeaves(l.data);
    setTherapists(t.data);
    if (!isAdmin && user?.id) {
      setMyBalance((b.data || []).find(x => x.therapist_id === user.id) || null);
    }
  };
  useEffect(() => { load(); }, [year, isAdmin, user?.id]);

  useEffect(() => {
    if (edit?.start_date && edit?.end_date) {
      const calc = diffDays(edit.start_date, edit.end_date);
      if (calc !== edit.days) setEdit(e => ({ ...e, days: calc }));
    }
  }, [edit?.start_date, edit?.end_date]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeLeaves = useMemo(() =>
    leaves.filter(isActiveLeave).sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return String(b.start_date).localeCompare(String(a.start_date));
    }),
    [leaves]
  );

  const save = async () => {
    if (!edit.therapist_id) { alert("Select a therapist"); return; }
    if (edit.id) await api.put(`/leaves/${edit.id}`, edit);
    else await api.post("/leaves", edit);
    setEdit(null);
    load();
  };

  const displayLeaves = isAdmin ? activeLeaves : [...leaves].sort((a, b) =>
    String(b.start_date).localeCompare(String(a.start_date))
  );

  return (
    <div>
      <div className="flex items-center mb-5 flex-wrap gap-3">
        <div className="flex-1 min-w-[240px]">
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2" style={{ color: "#2C3625" }}>
            <FileText size={28} weight="duotone" /> {isAdmin ? "Leave Requests" : "My Leave Requests"}
          </h1>
          <div className="text-sm" style={{ color: "#5C6853" }}>
            {isAdmin ? "Approve requests · track documents · mark absences" : "Submit requests and upload supporting documents"}
          </div>
        </div>
        <select className="select text-sm max-w-[100px]" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
          {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {isAdmin && (
          <button type="button" onClick={() => setShowMarkAbsence(true)} className="btn btn-secondary text-sm">
            <UserMinus size={16} /> Mark Absence
          </button>
        )}
        <button data-testid="add-leave-btn" onClick={() => setEdit(emptyLeave(isAdmin ? "" : user?.id))} className="btn btn-primary">
          <Plus size={16} /> {isAdmin ? "New Request" : "Request Leave"}
        </button>
      </div>

      {!isAdmin && myBalance && (
        <div className="card p-4 mb-5 flex items-center gap-6 flex-wrap" style={{ background: "#F5FAF3", borderColor: "#C4D4B8" }}>
          <div>
            <div className="text-[10px] font-bold tracking-wider" style={{ color: "#8B9E7A" }}>REMAINING BALANCE</div>
            <div className="font-display text-3xl font-semibold" style={{ color: "#2C3625" }}>{myBalance.remaining} days</div>
          </div>
          <div className="text-sm" style={{ color: "#5C6853" }}>
            Used {myBalance.used_annual} / {myBalance.allocated} · Pending {myBalance.pending}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-2 mb-5">
          {[
            { id: "active", label: "Active Requests", sub: "الطلبات الحالية" },
            { id: "history", label: "History", sub: "السجل" },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === t.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E8E4DE]"}`}>
              {t.label} <span className="opacity-70 font-normal text-xs">· {t.sub}</span>
            </button>
          ))}
        </div>
      )}

      {(!isAdmin || tab === "active") && (
        <div className="space-y-4">
          {displayLeaves.length === 0 && (
            <div className="card p-12 text-center" style={{ color: "#8B9E7A" }}>No active leave requests</div>
          )}
          {displayLeaves.map(l => (
            <LeaveRequestCard key={l.id} leave={l} isAdmin={isAdmin} user={user} onRefresh={load}
              onEdit={setEdit} therapists={therapists} />
          ))}
        </div>
      )}

      {isAdmin && tab === "history" && (
        <HistoryTab leaves={leaves} therapists={therapists} isAdmin={isAdmin} onRefresh={load} />
      )}

      {edit && (
        <ModalBase title={edit.id ? "Edit Leave" : "Request Leave"} onClose={() => setEdit(null)} size="md"
          footer={<>
            <ModalBtnSecondary onClick={() => setEdit(null)}>Cancel</ModalBtnSecondary>
            <ModalBtnPrimary data-testid="leave-save-btn" onClick={save}>Save</ModalBtnPrimary>
          </>}>
          <FormSection title="Leave Details">
            {isAdmin && (
              <FormField label="Therapist">
                <select data-testid="leave-therapist-select" className="modal-input" value={edit.therapist_id}
                  onChange={e => setEdit({ ...edit, therapist_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Type">
                <select className="modal-input" value={edit.leave_type} onChange={e => setEdit({ ...edit, leave_type: e.target.value })}>
                  {Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FormField>
              {isAdmin && (
                <FormField label="Status">
                  <select className="modal-input" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                    {Object.entries(LEAVE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </FormField>
              )}
              <FormField label="Date from">
                <input data-testid="leave-start-input" type="date" className="modal-input" value={edit.start_date}
                  onChange={e => setEdit({ ...edit, start_date: e.target.value })} />
              </FormField>
              <FormField label="Date to">
                <input data-testid="leave-end-input" type="date" className="modal-input" value={edit.end_date}
                  onChange={e => setEdit({ ...edit, end_date: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Days">
              <input type="number" step="0.5" min="0.5" className="modal-input" value={edit.days}
                onChange={e => setEdit({ ...edit, days: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Notes">
              <textarea className="modal-input" rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
            </FormField>
          </FormSection>
        </ModalBase>
      )}

      {showMarkAbsence && (
        <MarkAbsenceModal therapists={therapists} onClose={() => setShowMarkAbsence(false)} onDone={load} />
      )}
    </div>
  );
}
