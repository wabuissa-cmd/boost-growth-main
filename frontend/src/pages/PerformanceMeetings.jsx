import { useEffect, useState } from "react";
import api, { API, openAuthenticatedFile } from "../api";
import PageBanner from "../components/PageBanner";
import { CalendarBlank, FileText, DownloadSimple, UsersThree } from "@phosphor-icons/react";

async function viewFile(url) {
  try {
    await openAuthenticatedFile(url, { errorMessage: "Could not open file" });
  } catch (e) {
    alert(e?.message || "Could not open file");
  }
}

export default function PerformanceMeetings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/my-performance")
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="portal-page-shell page-enter">
        <div className="portal-content-panel portal-page-body p-12 text-center"><div className="spinner mx-auto"/></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="portal-page-shell page-enter">
        <PageBanner title="Performance & Meetings" subtitle="Manager check-ins and evaluations"/>
        <section className="portal-content-panel portal-page-body p-8 text-center text-sm" style={{ color: "#8B9E7A" }}>Could not load your performance record.</section>
      </div>
    );
  }

  const tid = data.therapist_id;
  const meetings = data.manager_meetings || [];
  const monthly = data.monthly_evaluations || [];
  const annual = data.annual_evaluations || [];

  const evalUrl = (evalId) => `${API}/hr/therapist/${tid}/evaluations/${evalId}/file`;

  return (
    <div className="portal-page-shell page-enter">
      <PageBanner
        title="Performance & Meetings"
        subtitle="Performance & Meetings · manager check-ins and evaluations"
      />

      <section className="portal-content-panel portal-page-body">
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {[
          { label: "Contract start", val: data.contract_start?.slice(0, 10) || "—" },
          { label: "Trial period end", val: data.probation_end?.slice(0, 10) || "—" },
          { label: "Annual contract end", val: data.annual_contract_end?.slice(0, 10) || "—" },
        ].map(x => (
          <div key={x.label} className="p-4 rounded-[16px] text-center border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8B9E7A" }}>{x.label}</div>
            <div className="font-bold text-sm" style={{ color: "#2C3625" }}>{x.val}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <UsersThree size={20} weight="duotone" style={{ color: "#7A8A6A" }}/>
          <h3 className="font-bold m-0 text-base" style={{ color: "#2C3625" }}>Manager meetings</h3>
        </div>
        {meetings.length === 0 ? (
          <p className="text-sm m-0" style={{ color: "#8B9E7A" }}>No scheduled meetings recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map(m => (
              <div key={m.id} className="p-3 rounded-xl" style={{ background: "#FAFAF7", border: "1px solid #EDE9E3" }}>
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "#2C3625" }}>
                  <CalendarBlank size={16} weight="duotone"/>
                  {m.date?.slice(0, 10) || "—"}
                </div>
                {m.notes && <p className="text-sm mt-1 mb-0" style={{ color: "#5C6853" }}>{m.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-[16px] border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="flex items-center gap-2 mb-3">
            <FileText size={20} weight="duotone" style={{ color: "#7A8A6A" }}/>
            <h3 className="font-bold m-0 text-base" style={{ color: "#2C3625" }}>Trial period evaluations</h3>
          </div>
          {monthly.length === 0 ? (
            <p className="text-sm m-0" style={{ color: "#8B9E7A" }}>No trial period evaluations uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {monthly.map(ev => (
                <div key={ev.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border" style={{ borderColor: "#EDE9E3" }}>
                  <span className="text-sm font-semibold" style={{ color: "#2C3625" }}>{ev.month || ev.uploaded_at?.slice(0, 10)}</span>
                  <button type="button" className="btn btn-ghost text-xs py-1" onClick={() => viewFile(evalUrl(ev.id))}>
                    <DownloadSimple size={14}/> View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 rounded-[16px] border" style={{ borderColor: "#E2DDD4", background: "#FAFAF7" }}>
          <div className="flex items-center gap-2 mb-3">
            <FileText size={20} weight="duotone" style={{ color: "#C28E6A" }}/>
            <h3 className="font-bold m-0 text-base" style={{ color: "#2C3625" }}>Annual evaluations</h3>
          </div>
          {annual.length === 0 ? (
            <p className="text-sm m-0" style={{ color: "#8B9E7A" }}>No annual evaluations uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {annual.map(ev => (
                <div key={ev.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border" style={{ borderColor: "#EDE9E3" }}>
                  <span className="text-sm font-semibold" style={{ color: "#2C3625" }}>{ev.year || ev.uploaded_at?.slice(0, 4)}</span>
                  <button type="button" className="btn btn-ghost text-xs py-1" onClick={() => viewFile(evalUrl(ev.id))}>
                    <DownloadSimple size={14}/> View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </section>
    </div>
  );
}
