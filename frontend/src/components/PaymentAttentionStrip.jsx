import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { hasOpsAccess } from "../auth";
import { Warning, Clock, CaretRight } from "@phosphor-icons/react";

/** Compact payment alerts for Session Preparation banner footer. */
export default function PaymentAttentionStrip({ user }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!hasOpsAccess(user)) return;
    api.get("/billing/dashboard")
      .then(r => setSummary(r.data?.summary || null))
      .catch(() => setSummary(null));
  }, [user]);

  if (!hasOpsAccess(user) || !summary) return null;
  const { unpaid = 0, partial = 0, reminders_soon = 0 } = summary;
  if (!unpaid && !partial) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {unpaid > 0 && (
        <Link
          to="/billing?tab=unpaid"
          className="inline-flex items-center gap-1.5 pill px-3 py-1.5 text-xs font-bold border transition hover:opacity-90"
          style={{ background: "#F8EBE7", color: "#8A3F27", borderColor: "#E8A898" }}
        >
          <Warning size={14} weight="fill" />
          {unpaid} Unpaid
        </Link>
      )}
      {partial > 0 && (
        <Link
          to="/billing?tab=partial"
          className="inline-flex items-center gap-1.5 pill px-3 py-1.5 text-xs font-bold border transition hover:opacity-90"
          style={{ background: "#FAF0D1", color: "#6B5218", borderColor: "#E5C387" }}
        >
          <Clock size={14} weight="fill" />
          {partial} Partial
          {reminders_soon > 0 && ` · ${reminders_soon} reminder${reminders_soon !== 1 ? "s" : ""} soon`}
        </Link>
      )}
      <Link
        to="/billing"
        className="inline-flex items-center gap-1 text-xs font-bold ml-auto"
        style={{ color: "#5C6853" }}
      >
        Billing <CaretRight size={12} />
      </Link>
    </div>
  );
}
