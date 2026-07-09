import { useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { track } from "../lib/analytics";
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
  "Dizziness", "Headache", "Muscle weakness", "Joint pain",
  "Shortness of breath", "Nausea", "Sleep disturbance", "Bladder urgency",
];

const PAIN_LABELS    = { 1: "Very Severe", 2: "Severe",  3: "Moderate", 4: "Light",    5: "Very Light" };
const MOOD_LABELS    = { 1: "Very Low",   2: "Low",     3: "Okay",     4: "Good",     5: "Great" };
const ENERGY_LABELS  = { 1: "Exhausted",  2: "Drained", 3: "Low",      4: "Good",     5: "Full" };
const ANXIETY_LABELS = { 1: "Severe",     2: "High",    3: "Moderate", 4: "Mild",     5: "Calm" };
const APPETITE_LABELS = { 1: "None",      2: "Poor",    3: "Fair",     4: "Good",     5: "Great" };

const getTier = (level) => {
  if (level === 5) return "best";
  if (level === 4) return "highMid";
  if (level === 3) return "mid";
  if (level === 2) return "lowMid";
  return "worst";
};

const TOAST_MESSAGES = {
  best: [
    "That's a good sign. Hold onto this one. 💙",
    "A bright spot in the data. You earned it. 💙",
    "Good days matter. So does noticing them. 💙",
    "This is what progress can look like. 💙",
    "Your body gave you a good one today. 💙",
    "Celebrate the small wins. This is one of them. 💙",
    "Moments like this are worth tracking. 💙",
    "A good reading on a hard journey. Take it in. 💙",
    "This is what a better day feels like. Remember it. 💙",
    "You're doing something right. 💙",
    "Good numbers mean something. This one does too. 💙",
    "Log it, feel it, keep going. 💙",
  ],
  highMid: [
    "That's a solid reading. You're doing okay. 💙",
    "Better than the middle — that counts. 💙",
    "A good direction. Keep going. 💙",
    "Not perfect, but genuinely good. 💙",
    "This is a positive sign. Take it. 💙",
    "Above the line today. That matters. 💙",
    "You're trending in the right direction. 💙",
    "A good reading for a hard journey. 💙",
    "This is worth noticing. 💙",
    "Not every day is great, but this one is pretty good. 💙",
    "High-mid is still high. Take that. 💙",
    "You're holding up well. 💙",
  ],
  mid: [
    "Steady is its own kind of strength. 💙",
    "You're in the middle and still moving. That counts. 💙",
    "Holding the middle ground takes effort too. 💙",
    "Not every day needs to be a high. Mid days matter. 💙",
    "You're managing. That's real. 💙",
    "Staying steady when things are hard is underrated. 💙",
    "Mid readings mean you're still in the fight. 💙",
    "You showed up for a mid day. That's something. 💙",
    "Middle of the road is still moving forward. 💙",
    "Consistent and present. That's worth something. 💙",
    "You're here, you're tracking, you're managing. 💙",
    "A steady day. Steady adds up. 💙",
  ],
  lowMid: [
    "That's a harder reading. You're still tracking it. 💙",
    "Not your best, but you're still here. 💙",
    "Low-mid days are real. So is your resilience. 💙",
    "A tougher reading today. Be kind to yourself. 💙",
    "Harder days deserve acknowledgment. This is yours. 💙",
    "This reading tells a story. You're still writing it. 💙",
    "A difficult marker today. You logged it anyway. 💙",
    "Not where you want to be, but still showing up. 💙",
    "A low-mid day is still a day you're fighting through. 💙",
    "Tough readings are part of the journey too. 💙",
    "You're having a harder moment. That's okay to notice. 💙",
  ],
  worst: {
    pain: [
      "Pain this intense is exhausting. You're still here. 💙",
      "That's a lot to carry. Logging it is an act of courage. 💙",
      "Severe pain days are their own kind of battle. You're fighting it. 💙",
      "Your body is working so hard. So are you. 💙",
      "Pain like this deserves to be acknowledged. We see you. 💙",
      "On days like this, just existing is enough. 💙",
      "This level of pain is real and it's hard. You showed up anyway. 💙",
      "Logging this on a day like today takes strength. 💙",
      "Pain doesn't get the last word. You do. 💙",
      "Even the hardest pain days pass. You'll get through this one. 💙",
      "Your pain is valid. Your strength is real. 💙",
      "You tracked it. That matters more than you know. 💙",
    ],
    mood: [
      "Low days are hard. You showed up anyway. 💙",
      "Even on your darkest days, you matter. 💙",
      "A low mood day doesn't define you. 💙",
      "Feeling this low is exhausting. Be gentle with yourself. 💙",
      "You don't have to feel okay to be worthy of care. 💙",
      "Tracking how you feel on hard days is brave. 💙",
      "Low mood and chronic illness is a heavy combination. You're carrying a lot. 💙",
      "Tomorrow can look different. For now, just breathe. 💙",
      "You noticed. You logged it. That's not nothing. 💙",
      "Hard emotional days deserve the same care as hard pain days. 💙",
      "Even when your mood is low, you're still showing up. 💙",
      "It's okay not to be okay. You're still here. 💙",
    ],
    energy: [
      "Running on empty is its own kind of hard. Rest when you can. 💙",
      "MS fatigue is real and it's brutal. Be gentle with yourself today. 💙",
      "Fatigue this deep isn't laziness. It's your body asking for care. 💙",
      "Low energy days are valid. You're doing your best. 💙",
      "Even exhausted, you checked in. That takes something. 💙",
      "Rest is not giving up. Rest is part of fighting. 💙",
      "Your energy is precious. Protect it today. 💙",
      "Drained days are hard to push through. You don't always have to. 💙",
      "This kind of exhaustion is invisible to most people. We see it. 💙",
      "Logging today even when you're this tired is a quiet kind of strength. 💙",
      "Fatigue is one of the hardest parts of this illness. You're not alone. 💙",
      "Low energy doesn't mean low worth. 💙",
    ],
    anxiety: [
      "Anxiety on top of everything else is a lot. You're handling it. 💙",
      "That level of anxiety is genuinely hard to sit with. You're not alone. 💙",
      "Anxiety and chronic illness feed each other. You're dealing with both. 💙",
      "High anxiety days are exhausting in a way most people don't understand. 💙",
      "You're tracking it. That's already more than most people would do. 💙",
      "Breathe. You're here. You're logging. That's enough for right now. 💙",
      "Anxiety doesn't mean weakness. It means your nervous system is overwhelmed. 💙",
      "You don't have to calm down. You just have to get through today. 💙",
      "High anxiety is hard to carry quietly. You don't have to. 💙",
      "Noticing your anxiety is the first step. You just did that. 💙",
      "This is hard. You're doing it anyway. 💙",
      "Anxiety at this level deserves acknowledgment. Consider this yours. 💙",
    ],
    appetite: [
      "Not being able to eat is its own kind of struggle. Take care of yourself. 💙",
      "A difficult appetite day. Small things still count. 💙",
      "When eating is hard, everything else feels harder too. 💙",
      "Poor appetite is a real symptom, not a choice. Be kind to yourself. 💙",
      "Eat what you can, when you can. No judgment here. 💙",
      "Your body is doing a lot right now. Nourish it however you're able. 💙",
      "Low appetite days are frustrating. You're not alone in that. 💙",
      "You noticed and you logged it. That's self-awareness worth having. 💙",
      "Appetite struggles are real and valid. So are you. 💙",
      "Even small amounts of food count. Every bit helps. 💙",
      "Hard appetite days don't last forever. This one will pass too. 💙",
      "Taking note of how your appetite feels is caring for yourself. 💙",
    ],
  },
};

