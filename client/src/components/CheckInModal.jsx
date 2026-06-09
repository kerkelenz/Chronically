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

const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
];

const PAIN_LABELS    = { 1: "Very Light", 2: "Light",   3: "Moderate", 4: "Severe",   5: "Very Severe" };
const MOOD_LABELS    = { 1: "Great",      2: "Good",    3: "Okay",     4: "Low",      5: "Very Low" };
const ENERGY_LABELS  = { 1: "Full",       2: "Good",    3: "Low",      4: "Drained",  5: "Exhausted" };
const ANXIETY_LABELS = { 1: "Calm",       2: "Mild",    3: "Moderate", 4: "High",     5: "Severe" };
const APPETITE_LABELS = { 1: "None",      2: "Poor",    3: "Fair",     4: "Good",     5: "Great" };

function LevelButtons({ labels, selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {[1, 2, 3, 4].map((level) => (
        <button
          key={level}
          onClick={() => onSelect(level)}
          className="py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
          style={{
            background: selected === level ? "white" : "rgba(255,255,255,0.18)",
            color: selected === level ? "#7C6BAE" : "white",
            border: "1px solid rgba(255,255,255,0.35)",
          }}
        >
          {labels[level]}
        </button>
      ))}
      <button
        onClick={() => onSelect(5)}
        className="col-span-2 py-4 rounded-2xl text-white font-medium transition-all duration-200 hover:scale-105"
        style={{
          background: selected === 5 ? "white" : "rgba(255,255,255,0.18)",
          color: selected === 5 ? "#7C6BAE" : "white",
          border: "1px solid rgba(255,255,255,0.35)",
        }}
      >
        {labels[5]}
      </button>
    </div>
  );
}

function ReviewRow({ label, value, labels, onEdit }) {
  return (
    <div
      className="w-full p-3 rounded-2xl text-center relative"
      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
    >
      <p className="text-white/60 text-xs mb-1">{label}</p>
      <p className="text-white font-medium">{labels[value]}</p>
      <button
        onClick={onEdit}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
      >
        <FiEdit2 size={14} />
      </button>
    </div>
  );
}

