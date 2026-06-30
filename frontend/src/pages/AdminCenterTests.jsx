import { useEffect, useState, Fragment } from "react";
import api, { formatErr } from "../api";
import { CaretDown, CaretUp, CheckCircle, XCircle, ClipboardText } from "@phosphor-icons/react";

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
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/center-test/attempts");
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        const detail = e.response?.data?.detail;
        const msg = formatErr(detail) || e.message;
        if (e.response?.status === 403) {
          setError("You do not have permission to view training results.");
        } else if (e.response?.status === 401) {
          setError("Session expired — please sign out and sign in again.");
        } else {
          setError(msg || "Could not load results.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const passedCount = rows.filter((r) => r.passed).length;
  const failedCount = rows.length - passedCount;

  return (
    <div className="page-enter p-4 md:p-6" dir="ltr">
      <div className="card p-5 mb-4" style={{ background: "var(--bg-warm)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}
          >
            <ClipboardText size={24} weight="duotone" />
          </div>
          <div>
            <h1 className="font-display text-xl m-0" style={{ color: "var(--brand-dark)" }}>
              Training Assessment Results
            </h1>
            <p className="text-sm m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
              View trainee answers and scores
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card p-8 text-center">
          <div className="spinner mx-auto" />
        </div>
      )}

      {error && (
        <div className="card p-4 text-red-800 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: "var(--brand-dark)" }}>{rows.length}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Total attempts</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{passedCount}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Passed</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{failedCount}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Retake needed</div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card p-8 text-center" style={{ color: "var(--text-muted)" }}>
              No results yet — trainees can start assessments from My Learning
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ background: "var(--bg-warm)" }}>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Course</th>
                      <th className="p-3 text-left">Score</th>
                      <th className="p-3 text-left">Result</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const rowKey = row.id || `row-${idx}`;
                      const isOpen = openId === rowKey;
                      return (
                        <Fragment key={rowKey}>
                          <tr className="border-b hover:bg-[var(--bg-warm)]">
                            <td className="p-3 font-medium">{row.student_name || "—"}</td>
                            <td className="p-3 text-sm" style={{ color: "var(--text-muted)" }}>
                              {row.course_name || row.test_title || "—"}
                            </td>
                            <td className="p-3">{row.percentage ?? 0}% ({row.score ?? 0}/{row.total ?? 0})</td>
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
                                onClick={() => setOpenId(isOpen ? null : rowKey)}
                              >
                                {isOpen ? <><CaretUp size={14} /> Hide</> : <><CaretDown size={14} /> Answers</>}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${rowKey}-answers`} className="border-b bg-[var(--bg-surface)]">
                              <td colSpan={5} className="p-4">
                                <div className="space-y-3">
                                  {(Array.isArray(row.answers) ? row.answers : []).map((a, i) => (
                                    <div
                                      key={`${rowKey}-q-${i}`}
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
