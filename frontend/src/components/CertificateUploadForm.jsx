import { useState } from "react";
import api, { formatErr } from "../api";
import { UploadSimple } from "@phosphor-icons/react";
import { getTherapistScheduleName, sortTherapistsForSchedule } from "../scheduleConstants";

export default function CertificateUploadForm({ therapists = [], onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [form, setForm] = useState({
    therapist_id: "",
    course_name: "",
    title: "",
    issued_at: "",
    file: null,
    notify_trainee: true,
  });

  const onSubmit = async (e) => {
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
      body.append("notify_trainee", form.notify_trainee ? "true" : "false");
      body.append("file", form.file);
      await api.post("/therapist-certificates", body);
      setForm({
        therapist_id: "",
        course_name: "",
        title: "",
        issued_at: "",
        file: null,
        notify_trainee: true,
      });
      setUploadMsg(
        form.notify_trainee
          ? "Certificate uploaded — trainee will be notified in the portal."
          : "Certificate uploaded successfully."
      );
      onUploaded?.();
    } catch (err) {
      setUploadMsg(formatErr(err.response?.data?.detail) || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card p-4 mb-4 my-learning-upload-card">
      <div className="flex items-center gap-2 mb-3 font-semibold" style={{ color: "var(--brand-dark)" }}>
        <UploadSimple size={20} weight="duotone" />
        Upload certificate (admin)
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Therapist</label>
          <select
            className="input w-full"
            value={form.therapist_id}
            onChange={(e) => setForm((f) => ({ ...f, therapist_id: e.target.value }))}
            required
          >
            <option value="">Select therapist…</option>
            {sortTherapistsForSchedule(therapists).map((t) => (
              <option key={t.id} value={t.id}>{getTherapistScheduleName(t)}</option>
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
        <div className="md:col-span-2">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.notify_trainee}
              onChange={(e) => setForm((f) => ({ ...f, notify_trainee: e.target.checked }))}
            />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--brand-dark)" }}>Notify trainee in the portal</strong>
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Send an in-app update that their certificate is available in My Learning → My Certificates.
              </span>
            </span>
          </label>
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? <span className="spinner" /> : "Upload certificate"}
          </button>
          {uploadMsg && <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{uploadMsg}</span>}
        </div>
      </form>
    </div>
  );
}
