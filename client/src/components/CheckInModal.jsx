import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { FiEdit2 } from "react-icons/fi";

const AFFIRMATIONS = [
  { title: "Well done 💙", message: "You showed up today. That matters." },
  { title: "Check-in complete 🌿", message: "Tracking your health is an act of self-care. Keep going." },
  { title: "You did it ✨", message: "Living with chronic illness takes real strength. You have it." },
  { title: "That took courage 💜", message: "Even on the hard days, you checked in. That's resilience." },
  { title: "Proud of you 🌸", message: "You're paying attention to yourself. That's more powerful than it sounds." },
  { title: "One more day 🌙", message: "Small steps still count. You're here, and that's enough." },
  { title: "You're doing the work 💫", message: "Every check-in adds up. Your future self will thank you." },
  { title: "Be gentle with yourself 🤍", message: "Rest is productive too. You're allowed to take it slow." },
  { title: "You know your body 🌱", message: "This check-in helps you listen. Keep tuning in." },
  { title: "Progress is progress 💙", message: "It looks different every day. Today's chapter is written." },
  { title: "Take a breath 🕊️", message: "You just took care of yourself. That's worth something." },
  { title: "You're not alone 💜", message: "Millions of people live with chronic illness. You're tracking, and that's taking charge." },
];

