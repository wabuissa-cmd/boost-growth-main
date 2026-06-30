import { useEffect, useState, Fragment } from "react";
import api, { formatErr } from "../api";
import PageBanner from "../components/PageBanner";
import { CaretDown, CaretUp, CheckCircle, XCircle } from "@phosphor-icons/react";

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminCenterTests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/center-test/attempts");
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        const detail = e.response?.data?.detail;
        const msg = formatErr(detail) || e.message;
        if (e.response?.status === 403) {
          setError("You do not have permission to view training results. Please sign in as admin or ops lead.");
        } else if (e.response?.status === 401) {
          setError("Session expired — please sign out and sign in again.");
        } else {
          setError(msg || "Could not load results. Try refreshing the page.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const passedCount = rows.filter((r) => r.passed).length;
  const failedCount = rows.length - passedCount;

  return (
    <div className="page-enter" dir="ltr">
      <PageBanner
        title="Training Assessment Results"
        subtitle="View trainee answers and scores"
        variant="classic"
      />

      {loading && <div className="card p-6 text-center"><div className="spinner" /></div>}
      {error && <div className="card p-4 text-red-700 bg-red-50 border border-red-200">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: "var(--brand-dark)" }}>{rows.length}</div>
              <div className="text-sm text-muted">Total attempts</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{passedCount}</div>
              <div className="text-sm text-muted">Passed</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{failedCount}</div>
              <div className="text-sm text-muted">Retake needed</div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card p-8 text-center text-muted">No results yet</div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ background: "var(--bg-warm)" }}>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Score</th>
                      <th className="p-3 text-left">Result</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const open = openId === row.id;
                      const rowKey = row.id || `attempt-${idx}`;
                      return (
                        <Fragment key={rowKey}>
                          <tr className="border-b hover:bg-[var(--bg-warm)]">
                            <td className="p-3 font-medium">{row.student_name}</td>
                            <td className="p-3">{row.percentage}% ({row.score}/{row.total})</td>
                            <td className="p-3">
                              {row.passed ? (
                                <span className="inline-flex items-center gap-1 text-green-700">
                                  <CheckCircle size={16} weight="fill" /> Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <XCircle size={16} weight="fill" /> Did not pass
                                </span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">{fmtWhen(row.created_at)}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                className="btn btn-secondary text-xs py-1 px-2"
                                onClick={() => setOpenId(open ? null : row.id)}
                              >
                                {open ? <><CaretUp size={14} /> Hide</> : <><CaretDown size={14} /> Answers</>}
                              </button>
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-b bg-[var(--bg-surface)]">
                              <td colSpan={5} className="p-4">
                                <div className="space-y-3">
                                  {(row.answers || []).map((a, i) => (
                                    <div
                                      key={a.question_id}
                                      className="p-3 rounded-xl border"
                                      style={{
                                        borderColor: a.is_correct ? "#86efac" : "#fcd34d",
                                        background: a.is_correct ? "#f0fdf4" : "#fffbeb",
                                      }}
                                    >
                                      <div className="font-medium mb-1">Q{i + 1}. {a.question_text}</div>
                                      <div className="text-sm">
                                        Answer: <strong>{a.selected_text || "—"}</strong>
                                        {!a.is_correct && (
                                          <span className="block mt-1 text-green-800">
                                            Correct answer: {a.correct_text}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
