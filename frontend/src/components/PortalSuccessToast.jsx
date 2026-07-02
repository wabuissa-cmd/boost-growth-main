import { useCallback, useEffect, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

const DEFAULT_DURATION_MS = 3200;

/**
 * Small cream/olive success popup for therapist portal submissions.
 */
export function PortalSuccessToast({ message, onDismiss, durationMs = DEFAULT_DURATION_MS }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => onDismiss?.(), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      className="portal-success-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="portal-success-toast-icon" aria-hidden="true">
        <CheckCircle size={22} weight="fill" />
      </span>
      <span className="portal-success-toast-text">{message}</span>
    </div>
  );
}

export function usePortalSuccessToast() {
  const [message, setMessage] = useState(null);

  const showSuccess = useCallback((text) => {
    if (!text) return;
    setMessage(text);
  }, []);

  const dismissSuccess = useCallback(() => setMessage(null), []);

  return { successMessage: message, showSuccess, dismissSuccess };
}

export function submitSuccessMessage(type) {
  if (type === "Permission") return "Permission request sent";
  if (type === "purchase") return "Purchase request sent";
  if (["Annual", "Unpaid", "Sickleave"].includes(type)) return "Leave request sent";
  if (type === "companies" || type === "other" || type === "supplies") return "Request sent";
  return "Submitted successfully";
}
