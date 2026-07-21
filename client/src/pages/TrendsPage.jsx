import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Navigation, { NavHamburger } from "../components/Navigation";
import { adherenceStats } from "../utils/medicationHelpers";

function TrendsPage() {
  const { user, token } = useAuth();
  const [checkIns, setCheckIns] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medLogs, setMedLogs] = useState([]);
  const [timeframe, setTimeframe] = useState(2);
  const [loading, setLoading] = useState(true);

  const getChartData = () => {
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
        pain:     parseFloat((pains.reduce((s, v) => s + v, 0) / pains.length).toFixed(1)),
        mood:     parseFloat((moods.reduce((s, v) => s + v, 0) / moods.length).toFixed(1)),
        energy:   energies.length   ? parseFloat((energies.reduce((s, v) => s + v, 0)   / energies.length).toFixed(1))   : null,
        anxiety:  anxieties.length  ? parseFloat((anxieties.reduce((s, v) => s + v, 0)  / anxieties.length).toFixed(1))  : null,
        appetite: appetites.length  ? parseFloat((appetites.reduce((s, v) => s + v, 0)  / appetites.length).toFixed(1))  : null,
      }));
  };

  // Adherence via the shared computed-missed engine math, so the charts, the
  // cabinet dots, and the doctor report can never disagree.
  const getAdherenceView = () => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeframe);
    const todayStr = today.toLocaleDateString("en-CA");
    const cutoffStr = cutoff.toLocaleDateString("en-CA");
    const stats = adherenceStats(medications, medLogs, cutoffStr, todayStr, todayStr);
    const medAdherence = stats.perMed
      .filter((m) => m.expected > 0)
      .map((m) => ({ name: m.name, adherence: m.pct, taken: m.taken, scheduled: m.expected }));
    const dailyAdherence = stats.perDay
      .filter((d) => d.expected > 0)
      .map((d) => ({
        date: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        percentage: Math.round((d.taken / d.expected) * 100),
        taken: d.taken,
        scheduled: d.expected,
      }));
    return { medAdherence, dailyAdherence };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toLocaleDateString("en-CA");
        const endDate   = new Date().toLocaleDateString("en-CA");
        const hdrs = { Authorization: `Bearer ${token}` };

        const [checkInsRes, medsRes, logsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/checkins`, { headers: hdrs }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications`, { headers: hdrs }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications/logs?startDate=${startDate}&endDate=${endDate}`, { headers: hdrs }),
        ]);

        setCheckIns(checkInsRes.data.checkIns);
        setMedications(medsRes.data.medications);
        setMedLogs(logsRes.data.logs);
      } catch (error) {
        console.error("Error fetching trends data:", error);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const TIMEFRAME_TABS = [
    { label: "3d",    value: 2  },
    { label: "Week",  value: 7  },
    { label: "Month", value: 30 },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Background blobs */}
      <div className="absolute rounded-full opacity-20" style={{ width: "300px", height: "300px", background: "#5C4E8A", filter: "blur(80px)", top: "-50px", left: "-100px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "250px", height: "250px", background: "#DEC8DA", filter: "blur(70px)", top: "200px", right: "-80px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "280px", height: "280px", background: "#9B8EC4", filter: "blur(75px)", bottom: "300px", left: "-50px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "200px", height: "200px", background: "#C4A8C0", filter: "blur(60px)", bottom: "100px", right: "-30px", pointerEvents: "none" }} />

      {/* Header */}
      <div className="relative z-20">
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

      {/* Main content */}
      <div
        className="relative z-10 p-6 pb-20 flex flex-col gap-4"
        style={{ maxWidth: "1024px", margin: "0 auto" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
            />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Loading...</p>
          </div>
        ) : (
          <>
            {/* Health metrics chart */}
            {checkIns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-base" style={{ color: "rgba(255,255,255,0.7)" }}>
                  No data yet. Complete a check-in to see your trends.
                </p>
              </div>
            ) : (
              <div
                className="p-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-medium" style={{ color: "white" }}>
                    Energy · Mood · Pain · Anxiety · Appetite
                  </p>
                  <div className="flex gap-2">
                    {TIMEFRAME_TABS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTimeframe(t.value)}
                        className="text-xs px-3 py-1 rounded-full transition-all duration-200"
                        style={{
                          background: timeframe === t.value ? "#7C6BAE" : "rgba(255,255,255,0.15)",
                          color: "white",
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
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.7)" }} />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 3, 5]}
                      width={32}
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.7)" }}
                      tickFormatter={(v) => ({ 1: "Bad", 3: "Mid", 5: "Good" })[v] ?? ""}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const r = Math.round(value);
                        const labels = { 1: "Very Low", 2: "Low", 3: "Mid", 4: "High", 5: "Very High" };
                        return [labels[r] ?? value, name.charAt(0).toUpperCase() + name.slice(1)];
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
                    <span key={key} className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <span style={{ display: "inline-block", width: 16, height: 2, background: color, borderRadius: 1 }} />
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Medication adherence section */}
            {medications.some((m) => m.active) && (() => {
              const { medAdherence, dailyAdherence } = getAdherenceView();
              const barHeight         = Math.max(120, medAdherence.length * 44);

              return (
                <>
                  <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Medication Adherence
                  </p>

                  {medAdherence.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                      No medication data for this period
                    </p>
                  ) : (
                    <>
                      {/* Chart 1 — per-medication horizontal bars */}
                      <div
                        className="p-4 rounded-2xl"
                        style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
                      >
                        <p className="text-sm font-medium mb-4" style={{ color: "white" }}>
                          Adherence by medication
                        </p>
                        <ResponsiveContainer width="100%" height={barHeight}>
                          <BarChart
                            layout="vertical"
                            data={medAdherence}
                            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                          >
                            <XAxis
                              type="number"
                              domain={[0, 100]}
                              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.7)" }}
                              tickFormatter={(v) => `${v}%`}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={110}
                              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.7)" }}
                            />
                            <Tooltip
                              formatter={(value, _name, props) => {
                                const { taken, scheduled } = props.payload;
                                return [`${taken} of ${scheduled} doses taken (${value}%)`, "Adherence"];
                              }}
                            />
                            <Bar dataKey="adherence" fill="#7C6BAE" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Chart 2 — daily adherence trend (only meaningful with 2+ days) */}
                      {dailyAdherence.length > 1 && (
                        <div
                          className="p-4 rounded-2xl"
                          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
                        >
                          <p className="text-sm font-medium mb-4" style={{ color: "white" }}>
                            Daily adherence trend
                          </p>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart
                              data={dailyAdherence}
                              margin={{ top: 5, right: 32, left: 0, bottom: 0 }}
                            >
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.7)" }} />
                              <YAxis
                                domain={[0, 100]}
                                width={36}
                                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.7)" }}
                                tickFormatter={(v) => `${v}%`}
                              />
                              <Tooltip
                                formatter={(value, _name, props) => {
                                  const { taken, scheduled } = props.payload;
                                  return [`${value}% adherence (${taken} of ${scheduled} doses)`, ""];
                                }}
                              />
                              <ReferenceLine
                                y={75}
                                stroke="#C4A882"
                                strokeDasharray="3 3"
                                label={{ value: "75%", position: "right", fontSize: 8, fill: "#C4A882" }}
                              />
                              <ReferenceLine
                                y={90}
                                stroke="#7FAF8A"
                                strokeDasharray="3 3"
                                label={{ value: "90%", position: "right", fontSize: 8, fill: "#7FAF8A" }}
                              />
                              <Line
                                type="monotone"
                                dataKey="percentage"
                                stroke="#8FAF9B"
                                strokeWidth={2}
                                dot={{ r: 3, fill: "#8FAF9B", strokeWidth: 0 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      <Navigation />
    </div>
  );
}

export default TrendsPage;
