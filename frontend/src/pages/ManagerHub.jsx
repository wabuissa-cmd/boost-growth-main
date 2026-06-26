import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth, isJenan } from "../auth";
import PageBanner from "../components/PageBanner";
import Requests from "./Requests";
import LeaveRequests from "./LeaveRequests";
import LeaveBalance from "./LeaveBalance";
import {
  MagnifyingGlass, Warning, UserCircle, FileText,
} from "@phosphor-icons/react";
import { getTherapistScheduleName } from "../scheduleConstants";

const MAIN_TABS = [
  { id: "staff", label: "Therapists' Requests", testid: "mgr-tab-staff" },
  { id: "leave", label: "Leave Requests", testid: "mgr-tab-leave" },
  { id: "balance", label: "Leave Balance", testid: "mgr-tab-balance" },
  { id: "profiles", label: "Therapist Profiles", testid: "mgr-tab-profiles" },
];

function TherapistProfilePanel({ therapistId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!therapistId) return;
    setLoading(true);
    api.get(`/hr/therapist/${therapistId}/profile`)
      .then(({ data }) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [therapistId]);

  if (!therapistId) return null;
  if (loading) return <div className="card p-8 text-center"><div className="spinner mx-auto"/></div>;
  if (!profile) return <div className="card p-6 text-sm text-center" style={{ color: "#8B9E7A" }}>Could not load profile</div>;

  const t = profile.therapist || {};
  const req = profile.requests || {};

  return (
    <div className="card p-4 rounded-[20px]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-lg m-0" style={{ color: "#2C3625" }}>{getTherapistScheduleName(t)}</h3>
          <p className="text-xs mt-1" style={{ color: "#8B9E7A" }}>{t.email || t.role || "Therapist"}</p>
        </div>
        {onClose && (
          <button type="button" className="btn btn-ghost text-xs" onClick={onClose}>Close</button>
        )}
      </div>

      {profile.alerts?.length > 0 && (
        <div className="space-y-2 mb-4">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
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

      <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Leave balance</div>
          <div className="font-bold" style={{ color: "#2C3625" }}>
            {profile.leave_balance ?? "—"} / {profile.annual_balance ?? 30} days
          </div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Contract start</div>
          <div className="font-bold text-xs" style={{ color: "#2C3625" }}>
            {profile.contract_start?.slice(0, 10) || profile.contract_period_start?.slice(0, 10) || "—"}
          </div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Annual contract end</div>
          <div className="font-bold text-xs" style={{ color: "#2C3625" }}>
            {profile.annual_contract_end?.slice(0, 10) || profile.contract_period_end?.slice(0, 10) || "—"}
          </div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Probation end (3 mo)</div>
          <div className="font-bold text-xs" style={{ color: "#2C3625" }}>
            {profile.probation_end?.slice(0, 10) || "—"}
          </div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Hours this month</div>
          <div className="font-bold" style={{ color: "#2C3625" }}>{profile.hours_this_month ?? 0}h</div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>Total hours</div>
          <div className="font-bold" style={{ color: "#2C3625" }}>{profile.hours_total ?? 0}h</div>
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
            <p className="text-sm" style={{ color: "#8B9E7A" }}>Select a therapist to view requests, leave balance, contract, and training uploads</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManagerHub() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!isJenan(user)) {
    return <Navigate to="/home" replace />;
  }

  const activeTab = MAIN_TABS.some(t => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "staff";

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page-enter">
      <PageBanner
        title="Manager Hub"
        subtitle="Review therapists' requests · leave balances · profiles"
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
      {activeTab === "leave" && <LeaveRequests embedded />}
      {activeTab === "balance" && <LeaveBalance embedded staffScope />}
      {activeTab === "profiles" && <TherapistProfilesTab />}
    </div>
  );
}
