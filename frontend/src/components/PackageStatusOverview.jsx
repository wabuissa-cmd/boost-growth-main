import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { pkgStatusStyle, formatPkgUsedRemaining, PKG_SORT_ORDER } from "../packageStatusUtils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "critical", label: "🔴 Critical" },
  { id: "low", label: "🟡 Low" },
  { id: "good", label: "🟢 Good" },
];

export default function PackageStatusOverview() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/clients/package-status")
      .then(r => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (filter !== "all") list = list.filter(r => r.status === filter);
    list.sort((a, b) => {
      const oa = PKG_SORT_ORDER[a.status] ?? 9;
      const ob = PKG_SORT_ORDER[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return (a.client_name || "").localeCompare(b.client_name || "");
    });
    return list;
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    critical: rows.filter(r => r.status === "critical").length,
    low: rows.filter(r => r.status === "low").length,
    good: rows.filter(r => r.status === "good").length,
  }), [rows]);

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-bold text-lg" style={{ color: "#2C3625" }}>Package Status Overview</div>
          <div className="text-xs" style={{ color: "#8B9E7A" }}>Last open invoice per client · sorted by urgency</div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={`pill px-3 py-1 text-xs border ${filter === f.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E2DDD4]"}`}>
              {f.label} ({counts[f.id] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-sm py-6 text-center" style={{ color: "#8B9E7A" }}>Loading…</div>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#F0E9D8" }}>
              <tr>
                <th className="p-2 text-left font-bold">Client</th>
                <th className="p-2 text-left font-bold">File #</th>
                <th className="p-2 text-center font-bold">Svc</th>
                <th className="p-2 text-left font-bold">Package</th>
                <th className="p-2 text-left font-bold">Used</th>
                <th className="p-2 text-left font-bold">Remaining</th>
                <th className="p-2 text-left font-bold">Status</th>
                <th className="p-2 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-xs" style={{ color: "#8B9E7A" }}>No clients match this filter</td></tr>
              )}
              {filtered.map(row => {
                const st = pkgStatusStyle(row.status);
                const fmt = formatPkgUsedRemaining(row);
                const isUrgent = row.status === "critical" || row.status === "low";
                return (
                  <tr key={`${row.client_id}-${row.service_type}`} className="border-t border-[#E2DDD4] hover:bg-[#FAFAF7]">
                    <td className="p-2 font-medium" style={{ color: "#2C3625" }}>{row.client_name}</td>
                    <td className="p-2 text-xs" style={{ color: "#8B9E7A" }}>{row.file_no || "—"}</td>
                    <td className="p-2 text-center"><span className="pill text-[10px]">{row.service_type}</span></td>
                    <td className="p-2 text-xs">{fmt.pkg}</td>
                    <td className="p-2 text-xs">{fmt.used}</td>
                    <td className="p-2 text-xs font-bold">{fmt.remaining}</td>
                    <td className="p-2">
                      <span className="pill text-[10px] px-2 py-0.5 capitalize"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {st.icon} {row.status === "none" ? "No invoice" : row.status}
                      </span>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {isUrgent && row.status !== "none" ? (
                        <button type="button" className="btn btn-primary text-xs"
                          onClick={() => navigate(`/billing?client=${row.client_id}&service=${row.service_type}&newInvoice=1`)}>
                          New Invoice
                        </button>
                      ) : (
                        <button type="button" className="btn btn-outline text-xs"
                          onClick={() => navigate(`/billing?client=${row.client_id}&service=${row.service_type}`)}>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
