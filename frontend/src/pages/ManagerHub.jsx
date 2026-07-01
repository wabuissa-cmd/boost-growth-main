import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import api, { API, openAuthenticatedFile } from "../api";
import { useAuth, canAccessManagerHub, isJenan } from "../auth";
import PageBanner from "../components/PageBanner";
import Requests from "./Requests";
import LeaveBalance from "./LeaveBalance";
import {
  MagnifyingGlass, Warning, UserCircle, FileText, Bell, UploadSimple,
  FloppyDisk, DownloadSimple, CalendarBlank,
} from "@phosphor-icons/react";
import { getTherapistScheduleName } from "../scheduleConstants";

const MAIN_TABS = [
  { id: "staff", label: "Therapists' Requests", testid: "mgr-tab-staff" },
  { id: "balance", label: "Leave Balance", testid: "mgr-tab-balance" },
  { id: "profiles", label: "Therapist Profiles", testid: "mgr-tab-profiles" },
];

async function viewFile(url) {
  try {
    await openAuthenticatedFile(url, { errorMessage: "Could not open file" });
  } catch (e) {
    alert(e?.message || "Could not open file");
  }
}

function TherapistProfilePanel({ therapistId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [trialEnd, setTrialEnd] = useState("");
  const [annualEnd, setAnnualEnd] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [monthlyPeriod, setMonthlyPeriod] = useState("");
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
  const monthlyRef = useRef(null);
  const annualRef = useRef(null);

  const load = () => {
    if (!therapistId) return;
    setLoading(true);
    api.get(`/hr/therapist/${therapistId}/profile`)
      .then(({ data }) => {
        setProfile(data);
        setTrialEnd((data.probation_end || "").slice(0, 10));
        setAnnualEnd((data.annual_contract_end || data.contract_period_end || "").slice(0, 10));
        setMonthlyPeriod(new Date().toISOString().slice(0, 7));
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [therapistId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        probation_end: trialEnd || null,
        annual_contract_end: annualEnd || null,
      };
      if (meetingDate) {
        payload.meeting_date = meetingDate;
        payload.meeting_notes = meetingNotes;
      }
      const { data } = await api.put(`/hr/therapist/${therapistId}/profile`, payload);
      setProfile(data);
      setMeetingDate("");
      setMeetingNotes("");
    } catch (e) {
      alert(e.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendReminder = async () => {
    setReminding(true);
    try {
      await api.post(`/hr/therapist/${therapistId}/contract-reminder`);
      alert("Jenan has been notified to prepare contracts.");
    } catch (e) {
      alert(e.response?.data?.detail || e.message || "Reminder failed");
    } finally {
      setReminding(false);
    }
  };

  const uploadEval = async (evalType, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("eval_type", evalType);
    fd.append("period", evalType === "monthly" ? monthlyPeriod : annualYear);
    try {
      await api.post(`/hr/therapist/${therapistId}/evaluations`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message || "Upload failed");
    }
  };

  if (!therapistId) return null;
  if (loading) return <div className="card p-8 text-center"><div className="spinner mx-auto"/></div>;
  if (!profile) return <div className="card p-6 text-sm text-center" style={{ color: "#8B9E7A" }}>Could not load profile</div>;

  const t = profile.therapist || {};
  const req = profile.requests || {};
  const monthly = profile.monthly_evaluations || [];
  const annual = profile.annual_evaluations || [];
  const meetings = profile.manager_meetings || [];

  return (
    <div className="card p-4 rounded-[20px] space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg m-0" style={{ color: "#2C3625" }}>{getTherapistScheduleName(t)}</h3>
          <p className="text-xs mt-1" style={{ color: "#8B9E7A" }}>{t.email || t.role || "Therapist"}</p>
        </div>
        {onClose && (
          <button type="button" className="btn btn-ghost text-xs" onClick={onClose}>Close</button>
        )}
      </div>

      {profile.alerts?.length > 0 && (
        <div className="space-y-2">
          {profile.alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg" style={{
              background: a.severity === "urgent" ? "#FCE0E8" : "#FAF0D1",
              color: a.severity === "urgent" ? "#8B3A55" : "#6B5218",
            }}>
              <Warning size={14} weight="fill" className="shrink-0 mt-0.5"/>
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Requests (total)", val: req.total ?? 0 },
          { label: "Open", val: req.open ?? 0 },
          { label: "Answered", val: req.answered ?? 0 },
          { label: "Clients", val: profile.assigned_clients ?? 0 },
        ].map(x => (
          <div key={x.label} className="p-3 rounded-xl text-center" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
            <div className="text-lg font-bold" style={{ color: "#2C3625" }}>{x.val}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#8B9E7A" }}>{x.label}</div>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#5C6853" }}>Contract & trial dates</div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="text-xs block">
            <span className="font-semibold" style={{ color: "#8B9E7A" }}>Contract start</span>
            <div className="font-bold mt-1 text-sm" style={{ color: "#2C3625" }}>
              {profile.contract_start?.slice(0, 10) || profile.contract_period_start?.slice(0, 10) || "—"}
            </div>
          </label>
          <label className="text-xs block">
            <span className="font-semibold" style={{ color: "#8B9E7A" }}>Trial period end (3 mo default)</span>
            <input type="date" className="input w-full mt-1 text-sm" value={trialEnd} onChange={e => setTrialEnd(e.target.value)}/>
          </label>
          <label className="text-xs block">
            <span className="font-semibold" style={{ color: "#8B9E7A" }}>Annual contract end</span>
            <input type="date" className="input w-full mt-1 text-sm" value={annualEnd} onChange={e => setAnnualEnd(e.target.value)}/>
          </label>
          <div className="text-xs">
            <span className="font-semibold" style={{ color: "#8B9E7A" }}>Leave balance</span>
            <div className="font-bold mt-1 text-sm" style={{ color: "#2C3625" }}>
              {profile.leave_balance ?? "—"} / {profile.annual_balance ?? 30} days
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary text-xs" onClick={saveProfile} disabled={saving}>
            <FloppyDisk size={14}/> {saving ? "Saving…" : "Save dates"}
          </button>
          <button type="button" className="btn btn-secondary text-xs" onClick={sendReminder} disabled={reminding}>
            <Bell size={14}/> {reminding ? "Sending…" : "Send Jenan reminder"}
          </button>
        </div>
        <p className="text-[10px] mt-2 mb-0" style={{ color: "#8B9E7A" }}>
          Reminder notifies Jenan to prepare trial + annual contracts before the dates above.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Hours this month</div>
          <div className="font-bold" style={{ color: "#2C3625" }}>{profile.hours_this_month ?? 0}h</div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Total hours</div>
          <div className="font-bold" style={{ color: "#2C3625" }}>{profile.hours_total ?? 0}h</div>
        </div>
      </div>

      <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#5C6853" }}>Manager meeting</div>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <input type="date" className="input text-sm" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} placeholder="Meeting date"/>
          <input className="input text-sm" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} placeholder="Meeting notes (optional)"/>
        </div>
        {meetings.length > 0 && (
          <div className="space-y-1 max-h-28 overflow-y-auto mb-2">
            {meetings.slice(0, 5).map(m => (
              <div key={m.id} className="text-xs flex gap-2" style={{ color: "#5C6853" }}>
                <CalendarBlank size={12} className="shrink-0 mt-0.5"/>
                <span><strong>{m.date?.slice(0, 10)}</strong>{m.notes ? ` — ${m.notes}` : ""}</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-secondary text-xs" onClick={saveProfile} disabled={saving || !meetingDate}>
          Add meeting & save
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#5C6853" }}>Monthly evaluation</div>
          <div className="flex gap-2 mb-2">
            <input type="month" className="input text-sm flex-1" value={monthlyPeriod} onChange={e => setMonthlyPeriod(e.target.value)}/>
            <button type="button" className="btn btn-secondary text-xs" onClick={() => monthlyRef.current?.click()}>
              <UploadSimple size={14}/> Upload
            </button>
            <input ref={monthlyRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => uploadEval("monthly", e.target.files?.[0])}/>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {monthly.map(ev => (
              <div key={ev.id} className="flex justify-between text-xs py-1 border-b" style={{ borderColor: "#EDE9E3" }}>
                <span style={{ color: "#2C3625" }}>{ev.month || ev.uploaded_at?.slice(0, 10)}</span>
                <button type="button" className="underline" style={{ color: "#7A8A6A" }} onClick={() => viewFile(`${API}/hr/therapist/${therapistId}/evaluations/${ev.id}/file`)}>
                  <DownloadSimple size={12} className="inline"/> View
                </button>
              </div>
            ))}
            {!monthly.length && <div className="text-xs" style={{ color: "#8B9E7A" }}>No monthly uploads yet</div>}
          </div>
        </div>

        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#5C6853" }}>Annual evaluation</div>
          <div className="flex gap-2 mb-2">
            <input type="number" className="input text-sm w-24" value={annualYear} onChange={e => setAnnualYear(e.target.value)} min="2020" max="2035"/>
            <button type="button" className="btn btn-secondary text-xs" onClick={() => annualRef.current?.click()}>
              <UploadSimple size={14}/> Upload
            </button>
            <input ref={annualRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => uploadEval("annual", e.target.files?.[0])}/>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {annual.map(ev => (
              <div key={ev.id} className="flex justify-between text-xs py-1 border-b" style={{ borderColor: "#EDE9E3" }}>
                <span style={{ color: "#2C3625" }}>{ev.year || ev.uploaded_at?.slice(0, 4)}</span>
                <button type="button" className="underline" style={{ color: "#7A8A6A" }} onClick={() => viewFile(`${API}/hr/therapist/${therapistId}/evaluations/${ev.id}/file`)}>
                  <DownloadSimple size={12} className="inline"/> View
                </button>
              </div>
            ))}
            {!annual.length && <div className="text-xs" style={{ color: "#8B9E7A" }}>No annual uploads yet</div>}
          </div>
        </div>
      </div>

      {profile.trainings?.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#5C6853" }}>Training / report uploads</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {profile.trainings.map(tr => (
              <div key={tr.id} className="flex justify-between text-xs py-1.5 border-b" style={{ borderColor: "#EDE9E3" }}>
                <span style={{ color: "#2C3625" }}>{tr.title || tr.attachment_file_name || "Report"}</span>
                <span style={{ color: "#8B9E7A" }}>{tr.report_date || tr.created_at?.slice(0, 10)} · {tr.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TherapistProfilesTab() {
  const [therapists, setTherapists] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    api.get("/therapists").then(({ data }) => setTherapists(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return therapists;
    return therapists.filter(t =>
      getTherapistScheduleName(t).toLowerCase().includes(q) ||
      (t.name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.key || "").toLowerCase().includes(q)
    );
  }, [therapists, search]);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="card p-3 rounded-[20px]">
        <div className="relative mb-3">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B9E7A" }}/>
          <input
            className="input w-full pl-9 text-sm"
            placeholder="Search therapist…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {filtered.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                selectedId === t.id ? "font-bold" : ""
              }`}
              style={{
                background: selectedId === t.id ? "#E5EBE1" : "transparent",
                color: "#2C3625",
              }}
            >
              {getTherapistScheduleName(t)}
            </button>
          ))}
          {!filtered.length && (
            <div className="text-center py-6 text-xs" style={{ color: "#8B9E7A" }}>No matches</div>
          )}
        </div>
      </div>
      <div>
        {selectedId ? (
          <TherapistProfilePanel therapistId={selectedId} onClose={() => setSelectedId("")} />
        ) : (
          <div className="card p-12 text-center rounded-[20px]">
            <UserCircle size={48} weight="duotone" className="mx-auto mb-3" style={{ color: "#C5CEBC" }}/>
            <p className="text-sm" style={{ color: "#8B9E7A" }}>Select a therapist to edit contract dates, upload evaluations, and schedule manager meetings</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManagerHub() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!canAccessManagerHub(user)) {
    return <Navigate to="/home" replace />;
  }

  const adminPreview = canAccessManagerHub(user) && !isJenan(user);

  const tabParam = searchParams.get("tab");
  const activeTab = (tabParam === "leave" || tabParam === "staff" || !tabParam)
    ? "staff"
    : MAIN_TABS.some(t => t.id === tabParam)
      ? tabParam
      : "staff";

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page-enter">
      <PageBanner
        title={adminPreview ? "Manager Hub (Jenan view)" : "Manager Hub"}
        subtitle={adminPreview
          ? "Temporary admin preview — same queue Jenan uses for leave & staff requests"
          : "All therapist requests in one queue · leave balances · profiles"}
        badge={(
          <Link to="/my-requests" className="btn btn-secondary text-[11px] px-2.5 py-1 min-h-0">
            <FileText size={13}/> My Requests
          </Link>
        )}
      />

      <div className="intake-tabs mb-4">
        {MAIN_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            data-testid={t.testid}
            onClick={() => setTab(t.id)}
            className={`intake-tab${activeTab === t.id ? " active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "staff" && <Requests embedded managerView />}
      {activeTab === "balance" && <LeaveBalance embedded staffScope />}
      {activeTab === "profiles" && <TherapistProfilesTab />}
    </div>
  );
}
