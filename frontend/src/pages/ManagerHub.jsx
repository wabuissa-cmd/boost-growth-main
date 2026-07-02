import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import api, { API, openAuthenticatedFile } from "../api";
import { useAuth, canAccessManagerHub, isJenan } from "../auth";
import PageBanner from "../components/PageBanner";
import PortalPageHeader from "../components/PortalPageHeader";
import Requests from "./Requests";
import LeaveBalance from "./LeaveBalance";
import {
  MagnifyingGlass, Warning, UserCircle, FileText, Bell, UploadSimple,
  FloppyDisk, DownloadSimple, CalendarBlank, ArrowLeft, X,
  IdentificationCard, CalendarCheck, ChartBar, CaretLeft, CaretRight, ListBullets,
} from "@phosphor-icons/react";
import { getTherapistScheduleName, sortTherapistsForSchedule } from "../scheduleConstants";

const MAIN_TABS = [
  { id: "staff", label: "Therapists' Requests", testid: "mgr-tab-staff" },
  { id: "balance", label: "Leave Balance", testid: "mgr-tab-balance" },
  { id: "profiles", label: "Therapist Profiles", testid: "mgr-tab-profiles" },
  { id: "calendar", label: "Evaluation Calendar", testid: "mgr-tab-calendar" },
];

async function viewFile(url) {
  try {
    await openAuthenticatedFile(url, { errorMessage: "Could not open file" });
  } catch (e) {
    alert(e?.message || "Could not open file");
  }
}

const TRIAL_ALERT_DAYS = 30;

