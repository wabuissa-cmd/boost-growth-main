import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { MagnifyingGlass, Eye } from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";
import { useAuth, canManuallySetClientStatus } from "../auth";

const SUPERVISION_TABS = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

function serviceBadge(service) {
  if (!service) return null;
  const s = String(service).toUpperCase();
  if (s.includes("HS") && s.includes("SS")) return { text: "HS / SS", bg: "#EDE9E3", color: "#2C3625" };
  if (s.includes("SS")) return { text: "SS", bg: "#E8F0E4", color: "#3D5A40" };
  if (s.includes("HS")) return { text: "HS", bg: "#F4EDE0", color: "#6B5A3E" };
  return { text: service, bg: "#EDE9E3", color: "#2C3625" };
}

function normalizeSupervisorLabel(s) {
  const raw = (s || "").trim();
  if (!raw) return "Unassigned";
  const low = raw.toLowerCase();
  if (low.includes("fahd")) return "Ms. Fahda";
  if (low.includes("maha")) return "Ms. Maha";
  if (low.includes("jenan") || low.includes("genan")) return "Ms. Jenan";
  if (low.startsWith("ms.")) return `Ms. ${raw.replace(/^ms\.\s*/i, "").trim()}`;
  return raw;
}

function supervisorKey(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("fahda")) return "fahda";
  if (l.includes("maha")) return "maha";
  return "other";
}

