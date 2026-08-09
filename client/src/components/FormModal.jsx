import { useEffect } from "react";

/**
 * Shared shell for the app's add/edit dialogs — the web twin of mobile's
 * FormSheet. One anatomy across every form:
 *  - Bottom-sheet on narrow viewports, centered card on sm+.
 *  - Frosted card, title-left header with optional subtitle / right slot.
 *  - Scrollable body with the footer pinned below it.
 *
 * Presentation only: no dialog changes which fields it has or how it saves.
 */

const PRIMARY = "#7C6BAE";
// Deep plum destructive treatment — visibly not the #7C6BAE save pill, no red.
const PLUM = "#5A3A60";

// Uppercase micro-label above an input — matches mobile's field-label contract.
export const labelClass =
  "block text-xs uppercase tracking-[0.08em] text-white/60 mb-1.5";

export default function FormModal({
  open,
  onClose,
  title,
  subtitle,
  right,
  children,
  footer,
  bodyClassName = "px-5",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col"
        style={{
          background: "rgba(52,38,86,0.98)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.18)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="font-bold text-lg text-white">{title}</p>
            {subtitle ? (
              <p className="text-sm text-white/65 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          {right ?? null}
        </div>

        {/* Body (scrolls; footer stays pinned) */}
        <div
          className={`${bodyClassName} overflow-y-auto`}
          style={{ flex: "1 1 auto", minHeight: 0, paddingRight: 4 }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer ? (
          <div className="flex-shrink-0 px-5 pt-3 pb-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ModalFooter({
  onCancel,
  onSave,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  saving = false,
  canSave = true,
  error,
}) {
  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p className="text-sm text-right text-white/85">{error}</p>
      ) : null}
      <div className="flex items-center justify-end gap-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 rounded-full text-sm text-white/70 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
            canSave ? "hover:opacity-90" : "opacity-40 cursor-not-allowed"
          }`}
          style={{ background: "white", color: PRIMARY, minWidth: 92 }}
        >
          {saving ? (
            <span
              className="inline-block w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(124,107,174,0.3)", borderTopColor: PRIMARY }}
            />
          ) : (
            saveLabel
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Centered, frosted confirmation for destructive actions. Interrupts on all
 * viewports (never sheets), sits above FormModal, and cancels on overlay click
 * or Esc. Footer mirrors the form dialogs: a quiet Cancel then the destructive
 * verb as a white pill with deep-plum text.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  error,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
        style={{
          background: "rgba(52,38,86,0.98)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="font-bold text-lg text-white">{title}</p>
          {message ? <p className="text-sm text-white/70">{message}</p> : null}
        </div>
        {error ? <p className="text-sm text-white/85">{error}</p> : null}
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 rounded-full text-sm text-white/70 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-6 py-2.5 rounded-full text-sm font-bold transition-all inline-flex items-center justify-center gap-2 hover:opacity-90"
            style={{ background: "white", color: PLUM, minWidth: 92 }}
          >
            {busy ? (
              <span
                className="inline-block w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(90,58,96,0.3)", borderTopColor: PLUM }}
              />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
