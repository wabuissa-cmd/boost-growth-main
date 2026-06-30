import { useEffect, useState } from "react";
import api, { formatErr } from "../api";
import { CheckCircle, XCircle, ArrowCounterClockwise, ArrowLeft, ArrowRight } from "@phosphor-icons/react";

const LOGO_SRC = "/bg-logo.png";
const QUESTIONS_URL = `${process.env.PUBLIC_URL || ""}/data/center-test-questions.json`.replace(/\/\//g, "/");

async function loadTestMeta() {
  try {
    const res = await fetch(QUESTIONS_URL);
    if (res.ok) return res.json();
  } catch {
    /* static file unavailable — try API */
  }
  const { data } = await api.get("/center-test/questions");
  return data;
}

export default function CenterTest() {
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
      try {
        const data = await loadTestMeta();
        setMeta(data);
        setQuestions(data.questions || []);
      } catch {
        setError("Could not load the assessment. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      });
      setResult(data);
      setStep("result");
    } catch (e) {
      const msg = formatErr(e.response?.data?.detail);
      if (!e.response) {
        setError("Could not save your results — the server is not running. Please contact your supervisor.");
      } else {
        setError(msg || "Could not submit your answers. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const q = questions[currentIdx];
  const threshold = meta?.passThreshold ?? 80;

  return (
    <div className="center-test-page" dir="ltr">
      <header className="center-test-header">
        <img src={LOGO_SRC} alt="Boost Growth" className="center-test-logo" />
        <div className="center-test-header-text">
          <div className="center-test-brand">Boost Growth</div>
          <div className="center-test-sub">Applied Behavior Analysis Services</div>
        </div>
      </header>

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
          <div className="center-test-card">
            <div className="center-test-badge">TRAINING ASSESSMENT</div>
            <h1 className="center-test-title">{meta.title}</h1>
            {meta.courseTopic && <p className="center-test-topic">{meta.courseTopic}</p>}
            {meta.instructor && <p className="center-test-instructor">Instructor: {meta.instructor}</p>}
            <p className="center-test-hint">
              {questions.length} questions · Pass score: {threshold}%
            </p>
            <form onSubmit={startQuiz} className="center-test-name-form">
              <label className="label">Full name</label>
              <input
                className="input"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Sara Ahmed"
                required
                autoFocus
              />
              {error && <div className="center-test-inline-error">{error}</div>}
              <button type="submit" className="btn btn-primary center-test-btn">
                Start assessment
              </button>
            </form>
          </div>
        )}

        {!loading && step === "quiz" && q && (
          <div className="center-test-card">
            <div className="center-test-progress">
              <span>Question {currentIdx + 1} of {questions.length}</span>
              <div className="center-test-progress-bar">
                <div
                  className="center-test-progress-fill"
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
            <p className="center-test-student">Trainee: {studentName}</p>
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
                  <span>{ch.text}</span>
                </button>
              ))}
            </div>
            {error && <div className="center-test-inline-error">{error}</div>}
            <div className="center-test-nav">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => i - 1)}
              >
                <ArrowLeft size={18} /> Previous
              </button>
              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!answers[q.id]}
                  onClick={() => setCurrentIdx((i) => i + 1)}
                >
                  Next <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!allAnswered || submitting}
                  onClick={submitTest}
                >
                  {submitting ? <span className="spinner" /> : "Submit assessment"}
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && step === "result" && result && (
          <div className="center-test-card center-test-result">
            {result.passed ? (
              <>
                <CheckCircle size={64} weight="fill" className="center-test-icon pass" />
                <h2>Congratulations — you passed!</h2>
                <p className="center-test-score">{result.percentage}%</p>
                <p className="center-test-result-detail">
                  {result.score} of {result.total} correct
                </p>
                <p className="center-test-success-note">
                  Your result has been saved. Thank you, {result.student_name}.
                </p>
              </>
            ) : (
              <>
                <XCircle size={64} weight="fill" className="center-test-icon fail" />
                <h2>You did not reach the pass score</h2>
                <p className="center-test-score">{result.percentage}%</p>
                <p className="center-test-result-detail">
                  {result.score} of {result.total} — required to pass: {threshold}%
                </p>
                <button type="button" className="btn btn-primary center-test-btn" onClick={resetTest}>
                  <ArrowCounterClockwise size={20} /> Retake assessment
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
