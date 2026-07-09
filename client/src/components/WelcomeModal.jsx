import { useAuth } from "../hooks/useAuth";
import axios from "axios";
import { track } from "../lib/analytics";
import { FiCheckCircle, FiTrendingUp, FiPackage, FiCalendar } from "react-icons/fi";
import { GiSpoon } from "react-icons/gi";

const FEATURES = [
  [FiCheckCircle, "Daily check-ins", "Note how you're feeling in seconds."],
  [GiSpoon, "Spoon Center", "Plan your day around the energy you have."],
  [FiPackage, "Medications", "Keep doses, schedules, and history in one place."],
  [FiCalendar, "Appointments", "Prep visits and bring a clean report to your doctor."],
  [FiTrendingUp, "Trends", "Watch your patterns come into focus over time."],
];

export default function WelcomeModal({ onClose }) {
  const { user, token, updateUser } = useAuth();

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
