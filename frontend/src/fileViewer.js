/** Global handler registered by AuthenticatedFileViewer (mounted in App). */
let fileViewerHandler = null;

export function registerFileViewer(handler) {
  fileViewerHandler = handler;
  return () => {
    if (fileViewerHandler === handler) fileViewerHandler = null;
  };
}

export function showAuthenticatedFile(url, options) {
  if (fileViewerHandler) return fileViewerHandler(url, options);
  return openAuthenticatedFileFallback(url, options);
}

/** Fallback when viewer is not mounted — same-tab blob open (no popup). */
async function openAuthenticatedFileFallback(url, { errorMessage = "Could not open file" } = {}) {
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
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.target = "_self";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