function CheckInModal({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [painLevel, setPainLevel] = useState(null);
  const [moodLevel, setMoodLevel] = useState(null);
  const [energyLevel, setEnergyLevel] = useState(null);
  const [anxietyLevel, setAnxietyLevel] = useState(null);
  const [appetiteLevel, setAppetiteLevel] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [error, setError] = useState("");
  const [affirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);

  const { token } = useAuth();

  const toggleSymptom = (s) =>
    setSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const handleSubmit = async () => {
    try {
      const today = new Date().toLocaleDateString("en-CA");
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/checkins`,
        {
          painLevel,
          moodLevel,
          energyLevel,
          anxietyLevel,
          appetiteLevel,
          symptoms: symptoms.length > 0 ? symptoms : null,
          date: today,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setStep(8);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)" }}
    >
      <div className="absolute rounded-full opacity-30" style={{ width: "200px", height: "200px", background: "#5C4E8A", filter: "blur(60px)", top: "-50px", left: "-50px" }} />
      <div className="absolute rounded-full opacity-30" style={{ width: "150px", height: "150px", background: "#DEC8DA", filter: "blur(50px)", top: "50px", right: "-30px" }} />
      <div className="absolute rounded-full opacity-30" style={{ width: "180px", height: "180px", background: "#9B8EC4", filter: "blur(55px)", bottom: "80px", left: "20px" }} />
      <div className="absolute rounded-full opacity-30" style={{ width: "130px", height: "130px", background: "#C4A8C0", filter: "blur(45px)", bottom: "-20px", right: "40px" }} />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6">

        {/* Step 1 — Pain */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white text-2xl font-medium text-center" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              How is your pain today?
            </p>
            <LevelButtons
              labels={PAIN_LABELS}
              selected={painLevel}
              onSelect={(level) => {
                setPainLevel(level);
                setMoodLevel(null);
                setEnergyLevel(null);
                setAnxietyLevel(null);
                setAppetiteLevel(null);
                setSymptoms([]);
                setStep(2);
              }}
            />
          </div>
        )}

        {/* Step 2 — Mood */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white text-2xl font-medium text-center" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              How is your mood today?
            </p>
            <LevelButtons
              labels={MOOD_LABELS}
              selected={moodLevel}
              onSelect={(level) => {
                setMoodLevel(level);
                setEnergyLevel(null);
                setAnxietyLevel(null);
                setAppetiteLevel(null);
                setSymptoms([]);
                setStep(3);
              }}
            />
          </div>
        )}

        {/* Step 3 — Energy */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white text-2xl font-medium text-center" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              How is your energy today?
            </p>
            <LevelButtons
              labels={ENERGY_LABELS}
              selected={energyLevel}
              onSelect={(level) => {
                setEnergyLevel(level);
                setAnxietyLevel(null);
                setAppetiteLevel(null);
                setSymptoms([]);
                setStep(4);
              }}
            />
          </div>
        )}

        {/* Step 4 — Anxiety */}
        {step === 4 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white text-2xl font-medium text-center" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              How is your anxiety today?
            </p>
            <LevelButtons
              labels={ANXIETY_LABELS}
              selected={anxietyLevel}
              onSelect={(level) => {
                setAnxietyLevel(level);
                setAppetiteLevel(null);
                setSymptoms([]);
                setStep(5);
              }}
            />
          </div>
        )}

        {/* Step 5 — Appetite */}
        {step === 5 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white text-2xl font-medium text-center" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              How is your appetite today?
            </p>
            <LevelButtons
              labels={APPETITE_LABELS}
              selected={appetiteLevel}
              onSelect={(level) => {
                setAppetiteLevel(level);
                setSymptoms([]);
                setStep(6);
              }}
            />
          </div>
        )}

        {/* Step 6 — Symptoms */}
        {step === 6 && (
          <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white text-2xl font-medium text-center" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              Any symptoms today?
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SYMPTOM_LIST.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background: symptoms.includes(s) ? "white" : "rgba(255,255,255,0.18)",
                    color: symptoms.includes(s) ? "#7C6BAE" : "white",
                    border: "1px solid rgba(255,255,255,0.35)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(7)}
              className="w-full py-3 rounded-full bg-white font-medium hover:scale-105 transition-all duration-200 shockwave-btn"
              style={{ color: "#7C6BAE" }}
            >
              {symptoms.length > 0 ? "Continue" : "Skip"}
            </button>
          </div>
        )}

        {/* Step 7 — Review & Submit */}
        {step === 7 && (
          <div className="flex flex-col gap-3 w-full">
            <ReviewRow label="Pain level"     value={painLevel}     labels={PAIN_LABELS}     onEdit={() => { setPainLevel(null);     setMoodLevel(null); setEnergyLevel(null); setAnxietyLevel(null); setAppetiteLevel(null); setSymptoms([]); setStep(1); }} />
            <ReviewRow label="Mood level"     value={moodLevel}     labels={MOOD_LABELS}     onEdit={() => { setMoodLevel(null);     setEnergyLevel(null); setAnxietyLevel(null); setAppetiteLevel(null); setSymptoms([]); setStep(2); }} />
            <ReviewRow label="Energy level"   value={energyLevel}   labels={ENERGY_LABELS}   onEdit={() => { setEnergyLevel(null);   setAnxietyLevel(null); setAppetiteLevel(null); setSymptoms([]); setStep(3); }} />
            <ReviewRow label="Anxiety level"  value={anxietyLevel}  labels={ANXIETY_LABELS}  onEdit={() => { setAnxietyLevel(null);  setAppetiteLevel(null); setSymptoms([]); setStep(4); }} />
            <ReviewRow label="Appetite level" value={appetiteLevel} labels={APPETITE_LABELS} onEdit={() => { setAppetiteLevel(null); setSymptoms([]); setStep(5); }} />
            {symptoms.length > 0 ? (
              <div
                className="w-full p-3 rounded-2xl relative"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <p className="text-white/60 text-xs mb-2">Symptoms</p>
                <div className="flex flex-wrap gap-1">
                  {symptoms.map((s) => (
                    <span key={s} className="text-xs px-2 py-1 rounded-full text-white" style={{ background: "rgba(255,255,255,0.25)" }}>
                      {s}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => { setSymptoms([]); setStep(6); }}
                  className="absolute right-3 top-3 text-white/50 hover:text-white transition-colors"
                >
                  <FiEdit2 size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setStep(6)}
                className="text-white/50 text-xs hover:text-white/80 transition-colors text-center"
              >
                + add symptoms
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="w-full py-3 rounded-full bg-white font-medium hover:scale-105 transition-all duration-200 shockwave-btn"
              style={{ color: "#7C6BAE" }}
            >
              Submit Check-in
            </button>
            {error && <p className="text-red-200 text-xs text-center">{error}</p>}
          </div>
        )}

        {/* Step 8 — Celebration */}
        {step === 8 && (
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-white text-3xl font-medium" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              {affirmation.title}
            </p>
            <p className="text-white/80 text-sm">{affirmation.message}</p>
            <button
              onClick={() => onComplete()}
              className="px-8 py-3 rounded-full bg-white font-medium hover:scale-105 transition-all duration-200"
              style={{ color: "#7C6BAE" }}
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {step !== 8 && (
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
