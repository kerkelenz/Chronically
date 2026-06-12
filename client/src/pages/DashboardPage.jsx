import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import CheckInModal from "../components/CheckInModal";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { generateReport } from "../utils/generateReport";
import Navigation, { NavHamburger } from "../components/Navigation";
import { TYPE_ICONS, FREQUENCY_LABELS, formatTime, isMedicationDueToday } from "../utils/medicationHelpers";

const SYMPTOM_ICONS = {
  Fatigue: "😴",
  "Brain fog": "🧠",
  "Pain flare": "🔥",
  Numbness: "🥶",
  Spasticity: "⚡",
  "Vision issues": "👁️",
  "Heat sensitivity": "🌡️",
  "Balance issues": "🌀",
};

const BAR_HEIGHTS = [8, 10, 12, 14, 16];
const COLORS_BETTER = ["#E55A5A", "#E8934A", "#E8C84A", "#8DC65C", "#5AB87A"];
const COLORS_WORSE  = ["#5AB87A", "#5AB87A", "#E8C84A", "#E8934A", "#E55A5A"];

function BarRating({ value, colors = COLORS_BETTER }) {
  const activeColor = value > 0 ? colors[value - 1] : "rgba(0,0,0,0.1)";
  return (
    <div className="flex items-end gap-0.5">
      {colors.map((_, i) => (
        <div
          key={i}
          style={{
            width: "4px",
            height: `${BAR_HEIGHTS[i]}px`,
            borderRadius: "1px",
            background: i < value ? activeColor : "rgba(0,0,0,0.1)",
          }}
        />
      ))}
    </div>
  );
}

