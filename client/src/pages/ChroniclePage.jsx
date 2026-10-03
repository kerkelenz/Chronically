import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation, { NavHamburger } from "../components/Navigation";
import ChronicleMark from "../components/ChronicleMark";

// "12 September 2026" — matches the mobile copy exactly
const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * The permanent record of everything Chronicle has said. Dismissing the
 * dashboard card clears it from the dashboard; this is where it still lives.
 *
 * Read-only by design — no unread state, no way to re-show a card.
 */
function ChroniclePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/announcements/history`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setAnnouncements(res.data.announcements || []);
      } catch {
        // silent-fail: an empty history reads better than an error dump
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#5C4E8A" }}>
      <div
        className="absolute rounded-full opacity-20"
        style={{ width: 300, height: 300, background: "#DEC8DA", filter: "blur(80px)", top: -60, right: -80, pointerEvents: "none" }}
      />

      <div className="relative z-20">
        <div className="px-6 py-4 flex justify-between items-center" style={{ maxWidth: 1024, margin: "0 auto" }}>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/profile")}
              aria-label="Back to profile"
              className="transition-opacity hover:opacity-70"
              style={{ color: "white", fontSize: 22, lineHeight: 1 }}
            >
              ‹
            </button>
            <h1 className="text-white font-medium text-lg" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              From Chronicle
            </h1>
          </div>
          <NavHamburger />
        </div>
      </div>

      <div className="relative z-10 p-6 pb-24 flex flex-col gap-3" style={{ maxWidth: 1024, margin: "0 auto" }}>
        {loading ? (
          <p className="text-sm py-10 text-center" style={{ color: "rgba(255,255,255,0.7)" }}>Loading…</p>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center gap-3" style={{ paddingTop: 48 }}>
            <ChronicleMark size={44} className="text-white" />
            <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.6)" }}>
              Nothing from Chronicle yet.
            </p>
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-2xl flex gap-3 items-start"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              <ChronicleMark size={32} className="text-white shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold" style={{ color: "white", fontSize: 15 }}>{a.title}</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                  {formatDate(a.publishedAt)}
                </p>
                {/* plain text from the author — pre-line keeps their line breaks
                    without ever interpreting the body as markup */}
                <p
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 14,
                    marginTop: 6,
                    whiteSpace: "pre-line",
                    overflowWrap: "anywhere",
                  }}
                >
                  {a.body}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <Navigation />
    </div>
  );
}

export default ChroniclePage;
