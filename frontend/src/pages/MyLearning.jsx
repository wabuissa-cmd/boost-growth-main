import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatErr, openAuthenticatedFile } from "../api";
import {
  GraduationCap, Certificate, ClipboardText, CheckCircle, XCircle,
  CaretDown, CaretUp, ArrowRight, UploadSimple, Sparkle, LockKey,
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

function StepPill({ n, label, active, done }) {
  return (
    <div className={`center-test-step${active ? " active" : ""}${done ? " done" : ""}`}>
      <span className="center-test-step-num">{done ? "✓" : n}</span>
      <span className="center-test-step-label">{label}</span>
    </div>
  );
}

function AttemptCard({ attempt, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const unlocked = attempt.answers_unlocked !== false;
  const correct = attempt.score ?? (attempt.answers || []).filter((a) => a.is_correct).length;
  const total = attempt.total ?? (attempt.answers || []).length;
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
          <span className={`my-learning-score-pill${attempt.passed ? " pass" : " fail"}`}>
            {attempt.percentage}%
          </span>
          {attempt.passed ? (
            <CheckCircle size={18} weight="fill" className="text-green-700" />
          ) : (
            <XCircle size={18} weight="fill" className="text-amber-600" />
          )}
          {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </div>
      </button>
      {open && (
        <div className="my-learning-attempt-body">
          {!unlocked ? (
            <div className="my-learning-locked-note">
              <LockKey size={20} weight="duotone" />
              <p>
                Answer review is locked until you pass this assessment (80% or higher).
                <span className="block mt-1">Retake the test — once you pass, all your attempts and correct answers will appear here.</span>
              </p>
            </div>
          ) : (
            (attempt.answers || []).map((a, i) => (
              <div
                key={`${attempt.id}-a-${i}`}
                className={`my-learning-answer${a.is_correct ? " correct" : " wrong"}`}
              >
                <div className="font-medium text-sm mb-1">Q{i + 1}. {a.question_text}</div>
                <div className="text-sm">
                  Your answer: <strong>{a.selected_text || "—"}</strong>
                  {!a.is_correct && (
                    <span className="block mt-1 text-green-800">Correct: {a.correct_text}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function MyLearning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [form, setForm] = useState({
    therapist_id: "",
    course_name: "",
    title: "",
    issued_at: "",
    file: null,
  });

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

  const onUpload = async (e) => {
    e.preventDefault();
    if (!form.therapist_id || !form.course_name || !form.file) {
      setUploadMsg("Please select a therapist, course name, and file.");
      return;
    }
    setUploading(true);
    setUploadMsg("");
    try {
      const body = new FormData();
      body.append("therapist_id", form.therapist_id);
      body.append("course_name", form.course_name);
      body.append("title", form.title || form.course_name);
      if (form.issued_at) body.append("issued_at", form.issued_at);
      body.append("file", form.file);
      await api.post("/therapist-certificates", body);
      setForm({ therapist_id: "", course_name: "", title: "", issued_at: "", file: null });
      setUploadMsg("Certificate uploaded successfully.");
      await load();
    } catch (err) {
      setUploadMsg(formatErr(err.response?.data?.detail) || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

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
      <div className="my-learning-top-bar">
        <div className="my-learning-badge">TRAINING PORTFOLIO</div>
      </div>

      <div className="center-test-steps-bar my-learning-steps">
        <StepPill n="1" label="Assessments" active done />
        <div className="center-test-step-line" />
        <StepPill n="2" label="My Certificates" active={false} done={certificates.length > 0} />
      </div>

      <div className="my-learning-hero card">
        <div className="flex items-start gap-3">
          <div className="my-learning-hero-icon">
            <GraduationCap size={28} weight="duotone" />
          </div>
          <div>
            <h1 className="my-learning-title">My Learning</h1>
            <p className="my-learning-subtitle">
              Your assessments, course progress, and certificates — all in one place.
            </p>
          </div>
        </div>
      </div>

      {data?.can_upload_certificates && (
        <div className="card p-4 mb-4 my-learning-upload-card">
          <div className="flex items-center gap-2 mb-3 font-semibold" style={{ color: "var(--brand-dark)" }}>
            <UploadSimple size={20} weight="duotone" />
            Upload certificate (admin)
          </div>
          <form onSubmit={onUpload} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Therapist</label>
              <select
                className="input w-full"
                value={form.therapist_id}
                onChange={(e) => setForm((f) => ({ ...f, therapist_id: e.target.value }))}
                required
              >
                <option value="">Select therapist…</option>
                {(data.therapists || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Course name</label>
              <input
                className="input w-full"
                value={form.course_name}
                onChange={(e) => setForm((f) => ({ ...f, course_name: e.target.value }))}
                placeholder="e.g. Behavioral Assessment in ABA"
                required
              />
            </div>
            <div>
              <label className="label">Certificate title (optional)</label>
              <input
                className="input w-full"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Post-training certificate"
              />
            </div>
            <div>
              <label className="label">Issue date (optional)</label>
              <input
                type="date"
                className="input w-full"
                value={form.issued_at}
                onChange={(e) => setForm((f) => ({ ...f, issued_at: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Certificate file (PDF or image)</label>
              <input
                type="file"
                className="input w-full"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                required
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? <span className="spinner" /> : "Upload certificate"}
              </button>
              {uploadMsg && <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{uploadMsg}</span>}
            </div>
          </form>
        </div>
      )}

      <div className="my-learning-grid">
        <section className="my-learning-panel card">
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
                <AttemptCard key={a.id || i} attempt={a} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </section>

        <section className="my-learning-panel card">
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
      </div>
    </div>
  );
}
