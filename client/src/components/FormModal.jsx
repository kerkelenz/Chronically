import { useEffect, useState } from "react";

/**
 * Shared shell for the app's add/edit dialogs — the web twin of mobile's
 * FormSheet. One anatomy across every form:
 *  - Bottom-sheet on narrow viewports, centered card on sm+.
 *  - Frosted card, title-left header with optional subtitle / right slot.
 *  - Scrollable body with the footer pinned below it.
 *
 * On mobile browsers the sheet slides up through a scrim that fades in place,
 * covers the tab bar (z-[70], above Navigation's z-50), and is sized in dvh so
 * the URL bar can't clip its bottom. The card stays mounted through a ~260ms
 * exit so dismiss gestures (overlay / Esc) slide back down before onClose fires.
 *
 * Presentation only: no dialog changes which fields it has or how it saves.
 */

const PRIMARY = "#7C6BAE";
// Deep plum destructive treatment — visibly not the #7C6BAE save pill, no red.
const PLUM = "#5A3A60";
const EXIT_MS = 260;

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
  // `mounted` keeps the card in the tree through its exit animation; `entered`
  // drives the open pose one frame after mount so the CSS transition runs.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open && !mounted) setMounted(true);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  // if a consumer keeps this mounted and flips `open` to false, animate out.
  useEffect(() => {
    if (open || !mounted) return undefined;
    setEntered(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // dismiss gesture: slide/fade out first, then notify the parent (which may
  // unmount us). Parent state stays intact during the exit, so nothing that the
  // body reads goes null mid-animation.
  const requestClose = () => {
    setEntered(false);
    setTimeout(() => onClose?.(), EXIT_MS);
  };

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  const openAttr = entered ? "true" : "false";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      {/* scrim fades in place; pointer-events off so the flex parent catches taps */}
      <div
        className="dialog-scrim absolute inset-0 pointer-events-none"
        data-open={openAttr}
        style={{ background: "rgba(0,0,0,0.5)" }}
        aria-hidden="true"
      />
      <div
        className="form-modal-card relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col"
        data-open={openAttr}
        style={{
          background: "rgba(52,38,86,0.98)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.18)",
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
          style={{ flex: "1 1 auto", minHeight: 0 }}
        >
          {children}
        </div>

        {/* Footer — safe-area pad keeps buttons clear of the home indicator */}
        {footer ? (
          <div
            className="flex-shrink-0 px-5 pt-3"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
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
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open && !mounted) setMounted(true);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  useEffect(() => {
    if (open || !mounted) return undefined;
    setEntered(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onCancel]);

  if (!mounted) return null;

  const openAttr = entered ? "true" : "false";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div
        className="dialog-scrim absolute inset-0 pointer-events-none"
        data-open={openAttr}
        style={{ background: "rgba(0,0,0,0.5)" }}
        aria-hidden="true"
      />
      <div
        className="confirm-card relative w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
        data-open={openAttr}
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