function CheckInModal({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [painLevel, setPainLevel] = useState(null);
  const [moodLevel, setMoodLevel] = useState(null);
  const [energyLevel, setEnergyLevel] = useState(null);
  const [error, setError] = useState("");
  const [affirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);

  const { token } = useAuth();

  const handleSubmit = async () => {
    try {
      const today = new Date().toLocaleDateString("en-CA");
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/checkins`,
        { painLevel, moodLevel, energyLevel, date: today },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setStep(4);
    } catch (error) {
      setError(
        error.response?.data?.error ||
          "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
      }}
    >
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "200px",
          height: "200px",
          background: "#5C4E8A",
          filter: "blur(60px)",
          top: "-50px",
          left: "-50px",
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "150px",
          height: "150px",
          background: "#DEC8DA",
          filter: "blur(50px)",
          top: "50px",
          right: "-30px",
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "180px",
          height: "180px",
          background: "#9B8EC4",
          filter: "blur(55px)",
          bottom: "80px",
          left: "20px",
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "130px",
          height: "130px",
          background: "#C4A8C0",
          filter: "blur(45px)",
          bottom: "-20px",
          right: "40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6">
        {/* Step 1 - Pain */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p
              className="text-white text-2xl font-medium text-center"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              How is your pain today?
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setPainLevel(level);
                    setMoodLevel(null);
                    setEnergyLevel(null);
                    setStep(2);
                  }}
                  className="py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background:
                      painLevel === level ? "white" : "rgba(255,255,255,0.18)",
                    color: painLevel === level ? "#7C6BAE" : "white",
                    border: "1px solid rgba(255,255,255,0.35)",
                  }}
                >
                  {level === 1
                    ? "Very Light"
                    : level === 2
                      ? "Light"
                      : level === 3
                        ? "Moderate"
                        : "Severe"}
                </button>
              ))}
              <button
                onClick={() => {
                  setPainLevel(5);
                  setMoodLevel(null);
                  setEnergyLevel(null);
                  setStep(2);
                }}
                className="col-span-2 py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
                style={{
                  background:
                    painLevel === 5 ? "white" : "rgba(255,255,255,0.18)",
                  color: painLevel === 5 ? "#7C6BAE" : "white",
                  border: "1px solid rgba(255,255,255,0.35)",
                }}
              >
                Very Severe
              </button>
            </div>
          </div>
        )}

        {/* Step 2 - Mood */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p
              className="text-white text-2xl font-medium text-center"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              How is your mood today?
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setMoodLevel(level);
                    setStep(3);
                  }}
                  className="py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.35)",
                  }}
                >
                  {level === 1
                    ? "Great"
                    : level === 2
                      ? "Good"
                      : level === 3
                        ? "Okay"
                        : "Low"}
                </button>
              ))}
              <button
                onClick={() => {
                  setMoodLevel(5);
                  setStep(3);
                }}
                className="col-span-2 py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.35)",
                }}
              >
                Very Low
              </button>
            </div>
          </div>
        )}

        {/* Step 3 - Energy */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p
              className="text-white text-2xl font-medium text-center"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              How is your energy today?
            </p>
            {!energyLevel ? (
              <div className="grid grid-cols-2 gap-3 w-full">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    onClick={() => setEnergyLevel(level)}
                    className="py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      border: "1px solid rgba(255,255,255,0.35)",
                    }}
                  >
                    {level === 1
                      ? "Full"
                      : level === 2
                        ? "Good"
                        : level === 3
                          ? "Low"
                          : "Drained"}
                  </button>
                ))}
                <button
                  onClick={() => setEnergyLevel(5)}
                  className="col-span-2 py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.35)",
                  }}
                >
                  Exhausted
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <div
                  className="w-full p-3 rounded-2xl text-center relative"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}
                >
                  <p className="text-white/60 text-xs mb-1">Pain level</p>
                  <p className="text-white font-medium">
                    {painLevel === 1
                      ? "Very Light"
                      : painLevel === 2
                        ? "Light"
                        : painLevel === 3
                          ? "Moderate"
                          : painLevel === 4
                            ? "Severe"
                            : "Very Severe"}
                  </p>
                  <button
                    onClick={() => {
                      setPainLevel(null);
                      setMoodLevel(null);
                      setEnergyLevel(null);
                      setStep(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    <FiEdit2 size={14} />
                  </button>
                </div>
                <div
                  className="w-full p-3 rounded-2xl text-center relative"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}
                >
                  <p className="text-white/60 text-xs mb-1">Mood level</p>
                  <p className="text-white font-medium">
                    {moodLevel === 1
                      ? "Great"
                      : moodLevel === 2
                        ? "Good"
                        : moodLevel === 3
                          ? "Okay"
                          : moodLevel === 4
                            ? "Low"
                            : "Very Low"}
                  </p>
                  <button
                    onClick={() => {
                      setMoodLevel(null);
                      setEnergyLevel(null);
                      setStep(2);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    <FiEdit2 size={14} />
                  </button>
                </div>
                <div
                  className="w-full p-3 rounded-2xl text-center relative"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}
                >
                  <p className="text-white/60 text-xs mb-1">Energy level</p>
                  <p className="text-white font-medium">
                    {energyLevel === 1
                      ? "Full"
                      : energyLevel === 2
                        ? "Good"
                        : energyLevel === 3
                          ? "Low"
                          : energyLevel === 4
                            ? "Drained"
                            : "Exhausted"}
                  </p>
                  <button
                    onClick={() => setEnergyLevel(null)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    <FiEdit2 size={14} />
                  </button>
                </div>
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 rounded-full bg-white font-medium hover:scale-105 transition-all duration-200 shockwave-btn"
                  style={{ color: "#7C6BAE" }}
                >
                  Submit Check-in
                </button>
                {error && (
                  <p className="text-red-200 text-xs text-center">{error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4 - Celebration */}
        {step === 4 && (
          <div className="flex flex-col items-center gap-6 text-center">
            <p
              className="text-white text-3xl font-medium"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              {affirmation.title}
            </p>
            <p className="text-white/80 text-sm">
              {affirmation.message}
            </p>
            <button
              onClick={() => onComplete()}
              className="px-8 py-3 rounded-full bg-white font-medium hover:scale-105 transition-all duration-200"
              style={{ color: "#7C6BAE" }}
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {step !== 4 && (
          <button
            onClick={onClose}
            className="text-white/50 text-xs hover:text-white/80 transition-colors mt-4"
          >
            cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default CheckInModal;
