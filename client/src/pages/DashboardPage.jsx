import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import CheckInModal from "../components/CheckInModal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { generateReport } from "../utils/generateReport";

const SYMPTOM_ICONS = {
  "Fatigue":          "😴",
  "Brain fog":        "🧠",
  "Pain flare":       "🔥",
  "Numbness":         "🥶",
  "Spasticity":       "⚡",
  "Vision issues":    "👁️",
  "Heat sensitivity": "🌡️",
  "Balance issues":   "🌀",
};

const BAR_HEIGHTS = [8, 10, 12, 14, 16];
// mood/energy: more bars = better (red → green)
const COLORS_BETTER = ["#E55A5A", "#E8934A", "#E8C84A", "#8DC65C", "#5AB87A"];
// pain/anxiety: more bars = worse symptom (green → red)
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
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [checkIns, setCheckIns] = useState([]);
  const [todaysDone, setTodaysDone] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [timeframe, setTimeframe] = useState("day");
  const [loading, setLoading] = useState(true);
  const [editingCheckIn, setEditingCheckIn] = useState(null);

  const getChartData = () => {
    if (timeframe === "day") {
      const today = new Date().toLocaleDateString("en-CA");
      return [...checkIns]
        .filter((c) => c.date === today)
        .reverse()
        .map((c) => ({
          date: new Date(c.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          pain: 6 - c.painLevel,
          mood: 6 - c.moodLevel,
          energy: c.energyLevel ? 6 - c.energyLevel : null,
          anxiety: c.anxietyLevel ? 6 - c.anxietyLevel : null,
          appetite: c.appetiteLevel ? c.appetiteLevel : null,
        }));
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeframe);
    const cutoffStr = cutoff.toLocaleDateString("en-CA");

    const byDate = {};
    checkIns
      .filter((c) => c.date >= cutoffStr)
      .forEach((c) => {
        if (!byDate[c.date])
          byDate[c.date] = { pains: [], moods: [], energies: [], anxieties: [], appetites: [] };
        byDate[c.date].pains.push(c.painLevel);
        byDate[c.date].moods.push(c.moodLevel);
        if (c.energyLevel) byDate[c.date].energies.push(c.energyLevel);
        if (c.anxietyLevel) byDate[c.date].anxieties.push(c.anxietyLevel);
        if (c.appetiteLevel) byDate[c.date].appetites.push(c.appetiteLevel);
      });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { pains, moods, energies, anxieties, appetites }]) => ({
        date,
        pain: parseFloat(
          (6 - pains.reduce((s, v) => s + v, 0) / pains.length).toFixed(1),
        ),
        mood: parseFloat(
          (6 - moods.reduce((s, v) => s + v, 0) / moods.length).toFixed(1),
        ),
        energy: energies.length
          ? parseFloat((6 - energies.reduce((s, v) => s + v, 0) / energies.length).toFixed(1))
          : null,
        anxiety: anxieties.length
          ? parseFloat((6 - anxieties.reduce((s, v) => s + v, 0) / anxieties.length).toFixed(1))
          : null,
        appetite: appetites.length
          ? parseFloat((appetites.reduce((s, v) => s + v, 0) / appetites.length).toFixed(1))
          : null,
      }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this check-in?"))
      return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/checkins/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCheckIns(checkIns.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting check-in:", error);
    }
  };

  const handleUpdate = async (id, painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel, symptoms) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/checkins/${id}`,
        { painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel, symptoms },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCheckIns(
        checkIns.map((c) => (c.id === id ? response.data.checkIn : c)),
      );
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

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{
              borderColor: "rgba(255,255,255,0.3)",
              borderTopColor: "white",
            }}
          />
          <p className="text-sm text-white opacity-70">Loading...</p>
        </div>
      </div>
    );
  }

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
          <button
            onClick={() => navigate("/profile")}
            className="text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all duration-200 hover:scale-105"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Profile
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all duration-200 hover:scale-105"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Log out
          </button>
        </div>
      </div>
      </div>

      <div className="p-6 flex flex-col gap-4" style={{ maxWidth: "1024px", margin: "0 auto" }}>
        {!todaysDone && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <p
              className="text-2xl font-medium"
              style={{
                color: "#2D2540",
                fontFamily: "Playfair Display, Georgia, serif",
              }}
            >
              How are you feeling right now?
            </p>
            <p className="text-sm" style={{ color: "#6B5F7A" }}>
              It only takes a moment.
            </p>
            <button
              onClick={() => setShowCheckIn(true)}
              className="mt-2 px-8 py-3 rounded-full text-white font-medium hover:scale-105 transition-all duration-200 shockwave-btn"
              style={{
                background: "linear-gradient(135deg, #7C6BAE, #9B8EC4)",
              }}
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
              const recent         = checkIns.filter((c) => new Date(c.date) >= fourteenDaysAgo);
              const recentEnergy   = recent.filter((c) => c.energyLevel);
              const recentAnxiety  = recent.filter((c) => c.anxietyLevel);
              const recentAppetite = recent.filter((c) => c.appetiteLevel);
              const days         = [...new Set(recent.map((c) => c.date))].length;
              const energyDays   = [...new Set(recentEnergy.map((c) => c.date))].length;
              const anxietyDays  = [...new Set(recentAnxiety.map((c) => c.date))].length;
              const appetiteDays = [...new Set(recentAppetite.map((c) => c.date))].length;
              const uniqueSymptomDays = [...new Set(
                recent.filter((c) => c.symptoms && c.symptoms.length > 0).map((c) => c.date)
              )].length;
              const symptomDayCounts = {};
              recent.filter((c) => c.symptoms && c.symptoms.length > 0).forEach((c) => {
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
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Avg pain",
                      value: recent.length > 0
                        ? (recent.reduce((s, c) => s + c.painLevel, 0) / recent.length).toFixed(1)
                        : "-",
                      count: days,
                    },
                    {
                      label: "Avg mood",
                      value: recent.length > 0
                        ? (6 - recent.reduce((s, c) => s + c.moodLevel, 0) / recent.length).toFixed(1)
                        : "-",
                      count: days,
                    },
                    {
                      label: "Avg energy",
                      value: recentEnergy.length > 0
                        ? (6 - recentEnergy.reduce((s, c) => s + c.energyLevel, 0) / recentEnergy.length).toFixed(1)
                        : "-",
                      count: energyDays,
                    },
                    {
                      label: "Avg anxiety",
                      value: recentAnxiety.length > 0
                        ? (recentAnxiety.reduce((s, c) => s + c.anxietyLevel, 0) / recentAnxiety.length).toFixed(1)
                        : "-",
                      count: anxietyDays,
                    },
                    {
                      label: "Avg appetite",
                      value: recentAppetite.length > 0
                        ? (recentAppetite.reduce((s, c) => s + c.appetiteLevel, 0) / recentAppetite.length).toFixed(1)
                        : "-",
                      count: appetiteDays,
                    },
                  ].map(({ label, value, count }) => (
                    <div key={label} className="p-4 rounded-2xl" style={{ background: "white", border: "1px solid #DDD5EE" }}>
                      <p className="text-xs" style={{ color: "#6B5F7A" }}>{label}</p>
                      <p className="text-2xl font-medium mt-1" style={{ color: "#2D2540" }}>{value}</p>
                      <p className="text-xs mt-1" style={{ color: "#7FAF8A" }}>{count} {count === 1 ? "day" : "days"}</p>
                    </div>
                  ))}
                  {/* Common symptoms card */}
                  <div className="p-4 rounded-2xl" style={{ background: "white", border: "1px solid #DDD5EE" }}>
                    <p className="text-xs mb-3" style={{ color: "#6B5F7A" }}>Common symptoms</p>
                    {topSymptoms.length > 0 ? (
                      <>
                        <p className="text-xs mb-2" style={{ color: "#7FAF8A" }}>{uniqueSymptomDays} {uniqueSymptomDays === 1 ? "day" : "days"}</p>
                        <div className="grid grid-cols-3 gap-1">
                          {topSymptoms.slice(0, 3).map(({ s, n }) => (
                            <div key={s} className="flex flex-col items-center gap-0.5">
                              <span className="text-3xl leading-none">{SYMPTOM_ICONS[s]}</span>
                              <span className="text-[11px] text-center leading-tight" style={{ color: "#6B5F7A" }}>{s}</span>
                              <span className="text-[11px]" style={{ color: "#7FAF8A" }}>{n}d</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: "#9B8EC4" }}>No symptoms logged recently</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* correlation graph */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "white", border: "1px solid #DDD5EE" }}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium" style={{ color: "#2D2540" }}>
                  Energy · Mood · Pain · Anxiety · Appetite
                </p>
                <div className="flex gap-2">
                  {[
                    { label: "Day", value: "day" },
                    { label: "Week", value: 7 },
                    { label: "Month", value: 30 },
                  ].map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTimeframe(t.value)}
                      className="text-xs px-3 py-1 rounded-full transition-all duration-200"
                      style={{
                        background:
                          timeframe === t.value ? "#7C6BAE" : "#F0EBF8",
                        color: timeframe === t.value ? "white" : "#6B5F7A",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={getChartData()}
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#6B5F7A" }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 3, 5]}
                    width={32}
                    tick={{ fontSize: 9, fill: "#6B5F7A" }}
                    tickFormatter={(v) => ({ 1: "Bad", 3: "Mid", 5: "Good" }[v] ?? "")}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const r = Math.round(value);
                      const fwd = { 1: "Low", 2: "Low-Mid", 3: "Mid", 4: "Mid-High", 5: "High" };
                      const rev = { 1: "High", 2: "Mid-High", 3: "Mid", 4: "Low-Mid", 5: "Low" };
                      const label = (name === "pain" || name === "anxiety") ? rev[r] : fwd[r];
                      return [label ?? value, name.charAt(0).toUpperCase() + name.slice(1)];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    stroke="#8FAF9B"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#C4A8C0"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pain"
                    stroke="#7C6BAE"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="anxiety"
                    stroke="#9BAFC4"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="appetite"
                    stroke="#C4A882"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* check-in history */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "white", border: "1px solid #DDD5EE" }}
            >
              <p
                className="text-sm font-medium mb-3"
                style={{ color: "#2D2540" }}
              >
                Today's check-ins
              </p>
              {(() => {
                const today = new Date().toLocaleDateString("en-CA");
                const todaysCheckIns = checkIns.filter((c) => c.date === today);
                if (todaysCheckIns.length === 0) {
                  return <p className="text-xs" style={{ color: "#9B8EC4" }}>No check-ins yet today</p>;
                }
                return (
                  <div className="flex flex-col gap-2">
                    {todaysCheckIns.map((c) => (
                      <div
                        key={c.id}
                        className="flex justify-between items-center p-3 rounded-xl"
                        style={{ background: "#F0EBF8" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs" style={{ color: "#6B5F7A" }}>
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {[
                              { label: "Energy",   value: c.energyLevel   ? 6 - c.energyLevel   : null, colors: COLORS_BETTER },
                              { label: "Mood",     value: 6 - c.moodLevel,                              colors: COLORS_BETTER },
                              { label: "Pain",     value: c.painLevel,                                  colors: COLORS_WORSE },
                              { label: "Anxiety",  value: c.anxietyLevel  ? c.anxietyLevel       : null, colors: COLORS_WORSE },
                              { label: "Appetite", value: c.appetiteLevel ? c.appetiteLevel      : null, colors: COLORS_BETTER },
                            ].filter(({ value }) => value !== null).map(({ label, value, colors }) => (
                              <div key={label} className="flex items-center gap-1">
                                <span className="text-[10px]" style={{ color: "#6B5F7A" }}>{label}</span>
                                <BarRating value={value} colors={colors} />
                              </div>
                            ))}
                          </div>
                          {c.symptoms && c.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.symptoms.map((s) => (
                                <span key={s} title={s} className="text-base leading-none">
                                  {SYMPTOM_ICONS[s]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
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
              style={{
                color: "#2D2540",
                fontFamily: "Playfair Display, Georgia, serif",
              }}
            >
              Edit Check-in
            </p>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>
                Pain level
              </p>
              <div className="flex gap-2">
                {[
                  [1, "Very Light"],
                  [2, "Light"],
                  [3, "Moderate"],
                  [4, "Severe"],
                  [5, "Very Severe"],
                ].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() =>
                      setEditingCheckIn({ ...editingCheckIn, painLevel: level })
                    }
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background:
                        editingCheckIn.painLevel === level
                          ? "#7C6BAE"
                          : "#F0EBF8",
                      color:
                        editingCheckIn.painLevel === level
                          ? "white"
                          : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>
                Mood level
              </p>
              <div className="flex gap-2">
                {[
                  [1, "Great"],
                  [2, "Good"],
                  [3, "Okay"],
                  [4, "Low"],
                  [5, "Very Low"],
                ].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() =>
                      setEditingCheckIn({ ...editingCheckIn, moodLevel: level })
                    }
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background:
                        editingCheckIn.moodLevel === level
                          ? "#7C6BAE"
                          : "#F0EBF8",
                      color:
                        editingCheckIn.moodLevel === level
                          ? "white"
                          : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>
                Energy level
              </p>
              <div className="flex gap-2">
                {[
                  [1, "Full"],
                  [2, "Good"],
                  [3, "Low"],
                  [4, "Drained"],
                  [5, "Exhausted"],
                ].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, energyLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.energyLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color: editingCheckIn.energyLevel === level ? "white" : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>
                Anxiety level
              </p>
              <div className="flex gap-2">
                {[
                  [1, "Calm"],
                  [2, "Mild"],
                  [3, "Moderate"],
                  [4, "High"],
                  [5, "Severe"],
                ].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, anxietyLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.anxietyLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color: editingCheckIn.anxietyLevel === level ? "white" : "#6B5F7A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "#6B5F7A" }}>
                Appetite level
              </p>
              <div className="flex gap-2">
                {[
                  [1, "None"],
                  [2, "Poor"],
                  [3, "Fair"],
                  [4, "Good"],
                  [5, "Great"],
                ].map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setEditingCheckIn({ ...editingCheckIn, appetiteLevel: level })}
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background: editingCheckIn.appetiteLevel === level ? "#7C6BAE" : "#F0EBF8",
                      color: editingCheckIn.appetiteLevel === level ? "white" : "#6B5F7A",
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
                {["Fatigue", "Brain fog", "Pain flare", "Numbness", "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues"].map((s) => {
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
                        color: active ? "white" : "#6B5F7A",
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
              new Date(response.data.checkIns[0].createdAt).getTime() >
                fourHoursAgo;
            setTodaysDone(recentlyDone);
          }}
        />
      )}
    </div>
  );
}

export default DashboardPage;
