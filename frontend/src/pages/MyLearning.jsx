import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatErr, openAuthenticatedFile } from "../api";
import PageBanner from "../components/PageBanner";
import {
  GraduationCap, Certificate, ClipboardText, CheckCircle, XCircle,
  CaretDown, CaretUp, ArrowRight, Sparkle, LockKey,
} from "@phosphor-icons/react";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AttemptCard({ attempt }) {
  const [open, setOpen] = useState(false);
  const passed = Boolean(attempt.passed);
  const answers = attempt.answers || [];
  const correct = attempt.score ?? answers.filter((a) => a.is_correct).length;
  const total = attempt.total ?? answers.length;
  const wrong = Math.max(0, total - correct);

  return (
    <div className="my-learning-attempt-card">
      <button type="button" className="my-learning-attempt-head" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 text-left">
          <div className="my-learning-attempt-badge">Attempt {attempt.attempt_number || "—"}</div>
          <div className="my-learning-course-name">{attempt.course_name || attempt.test_title || "Assessment"}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {fmtDate(attempt.created_at)} · {correct} correct · {wrong} incorrect
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`my-learning-score-pill${passed ? " pass" : " fail"}`}>
            {attempt.percentage}%
          </span>
          {passed ? (
            <CheckCircle size={18} weight="fill" className="text-green-700" />
          ) : (
            <XCircle size={18} weight="fill" className="text-amber-600" />
          )}
          {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </div>
      </button>
      {open && (
        <div className="my-learning-attempt-body">
          {!passed && (
            <div className="my-learning-locked-note my-learning-locked-note--inline">
              <LockKey size={18} weight="duotone" />
              <p>Correct answers are hidden for this attempt so retakes stay fair.</p>
            </div>
          )}
          {answers.map((a, i) => (
            <div
              key={`${attempt.id}-a-${i}`}
              className={`my-learning-answer${a.is_correct ? " correct" : " wrong"}`}
            >
              <div className="font-medium text-sm mb-1">Q{i + 1}. {a.question_text}</div>
              <div className="text-sm">
                Your answer: <strong>{a.selected_text || "—"}</strong>
                {passed && !a.is_correct && a.correct_text && (
                  <span className="block mt-1 text-green-800">Correct: {a.correct_text}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyLearning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("assessments");

  const load = async () => {
    setError("");
    try {
      const { data: d } = await api.get("/my-learning");
      setData(d);
    } catch (e) {
      setError(formatErr(e.response?.data?.detail) || "Could not load your learning portfolio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="page-enter my-learning-page flex justify-center py-16">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter my-learning-page p-6">
        <div className="card p-4 text-red-800 bg-red-50 border border-red-200">{error}</div>
      </div>
    );
  }

  const catalog = data?.catalog || [];
  const attempts = data?.attempts || [];
  const certificates = data?.certificates || [];
  const takenTestIds = new Set(attempts.map((a) => a.test_id));

  return (
    <div className="page-enter my-learning-page" dir="ltr">
      <PageBanner
        title="My Learning"
        subtitle="Your assessments, course progress, and certificates — all in one place."
        eyebrow="TRAINING PORTFOLIO"
        badge={(
          <span className="editorial-banner__icon-badge" aria-hidden>
            <GraduationCap size={20} weight="duotone" />
          </span>
        )}
        stats={[
          { label: "Attempts", n: attempts.length, color: "#2C3625" },
          { label: "Available", n: catalog.length, color: "#3D4F35" },
          { label: "Certificates", n: certificates.length, color: "#6B5218" },
        ]}
        tabs={[
          { id: "assessments", label: "Assessments", icon: <ClipboardText size={14} weight="duotone" />, testId: "my-learning-tab-assessments" },
          { id: "certificates", label: "Certificates", icon: <Certificate size={14} weight="duotone" />, count: certificates.length, testId: "my-learning-tab-certificates" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="editorial-banner--compact-mobile"
      />

      <div className="my-learning-grid">
        {activeTab === "assessments" ? (
        <section className="portal-content-panel my-learning-panel card">
          <div className="my-learning-panel-head">
            <ClipboardText size={22} weight="duotone" />
            <div>
              <h2>My Assessments</h2>
              <p>Tests you have completed and assessments available to take</p>
            </div>
          </div>

          {catalog.length > 0 && (
            <div className="my-learning-available mb-4">
              <div className="my-learning-section-label">
                <Sparkle size={14} className="inline mr-1" /> Available now
              </div>
              {catalog.map((test) => (
                <div key={test.testId} className="my-learning-available-card">
                  <div>
                    <div className="font-semibold" style={{ color: "var(--brand-dark)" }}>{test.courseName}</div>
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>{test.title}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {test.questionCount} questions · Pass: {test.passThreshold}%
                    </div>
                  </div>
                  <Link
                    to={`/center-test?test=${encodeURIComponent(test.testId)}`}
                    className="btn btn-primary text-sm shrink-0"
                  >
                    {takenTestIds.has(test.testId) ? "Retake" : "Start"} <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="my-learning-section-label">Completed attempts</div>
          {attempts.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
              No assessments completed yet. Start an available assessment above.
            </p>
          ) : (
            <div className="space-y-2">
              {attempts.map((a, i) => (
                <AttemptCard key={a.id || i} attempt={a} />
              ))}
            </div>
          )}
        </section>
        ) : (
        <section className="portal-content-panel my-learning-panel card">
          <div className="my-learning-panel-head">
            <Certificate size={22} weight="duotone" />
            <div>
              <h2>My Certificates</h2>
              <p>Certificates for completed training — available here in your portal</p>
            </div>
          </div>

          {certificates.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No certificates yet. Once you pass an assessment, your certificate will be published here by your supervisor.
            </p>
          ) : (
            <div className="space-y-3">
              {certificates.map((c) => (
                <div key={c.id} className="my-learning-cert-card">
                  <div className="my-learning-cert-icon">
                    <Certificate size={24} weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" style={{ color: "var(--brand-dark)" }}>
                      {c.title || c.course_name}
                    </div>
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>{c.course_name}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Issued {fmtDate(c.issued_at || c.created_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm shrink-0"
                    onClick={() => openAuthenticatedFile(c.download_url)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