function CompactTable({ rows, canEditStatus, onSetStatus }) {
  return (
    <div className="overflow-x-auto border border-[#EDE9E3] rounded-xl bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-[#FAFAF7] sticky top-0 z-[1]">
          <tr className="text-left" style={{ color: "#6B7568" }}>
            <th className="px-3 py-2 font-semibold whitespace-nowrap">File</th>
            <th className="px-3 py-2 font-semibold">Client</th>
            <th className="px-3 py-2 font-semibold">Therapist</th>
            <th className="px-3 py-2 font-semibold whitespace-nowrap">Service</th>
            <th className="px-3 py-2 font-semibold whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1EEE6]">
          {rows.map((r) => {
            const svc = serviceBadge(r.service);
            const inactive = (r.status || "Active") === "Inactive";
            return (
              <tr key={r.id || r.file_no}>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs" style={{ color: "#2C3625" }}>
                  #{r.file_no || "—"}
                </td>
                <td className="px-3 py-2 font-semibold" style={{ color: inactive ? "#9CA3AF" : "#2C3625" }}>
                  {r.name || "—"}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "#6B7568" }}>
                  {r.main_therapist || "—"}
                </td>
                <td className="px-3 py-2">
                  {svc ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: svc.bg, color: svc.color }}>
                      {svc.text}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {canEditStatus && r.id ? (
                    <select
                      className="input text-sm py-1 px-2 h-8"
                      value={r.status || "Active"}
                      onChange={(e) => onSetStatus?.(r, e.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  ) : (
                    <span className={inactive ? "text-xs font-bold text-[#6B7280]" : "text-xs font-bold text-[#3D5A40]"}>
                      {inactive ? "Inactive" : "Active"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-10 text-center text-sm" style={{ color: "#8B9E7A" }} colSpan={5}>
                No clients to show
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SupervisorPane({ label, rows, accent, canEditStatus, onSetStatus }) {
  return (
    <section className="supervision-pane portal-surface p-0 overflow-hidden">
      <div className="supervision-pane-head" style={{ borderLeft: `4px solid ${accent}` }}>
        <div>
          <h2 className="text-sm font-bold m-0" style={{ color: "#2C3625" }}>{label}</h2>
          <p className="text-xs m-0 mt-0.5" style={{ color: "#6B7568" }}>
            {rows.length} client{rows.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="supervision-pane-scroll">
        <CompactTable rows={rows} canEditStatus={canEditStatus} onSetStatus={onSetStatus} />
      </div>
    </section>
  );
}

export default function SupervisionCaseload() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    api.get("/clients/supervision-caseload")
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ fahda: [], maha: [], other: [], counts: {} }))
      .finally(() => setLoading(false));
  }, []);

  const canEditStatus = canManuallySetClientStatus(user);

  const filterRow = useCallback((r) => {
    const q = search.trim().toLowerCase();
    const wantInactive = tab === "inactive";
    const isInactive = (r.status || "Active") === "Inactive";
    if (wantInactive !== isInactive) return false;
    if (!q) return true;
    return (
      (r.name || "").toLowerCase().includes(q)
      || (r.file_no || "").includes(q)
      || (r.main_therapist || "").toLowerCase().includes(q)
      || (r.supervisor || "").toLowerCase().includes(q)
    );
  }, [search, tab]);

  const allRows = useMemo(() => {
    const d = data || {};
    return [
      ...(d.fahda || []),
      ...(d.maha || []),
      ...(d.other || []),
    ];
  }, [data]);

  const filteredRows = useMemo(() => allRows.filter(filterRow), [allRows, filterRow]);

  const fahdaRows = useMemo(
    () => filteredRows
      .filter((r) => supervisorKey(normalizeSupervisorLabel(r.supervisor)) === "fahda")
      .sort((a, b) => String(a.file_no || "").localeCompare(String(b.file_no || ""))),
    [filteredRows],
  );

  const mahaRows = useMemo(
    () => filteredRows
      .filter((r) => supervisorKey(normalizeSupervisorLabel(r.supervisor)) === "maha")
      .sort((a, b) => String(a.file_no || "").localeCompare(String(b.file_no || ""))),
    [filteredRows],
  );

  const otherGroups = useMemo(() => {
    const map = new Map();
    for (const r of filteredRows) {
      const key = supervisorKey(normalizeSupervisorLabel(r.supervisor));
      if (key === "fahda" || key === "maha") continue;
      const label = normalizeSupervisorLabel(r.supervisor);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    }
    return Array.from(map.entries())
      .map(([label, rows]) => ({
        label,
        rows: rows.slice().sort((a, b) => String(a.file_no || "").localeCompare(String(b.file_no || ""))),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredRows]);

  const counts = useMemo(() => {
    const active = allRows.filter(r => (r.status || "Active") !== "Inactive").length;
    const inactive = allRows.length - active;
    return { all: allRows.length, active, inactive };
  }, [allRows]);

  const setStatus = async (row, status) => {
    if (!row?.id) return;
    setSavingId(row.id);
    try {
      await api.put(`/clients/${row.id}/status-override`, { status, manual_override: true });
      setData((prev) => {
        if (!prev) return prev;
        const patchList = (xs) => (xs || []).map((x) => (x.id === row.id ? { ...x, status } : x));
        return { ...prev, fahda: patchList(prev.fahda), maha: patchList(prev.maha), other: patchList(prev.other) };
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="portal-page-shell page-enter" dir="ltr">
      <PageBanner
        title="Supervision"
        subtitle="Ms. Fahda and Ms. Maha caseloads side by side — scroll inside each panel"
        eyebrow="CLINICAL"
        badge={(
          <span className="editorial-banner__icon-badge" aria-hidden>
            <Eye size={20} weight="duotone" />
          </span>
        )}
        tabs={SUPERVISION_TABS}
        activeTab={tab}
        onTabChange={setTab}
        stats={[
          { label: "Total", n: counts.all ?? "—", color: "#2C3625" },
          { label: "Active", n: counts.active ?? "—", color: "#3D5A40" },
          { label: "Inactive", n: counts.inactive ?? "—", color: "#6B7280" },
        ]}
        className="editorial-banner--compact-mobile"
        toolbar={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B9E7A" }} />
              <input
                data-testid="supervision-search"
                className="input pl-9 w-full"
                placeholder="Search name, file #, therapist, supervisor…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {savingId && (
              <div className="text-xs" style={{ color: "#8B9E7A" }}>
                Saving…
              </div>
            )}
          </div>
        )}
      />

      <section className="portal-content-panel portal-page-body">
      {loading ? (
        <div className="p-16 text-center" style={{ color: "#8B9E7A" }}>
          <div className="spinner mx-auto mb-3" />
          Loading supervision caseload…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="supervision-split">
            <SupervisorPane
              label="Ms. Fahda"
              rows={fahdaRows}
              accent="#A2C4C9"
              canEditStatus={canEditStatus}
              onSetStatus={setStatus}
            />
            <SupervisorPane
              label="Ms. Maha"
              rows={mahaRows}
              accent="#B6D7A8"
              canEditStatus={canEditStatus}
              onSetStatus={setStatus}
            />
          </div>

          {otherGroups.length > 0 && (
            <div className="space-y-4">
              {otherGroups.map((g) => (
                <SupervisorPane
                  key={g.label}
                  label={g.label}
                  rows={g.rows}
                  accent="#C9C0A8"
                  canEditStatus={canEditStatus}
                  onSetStatus={setStatus}
                />
              ))}
            </div>
          )}

          {fahdaRows.length === 0 && mahaRows.length === 0 && otherGroups.length === 0 && (
            <div className="p-12 text-center text-sm" style={{ color: "#8B9E7A" }}>
              No clients found.
            </div>
          )}
        </div>
      )}
      </section>
    </div>
  );
}
