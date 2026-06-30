import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { formatErr } from "../api";
import { useAuth } from "../auth";
import {
  CheckCircle, XCircle, ArrowCounterClockwise, ArrowLeft, ArrowRight,
  GraduationCap, Clock, Target, User, EnvelopeSimple,
} from "@phosphor-icons/react";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/brand-assets/boost-growth-logo.png`.replace(/\/\//g, "/");
const QUESTIONS_URL = `${process.env.PUBLIC_URL || ""}/data/center-test-questions.json`.replace(/\/\//g, "/");

async function loadTestMeta(testId) {
  const qs = testId ? `?test_id=${encodeURIComponent(testId)}` : "";
  try {
    const { data } = await api.get(`/center-test/questions${qs}`);
    return data;
  } catch {
    /* API unavailable — try static file */
  }
  try {
    const res = await fetch(QUESTIONS_URL);
    if (res.ok) return res.json();
  } catch {
    /* static file unavailable */
  }
  throw new Error("Could not load assessment");
}

function StepPill({ n, label, active, done }) {
  return (
    <div className={`center-test-step${active ? " active" : ""}${done ? " done" : ""}`}>
      <span className="center-test-step-num">{done ? "✓" : n}</span>
      <span className="center-test-step-label">{label}</span>
    </div>
  );
}

export default function CenterTest() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("test") || searchParams.get("test_id") || null;
  const fromPortal = Boolean(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState("name");
  const [studentName, setStudentName] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await loadTestMeta(testId);
        setMeta(data);
        setQuestions(data.questions || []);
      } catch {
        setError("Could not load the assessment. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [testId]);

  useEffect(() => {
    if (!fromPortal || studentName.trim()) return;
    const raw = (user?.name || "").replace(/^Ms\.?\s*/i, "").trim();
    if (raw.split(/\s+/).filter(Boolean).length >= 2) {
      setStudentName(raw);
    }
  }, [fromPortal, user, studentName]);

  const resetTest = () => {
    setStep("name");
    setStudentName("");
    setCurrentIdx(0);
    setAnswers({});
    setResult(null);
    setError("");
  };

  const startQuiz = (e) => {
    e.preventDefault();
    const name = studentName.trim();
    if (name.split(/\s+/).filter(Boolean).length < 2) {
      setError("Please enter your full name (first and last name).");
      return;
    }
    setError("");
    setStep("quiz");
    setCurrentIdx(0);
  };

  const selectAnswer = (qid, choiceId) => {
    setAnswers((prev) => ({ ...prev, [qid]: choiceId }));
  };

  const allAnswered = questions.every((q) => answers[q.id]);
  const answeredCount = Object.keys(answers).length;

  const submitTest = async () => {
    if (!allAnswered) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/center-test/attempts", {
        student_name: studentName.trim(),
        answers,
        test_id: testId || meta?.testId || undefined,
      });
      setResult(data);
      setStep("result");
    } catch (e) {
      const msg = formatErr(e.response?.data?.detail);
      if (!e.response) {
        setError("Could not save your results. Please contact your supervisor.");
      } else {
        setError(msg || "Could not submit your answers. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const q = questions[currentIdx];
  const threshold = meta?.passThreshold ?? 80;
  const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="center-test-page" dir="ltr">
      <header className="center-test-header">
        <div className="center-test-header-inner">
          <div className="center-test-brand-lockup">
            <img src={LOGO_SRC} alt="Boost Growth — تعزيز النمو" className="center-test-logo-full" />
          </div>
          <div className="center-test-header-tag">Training Portal</div>
          {fromPortal && (
            <Link to="/my-learning" className="center-test-portal-link">
              <GraduationCap size={16} weight="duotone" /> My Learning
            </Link>
          )}
        </div>
      </header>

      {!loading && meta && step !== "result" && (
        <div className="center-test-steps-bar">
          <StepPill n="1" label="Your details" active={step === "name"} done={step === "quiz"} />
          <div className="center-test-step-line" />
          <StepPill n="2" label="Assessment" active={step === "quiz"} done={false} />
          <div className="center-test-step-line" />
          <StepPill n="3" label="Results" active={false} done={false} />
        </div>
      )}

      <main className="center-test-main">
        {loading && (
          <div className="center-test-card center-test-loading">
            <div className="spinner" />
            <p>Loading assessment...</p>
          </div>
        )}

        {!loading && error && step !== "quiz" && (
          <div className="center-test-card center-test-error">{error}</div>
        )}

        {!loading && meta && step === "name" && (
          <div className="center-test-card center-test-intro-card">
            <div className="center-test-intro-icon">
              <GraduationCap size={32} weight="duotone" />
            </div>
            <div className="center-test-badge">POST-TRAINING ASSESSMENT</div>
            <h1 className="center-test-title">{meta.title}</h1>
            {meta.courseTopic && <p className="center-test-topic">{meta.courseTopic}</p>}
            {meta.instructor && (
              <p className="center-test-instructor">
                <User size={16} weight="duotone" /> Instructor: {meta.instructor}
              </p>
            )}

            <div className="center-test-meta-grid">
              <div className="center-test-meta-item">
                <Clock size={20} weight="duotone" />
                <div>
                  <div className="center-test-meta-val">{questions.length}</div>
                  <div className="center-test-meta-lbl">Questions</div>
                </div>
              </div>
              <div className="center-test-meta-item">
                <Target size={20} weight="duotone" />
                <div>
                  <div className="center-test-meta-val">{threshold}%</div>
                  <div className="center-test-meta-lbl">Pass score</div>
                </div>
              </div>
            </div>

            <form onSubmit={startQuiz} className="center-test-name-form">
              <label className="label">Full name</label>
              <input
                className="input center-test-input"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Sara Ahmed"
                required
                autoFocus
              />
              <p className="center-test-field-hint">Enter your first and last name as registered with the center.</p>
              {error && <div className="center-test-inline-error">{error}</div>}
              <button type="submit" className="btn btn-primary center-test-btn center-test-btn-primary">
                Start assessment <ArrowRight size={18} weight="bold" />
              </button>
            </form>
          </div>
        )}

        {!loading && step === "quiz" && q && (
          <div className="center-test-card center-test-quiz-card">
            <div className="center-test-quiz-top">
              <div className="center-test-progress-head">
                <span className="center-test-q-label">Question {currentIdx + 1} of {questions.length}</span>
                <span className="center-test-answered">{answeredCount}/{questions.length} answered</span>
              </div>
              <div className="center-test-progress-bar">
                <div className="center-test-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="center-test-trainee-chip">
              <User size={14} weight="bold" /> {studentName}
            </div>

            <h2 className="center-test-question">{q.text}</h2>

            <div className="center-test-choices">
              {q.choices.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className={`center-test-choice${answers[q.id] === ch.id ? " selected" : ""}`}
                  onClick={() => selectAnswer(q.id, ch.id)}
                >
                  <span className="center-test-choice-id">{ch.id.toUpperCase()}</span>
                  <span className="center-test-choice-text">{ch.text}</span>
                </button>
              ))}
            </div>

            {error && <div className="center-test-inline-error">{error}</div>}

            <div className="center-test-nav">
              <button
                type="button"
                className="btn btn-secondary center-test-nav-btn"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => i - 1)}
              >
                <ArrowLeft size={18} /> Previous
              </button>
              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary center-test-nav-btn"
                  disabled={!answers[q.id]}
                  onClick={() => setCurrentIdx((i) => i + 1)}
                >
                  Next <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary center-test-nav-btn"
                  disabled={!allAnswered || submitting}
                  onClick={submitTest}
                >
                  {submitting ? <span className="spinner" /> : <>Submit <CheckCircle size={18} weight="bold" /></>}
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && step === "result" && result && (
          <div className={`center-test-card center-test-result${result.passed ? " pass" : " fail"}`}>
            <div className="center-test-score-ring">
              <svg viewBox="0 0 120 120" className="center-test-ring-svg">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-light)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={result.passed ? "var(--brand)" : "#b45309"}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - result.percentage / 100)}`}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="center-test-score-center">
                <span className="center-test-score-pct">{result.percentage}%</span>
              </div>
            </div>

            {result.passed ? (
              <>
                <CheckCircle size={52} weight="fill" className="center-test-icon pass" />
                <h2 className="center-test-result-title">Congratulations — you passed!</h2>
                <p className="center-test-result-score-line">
                  Your score: <strong>{result.percentage}%</strong>
                  <span className="center-test-result-score-sub">
                    ({result.score} of {result.total} correct)
                  </span>
                </p>
                <div className="center-test-certificate-note">
                  <EnvelopeSimple size={22} weight="duotone" />
                  <p>
                    Your certificate will be sent to you by email.
                    <span className="center-test-certificate-sub">
                      Please check your inbox over the next few days.
                    </span>
                  </p>
                </div>
                <p className="center-test-success-note">
                  Well done, <strong>{result.student_name}</strong>. Your result has been recorded.
                </p>
                {fromPortal && (
                  <Link to="/my-learning" className="btn btn-secondary center-test-btn mt-3">
                    <GraduationCap size={18} weight="duotone" /> Back to My Learning
                  </Link>
                )}
              </>
            ) : (
              <>
                <XCircle size={52} weight="fill" className="center-test-icon fail" />
                <h2 className="center-test-result-title">You did not pass this assessment</h2>
                <p className="center-test-result-score-line">
                  Your score: <strong>{result.percentage}%</strong>
                  <span className="center-test-result-score-sub">
                    ({result.score} of {result.total} correct — {threshold}% required to pass)
                  </span>
                </p>
                <p className="center-test-fail-note">
                  You may retake the assessment again when you are ready.
                </p>
                <button type="button" className="btn btn-primary center-test-btn center-test-btn-primary" onClick={resetTest}>
                  <ArrowCounterClockwise size={20} weight="bold" /> Retake assessment
                </button>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="center-test-footer">
        <img src={LOGO_SRC} alt="" className="center-test-footer-logo" aria-hidden />
        <span>Boost Growth · Applied Behavior Analysis Services</span>
        <span className="center-test-footer-dot">·</span>
        <span>boost-growthsa.com</span>
      </footer>
    </div>
  );
}
