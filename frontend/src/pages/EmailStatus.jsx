import { useEffect, useState } from "react";
import api from "../api";
import PageBanner from "../components/PageBanner";
import { EnvelopeSimple, CheckCircle, Warning } from "@phosphor-icons/react";

export default function EmailStatus() {
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, q] = await Promise.all([
        api.get("/ops/email-status").catch(() => ({ data: null })),
        api.get("/ops/email-queue").catch(() => ({ data: [] })),
      ]);
      setStatus(s.data || null);
      setQueue(Array.isArray(q.data) ? q.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deliveryWarning = status?.delivery_warning || (status?.smtp_blocked_on_railway ? "Email delivery is blocked — switch from Gmail SMTP to Mailgun." : "");
  const last = status?.last_email || null;

  return (
    <div className="max-w-4xl mx-auto">
      <PageBanner
        title="Email Status"
        subtitle="Delivery log + provider snapshot (read-only)"
        toolbar={(
          <button type="button" className="btn btn-secondary text-sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        )}
      />

      {deliveryWarning && (
        <div className="card p-3 mb-3 text-xs font-bold" style={{ background: "#FCE0E8", color: "#8B3A55" }}>
          ⚠️ {deliveryWarning}
        </div>
      )}

      <div className="card p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <EnvelopeSimple size={18} weight="duotone" style={{ color: "#7A8A6A" }} />
          <div className="font-bold" style={{ color: "#2C3625" }}>Provider</div>
        </div>
        <div className="text-xs" style={{ color: "#5C6853" }}>
          Active provider: <strong>{status?.active_provider || "—"}</strong>
          {" · "}
          Configured:{" "}
          {status?.provider_configured ? (
            <span className="inline-flex items-center gap-1" style={{ color: "#3D4F35" }}><CheckCircle size={14} weight="fill" /> Yes</span>
          ) : (
            <span className="inline-flex items-center gap-1" style={{ color: "#6B5218" }}><Warning size={14} /> No</span>
          )}
        </div>
      </div>

      {status?.jenan_email && (
        <div className="card p-4 mb-3">
          <div className="font-bold mb-1" style={{ color: "#2C3625" }}>Jenan inbox</div>
          <div className="text-xs mb-2" style={{ color: "#8B9E7A" }}>{status.jenan_email}</div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="pill" style={{ background: "#FAFAF7", border: "1px solid #E2DDD4", color: "#5C6853" }}>
              pending/failed: <strong>{status.pending_count ?? 0}</strong>
            </span>
            <span className="pill" style={{ background: "#FAFAF7", border: "1px solid #E2DDD4", color: "#5C6853" }}>
              failed: <strong>{status.failed_count ?? 0}</strong>
            </span>
            <span className="pill" style={{ background: "#FAFAF7", border: "1px solid #E2DDD4", color: "#5C6853" }}>
              sent: <strong>{status.sent_count ?? 0}</strong>
            </span>
          </div>
          {last && (
            <div className="mt-3 text-xs p-3 rounded-xl" style={{
              background: last.status === "sent" ? "#E5EBE1" : "#FAF0D1",
              color: last.status === "sent" ? "#3D4F35" : "#6B5218",
            }}>
              <div className="font-bold mb-1">Last delivery attempt</div>
              <div>{String(last.created_at || "").slice(0, 19).replace("T", " ")} · <strong>{last.status}</strong></div>
              <div className="truncate" title={last.subject}>{last.subject}</div>
              {last.error && (
                <div className="mt-1" style={{ color: "#8B3A55" }}>{last.error}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card p-4">
        <div className="font-bold mb-2" style={{ color: "#2C3625" }}>Email delivery log</div>
        {queue.length === 0 ? (
          <div className="text-xs" style={{ color: "#8B9E7A" }}>No email logs found.</div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {queue.slice(0, 100).map((q) => {
              const ok = q.status === "sent";
              const pending = q.status === "queued" || q.status === "queued_no_key";
              const stBg = ok ? "#E5EBE1" : pending ? "#FAF0D1" : "#FCE0E8";
              const stColor = ok ? "#3D4F35" : pending ? "#6B5218" : "#8B3A55";
              return (
                <div key={q.id} className="flex flex-wrap items-center gap-2 py-1 border-b last:border-b-0" style={{ borderColor: "#EDE9E3" }}>
                  <span className="pill text-[10px] px-1.5 font-bold shrink-0" style={{ background: stBg, color: stColor }}>
                    {q.status}
                  </span>
                  <span className="truncate flex-1 min-w-0 text-[12px]" title={`${q.to} — ${q.subject}`}>
                    <strong>{q.to}</strong> — {q.subject}
                  </span>
                  {q.created_at && (
                    <span className="text-[10px] shrink-0" style={{ color: "#8B9E7A" }}>
                      {String(q.created_at).slice(0, 16).replace("T", " ")}
                    </span>
                  )}
                  {q.error && (
                    <span className="text-[10px] shrink-0 max-w-[160px] truncate" style={{ color: "#8B3A55" }} title={q.error}>
                      {String(q.error).slice(0, 60)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

