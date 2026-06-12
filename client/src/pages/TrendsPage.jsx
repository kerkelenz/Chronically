import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import Navigation, { NavHamburger } from "../components/Navigation";

function TrendsPage() {
  const { user, token } = useAuth();
  const [checkIns, setCheckIns] = useState([]);
  const [timeframe, setTimeframe] = useState("day");
  const [loading, setLoading] = useState(true);

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
          pain:     6 - c.painLevel,
          mood:     6 - c.moodLevel,
          energy:   c.energyLevel   ? 6 - c.energyLevel   : null,
          anxiety:  c.anxietyLevel  ? 6 - c.anxietyLevel  : null,
          appetite: c.appetiteLevel ? 6 - c.appetiteLevel : null,
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
        if (c.energyLevel)   byDate[c.date].energies.push(c.energyLevel);
        if (c.anxietyLevel)  byDate[c.date].anxieties.push(c.anxietyLevel);
        if (c.appetiteLevel) byDate[c.date].appetites.push(c.appetiteLevel);
      });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { pains, moods, energies, anxieties, appetites }]) => ({
        date,
        pain:     parseFloat((6 - pains.reduce((s, v) => s + v, 0) / pains.length).toFixed(1)),
        mood:     parseFloat((6 - moods.reduce((s, v) => s + v, 0) / moods.length).toFixed(1)),
        energy:   energies.length   ? parseFloat((6 - energies.reduce((s, v) => s + v, 0)   / energies.length).toFixed(1))   : null,
        anxiety:  anxieties.length  ? parseFloat((6 - anxieties.reduce((s, v) => s + v, 0)  / anxieties.length).toFixed(1))  : null,
        appetite: appetites.length  ? parseFloat((6 - appetites.reduce((s, v) => s + v, 0)  / appetites.length).toFixed(1))  : null,
      }));
  };

  useEffect(() => {
    const fetchCheckIns = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/checkins`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCheckIns(response.data.checkIns);
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
        style={{ background: "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
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
          <h1
            className="text-white font-medium text-lg"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Trends
          </h1>
          <NavHamburger />
        </div>
      </div>

      <div
        className="p-6 pb-20 flex flex-col gap-4"
        style={{ maxWidth: "1024px", margin: "0 auto" }}
      >
        {checkIns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-base" style={{ color: "#9B8EC4" }}>
              No data yet. Complete a check-in to see your trends.
            </p>
          </div>
        ) : (
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
                  { label: "Day",   value: "day" },
                  { label: "Week",  value: 7     },
                  { label: "Month", value: 30    },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframe(t.value)}
                    className="text-xs px-3 py-1 rounded-full transition-all duration-200"
                    style={{
                      background: timeframe === t.value ? "#7C6BAE" : "#F0EBF8",
                      color:      timeframe === t.value ? "white"   : "#6B5F7A",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={getChartData()}
                margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B5F7A" }} />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 3, 5]}
                  width={32}
                  tick={{ fontSize: 9, fill: "#6B5F7A" }}
                  tickFormatter={(v) => ({ 1: "Bad", 3: "Mid", 5: "Good" })[v] ?? ""}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const r = Math.round(value);
                    const fwd = { 1: "Low", 2: "Low-Mid", 3: "Mid", 4: "Mid-High", 5: "High" };
                    const rev = { 1: "High", 2: "Mid-High", 3: "Mid", 4: "Low-Mid", 5: "Low" };
                    const label = name === "pain" || name === "anxiety" ? rev[r] : fwd[r];
                    return [label ?? value, name.charAt(0).toUpperCase() + name.slice(1)];
                  }}
                />
                <Line type="monotone" dataKey="energy"   stroke="#8FAF9B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mood"     stroke="#C4A8C0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pain"     stroke="#7C6BAE" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="anxiety"  stroke="#9BAFC4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="appetite" stroke="#C4A882" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
              {[
                { key: "energy",   color: "#8FAF9B" },
                { key: "mood",     color: "#C4A8C0" },
                { key: "pain",     color: "#7C6BAE" },
                { key: "anxiety",  color: "#9BAFC4" },
                { key: "appetite", color: "#C4A882" },
              ].map(({ key, color }) => (
                <span key={key} className="flex items-center gap-1 text-xs" style={{ color: "#6B5F7A" }}>
                  <span style={{ display: "inline-block", width: 16, height: 2, background: color, borderRadius: 1 }} />
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}

export default TrendsPage;
