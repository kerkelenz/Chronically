import { useState } from "react";
// TODO: Chronicle artwork — swap for client/src/assets/chronicle.svg once the
// mascot is drawn. The lavender sprig mark stands in so nothing blocks on art.
import chronicleMark from "../assets/logo-mark.png";

const EXIT_MS = 260;

/**
 * A product update in Chronicle's voice, shown above the check-in prompt on the
 * dashboard. One at a time, dismissible, never returns once dismissed.
 *
 * Also used by the admin page as a live preview, which is why dismissal is
 * optional: with no `onDismiss` the × is hidden and the card is inert.
 */
export default function AnnouncementCard({ announcement, onDismiss, preview = false }) {
  const [leaving, setLeaving] = useState(false);

  if (!announcement) return null;

  const dismiss = () => {
    setLeaving(true);
    // let the fade + collapse play before the parent drops us from the tree
    setTimeout(() => onDismiss?.(announcement.id), EXIT_MS);
  };

  return (
    <div
      style={{
        transition: `opacity ${EXIT_MS}ms ease, max-height ${EXIT_MS}ms ease, margin ${EXIT_MS}ms ease`,
        opacity: leaving ? 0 : 1,
        maxHeight: leaving ? 0 : 500,
        overflow: "hidden",
      }}
    >
      <div
        className="p-4 rounded-2xl flex gap-3 items-start"
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
        }}
      >
        <img
          src={chronicleMark}
          alt=""
          aria-hidden="true"
          style={{ width: 44, height: 44, flexShrink: 0, objectFit: "contain" }}
        />

        <div className="min-w-0 flex-1">
          <p
            className="text-xs uppercase tracking-[0.08em]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Chronicle
          </p>
          <p className="font-bold mt-0.5" style={{ color: "white", fontSize: 15 }}>
            {announcement.title}
          </p>
          {/* plain text from the author — pre-line keeps their line breaks
              without ever interpreting the body as markup */}
          <p
            className="mt-1"
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
            }}
          >
            {announcement.body}
          </p>
        </div>

        {!preview && onDismiss && (
          <button
            onClick={dismiss}
            aria-label="Dismiss this update"
            className="text-base leading-none hover:opacity-70 transition-opacity flex-shrink-0"
            style={{ color: "white", padding: "2px 2px 2px 6px" }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
