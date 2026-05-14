import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import CheckInModal from "../components/CheckInModal";

function DashboardPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [checkIns, setCheckIns] = useState([]);
  const [todaysDone, setTodaysDone] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  useEffect(() => {
    const fetchCheckIns = async () => {
      try {
        const response = await axios.get("http://localhost:3001/api/checkins", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCheckIns(response.data.checkIns);

        const today = new Date().toISOString().split("T")[0];
        const doneToday = response.data.checkIns.some((c) => c.date === today);
        setTodaysDone(doneToday);
      } catch (error) {
        console.error("Error fetching check-ins:", error);
      }
    };

    if (token) fetchCheckIns();
  }, [token]);

  return (
    <div className="min-h-screen" style={{ background: "#cabce2" }}>
      <div
        className="w-full px-6 py-4 flex justify-between items-center"
        style={{ background: "linear-gradient(135deg, #5C4E8A, #7C6BAE)" }}
      >
        <div>
          <h1
            className="text-white font-medium text-lg"
            style={{ fontFamily: "Georgia, serif" }}
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
              style={{ color: "#2D2540", fontFamily: "Georgia, serif" }}
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
          <p className="text-center" style={{ color: "#6B5F7A" }}>
            Your stats will appear here.
          </p>
        )}
      </div>
      {showCheckIn && (
        <CheckInModal
          onClose={() => setShowCheckIn(false)}
          onComplete={() => {
            setShowCheckIn(false);
            // refetch check-ins so dashboard updates
            setTodaysDone(true);
          }}
        />
      )}
    </div>
  );
}

export default DashboardPage;
