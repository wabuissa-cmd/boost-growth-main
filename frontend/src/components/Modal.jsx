import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

const SIZE_MAX = { sm: 480, md: 600, lg: 760, xl: 900 };

/** ModalBase — unified shell for every modal in the app */
export function ModalBase({ title, subtitle, onClose, children, footer, size = "md", elevated = false }) {
  const maxWidth = SIZE_MAX[size] || SIZE_MAX.md;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className={`fixed inset-0 ${elevated ? "z-[60]" : "z-50"} overflow-y-auto modal-mobile-full`}
      style={{ background: "rgba(30,40,25,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 modal-center-wrap">
        <div
          className="modal-shell bg-white rounded-[1.25rem] shadow-2xl flex flex-col overflow-hidden w-full my-auto"
          style={{ maxWidth: `min(${maxWidth}px, calc(100vw - 32px))`, maxHeight: "min(90dvh, calc(100dvh - 24px))" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div
            className="px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b flex items-start justify-between flex-shrink-0"
            style={{ borderColor: "#EDE9E3" }}
          >
            <div className="min-w-0 pr-2">
              <h2
                className="font-bold tracking-tight text-xl sm:text-[26px]"
                style={{ color: "#1C2617", lineHeight: 1.2 }}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-sm truncate" style={{ color: "#8B9E7A" }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 mt-0.5 rounded-lg p-2 hover:bg-gray-100 transition flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ color: "#9CA3AF" }}
              aria-label="Close"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-6 min-h-0">
            {children}
          </div>

          {/* FOOTER */}
          {footer && (
            <div
              className="modal-footer-sticky px-5 sm:px-8 py-4 sm:py-5 border-t flex items-center justify-end gap-2 sm:gap-3 flex-wrap flex-shrink-0"
              style={{ borderColor: "#EDE9E3", background: "#FAFAF7" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FormSection({ title, description, children }) {
  return (
    <div>
      <div className="mb-4">
        <h3
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#5C6853", letterSpacing: "0.12em" }}
        >
          {title}
        </h3>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
            {description}
          </p>
        )}
        <div className="mt-2 h-px" style={{ background: "#EDE9E3" }} />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function FormField({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
        {label}
        {required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      {children}
      {hint && (
        <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function ModalBtnPrimary({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50 ${className}`}
      style={{ background: "#3D5C3A" }}
      {...props}
    >
      {children}
    </button>
  );
}

export function ModalBtnSecondary({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rounded-xl px-5 py-2.5 text-sm font-medium border transition hover:bg-gray-50 ${className}`}
      style={{ background: "#FFFFFF", color: "#374151", borderColor: "#DDD8D0" }}
      {...props}
    >
      {children}
    </button>
  );
}

export function ModalBtnDanger({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rounded-xl px-5 py-2.5 text-sm font-medium border transition hover:opacity-90 ${className}`}
      style={{ background: "#FEF2F2", color: "#DC2626", borderColor: "#FCA5A5" }}
      {...props}
    >
      {children}
    </button>
  );
}
