import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { MagnifyingGlass, UsersThree } from "@phosphor-icons/react";
import PageBanner from "../components/PageBanner";

const SUPERVISORS = [
  { key: "fahda", label: "Ms. Fahda", labelAr: "فهداء", accent: "#6B8F71" },
  { key: "maha", label: "Ms. Maha", labelAr: "مها", accent: "#8FA481" },
];

function serviceBadge(service) {
  if (!service) return null;
  const s = String(service).toUpperCase();
  if (s.includes("HS") && s.includes("SS")) return { text: "HS / SS", bg: "#EDE9E3", color: "#2C3625" };
  if (s.includes("SS")) return { text: "SS", bg: "#E8F0E4", color: "#3D5A40" };
  if (s.includes("HS")) return { text: "HS", bg: "#F4EDE0", color: "#6B5A3E" };
  return { text: service, bg: "#EDE9E3", color: "#2C3625" };
}

function CaseloadColumn({ supervisor, rows, search, onSelect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.name || "").toLowerCase().includes(q)
      || (r.file_no || "").includes(q)
      || (r.main_therapist || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const activeCount = filtered.filter(r => (r.status || "Active") !== "Inactive").length;

  return (
    <section className="card overflow-hidden flex flex-col min-h-[420px]">
      <header
        className="px-5 py-4 border-b flex items-center justify-between gap-3"
        style={{ background: `linear-gradient(135deg, ${supervisor.accent}22 0%, #FAFAF7 100%)`, borderColor: "#E2DDD4" }}
      >
        <div>
          <h2 className="font-display text-xl m-0" style={{ color: "#2C3625" }}>{supervisor.label}</h2>
          <div className="text-xs mt-0.5" style={{ color: "#6B7568" }}>{supervisor.labelAr}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none" style={{ color: supervisor.accent }}>{filtered.length}</div>
          <div className="text-[10px] uppercase tracking-wide mt-1" style={{ color: "#8B9E7A" }}>
            {activeCount} active
          </div>
        </div>
      </header>

      <ul className="flex-1 overflow-y-auto divide-y divide-[#EDE9E3]">
        {filtered.length === 0 && (
          <li className="p-10 text-center text-sm" style={{ color: "#8B9E7A" }}>
            No clients match
          </li>
        )}
        {filtered.map(r => {
          const svc = serviceBadge(r.service);
          const inactive = (r.status || "Active") === "Inactive";
          return (
            <li key={r.id || r.file_no}>
              <button
                type="button"
                data-testid={`caseload-${supervisor.key}-${r.file_no}`}
                onClick={() => onSelect?.(r)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#F7F5F0] transition-colors flex items-start gap-3"
              >
                <div
                  className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: `${supervisor.accent}18`, color: "#2C3625" }}
                >
                  #{r.file_no}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: inactive ? "#9CA3AF" : "#2C3625" }}>
                    {r.name}
                  </div>
                  {r.main_therapist && (
                    <div className="text-xs truncate mt-0.5" style={{ color: "#6B7568" }}>
                      {r.main_therapist}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {svc && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: svc.bg, color: svc.color }}>
                        {svc.text}
                      </span>
                    )}
                    {inactive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">Inactive</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F0E4] text-[#3D5A40]">Active</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function SupervisionCaseload() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/clients/supervision-caseload")
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ fahda: [], maha: [], other: [], counts: {} }))
      .finally(() => setLoading(false));
  }, []);

  const counts = data?.counts || {};

  return (
    <div>
      <PageBanner
        title="Supervision Caseload"
        subtitle="Clinical supervision · Fahda & Maha · sourced from Client Info supervisor field"
        stats={[
          { label: "Ms. Fahda", n: counts.fahda ?? "—", color: "#6B8F71" },
          { label: "Ms. Maha", n: counts.maha ?? "—", color: "#8FA481" },
          { label: "Active (Fahda)", n: counts.active_fahda ?? "—", color: "#5C8A47" },
          { label: "Active (Maha)", n: counts.active_maha ?? "—", color: "#5C8A47" },
        ]}
        toolbar={(
          <div className="relative max-w-md">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B9E7A" }} />
            <input
              data-testid="supervision-search"
              className="input pl-9 w-full"
              placeholder="Search name, file #, therapist…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      />

      {loading ? (
        <div className="card p-16 text-center" style={{ color: "#8B9E7A" }}>
          <div className="spinner mx-auto mb-3" />
          Loading caseload…
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-5 stagger">
            {SUPERVISORS.map(s => (
              <CaseloadColumn
                key={s.key}
                supervisor={s}
                rows={data?.[s.key] || []}
                search={search}
                onSelect={r => r.id && navigate("/clients")}
              />
            ))}
          </div>

          {(data?.other?.length > 0) && (
            <div className="mt-5 card p-4 border border-[#EDE9E3]" style={{ background: "#FAFAF7" }}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#6B7568" }}>
                <UsersThree size={16} />
                Other supervisors ({data.other.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {data.other.map(r => (
                  <span key={r.id || r.file_no} className="text-xs pill px-2 py-1 bg-white border border-[#E2DDD4]">
                    #{r.file_no} {r.name}
                    {r.supervisor ? ` · ${r.supervisor}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
