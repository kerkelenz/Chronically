import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import axios from "axios";
import { track } from "../lib/analytics";
import { FiCheckCircle, FiTrendingUp, FiPackage, FiCalendar } from "react-icons/fi";
import { GiSpoon } from "react-icons/gi";
import ChronicleMark from "./ChronicleMark";
import { TRACKING_OPTIONS } from "./TrackingFocusModal";

const FEATURES = [
  [FiCheckCircle, "Daily check-ins", "Note how you're feeling in seconds."],
  [GiSpoon, "Spoon Center", "Plan your day around the energy you have."],
  [FiPackage, "Medications", "Keep doses, schedules, and history in one place."],
  [FiCalendar, "Appointments", "Prep visits and bring a clean report to your doctor."],
  [FiTrendingUp, "Trends", "Watch your patterns come into focus over time."],
];

export default function WelcomeModal({ onClose }) {
  const { user, token, updateUser } = useAuth();

  // Preselected, and left alone if they skip or dismiss — nobody is made to
  // answer this to get into the app.
  const [mode, setMode] = useState("both");

  const chooseMode = async (value) => {
    setMode(value);
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/tracking-mode`,
        { trackingMode: value },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateUser({ ...user, trackingMode: value });
    } catch {
      // non-fatal — "both" is the default and the Profile row is the other route
    }
  };

  const dismiss = async () => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/welcome`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch {
      // non-fatal — still dismiss locally
    }
    track("welcome_completed");
    updateUser({ ...user, hasSeenWelcome: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: "white", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="text-center">
          {/* Chronicle's introduction — the one placement every user sees.
              This card is white, unlike mobile's, so he takes the brand purple
              rather than the white he wears everywhere else. */}
          <div className="flex justify-center" style={{ color: "#7C6BAE", marginBottom: 12 }}>
            <ChronicleMark size={64} />
          </div>
          <h2 style={{ fontFamily: "Playfair Display, Georgia, serif", color: "#2D2540", fontSize: 26 }}>
            Welcome to Chronically
          </h2>
          <p className="text-sm mt-1" style={{ color: "#6B5F7A" }}>
            A calm, private place to track life with a chronic illness — one day at a time.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {FEATURES.map(([Icon, name, desc]) => (
            <div key={name} className="flex gap-3 items-start">
              <Icon size={22} style={{ color: "#7C6BAE", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#2D2540" }}>{name}</p>
                <p className="text-sm" style={{ color: "#6B5F7A" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-center mb-2.5" style={{ color: "#2D2540" }}>
            What would you like to keep track of?
          </p>
          <div className="flex gap-2">
            {TRACKING_OPTIONS.map((o) => {
              const active = mode === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => chooseMode(o.value)}
                  role="radio"
                  aria-checked={active}
                  aria-label={o.label}
                  className="flex-1 rounded-xl transition-colors"
                  style={{
                    background: active ? "#7C6BAE" : "#F0EBF8",
                    color: active ? "white" : "#6B5F7A",
                    border: `1px solid ${active ? "#7C6BAE" : "#DDD5EE"}`,
                    padding: "14px 8px", fontSize: 14, fontWeight: 700,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-center mt-2.5" style={{ color: "#8A7FA0", lineHeight: 1.45 }}>
            You can change this anytime in Profile. Everything stays searchable either way.
          </p>
        </div>
        <p className="text-xs text-center" style={{ color: "#8A7FA0" }}>
          No ads, no tracking — just gentle, everyday support. 💜
        </p>
        <button
          onClick={dismiss}
          className="py-3 rounded-full text-white font-medium transition-all duration-200"
          style={{ background: "#7C6BAE" }}
        >
          Get started
        </button>
      </div>
    </div>
  );
}