const COMBINED_TOAST_MESSAGES = {
  twoOrMoreWorst: [
    "This is a hard check-in. You did it anyway. 💙",
    "Multiple difficult readings today. That's a lot to carry. 💙",
    "Hard days show up in the data too. This is one of them. 💙",
    "You logged a tough one. That takes something. 💙",
    "Rough check-ins are part of the journey. So is surviving them. 💙",
    "This is a hard day. You're allowed to feel that. 💙",
    "Two hard readings in one check-in. Be gentle with yourself today. 💙",
    "You're tracking even on the bad ones. That's brave. 💙",
    "Hard days logged are hard days witnessed. We see you. 💙",
    "This check-in shows a hard moment. You're still here for it. 💙",
    "When everything feels hard, just getting through counts. 💙",
    "A difficult check-in. Rest when you can. 💙",
  ],
  twoOrMoreLowMid: [
    "A harder check-in today. You tracked it anyway. 💙",
    "Multiple difficult readings. That's a tough day. 💙",
    "Low-mid across a few metrics — be gentle with yourself. 💙",
    "A harder day showing up in the data. You're still here. 💙",
    "Not your easiest check-in. You did it anyway. 💙",
    "Tougher readings today. Rest when you can. 💙",
    "A difficult check-in. You logged it. That matters. 💙",
    "More than one hard reading today. Acknowledge that. 💙",
    "Low-mid days are real and they're hard. So are you. 💙",
    "A tough check-in. Tomorrow can look different. 💙",
    "You're having a harder day. That's allowed. 💙",
    "Multiple low readings today. Be kind to yourself. 💙",
  ],
  threeMid: [
    "A steady check-in. Steady is underrated. 💙",
    "Mid across the board — you're managing. Keep going. 💙",
    "Not every day is a high or a low. This is a keep-going day. 💙",
    "Consistent and steady. That's its own kind of strength. 💙",
    "A middle-of-the-road day. Those count. 💙",
    "Steady days build the foundation for better ones. 💙",
    "You're maintaining. That's not nothing. 💙",
    "Mid readings mean you're managing. Keep going. 💙",
    "Not every day needs to be great. Today just needs to be today. 💙",
    "Stable is a win when you're living with chronic illness. 💙",
    "Holding steady. That takes more than people realize. 💙",
    "A steady check-in. Steady adds up over time. 💙",
  ],
  twoOrMoreHighMid: [
    "A solid check-in. More good than not. 💙",
    "Multiple high readings. That's encouraging. 💙",
    "You're trending well today. 💙",
    "More good than difficult today. Take that. 💙",
    "A positive check-in overall. 💙",
    "High-mid across the board is a good day. 💙",
    "You're doing better than you might think. 💙",
    "Multiple solid readings. That's worth noticing. 💙",
    "A good check-in on a hard journey. 💙",
    "More highs than lows today. Remember that. 💙",
    "You're holding up well across the board. 💙",
    "A solid overall check-in. You're doing okay. 💙",
  ],
  twoOrMoreBest: [
    "Two good ones. That's a genuinely good check-in. 💙",
    "Look at that — multiple good readings. That matters. 💙",
    "A good check-in day. These are worth celebrating. 💙",
    "Your body is giving you good signals right now. 💙",
    "This is what a better day looks like in the data. 💙",
    "Two or more good readings — that's real progress. 💙",
    "Hold onto this. You're doing well right now. 💙",
    "Good check-ins like this are what the journey is for. 💙",
    "Multiple good readings. Take a moment to feel that. 💙",
    "A strong check-in. You deserve to notice it. 💙",
    "Good days deserve to be marked. Consider this one marked. 💙",
    "This is a good moment. You get to have those too. 💙",
  ],
};

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
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef(null);

  const { token } = useAuth();

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const showToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToastMessage(""), 500);
    }, 1500);
  };

  const getIndividualToast = (tier, metric) => {
    if (tier === "worst") return pickRandom(TOAST_MESSAGES.worst[metric]);
    return pickRandom(TOAST_MESSAGES[tier]);
  };

  const getComboToast = (pain, mood, energy, anxiety, appetite) => {
    const tiers = [
      pain     ? getTier(pain)            : null,
      mood     ? getTier(mood)              : null,
      energy   ? getTier(energy)            : null,
      anxiety  ? getTier(anxiety)          : null,
      appetite ? getTier(appetite)          : null,
    ].filter(Boolean);

    const count = (t) => tiers.filter((x) => x === t).length;

    if (count("worst") >= 2)   return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreWorst);
    if (count("lowMid") >= 2)  return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreLowMid);
    if (count("mid") >= 3)     return pickRandom(COMBINED_TOAST_MESSAGES.threeMid);
    if (count("highMid") >= 2) return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreHighMid);
    if (count("best") >= 2)    return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreBest);
    return null;
  };

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
      track("checkin_completed");
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

        {toastMessage && (
          <div
            className="flex items-center justify-center w-full text-center"
            style={{ opacity: toastVisible ? 1 : 0, transition: "opacity 0.5s", minHeight: "260px" }}
          >
            <p className="text-white text-base leading-relaxed px-2">{toastMessage}</p>
          </div>
        )}

        {!toastMessage && <>

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
                showToast(getIndividualToast(getTier(level), "pain"));
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
                showToast(getIndividualToast(getTier(level), "mood"));
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
                showToast(getIndividualToast(getTier(level), "energy"));
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
                showToast(getIndividualToast(getTier(level), "anxiety"));
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
                showToast(getIndividualToast(getTier(level), "appetite"));
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
              onClick={() => {
                const combo = getComboToast(painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel);
                if (combo) showToast(combo);
                setStep(7);
              }}
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
          <div className="flex items-center gap-5 mt-4">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="text-white/50 text-xs hover:text-white/80 transition-colors"
              >
                back
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/50 text-xs hover:text-white/80 transition-colors"
            >
              cancel
            </button>
          </div>
        )}

        </>}
      </div>
    </div>
  );
}

export default CheckInModal;