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

function DashboardPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [checkIns, setCheckIns] = useState([]);
  const [todaysDone, setTodaysDone] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [timeframe, setTimeframe] = useState(7);
  const [loading, setLoading] = useState(true);
  const [editingCheckIn, setEditingCheckIn] = useState(null);

  const getChartData = () => {
    return [...checkIns]
      .reverse()
      .slice(-timeframe)
      .map((c) => ({
        date: c.date,
        pain: 6 - c.painLevel,
        mood: 6 - c.moodLevel,
        energy: c.energyLevel ? 6 - c.energyLevel : null,
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

  const handleUpdate = async (id, painLevel, moodLevel, energyLevel) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/checkins/${id}`,
        { painLevel, moodLevel, energyLevel },
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
        const today = new Date().toLocaleDateString("en-CA");
        const doneToday = response.data.checkIns.some((c) => c.date === today);
        setTodaysDone(doneToday);
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
    <div className="min-h-screen" style={{ background: "#FAF7FF" }}>
      <div
        className="w-full px-6 py-4 flex justify-between items-center"
        style={{ background: "linear-gradient(135deg, #5C4E8A, #7C6BAE)" }}
      >
        <div>
          <h1
            className="text-white font-medium text-lg"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Good evening, {user?.username}
          </h1>
          <p className="text-white/70 text-xs mt-1">
            {todaysDone ? "Check-in complete" : "Ready to check in?"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-white text-xs px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            {checkIns.length} days
          </span>
          <button
            onClick={() => navigate("/profile")}
            className="text-white/70 text-xs hover:text-white transition-colors"
          >
            Profile
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="text-white/70 text-xs hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="p-6">
        {!todaysDone ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p
              className="text-2xl font-medium"
              style={{
                color: "#2D2540",
                fontFamily: "Playfair Display, Georgia, serif",
              }}
            >
              How are you feeling today?
            </p>
            <p className="text-sm" style={{ color: "#6B5F7A" }}>
              It only takes a moment.
            </p>
            <button
              onClick={() => setShowCheckIn(true)}
              className="mt-4 px-8 py-3 rounded-full text-white font-medium hover:scale-105 transition-all duration-200 shockwave-btn"
              style={{
                background: "linear-gradient(135deg, #7C6BAE, #9B8EC4)",
              }}
            >
              Start Check-in
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="p-4 rounded-2xl"
                style={{ background: "white", border: "1px solid #DDD5EE" }}
              >
                <p className="text-xs" style={{ color: "#6B5F7A" }}>
                  Avg pain
                </p>
                <p
                  className="text-2xl font-medium mt-1"
                  style={{ color: "#2D2540" }}
                >
                  {checkIns.length > 0
                    ? (
                        checkIns.reduce((sum, c) => sum + c.painLevel, 0) /
                        checkIns.length
                      ).toFixed(1)
                    : "-"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#7FAF8A" }}>
                  last {checkIns.length}{" "}
                  {checkIns.length === 1 ? "day" : "days"}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl"
                style={{ background: "white", border: "1px solid #DDD5EE" }}
              >
                <p className="text-xs" style={{ color: "#6B5F7A" }}>
                  Avg mood
                </p>
                <p
                  className="text-2xl font-medium mt-1"
                  style={{ color: "#2D2540" }}
                >
                  {checkIns.length > 0
                    ? (
                        6 -
                        checkIns.reduce((sum, c) => sum + c.moodLevel, 0) /
                          checkIns.length
                      ).toFixed(1)
                    : "-"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#7FAF8A" }}>
                  last {checkIns.length}{" "}
                  {checkIns.length === 1 ? "day" : "days"}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl"
                style={{ background: "white", border: "1px solid #DDD5EE" }}
              >
                <p className="text-xs" style={{ color: "#6B5F7A" }}>
                  Avg energy
                </p>
                <p
                  className="text-2xl font-medium mt-1"
                  style={{ color: "#2D2540" }}
                >
                  {checkIns.filter((c) => c.energyLevel).length > 0
                    ? (
                        6 -
                        checkIns
                          .filter((c) => c.energyLevel)
                          .reduce((sum, c) => sum + c.energyLevel, 0) /
                          checkIns.filter((c) => c.energyLevel).length
                      ).toFixed(1)
                    : "-"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#7FAF8A" }}>
                  last {checkIns.filter((c) => c.energyLevel).length} days
                </p>
              </div>
            </div>

            {/* correlation graph */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "white", border: "1px solid #DDD5EE" }}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium" style={{ color: "#2D2540" }}>
                  Pain · Mood · Energy
                </p>
                <div className="flex gap-2">
                  {[
                    { label: "Week", value: 7 },
                    { label: "Month", value: 30 },
                    { label: "3 months", value: 90 },
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
                <LineChart data={getChartData()}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#6B5F7A" }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    tick={{ fontSize: 10, fill: "#6B5F7A" }}
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
                Recent check-ins
              </p>
              <div className="flex flex-col gap-2">
                {checkIns.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-3 rounded-xl"
                    style={{ background: "#F0EBF8" }}
                  >
                    <div>
                      <p className="text-xs" style={{ color: "#6B5F7A" }}>
                        {c.date}
                      </p>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#2D2540" }}
                      >
                        Pain: {c.painLevel} · Mood: {6 - c.moodLevel} · Energy:{" "}
                        {c.energyLevel ? 6 - c.energyLevel : "-"}
                      </p>
                    </div>
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
                    onClick={() =>
                      setEditingCheckIn({
                        ...editingCheckIn,
                        energyLevel: level,
                      })
                    }
                    className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200"
                    style={{
                      background:
                        editingCheckIn.energyLevel === level
                          ? "#7C6BAE"
                          : "#F0EBF8",
                      color:
                        editingCheckIn.energyLevel === level
                          ? "white"
                          : "#6B5F7A",
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
            const today = new Date().toLocaleDateString("en-CA");
            const doneToday = response.data.checkIns.some(
              (c) => c.date === today,
            );
            setTodaysDone(doneToday);
          }}
        />
      )}
    </div>
  );
}

export default DashboardPage;
