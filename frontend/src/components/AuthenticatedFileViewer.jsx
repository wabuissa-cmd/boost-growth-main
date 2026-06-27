import { useState, useEffect, useCallback, useRef } from "react";
import { DownloadSimple, ArrowSquareOut, WarningCircle } from "@phosphor-icons/react";
import { ModalBase, ModalBtnSecondary } from "./Modal";
import { registerFileViewer } from "../fileViewer";

function parseFilename(contentDisposition, fallback = "document") {
  if (!contentDisposition) return fallback;
  const star = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1].trim()); } catch { /* ignore */ }
  }
  const plain = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : fallback;
}

function viewerKind(contentType, filename) {
  const ct = (contentType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  if (ct.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)) return "image";
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  return "download";
}

function triggerDownload(blobUrl, filename) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function AuthenticatedFileViewer() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blobUrl, setBlobUrl] = useState(null);
  const [filename, setFilename] = useState("Document");
  const [kind, setKind] = useState("pdf");
  const blobUrlRef = useRef(null);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    setLoading(false);
    revokeBlob();
  }, [revokeBlob]);

  useEffect(() => {
    const handler = async (url, { errorMessage = "Could not open file" } = {}) => {
      revokeBlob();
      setOpen(true);
      setLoading(true);
      setError("");
      setFilename("Document");

      try {
        const token = localStorage.getItem("bg_token");
        const r = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (!r.ok) {
          let detail = errorMessage;
          try {
            const body = await r.json();
            if (body?.detail) detail = typeof body.detail === "string" ? body.detail : errorMessage;
          } catch { /* ignore */ }
          throw new Error(detail);
        }

        const blob = await r.blob();
        const fname = parseFilename(r.headers.get("content-disposition"), "document");
        const url2 = URL.createObjectURL(blob);
        blobUrlRef.current = url2;
        setBlobUrl(url2);
        setFilename(fname);

        const vk = viewerKind(blob.type || r.headers.get("content-type"), fname);
        setKind(vk);
        if (vk === "download") triggerDownload(url2, fname);
      } catch (e) {
        setError(e?.message || errorMessage);
      } finally {
        setLoading(false);
      }
    };

    return registerFileViewer(handler);
  }, [revokeBlob]);

  if (!open) return null;

  return (
    <ModalBase
      title={filename}
      subtitle={loading ? "Loading…" : error ? "Could not open file" : undefined}
      onClose={close}
      size="xl"
      elevated
      footer={(
        <>
          {blobUrl && (
            <>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => triggerDownload(blobUrl, filename)}
              >
                <DownloadSimple size={16} /> Download
              </button>
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost text-sm inline-flex items-center gap-1"
              >
                <ArrowSquareOut size={16} /> Open in tab
              </a>
            </>
          )}
          <ModalBtnSecondary onClick={close}>Close</ModalBtnSecondary>
        </>
      )}
    >
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="spinner" style={{ width: 32, height: 32 }} />
          <p className="text-sm" style={{ color: "#5C6853" }}>Opening document…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
          <WarningCircle size={40} weight="duotone" style={{ color: "#B45309" }} />
          <p className="text-sm font-medium" style={{ color: "#2C3625" }}>{error}</p>
          <p className="text-xs" style={{ color: "#8B9E7A" }}>
            اطلبي من المعالجة إعادة رفع الملف إذا استمرت المشكلة
          </p>
        </div>
      )}

      {!loading && !error && blobUrl && kind === "image" && (
        <div className="flex justify-center">
          <img
            src={blobUrl}
            alt={filename}
            className="max-w-full max-h-[70dvh] rounded-lg object-contain"
          />
        </div>
      )}

      {!loading && !error && blobUrl && kind === "pdf" && (
        <iframe
          title={filename}
          src={blobUrl}
          className="w-full rounded-lg border"
          style={{ borderColor: "#E2DDD4", height: "min(70dvh, 600px)" }}
        />
      )}

      {!loading && !error && blobUrl && kind === "download" && (
        <div className="text-center py-12">
          <p className="text-sm mb-3" style={{ color: "#5C6853" }}>
            File downloaded — or use the Download button above.
          </p>
        </div>
      )}
    </ModalBase>
  );
}
