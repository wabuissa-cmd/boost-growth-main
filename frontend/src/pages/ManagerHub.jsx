import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import api, { API, openAuthenticatedFile } from "../api";
import { useAuth, canAccessManagerHub, isJenan } from "../auth";
import PageBanner from "../components/PageBanner";
import Requests from "./Requests";
import LeaveBalance from "./LeaveBalance";
import {
  MagnifyingGlass, Warning, UserCircle, FileText, Bell, UploadSimple,
  FloppyDisk, DownloadSimple, CalendarBlank, CaretDown, CaretUp,
  IdentificationCard, Hourglass, CalendarCheck, ChartBar, Briefcase,
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

const TRIAL_ALERT_DAYS = 30;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  try {
    const end = new Date(String(dateStr).slice(0, 10));
    const today = new Date();
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.round((end - today) / 86400000);
  } catch {
    return null;
  }
}

function trialPhase(profile) {
  const days = profile?.trial_days_left ?? daysUntil(profile?.probation_end);
  if (days == null) return "unknown";
  if (days < 0) return "completed";
  if (days <= TRIAL_ALERT_DAYS) return "ending_soon";
  return "active";
}

function ProfileSection({ id, openId, onToggle, icon, title, hint, badge, children }) {
  const open = openId === id;
  return (
    <div className="mgr-profile-section">
      <button type="button" className="my-learning-attempt-head" onClick={() => onToggle(open ? "" : id)}>
        <div className="flex items-center gap-2.5 min-w-0 text-left">
          <span className="mgr-profile-section-icon">{icon}</span>
          <div className="min-w-0">
            <div className="my-learning-course-name">{title}</div>
            {hint && (
              <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{hint}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </div>
      </button>
      {open && <div className="my-learning-attempt-body">{children}</div>}
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }) {
  const styles = {
    neutral: { background: "#EDE9E3", color: "#5C6853" },
    success: { background: "#E5EBE1", color: "#3D5235" },
    warning: { background: "#FAF0D1", color: "#6B5218" },
    urgent: { background: "#FCE0E8", color: "#8B3A55" },
  }[tone] || { background: "#EDE9E3", color: "#5C6853" };
  return (
    <span className="mgr-profile-pill" style={styles}>{children}</span>
  );
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
  const [openSection, setOpenSection] = useState("basic");
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
        const phase = trialPhase(data);
        setOpenSection(phase === "ending_soon" ? "trial" : "basic");
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
  const trial = trialPhase(profile);
  const trialDays = profile.trial_days_left ?? daysUntil(profile.probation_end);
  const annualDays = daysUntil(profile.annual_contract_end || profile.contract_period_end);
  const showJenanReminder = trial === "ending_soon" || (annualDays != null && annualDays >= 0 && annualDays <= 60);
  const visibleAlerts = (profile.alerts || []).filter(a => {
    if (a.type === "probation_end") return trial === "ending_soon";
    if (a.type === "annual_contract_expiry") return annualDays != null && annualDays >= 0;
    return true;
  });

  return (
    <div className="card mgr-profile-card rounded-[20px]">
      <div className="mgr-profile-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="my-learning-hero-icon shrink-0">
              <UserCircle size={26} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="my-learning-badge mb-2">THERAPIST PROFILE</div>
              <h3 className="my-learning-title m-0 text-lg">{getTherapistScheduleName(t)}</h3>
              <p className="my-learning-subtitle mt-1 mb-0 text-xs">{t.email || t.role || "Therapist"}</p>
            </div>
          </div>
          {onClose && (
            <button type="button" className="btn btn-ghost text-xs shrink-0" onClick={onClose}>Close</button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[
            { label: "Requests", val: req.total ?? 0 },
            { label: "Open", val: req.open ?? 0 },
            { label: "Clients", val: profile.assigned_clients ?? 0 },
            { label: "Hours (mo)", val: `${profile.hours_this_month ?? 0}h` },
          ].map(x => (
            <div key={x.label} className="mgr-profile-stat">
              <div className="font-bold text-base" style={{ color: "#2C3625" }}>{x.val}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#8B9E7A" }}>{x.label}</div>
            </div>
          ))}
        </div>

        {trial === "completed" && (
          <div className="mt-3">
            <StatusPill tone="success">Trial period completed{trialDays != null ? ` · ended ${Math.abs(trialDays)}d ago` : ""}</StatusPill>
          </div>
        )}
      </div>

      {visibleAlerts.length > 0 && (
        <div className="mgr-profile-alerts space-y-2">
          {visibleAlerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{
              background: a.severity === "urgent" ? "#FCE0E8" : "#FAF0D1",
              color: a.severity === "urgent" ? "#8B3A55" : "#6B5218",
            }}>
              <Warning size={14} weight="fill" className="shrink-0 mt-0.5"/>
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mgr-profile-sections space-y-2">
        <ProfileSection
          id="basic"
          openId={openSection}
          onToggle={setOpenSection}
          icon={<IdentificationCard size={18} weight="duotone" />}
          title="Basic info & contract dates"
          hint={`Start ${profile.contract_start?.slice(0, 10) || profile.contract_period_start?.slice(0, 10) || "—"}`}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs block">
              <span className="font-semibold" style={{ color: "#8B9E7A" }}>Contract start</span>
              <div className="font-bold mt-1 text-sm" style={{ color: "#2C3625" }}>
                {profile.contract_start?.slice(0, 10) || profile.contract_period_start?.slice(0, 10) || "—"}
              </div>
            </label>
            <label className="text-xs block">
              <span className="font-semibold" style={{ color: "#8B9E7A" }}>Annual contract end</span>
              <input type="date" className="input w-full mt-1 text-sm" value={annualEnd} onChange={e => setAnnualEnd(e.target.value)}/>
            </label>
            <div className="text-xs">
              <span className="font-semibold" style={{ color: "#8B9E7A" }}>Total hours</span>
              <div className="font-bold mt-1 text-sm" style={{ color: "#2C3625" }}>{profile.hours_total ?? 0}h</div>
            </div>
            <div className="text-xs">
              <span className="font-semibold" style={{ color: "#8B9E7A" }}>Requests answered</span>
              <div className="font-bold mt-1 text-sm" style={{ color: "#2C3625" }}>{req.answered ?? 0}</div>
            </div>
          </div>
          <div className="mt-3">
            <button type="button" className="btn btn-primary text-xs" onClick={saveProfile} disabled={saving}>
              <FloppyDisk size={14}/> {saving ? "Saving…" : "Save contract dates"}
            </button>
          </div>
        </ProfileSection>

        <ProfileSection
          id="trial"
          openId={openSection}
          onToggle={setOpenSection}
          icon={<Hourglass size={18} weight="duotone" />}
          title="Trial period & reminders"
          hint={trialEnd ? `Ends ${trialEnd}` : "Set trial end date"}
          badge={trial === "ending_soon" ? (
            <StatusPill tone={trialDays <= 14 ? "urgent" : "warning"}>{trialDays}d left</StatusPill>
          ) : trial === "completed" ? (
            <StatusPill tone="success">Completed</StatusPill>
          ) : null}
        >
          <label className="text-xs block mb-3">
            <span className="font-semibold" style={{ color: "#8B9E7A" }}>Trial period end (3 mo default)</span>
            <input type="date" className="input w-full mt-1 text-sm" value={trialEnd} onChange={e => setTrialEnd(e.target.value)}/>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary text-xs" onClick={saveProfile} disabled={saving}>
              <FloppyDisk size={14}/> {saving ? "Saving…" : "Save trial date"}
            </button>
            {showJenanReminder && (
              <button type="button" className="btn btn-secondary text-xs" onClick={sendReminder} disabled={reminding}>
                <Bell size={14}/> {reminding ? "Sending…" : "Send Jenan reminder"}
              </button>
            )}
          </div>
          {showJenanReminder ? (
            <p className="text-[10px] mt-2 mb-0" style={{ color: "#8B9E7A" }}>
              Reminder notifies Jenan to prepare trial + annual contracts before upcoming dates.
            </p>
          ) : (
            <p className="text-[10px] mt-2 mb-0" style={{ color: "#8B9E7A" }}>
              Jenan reminders appear when trial or annual contract is ending within 30–60 days.
            </p>
          )}
        </ProfileSection>

        <ProfileSection
          id="monthly"
          openId={openSection}
          onToggle={setOpenSection}
          icon={<ChartBar size={18} weight="duotone" />}
          title="Monthly evaluation"
          hint={`${monthly.length} upload${monthly.length === 1 ? "" : "s"}`}
        >
          <div className="flex gap-2 mb-2">
            <input type="month" className="input text-sm flex-1" value={monthlyPeriod} onChange={e => setMonthlyPeriod(e.target.value)}/>
            <button type="button" className="btn btn-secondary text-xs" onClick={() => monthlyRef.current?.click()}>
              <UploadSimple size={14}/> Upload
            </button>
            <input ref={monthlyRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => uploadEval("monthly", e.target.files?.[0])}/>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
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
        </ProfileSection>

        <ProfileSection
          id="annual"
          openId={openSection}
          onToggle={setOpenSection}
          icon={<CalendarCheck size={18} weight="duotone" />}
          title="Annual evaluation"
          hint={`${annual.length} upload${annual.length === 1 ? "" : "s"}`}
        >
          <div className="flex gap-2 mb-2">
            <input type="number" className="input text-sm w-24" value={annualYear} onChange={e => setAnnualYear(e.target.value)} min="2020" max="2035"/>
            <button type="button" className="btn btn-secondary text-xs" onClick={() => annualRef.current?.click()}>
              <UploadSimple size={14}/> Upload
            </button>
            <input ref={annualRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => uploadEval("annual", e.target.files?.[0])}/>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
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
        </ProfileSection>

        <ProfileSection
          id="meetings"
          openId={openSection}
          onToggle={setOpenSection}
          icon={<CalendarBlank size={18} weight="duotone" />}
          title="Manager meetings"
          hint={meetings.length ? `Last ${meetings[0]?.date?.slice(0, 10) || "—"}` : "Schedule a meeting"}
        >
          <div className="grid sm:grid-cols-2 gap-2 mb-2">
            <input type="date" className="input text-sm" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} placeholder="Meeting date"/>
            <input className="input text-sm" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} placeholder="Meeting notes (optional)"/>
          </div>
          {meetings.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto mb-2">
              {meetings.slice(0, 8).map(m => (
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
        </ProfileSection>

        <ProfileSection
          id="leave"
          openId={openSection}
          onToggle={setOpenSection}
          icon={<Briefcase size={18} weight="duotone" />}
          title="Leave balance"
          hint={`${profile.leave_balance ?? "—"} / ${profile.annual_balance ?? 30} days`}
          badge={(profile.leave_balance != null && Number(profile.leave_balance) < 5) ? (
            <StatusPill tone="warning">Low balance</StatusPill>
          ) : null}
        >
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Remaining</div>
              <div className="font-bold text-lg" style={{ color: "#2C3625" }}>{profile.leave_balance ?? "—"} days</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Annual allowance</div>
              <div className="font-bold text-lg" style={{ color: "#2C3625" }}>{profile.annual_balance ?? 30} days</div>
            </div>
          </div>
        </ProfileSection>

        {profile.trainings?.length > 0 && (
          <ProfileSection
            id="trainings"
            openId={openSection}
            onToggle={setOpenSection}
            icon={<FileText size={18} weight="duotone" />}
            title="Training / report uploads"
            hint={`${profile.trainings.length} report${profile.trainings.length === 1 ? "" : "s"}`}
          >
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {profile.trainings.map(tr => (
                <div key={tr.id} className="flex justify-between text-xs py-1.5 border-b" style={{ borderColor: "#EDE9E3" }}>
                  <span style={{ color: "#2C3625" }}>{tr.title || tr.attachment_file_name || "Report"}</span>
                  <span style={{ color: "#8B9E7A" }}>{tr.report_date || tr.created_at?.slice(0, 10)} · {tr.status}</span>
                </div>
              ))}
            </div>
          </ProfileSection>
        )}
      </div>
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