const PROFILE_TABS = [
  { id: "overview", label: "Overview", icon: IdentificationCard, testId: "mgr-profile-tab-overview" },
  { id: "contract", label: "Contract", icon: FileText, testId: "mgr-profile-tab-contract" },
  { id: "evaluations", label: "Evaluations", icon: ChartBar, testId: "mgr-profile-tab-evaluations" },
  { id: "meetings", label: "Meetings", icon: CalendarBlank, testId: "mgr-profile-tab-meetings" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(String(iso).slice(0, 10)).toLocaleDateString("en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

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

function StatusPill({ children, tone = "neutral" }) {
  const styles = {
    neutral: { background: "#EDE9E3", color: "#5C6853" },
    success: { background: "#E5EBE1", color: "#3D5235" },
    warning: { background: "#FAF0D1", color: "#6B5218" },
    info: { background: "#E8EEF5", color: "#3D4F5C" },
  }[tone] || { background: "#EDE9E3", color: "#5C6853" };
  return (
    <span className="mgr-profile-pill" style={styles}>{children}</span>
  );
}

function ProfileField({ label, value, children }) {
  return (
    <div className="mgr-profile-field">
      <div className="mgr-profile-field-label">{label}</div>
      {children || <div className="mgr-profile-field-value">{value ?? "—"}</div>}
    </div>
  );
}

function EvalFileList({ items, therapistId, emptyLabel }) {
  if (!items.length) {
    return <div className="mgr-profile-empty-row">{emptyLabel}</div>;
  }
  return (
    <ul className="mgr-profile-file-list">
      {items.map(ev => (
        <li key={ev.id} className="mgr-profile-file-row">
          <span className="mgr-profile-file-name">
            {ev.month || ev.year || ev.uploaded_at?.slice(0, 10) || "Upload"}
          </span>
          <button
            type="button"
            className="mgr-profile-file-link"
            onClick={() => viewFile(`${API}/hr/therapist/${therapistId}/evaluations/${ev.id}/file`)}
          >
            <DownloadSimple size={14} /> View
          </button>
        </li>
      ))}
    </ul>
  );
}

function TherapistProfilePanel({ therapistId, onClose, mobile = false }) {
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
  const [activeTab, setActiveTab] = useState("overview");
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
        setActiveTab(phase === "ending_soon" ? "contract" : "overview");
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
  if (loading) {
    return (
      <div className="mgr-profile-detail-card card">
        <div className="mgr-profile-loading"><div className="spinner" /></div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mgr-profile-detail-card card">
        <div className="mgr-profile-loading" style={{ color: "#8B9E7A" }}>Could not load profile</div>
      </div>
    );
  }

  const t = profile.therapist || {};
  const req = profile.requests || {};
  const monthly = profile.monthly_evaluations || [];
  const annual = profile.annual_evaluations || [];
  const meetings = profile.manager_meetings || [];
  const trial = trialPhase(profile);
  const trialDays = profile.trial_days_left ?? daysUntil(profile.probation_end);
  const annualDays = daysUntil(profile.annual_contract_end || profile.contract_period_end);
  const contractStart = profile.contract_start?.slice(0, 10) || profile.contract_period_start?.slice(0, 10);
  const showJenanReminder = trial === "ending_soon" || (annualDays != null && annualDays >= 0 && annualDays <= 60);
  const showTrialBanner = trial === "ending_soon";

  const trialStatusPill = () => {
    if (trial === "completed") {
      return <StatusPill tone="success">Trial completed</StatusPill>;
    }
    if (trial === "ending_soon") {
      return <StatusPill tone="warning">{trialDays} days left on trial</StatusPill>;
    }
    if (trial === "active" && trialDays != null) {
      return <StatusPill tone="neutral">{trialDays} days on trial</StatusPill>;
    }
    return null;
  };

  const contractFooter = activeTab === "contract" ? (
    <div className="mgr-profile-tab-footer">
      <button type="button" className="btn btn-primary text-sm" onClick={saveProfile} disabled={saving}>
        <FloppyDisk size={15} /> {saving ? "Saving…" : "Save contract dates"}
      </button>
      {showJenanReminder && (
        <button type="button" className="btn btn-secondary text-sm" onClick={sendReminder} disabled={reminding}>
          <Bell size={15} /> {reminding ? "Sending…" : "Notify Jenan"}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className={`mgr-profile-detail-card card${mobile ? " is-mobile-sheet" : ""}`}>
      <div className="mgr-profile-detail-head">
        <div className="mgr-profile-detail-hero-row">
          {mobile && onClose && (
            <button type="button" className="mgr-profile-back-btn" onClick={onClose} aria-label="Back to list">
              <ArrowLeft size={20} weight="bold" />
            </button>
          )}
          <div className="mgr-profile-detail-hero-icon">
            <UserCircle size={26} weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mgr-profile-detail-name">{getTherapistScheduleName(t)}</h2>
            <p className="mgr-profile-detail-meta">{t.email || t.role || "Therapist"}</p>
            <div className="mgr-profile-detail-pills">
              {trialStatusPill()}
              {profile.leave_balance != null && Number(profile.leave_balance) < 5 && (
                <StatusPill tone="warning">Low leave · {profile.leave_balance}d</StatusPill>
              )}
            </div>
          </div>
          {!mobile && onClose && (
            <button type="button" className="btn btn-ghost text-xs shrink-0 min-h-[44px]" onClick={onClose}>
              <X size={16} /> Close
            </button>
          )}
        </div>

        <div className="mgr-profile-detail-stats">
          {[
            { label: "Requests", val: req.total ?? 0 },
            { label: "Open", val: req.open ?? 0 },
            { label: "Clients", val: profile.assigned_clients ?? 0 },
            { label: "Hours (mo)", val: `${profile.hours_this_month ?? 0}h` },
          ].map(x => (
            <div key={x.label} className="mgr-profile-detail-stat">
              <span className="mgr-profile-detail-stat-val">{x.val}</span>
              <span className="mgr-profile-detail-stat-lbl">{x.label}</span>
            </div>
          ))}
        </div>
      </div>

      {showTrialBanner && (
        <div className="mgr-profile-notice mgr-profile-notice--warning">
          <Warning size={16} weight="fill" />
          <span>Trial period ends {fmtDate(profile.probation_end)} — {trialDays} days remaining.</span>
        </div>
      )}

      <div className="center-test-steps-bar mgr-profile-detail-tabs">
        {PROFILE_TABS.map((tab, i) => (
          <span key={tab.id} className="mgr-profile-tab-wrap">
            {i > 0 && <div className="center-test-step-line" />}
            <button
              type="button"
              data-testid={tab.testId}
              className={`center-test-step portal-page-view-step mgr-profile-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="center-test-step-num">
                <tab.icon size={14} weight={activeTab === tab.id ? "fill" : "duotone"} />
              </span>
              <span className={`center-test-step-label${activeTab === tab.id ? " font-semibold" : ""}`}>
                {tab.label}
              </span>
            </button>
          </span>
        ))}
      </div>

      <div className="mgr-profile-tab-body">
        {activeTab === "overview" && (
          <div className="mgr-profile-tab-panel">
            <div className="mgr-profile-section-label">Summary</div>
            <div className="mgr-profile-summary-grid">
              <ProfileField label="Contract start" value={fmtDate(contractStart)} />
              <ProfileField label="Annual contract end" value={fmtDate(annualEnd)} />
              <ProfileField label="Trial end" value={fmtDate(trialEnd)} />
              <ProfileField label="Total hours" value={`${profile.hours_total ?? 0}h`} />
              <ProfileField label="Leave remaining" value={`${profile.leave_balance ?? "—"} / ${profile.annual_balance ?? 30} days`} />
              <ProfileField label="Requests answered" value={req.answered ?? 0} />
            </div>
            {annualDays != null && annualDays >= 0 && annualDays <= 60 && (
              <div className="mgr-profile-inline-note">
                Annual contract expires {fmtDate(annualEnd)} ({annualDays} days left).
              </div>
            )}
            {profile.trainings?.length > 0 && (
              <>
                <div className="mgr-profile-section-label mt-4">Training reports</div>
                <ul className="mgr-profile-file-list">
                  {profile.trainings.slice(0, 6).map(tr => (
                    <li key={tr.id} className="mgr-profile-file-row">
                      <span className="mgr-profile-file-name">{tr.title || tr.attachment_file_name || "Report"}</span>
                      <span className="mgr-profile-file-meta">{tr.report_date || tr.created_at?.slice(0, 10)} · {tr.status}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {activeTab === "contract" && (
          <div className="mgr-profile-tab-panel">
            <div className="mgr-profile-section-label">Contract dates</div>
            <div className="mgr-profile-form-grid">
              <ProfileField label="Contract start">
                <div className="mgr-profile-field-value">{fmtDate(contractStart)}</div>
              </ProfileField>
              <ProfileField label="Annual contract end">
                <input type="date" className="input w-full text-sm" value={annualEnd} onChange={e => setAnnualEnd(e.target.value)} />
              </ProfileField>
            </div>

            <div className="mgr-profile-section-label mt-5">Trial period</div>
            <div className="mgr-profile-form-grid">
              <ProfileField label="Trial end date">
                <input type="date" className="input w-full text-sm" value={trialEnd} onChange={e => setTrialEnd(e.target.value)} />
              </ProfileField>
              <ProfileField label="Status">
                <div className="pt-1">{trialStatusPill() || <span className="text-sm" style={{ color: "#8B9E7A" }}>No trial date set</span>}</div>
              </ProfileField>
            </div>

            {showJenanReminder && (
              <p className="mgr-profile-help-text">
                Notify Jenan to prepare trial and annual contracts before upcoming dates.
              </p>
            )}
          </div>
        )}

        {activeTab === "evaluations" && (
          <div className="mgr-profile-tab-panel">
            <div className="mgr-profile-section-label">Trial period evaluation</div>
            <div className="mgr-profile-upload-row">
              <input type="month" className="input text-sm flex-1" value={monthlyPeriod} onChange={e => setMonthlyPeriod(e.target.value)} aria-label="Evaluation period" />
              <button type="button" className="btn btn-secondary text-sm shrink-0" onClick={() => monthlyRef.current?.click()}>
                <UploadSimple size={15} /> Upload
              </button>
              <input ref={monthlyRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => uploadEval("monthly", e.target.files?.[0])} />
            </div>
            <EvalFileList items={monthly} therapistId={therapistId} emptyLabel="No trial period evaluations uploaded yet." />

            <div className="mgr-profile-section-label mt-5">Annual evaluation</div>
            <div className="mgr-profile-upload-row">
              <input type="number" className="input text-sm w-28" value={annualYear} onChange={e => setAnnualYear(e.target.value)} min="2020" max="2035" aria-label="Year" />
              <button type="button" className="btn btn-secondary text-sm shrink-0" onClick={() => annualRef.current?.click()}>
                <UploadSimple size={15} /> Upload
              </button>
              <input ref={annualRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => uploadEval("annual", e.target.files?.[0])} />
            </div>
            <EvalFileList items={annual} therapistId={therapistId} emptyLabel="No annual evaluations uploaded yet." />
          </div>
        )}

        {activeTab === "meetings" && (
          <div className="mgr-profile-tab-panel">
            <div className="mgr-profile-section-label">Schedule a meeting</div>
            <div className="mgr-profile-form-grid">
              <ProfileField label="Date">
                <input type="date" className="input w-full text-sm" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              </ProfileField>
              <ProfileField label="Notes (optional)">
                <input className="input w-full text-sm" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} placeholder="Discussion topics…" />
              </ProfileField>
            </div>
            <button type="button" className="btn btn-secondary text-sm mt-3" onClick={saveProfile} disabled={saving || !meetingDate}>
              <CalendarCheck size={15} /> Add meeting
            </button>

            <div className="mgr-profile-section-label mt-5">Meeting history</div>
            {meetings.length > 0 ? (
              <ul className="mgr-profile-meeting-list">
                {meetings.slice(0, 12).map(m => (
                  <li key={m.id} className="mgr-profile-meeting-row">
                    <CalendarBlank size={14} weight="duotone" className="shrink-0" />
                    <span><strong>{fmtDate(m.date)}</strong>{m.notes ? ` — ${m.notes}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mgr-profile-empty-row">No manager meetings recorded yet.</div>
            )}
          </div>
        )}
      </div>

      {contractFooter}
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function evalTone(entry, todayIso) {
  if (entry.date < todayIso) return "past";
  const days = daysUntil(entry.date);
  if (days != null && days <= 7) return "soon";
  return "upcoming";
}

function EvaluationCalendarTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [view, setView] = useState("list");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/hr/evaluation-calendar", { params: { year } })
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [year]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const entries = data?.entries || [];
  const summary = data?.summary || {};

  const byMonth = useMemo(() => {
    const map = Array.from({ length: 12 }, (_, i) => ({ month: i, label: MONTH_NAMES[i], items: [] }));
    for (const e of entries) {
      const m = parseInt(e.date.slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) map[m].items.push(e);
    }
    return map;
  }, [entries]);

  const monthEntries = byMonth[selectedMonth]?.items || [];

  const renderEntry = (entry) => {
    const tone = evalTone(entry, todayIso);
    return (
      <li key={`${entry.therapist_id}-${entry.eval_type}-${entry.date}`} className={`mgr-cal-entry mgr-cal-entry--${tone}`}>
        <span className="mgr-cal-entry-date">{fmtDate(entry.date)}</span>
        <span className="mgr-cal-entry-name">{entry.therapist_name}</span>
        <span className={`mgr-cal-entry-type mgr-cal-entry-type--${entry.eval_type}`}>
          {entry.eval_type === "trial" ? "Trial period" : "Annual"}
        </span>
      </li>
    );
  };

  return (
    <div className="mgr-cal-page" dir="ltr">
      <PortalPageHeader
        prefix="mgr-cal"
        badge="MANAGER HUB"
        title="Evaluation Calendar"
        subtitle="Trial period evaluations every 3 months and annual evaluations from each therapist's contract start"
        icon={CalendarBlank}
        stats={[
          { label: "This year", n: summary.total ?? 0, color: "#2C3625" },
          { label: "Upcoming", n: summary.upcoming ?? 0, color: "#3D4F35" },
          { label: "Trial", n: summary.trial ?? 0, color: "#6B5218" },
          { label: "Annual", n: summary.annual ?? 0, color: "#3D4F5C" },
        ]}
        toolbar={(
          <div className="mgr-cal-toolbar">
            <div className="mgr-cal-year-nav">
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setYear(y => y - 1)} aria-label="Previous year">
                <CaretLeft size={18} weight="bold" />
              </button>
              <span className="mgr-cal-year-label">{year}</span>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setYear(y => y + 1)} aria-label="Next year">
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
            <div className="mgr-cal-view-toggle">
              <button
                type="button"
                className={`mgr-cal-view-btn${view === "calendar" ? " active" : ""}`}
                onClick={() => setView("calendar")}
              >
                <CalendarBlank size={15} /> Month
              </button>
              <button
                type="button"
                className={`mgr-cal-view-btn${view === "list" ? " active" : ""}`}
                onClick={() => setView("list")}
              >
                <ListBullets size={15} /> List
              </button>
            </div>
          </div>
        )}
      />

      {loading ? (
        <div className="card mgr-cal-loading"><div className="spinner" /></div>
      ) : !data ? (
        <div className="card mgr-cal-empty">Could not load evaluation calendar.</div>
      ) : view === "calendar" ? (
        <div className="mgr-cal-layout">
          <div className="card mgr-cal-month-grid">
            {byMonth.map((m) => (
              <button
                key={m.month}
                type="button"
                className={`mgr-cal-month-cell${selectedMonth === m.month ? " is-active" : ""}${m.items.length ? " has-items" : ""}`}
                onClick={() => setSelectedMonth(m.month)}
              >
                <span className="mgr-cal-month-name">{m.label.slice(0, 3)}</span>
                <span className="mgr-cal-month-count">{m.items.length || "—"}</span>
              </button>
            ))}
          </div>
          <div className="card mgr-cal-month-detail">
            <h3 className="mgr-cal-month-title">{MONTH_NAMES[selectedMonth]} {year}</h3>
            {monthEntries.length ? (
              <ul className="mgr-cal-entry-list">{monthEntries.map(renderEntry)}</ul>
            ) : (
              <div className="mgr-profile-empty-row">No evaluations scheduled this month.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="card mgr-cal-list">
          {byMonth.filter(m => m.items.length > 0).map(m => (
            <section key={m.month} className="mgr-cal-list-section">
              <h3 className="mgr-cal-list-month">{m.label} {year}</h3>
              <ul className="mgr-cal-entry-list">{m.items.map(renderEntry)}</ul>
            </section>
          ))}
          {!entries.length && (
            <div className="mgr-profile-empty-row">No evaluation dates for {year}. Check contract start dates on therapist profiles.</div>
          )}
        </div>
      )}
    </div>
  );
}

function TherapistProfilesTab() {
  const [therapists, setTherapists] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    api.get("/therapists").then(({ data }) => setTherapists(sortTherapistsForSchedule(Array.isArray(data) ? data : []))).catch(() => {});
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => { if (!mq.matches) setMobileOpen(false); };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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

  const selectTherapist = (id) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen(true);
  };

  const closeProfile = () => {
    setSelectedId("");
    setMobileOpen(false);
  };

  const selectedTherapist = therapists.find(t => t.id === selectedId);

  return (
    <div className="mgr-profile-page" dir="ltr">
      <PortalPageHeader
        prefix="mgr-profile"
        badge="MANAGER HUB"
        title="Therapist Profiles"
        subtitle="Contract dates, evaluations, and manager meetings — select a team member to review or update"
        icon={UserCircle}
        stats={[
          { label: "Team", n: therapists.length, color: "#2C3625" },
          { label: "Showing", n: filtered.length, color: "#3D4F35" },
        ]}
      />

      <div className={`mgr-profile-layout${selectedId ? " has-selection" : ""}`}>
        <aside className={`card mgr-profile-sidebar${mobileOpen ? " is-hidden-mobile" : ""}`}>
          <div className="mgr-profile-sidebar-head">
            <h2>Team members</h2>
            <p>{filtered.length} therapist{filtered.length === 1 ? "" : "s"}</p>
          </div>
          <div className="mgr-profile-search-wrap">
            <MagnifyingGlass size={16} className="mgr-profile-search-icon" />
            <input
              className="input w-full mgr-profile-search-input"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="mgr-profile-list" role="listbox" aria-label="Therapists">
            {filtered.map(t => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={selectedId === t.id}
                onClick={() => selectTherapist(t.id)}
                className={`mgr-profile-list-row${selectedId === t.id ? " is-active" : ""}`}
              >
                <span className="mgr-profile-list-avatar">{(getTherapistScheduleName(t) || "?").charAt(0)}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="mgr-profile-list-name">{getTherapistScheduleName(t)}</span>
                  {t.email && <span className="mgr-profile-list-meta">{t.email}</span>}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <div className="mgr-profile-empty-row">No therapists match your search.</div>
            )}
          </div>
        </aside>

        <main className="mgr-profile-main">
          {selectedId && !mobileOpen ? (
            <TherapistProfilePanel therapistId={selectedId} onClose={closeProfile} />
          ) : !selectedId ? (
            <div className="card mgr-profile-placeholder">
              <UserCircle size={48} weight="duotone" className="mgr-profile-placeholder-icon" />
              <h3>Select a therapist</h3>
              <p>Choose someone from the list to view contract dates, upload evaluations, and log manager meetings.</p>
            </div>
          ) : null}
        </main>
      </div>

      {mobileOpen && selectedId && (
        <>
          <button type="button" className="mgr-profile-mobile-backdrop" aria-label="Close profile" onClick={closeProfile} />
          <div className="mgr-profile-mobile-sheet" role="dialog" aria-label={selectedTherapist ? getTherapistScheduleName(selectedTherapist) : "Therapist profile"}>
            <TherapistProfilePanel therapistId={selectedId} onClose={closeProfile} mobile />
          </div>
        </>
      )}
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
      {activeTab === "calendar" && <EvaluationCalendarTab />}
    </div>
  );
}
