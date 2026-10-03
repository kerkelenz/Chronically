import { useNavigate } from "react-router-dom";
import {
  SUPPORT_TITLE,
  SUPPORT_INTRO,
  SUPPORT_CLOSING,
  SUPPORT_RESOURCES,
} from "../utils/supportResources";

/**
 * The support pathway. A door, not an intervention: always here, never
 * triggered by anything the app thinks it has detected.
 *
 * Public by design — reachable at /support without logging in. Someone who
 * needs this should never meet an auth wall, and it therefore reads nothing
 * from auth state.
 *
 * Deliberately NOT instrumented. No analytics import, no track() call on open
 * or on any resource. Nothing about someone's worst day belongs in an events
 * table, not even as a count.
 */
function SupportPage() {
  const navigate = useNavigate();

  const hrefFor = (r) => {
    if (r.kind === "tel") return `tel:${r.value}`;
    if (r.kind === "sms") return `sms:${r.value}${r.body ? `?body=${encodeURIComponent(r.body)}` : ""}`;
    return r.value;
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#5C4E8A" }}>
      <div
        className="absolute rounded-full opacity-20"
        style={{ width: 320, height: 320, background: "#DEC8DA", filter: "blur(80px)", top: -70, right: -90, pointerEvents: "none" }}
      />

      <div className="relative z-10 px-6 py-6 pb-20" style={{ maxWidth: 680, margin: "0 auto" }}>
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          aria-label="Go back"
          className="mb-4 transition-opacity hover:opacity-70"
          style={{ color: "white", fontSize: 24, lineHeight: 1, padding: "4px 8px 4px 0" }}
        >
          ‹
        </button>

        <h1
          className="text-white"
          style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 30, fontWeight: 500 }}
        >
          {SUPPORT_TITLE}
        </h1>

        <p
          className="mt-3"
          style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 1.55 }}
        >
          {SUPPORT_INTRO}
        </p>

        <div className="flex flex-col gap-3 mt-6">
          {SUPPORT_RESOURCES.map((r) => (
            <a
              key={r.id}
              href={hrefFor(r)}
              {...(r.kind === "url" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label={r.a11y}
              className="block rounded-2xl transition-colors hover:bg-white/20"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                // generous target; nothing here should need precision
                padding: "18px 16px",
                textDecoration: "none",
              }}
            >
              <p style={{ color: "white", fontSize: 16, fontWeight: 700 }}>{r.name}</p>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>
                {r.sub}
              </p>
            </a>
          ))}
        </div>

        <p className="mt-7" style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.5 }}>
          {SUPPORT_CLOSING}
        </p>
      </div>
    </div>
  );
}

export default SupportPage;
