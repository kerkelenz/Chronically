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

const PAIN_LABELS    = { 1: "Very Light", 2: "Light",   3: "Moderate", 4: "Severe",  5: "Very Severe" };
const MOOD_LABELS    = { 1: "Great",      2: "Good",    3: "Okay",     4: "Low",     5: "Very Low" };
const ENERGY_LABELS  = { 1: "Full",       2: "Good",    3: "Low",      4: "Drained", 5: "Exhausted" };
const ANXIETY_LABELS = { 1: "Calm",       2: "Mild",    3: "Moderate", 4: "High",    5: "Severe" };

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
          byDate[c.date] = { pains: [], moods: [], energies: [], anxieties: [] };
        byDate[c.date].pains.push(c.painLevel);
        byDate[c.date].moods.push(c.moodLevel);
        if (c.energyLevel) byDate[c.date].energies.push(c.energyLevel);
        if (c.anxietyLevel) byDate[c.date].anxieties.push(c.anxietyLevel);
      });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { pains, moods, energies, anxieties }]) => ({
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

  const handleUpdate = async (id, painLevel, moodLevel, energyLevel, anxietyLevel) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/checkins/${id}`,
        { painLevel, moodLevel, energyLevel, anxietyLevel },
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
      <div
        className="w-full px-6 py-4 flex justify-between items-center"
        style={{ background: "linear-gradient(135deg, #5C4E8A, #7C6BAE)" }}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="text-xs px-3 py-1 rounded-full transition-all duration-200 hover:scale-105"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Profile
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="text-xs px-3 py-1 rounded-full transition-all duration-200 hover:scale-105"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Log out
          </button>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4">
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
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Avg pain",
                  value: checkIns.length > 0
                    ? (6 - checkIns.reduce((s, c) => s + c.painLevel, 0) / checkIns.length).toFixed(1)
                    : "-",
                  count: checkIns.length,
                },
                {
                  label: "Avg mood",
                  value: checkIns.length > 0
                    ? (6 - checkIns.reduce((s, c) => s + c.moodLevel, 0) / checkIns.length).toFixed(1)
                    : "-",
                  count: checkIns.length,
                },
                {
                  label: "Avg energy",
                  value: checkIns.filter((c) => c.energyLevel).length > 0
                    ? (6 - checkIns.filter((c) => c.energyLevel).reduce((s, c) => s + c.energyLevel, 0) / checkIns.filter((c) => c.energyLevel).length).toFixed(1)
                    : "-",
                  count: checkIns.filter((c) => c.energyLevel).length,
                },
                {
                  label: "Avg anxiety",
                  value: checkIns.filter((c) => c.anxietyLevel).length > 0
                    ? (6 - checkIns.filter((c) => c.anxietyLevel).reduce((s, c) => s + c.anxietyLevel, 0) / checkIns.filter((c) => c.anxietyLevel).length).toFixed(1)
                    : "-",
                  count: checkIns.filter((c) => c.anxietyLevel).length,
                },
              ].map(({ label, value, count }) => (
                <div key={label} className="p-4 rounded-2xl" style={{ background: "white", border: "1px solid #DDD5EE" }}>
                  <p className="text-xs" style={{ color: "#6B5F7A" }}>{label}</p>
                  <p className="text-2xl font-medium mt-1" style={{ color: "#2D2540" }}>{value}</p>
                  <p className="text-xs mt-1" style={{ color: "#7FAF8A" }}>last {count} {count === 1 ? "entry" : "entries"}</p>
                </div>
              ))}
            </div>

            {/* correlation graph */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "white", border: "1px solid #DDD5EE" }}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium" style={{ color: "#2D2540" }}>
                  Pain · Mood · Energy · Anxiety
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
                    width={0}
                    tick={false}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="pain"
                    stroke="#7C6BAE"
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
                    dataKey="energy"
                    stroke="#8FAF9B"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="anxiety"
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
              <div className="flex flex-col gap-2">
                {checkIns.filter((c) => c.date === checkIns[0].date).map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-3 rounded-xl"
                    style={{ background: "#F0EBF8" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: "#6B5F7A" }}>
                        {c.date} · {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-sm font-medium" style={{ color: "#2D2540" }}>
                        Pain: {PAIN_LABELS[c.painLevel]} · Mood: {MOOD_LABELS[c.moodLevel]} · Energy: {c.energyLevel ? ENERGY_LABELS[c.energyLevel] : "-"} · Anxiety: {c.anxietyLevel ? ANXIETY_LABELS[c.anxietyLevel] : "-"}
                      </p>
                      {c.symptoms && c.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.symptoms.map((s) => (
                            <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EDE8F5", color: "#7C6BAE" }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {c.date === checkIns[0].date && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingCheckIn(c)}
                          className="p-1 hover:opacity-70 transition-opacity"
                          style={{ color: "#7C6BAE" }}
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1 hover:opacity-70 transition-opacity"
                          style={{ color: "#B07088" }}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