function DashboardPage() {
  const { user, token } = useAuth();

  const [checkIns, setCheckIns] = useState([]);
  const [todaysDone, setTodaysDone] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingCheckIn, setEditingCheckIn] = useState(null);

  const [medications, setMedications] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [medLoading, setMedLoading] = useState(true);
  const [skippingDoseKey, setSkippingDoseKey] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this check-in?")) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/checkins/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCheckIns(checkIns.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting check-in:", error);
    }
  };

  const handleUpdate = async (
    id, painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel, symptoms,
  ) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/checkins/${id}`,
        { painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel, symptoms },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCheckIns(checkIns.map((c) => (c.id === id ? response.data.checkIn : c)));
      setEditingCheckIn(null);
    } catch (error) {
      console.error("Error updating check-in:", error);
    }
  };

  useEffect(() => {
    const fetchCheckIns = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/checkins`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCheckIns(response.data.checkIns);
        const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
        const recentlyDone =
          response.data.checkIns.length > 0 &&
          new Date(response.data.checkIns[0].createdAt).getTime() > fourHoursAgo;
        setTodaysDone(recentlyDone);
      } catch (error) {
        console.error("Error fetching check-ins:", error);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchCheckIns();
  }, [token]);

  useEffect(() => {
    const fetchMeds = async () => {
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const [medsRes, logsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications/logs?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setMedications(medsRes.data.medications.filter((m) => m.active));
        setTodayLogs(logsRes.data.logs);
      } catch (err) {
        console.error("Error fetching medications:", err);
      } finally {
        setMedLoading(false);
      }
    };
    if (token) fetchMeds();
  }, [token]);

  const handleTake = async (med, scheduledTime) => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime, takenAt: new Date().toISOString(), status: "taken" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTodayLogs((prev) => [...prev, res.data.log]);
    } catch (err) {
      console.error("Error logging take:", err);
    }
  };

  const handleSkip = async (med, scheduledTime, reason) => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime, status: "skipped", skipReason: reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTodayLogs((prev) => [...prev, res.data.log]);
      setSkippingDoseKey(null);
    } catch (err) {
      console.error("Error logging skip:", err);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAF7FF", overflowX: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg, #5C4E8A, #7C6BAE)" }}>
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ maxWidth: "1024px", margin: "0 auto" }}
        >
          <div>
            <h1
              className="text-white font-medium text-lg"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return "Good morning,";
                if (hour < 17) return "Good afternoon,";
                return "Good evening,";
              })()}{" "}
              {user?.username}
            </h1>
            <p className="text-white/70 text-xs mt-1">
              {todaysDone
                ? `Next check-in at ${new Date(
                    new Date(checkIns[0].createdAt).getTime() + 4 * 60 * 60 * 1000,
                  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Ready to check in?"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              onClick={() => generateReport(checkIns, user?.username)}
              className="text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all duration-200 hover:scale-105"
              style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
            >
              Export Report
            </button>
            <NavHamburger />
          </div>
        </div>
      </div>

      <div
        className="p-6 pb-20 flex flex-col gap-4"
        style={{ maxWidth: "1024px", margin: "0 auto" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(124,107,174,0.3)", borderTopColor: "#7C6BAE" }}
            />
            <p className="text-sm" style={{ color: "#6B5F7A" }}>Loading...</p>
          </div>
        ) : (
          <>
        {(checkIns.length === 0 || !todaysDone) && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <p
              className="text-2xl font-medium"
              style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}
            >
              How are you feeling right now?
            </p>
            <p className="text-sm" style={{ color: "#6B5F7A" }}>
              It only takes a moment.
            </p>
            <button
              onClick={() => setShowCheckIn(true)}
              className="mt-2 px-8 py-3 rounded-full text-white font-medium hover:scale-105 transition-all duration-200 shockwave-btn"
              style={{ background: "linear-gradient(135deg, #7C6BAE, #9B8EC4)" }}
            >
              Start Check-in
            </button>
          </div>
        )}

        {checkIns.length > 0 && (
          <div className="flex flex-col gap-4">
            {/* stat cards */}
            {(() => {
              const fourteenDaysAgo = new Date();
              fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
              const recent = checkIns.filter(
                (c) => new Date(c.date) >= fourteenDaysAgo,
              );
              const recentEnergy   = recent.filter((c) => c.energyLevel);
              const recentAnxiety  = recent.filter((c) => c.anxietyLevel);
              const recentAppetite = recent.filter((c) => c.appetiteLevel);
              const uniqueSymptomDays = [
                ...new Set(
                  recent
                    .filter((c) => c.symptoms && c.symptoms.length > 0)
                    .map((c) => c.date),
                ),
              ].length;
              const symptomDayCounts = {};
              recent
                .filter((c) => c.symptoms && c.symptoms.length > 0)
                .forEach((c) => {
                  c.symptoms.forEach((s) => {
                    if (!symptomDayCounts[s]) symptomDayCounts[s] = new Set();
                    symptomDayCounts[s].add(c.date);
                  });
                });
              const topSymptoms = Object.entries(symptomDayCounts)
                .map(([s, dates]) => ({ s, n: dates.size }))
                .filter(({ n }) => n >= uniqueSymptomDays * 0.3)
                .sort((a, b) => b.n - a.n)
                .slice(0, 3);
              return (
                <>
                  <p className="text-xs uppercase tracking-wide" style={{ color: "#6B5F7A" }}>
                    Last 14 days
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "Avg pain",
                        value: recent.length > 0
                          ? (recent.reduce((s, c) => s + c.painLevel, 0) / recent.length).toFixed(1)
                          : "-",
                      },
                      {
                        label: "Avg mood",
                        value: recent.length > 0
                          ? (6 - recent.reduce((s, c) => s + c.moodLevel, 0) / recent.length).toFixed(1)
                          : "-",
                      },
                      {
                        label: "Avg energy",
                        value: recentEnergy.length > 0
                          ? (6 - recentEnergy.reduce((s, c) => s + c.energyLevel, 0) / recentEnergy.length).toFixed(1)
                          : "-",
                      },
                      {
                        label: "Avg anxiety",
                        value: recentAnxiety.length > 0
                          ? (recentAnxiety.reduce((s, c) => s + c.anxietyLevel, 0) / recentAnxiety.length).toFixed(1)
                          : "-",
                      },
                      {
                        label: "Avg appetite",
                        value: recentAppetite.length > 0
                          ? (recentAppetite.reduce((s, c) => s + c.appetiteLevel, 0) / recentAppetite.length).toFixed(1)
                          : "-",
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="p-4 rounded-2xl"
                        style={{ background: "white", border: "1px solid #DDD5EE" }}
                      >
                        <p className="text-xs" style={{ color: "#6B5F7A" }}>{label}</p>
                        <p className="text-2xl font-medium mt-1" style={{ color: "#2D2540" }}>
                          {value}
                        </p>
                      </div>
                    ))}
                    {/* Common symptoms card */}
                    <div
                      className="p-4 rounded-2xl"
                      style={{ background: "white", border: "1px solid #DDD5EE" }}
                    >
                      <p className="text-xs mb-3" style={{ color: "#6B5F7A" }}>Common symptoms</p>
                      {topSymptoms.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1">
                          {topSymptoms.slice(0, 3).map(({ s, n }) => (
                            <div key={s} className="flex flex-col items-center gap-0.5">
                              <span className="text-3xl leading-none">{SYMPTOM_ICONS[s]}</span>
                              <span
                                className="text-[11px] text-center leading-tight"
                                style={{ color: "#6B5F7A" }}
                              >
                                {s}
                              </span>
                              <span className="text-[11px]" style={{ color: "#7FAF8A" }}>{n}d</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: "#9B8EC4" }}>
                          No symptoms logged recently
                        </p>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* today's medications */}
            {!medLoading && medications.length > 0 && (() => {
              const today = new Date().toLocaleDateString("en-CA");
              const now = new Date();
              const doses = [];

              medications.forEach((med) => {
                if (!isMedicationDueToday(med, today)) return;
                const times = med.scheduledTimes?.length > 0 ? med.scheduledTimes : [null];
                times.forEach((scheduledTime) => {
                  const doseKey = `${med.id}-${scheduledTime || "none"}`;
                  const log = todayLogs.find(
                    (l) => l.medicationId === med.id && l.scheduledTime === scheduledTime,
                  );
                  let status;
                  if (log) {
                    status = log.status;
                  } else if (scheduledTime) {
                    const [h, m] = scheduledTime.split(":").map(Number);
                    const sched = new Date();
                    sched.setHours(h, m, 0, 0);
                    const minPast = (now - sched) / (1000 * 60);
                    if (minPast > 60) status = "missed";
                    else if (minPast > 0) status = "past-due";
                    else status = "upcoming";
                  } else {
                    status = "upcoming";
                  }
                  doses.push({ med, scheduledTime, doseKey, status, log });
                });
              });

              doses.sort((a, b) => {
                const aTime = a.scheduledTime || "99:99";
                const bTime = b.scheduledTime || "99:99";
                return aTime.localeCompare(bTime);
              });

              const borderColor = {
                taken: "#7FAF8A",
                skipped: "#DDD5EE",
                missed: "#B07088",
                "past-due": "#C4A882",
                upcoming: "transparent",
              };

              const SKIP_REASONS = [
                "Forgot", "Felt sick / threw up", "Side effects", "Ran out",
                "Doctor advised", "Already took it", "Too painful to take",
              ];

              return (
                <div className="p-4 rounded-2xl" style={{ background: "white", border: "1px solid #DDD5EE" }}>
                  <p className="text-sm font-medium mb-3" style={{ color: "#2D2540" }}>
                    Today's medications
                  </p>
                  {doses.length === 0 ? (
                    <p className="text-xs" style={{ color: "#9B8EC4" }}>
                      No medications scheduled for today
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {doses.map(({ med, scheduledTime, doseKey, status, log }) => (
                        <div
                          key={doseKey}
                          className="p-3 rounded-xl"
                          style={{
                            background: "white",
                            border: "1px solid #F0EBF8",
                            borderLeft: `3px solid ${borderColor[status] || "transparent"}`,
                          }}
                        >
                          {skippingDoseKey === doseKey ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-medium" style={{ color: "#6B5F7A" }}>
                                Why are you skipping?
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {SKIP_REASONS.map((r) => (
                                  <button
                                    key={r}
                                    onClick={() => handleSkip(med, scheduledTime, r)}
                                    className="px-2 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-80"
                                    style={{ background: "#F0EBF8", color: "#6B5F7A" }}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setSkippingDoseKey(null)}
                                className="text-[10px] text-left hover:opacity-70"
                                style={{ color: "#9B8EC4" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-base leading-none">{TYPE_ICONS[med.type] || "💊"}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-tight" style={{ color: "#2D2540" }}>
                                    {med.name}
                                    {med.dosage && (
                                      <span className="font-normal ml-1" style={{ color: "#9B8EC4" }}>
                                        {med.dosage}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] mt-0.5" style={{ color: "#9B8EC4" }}>
                                    {status === "taken" && log?.takenAt
                                      ? `Taken at ${new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                      : status === "skipped"
                                      ? `Skipped${log?.skipReason ? ` · ${log.skipReason}` : ""}`
                                      : status === "missed"
                                      ? "Missed"
                                      : scheduledTime
                                      ? formatTime(scheduledTime)
                                      : FREQUENCY_LABELS[med.frequency] || ""}
                                  </p>
                                </div>
                              </div>
                              {status === "taken" && (
                                <span className="text-sm flex-shrink-0" style={{ color: "#7FAF8A" }}>✓</span>
                              )}
                              {(status === "upcoming" || status === "past-due") && (
                                <div className="flex gap-1.5 flex-shrink-0">
                                  <button
                                    onClick={() => handleTake(med, scheduledTime)}
                                    className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-200 hover:opacity-80"
                                    style={{ background: "#7C6BAE", color: "white" }}
                                  >
                                    Take
                                  </button>
                                  <button
                                    onClick={() => setSkippingDoseKey(doseKey)}
                                    className="px-2.5 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-80"
                                    style={{ background: "#F0EBF8", color: "#6B5F7A" }}
                                  >
                                    Skip
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* check-in history */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "white", border: "1px solid #DDD5EE" }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: "#2D2540" }}>
                Today's check-ins
              </p>
              {(() => {
                const today = new Date().toLocaleDateString("en-CA");
                const todaysCheckIns = checkIns.filter((c) => c.date === today);
                if (todaysCheckIns.length === 0) {
                  return (
                    <p className="text-xs" style={{ color: "#9B8EC4" }}>
                      No check-ins yet today
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    {todaysCheckIns.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ background: "#F0EBF8" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs" style={{ color: "#6B5F7A" }}>
                            {new Date(c.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <div className="flex flex-col gap-y-1 mt-1">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {[
                                { label: "Energy",   value: c.energyLevel   ? 6 - c.energyLevel   : null, colors: COLORS_BETTER },
                                { label: "Mood",     value: 6 - c.moodLevel,                               colors: COLORS_BETTER },
                                { label: "Appetite", value: c.appetiteLevel ? 6 - c.appetiteLevel : null, colors: COLORS_BETTER },
                                { label: "Pain",     value: c.painLevel,                                   colors: COLORS_WORSE  },
                                { label: "Anxiety",  value: c.anxietyLevel  ? c.anxietyLevel       : null, colors: COLORS_WORSE  },
                              ]
                                .filter(({ value }) => value !== null)
                                .map(({ label, value, colors }) => (
                                  <div
                                    key={label}
                                    className="flex items-center gap-1 shrink-0"
                                    style={{ width: "80px" }}
                                  >
                                    <span
                                      className="text-[10px] shrink-0"
                                      style={{ color: "#6B5F7A", width: "46px" }}
                                    >
                                      {label}
                                    </span>
                                    <BarRating value={value} colors={colors} />
                                  </div>
                                ))}
                            </div>
                            {c.symptoms && c.symptoms.length > 0 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {c.symptoms.map((s) => (
                                  <span key={s} title={s} className="text-base leading-none">
                                    {SYMPTOM_ICONS[s]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex flex-col gap-1">
                          <button
                            onClick={() => setEditingCheckIn(c)}
                            className="p-1 hover:opacity-70 transition-opacity"
                            style={{ color: "#7C6BAE" }}
                          >
                            <FiEdit2 size={14} />
                          </button>
                          {c.id === todaysCheckIns[0].id && (
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1 hover:opacity-70 transition-opacity"
                              style={{ color: "#B07088" }}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* edit modal */}
      {editingCheckIn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <div
            className="w-full max-w-sm mx-4 p-6 rounded-2xl flex flex-col gap-4"
            style={{ background: "white" }}
          >
            <p
              className="font-medium"
              style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}
            >
              Edit Check-in
            </p>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>Pain level</p>
              <div className="flex gap-2">
                {[[1,"Very Light"],[2,"Light"],[3,"Moderate"],[4,"Severe"],[5,"Very Severe"]].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, painLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.painLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color:      editingCheckIn.painLevel === level ? "white"   : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>Mood level</p>
              <div className="flex gap-2">
                {[[1,"Great"],[2,"Good"],[3,"Okay"],[4,"Low"],[5,"Very Low"]].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, moodLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.moodLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color:      editingCheckIn.moodLevel === level ? "white"   : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>Energy level</p>
              <div className="flex gap-2">
                {[[1,"Full"],[2,"Good"],[3,"Low"],[4,"Drained"],[5,"Exhausted"]].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, energyLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.energyLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color:      editingCheckIn.energyLevel === level ? "white"   : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>Anxiety level</p>
              <div className="flex gap-2">
                {[[1,"Calm"],[2,"Mild"],[3,"Moderate"],[4,"High"],[5,"Severe"]].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, anxietyLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.anxietyLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color:      editingCheckIn.anxietyLevel === level ? "white"   : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>Appetite level</p>
              <div className="flex gap-2">
                {[[1,"Great"],[2,"Good"],[3,"Fair"],[4,"Poor"],[5,"None"]].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, appetiteLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.appetiteLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color:      editingCheckIn.appetiteLevel === level ? "white"   : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>Symptoms</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Fatigue","Brain fog","Pain flare","Numbness",
                  "Spasticity","Vision issues","Heat sensitivity","Balance issues",
                ].map((s) => {
                  const active = (editingCheckIn.symptoms || []).includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        const current = editingCheckIn.symptoms || [];
                        setEditingCheckIn({
                          ...editingCheckIn,
                          symptoms: active ? current.filter((x) => x !== s) : [...current, s],
                        });
                      }}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200"
                      style={{
                        background: active ? "#7C6BAE" : "#F0EBF8",
                        color:      active ? "white"   : "#6B5F7A",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingCheckIn(null)}
                className="flex-1 py-2 rounded-full text-sm"
                style={{ background: "#F0EBF8", color: "#6B5F7A" }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdate(
                    editingCheckIn.id,
                    editingCheckIn.painLevel,
                    editingCheckIn.moodLevel,
                    editingCheckIn.energyLevel,
                    editingCheckIn.anxietyLevel,
                    editingCheckIn.appetiteLevel,
                    editingCheckIn.symptoms?.length > 0 ? editingCheckIn.symptoms : null,
                  )
                }
                className="flex-1 py-2 rounded-full text-sm text-white"
                style={{ background: "#7C6BAE" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* check-in modal */}
      {showCheckIn && (
        <CheckInModal
          onClose={() => setShowCheckIn(false)}
          onComplete={async () => {
            setShowCheckIn(false);
            const response = await axios.get(
              `${import.meta.env.VITE_API_URL}/api/checkins`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            setCheckIns(response.data.checkIns);
            const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
            const recentlyDone =
              response.data.checkIns.length > 0 &&
              new Date(response.data.checkIns[0].createdAt).getTime() > fourHoursAgo;
            setTodaysDone(recentlyDone);
          }}
        />
      )}

      <Navigation />
    </div>
  );
}

export default DashboardPage;
