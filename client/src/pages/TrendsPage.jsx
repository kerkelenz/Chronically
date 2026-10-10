import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import FlaresModal from "../components/FlaresModal";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { curveCatmullRom } from "d3-shape";
import Navigation from "../components/Navigation";
import PageHeader from "../components/PageHeader";
import { adherenceStats, describeChange } from "../utils/medicationHelpers";
import ChronicleMark from "../components/ChronicleMark";
import TrendsMetricsChart from "../components/TrendsMetricsChart";
import { formatFlareRange, localToday } from "../utils/flareHelpers";
import {
  TREND_RANGES, DEFAULT_RANGE_DAYS, COMPARE_METRICS, rangeWindow, dayIndex, buildAnnotations, formatComparison,
  comparisonTitle, comparisonFootnote, emptyRangeText, COMPARISON_CAPTION, COMPARISON_NONE,
} from "../utils/trendHelpers";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monDay = (ymd) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;

function TrendsPage() {
  const { token } = useAuth();
  const hdrs = { Authorization: `Bearer ${token}` };
  const api = (path) => axios.get(`${import.meta.env.VITE_API_URL}${path}`, { headers: hdrs });

  // "Your flares" lists every flare, whatever the range; the chart's bands
  // come from a ranged fetch below.
  const [flares, setFlares] = useState([]);
  const [showFlares, setShowFlares] = useState(false);
  const [medications, setMedications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  // everything that belongs to one window, replaced together so the chart
  // never mixes one range's rows with another's annotations
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const [insights, setInsights] = useState(null);
  const requestId = useRef(0);

  const fetchFlares = async () => {
    try {
      const res = await api("/api/flares");
      setFlares(res.data.flares || []);
    } catch (err) {
      console.error("Failed to fetch flares:", err);
    }
  };

  useEffect(() => {
    if (token) fetchFlares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Insights are fetched independently and silent-fail: on error the section
  // simply doesn't render.
  useEffect(() => {
    if (!token) return;
    api("/api/insights")
      .then((res) => setInsights(res.data))
      .catch(() => setInsights(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // once per page load: what the adherence and appointment markers read
  useEffect(() => {
    if (!token) return;
    api("/api/medications").then((r) => setMedications(r.data.medications || [])).catch(() => {});
    api("/api/appointments").then((r) => setAppointments(r.data.appointments || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Every range change: one window drives every fetch. A response that comes
  // back after a newer request is dropped, so 7 → 365 → 7 ends on 7. If the
  // summary fails the last view stays; the annotation fetches fail silently.
  useEffect(() => {
    if (!token) return;
    const id = ++requestId.current;
    const win = rangeWindow(localToday(), rangeDays);
    const q = `startDate=${win.startDate}&endDate=${win.endDate}`;
    Promise.all([
      api(`/api/trends/summary?${q}`).then((r) => r.data).catch(() => null),
      api(`/api/flares?${q}`).then((r) => r.data.flares || []).catch(() => []),
      api(`/api/medications/changes?${q}`).then((r) => r.data.changes || []).catch(() => []),
      api(`/api/medications/logs?${q}`).then((r) => r.data.logs || []).catch(() => null),
    ]).then(([summary, rangeFlares, changes, logs]) => {
      if (id !== requestId.current) return;
      if (summary) setView({ win, summary, rangeFlares, changes, logs });
      setLoading(false);
      setRefreshing(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rangeDays, reload]);

  const chooseRange = (days) => {
    if (days === rangeDays) return;
    setRefreshing(true);
    setRangeDays(days);
  };

  // Adherence via the shared computed-missed engine math, so the charts, the
  // cabinet dots, and the doctor report can never disagree.
  const getAdherenceView = (win, logs) => {
    const todayStr = localToday();
    const stats = adherenceStats(medications, logs, win.startDate, win.endDate, todayStr);
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

  const win = view?.win;
  const summary = view?.summary;
  const rows = summary
    ? summary.days.map((d) => ({ ...d, x: dayIndex(win.startDate, d.date), label: monDay(d.date) }))
    : [];
  const annotations = view
    ? buildAnnotations({
      window: win,
      flares: view.rangeFlares,
      changes: view.changes,
      appointments,
      describeChange,
      formatFlareRange,
      todayYmd: localToday(),
    })
    : { bands: [], markers: [] };
  const comparable = summary
    ? COMPARE_METRICS.filter((k) => summary.comparison[k]?.comparable)
    : [];
  const notComparable = summary
    ? COMPARE_METRICS.filter((k) => !summary.comparison[k]?.comparable)
    : [];

  const card = { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" };

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
        <PageHeader
          title="Trends"
          actions={
            <>
              <button
                onClick={() => setShowFlares(true)}
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                Your flares
              </button>
            </>
          }
        />
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
            {/* Insights */}
            {insights && (
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Insights
                </p>
                {insights.cards.length > 0 ? (
                  insights.cards.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl" style={card}>
                      <p className="font-bold text-white" style={{ fontSize: "15px" }}>{c.headline}</p>
                      <p className="mt-1" style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{c.body}</p>
                      <p className="mt-1.5" style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{c.evidence}</p>
                    </div>
                  ))
                ) : (
                  /* Chronicle keeps the empty state company. He appears only
                     here — once there are real cards, they speak for themselves. */
                  <div className="p-4 rounded-2xl flex items-center gap-3" style={card}>
                    <ChronicleMark size={36} className="text-white shrink-0" />
                    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{insights.meta.message}</p>
                  </div>
                )}
                {insights.meta.sleepHint && (
                  <p className="text-center" style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                    Answering the sleep question unlocks sleep insights.
                  </p>
                )}
              </div>
            )}

            {/* Health metrics chart */}
            {!summary || !summary.everLogged ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-base" style={{ color: "rgba(255,255,255,0.7)" }}>
                  No data yet. Complete a check-in to see your trends.
                </p>
              </div>
            ) : (
              <div
                className="flex flex-col gap-4 transition-opacity"
                style={{ opacity: refreshing ? 0.55 : 1 }}
                aria-busy={refreshing}
              >
                <div className="p-4 rounded-2xl" style={card}>
                  <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
                    <p className="text-sm font-medium" style={{ color: "white" }}>
                      Energy · Mood · Pain · Anxiety · Appetite · Sleep
                    </p>
                    <div className="flex gap-2" role="group" aria-label="Range">
                      {TREND_RANGES.map((r) => (
                        <button
                          key={r.days}
                          type="button"
                          onClick={() => chooseRange(r.days)}
                          aria-pressed={rangeDays === r.days}
                          className="text-xs px-3 py-1 rounded-full transition-all duration-200"
                          style={{
                            background: rangeDays === r.days ? "#7C6BAE" : "rgba(255,255,255,0.15)",
                            color: "white",
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-sm text-center py-12" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {emptyRangeText(win.days)}
                    </p>
                  ) : (
                    <TrendsMetricsChart rows={rows} win={win} annotations={annotations} />
                  )}
                </div>

                {/* Period comparison — numbers and day counts only */}
                {rows.length > 0 && (
                  <div className="p-4 rounded-2xl" style={card}>
                    <p className="text-sm font-medium text-white">{comparisonTitle(win.days)}</p>
                    <p className="text-xs mt-1 mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>{COMPARISON_CAPTION}</p>
                    {comparable.length === 0 ? (
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{COMPARISON_NONE}</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {comparable.map((k) => (
                          <li key={k} className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                            {formatComparison(k.charAt(0).toUpperCase() + k.slice(1), summary.comparison[k], win.days)}
                          </li>
                        ))}
                        {notComparable.length > 0 && (
                          <li className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {comparisonFootnote(notComparable)}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Medication adherence section — follows the range, no markers */}
            {view && view.logs && medications.some((m) => m.active) && (() => {
              const { medAdherence, dailyAdherence } = getAdherenceView(view.win, view.logs);
              const barHeight         = Math.max(120, medAdherence.length * 44);

              return (
                <div className="flex flex-col gap-4 transition-opacity" style={{ opacity: refreshing ? 0.55 : 1 }}>
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
                      <div className="p-4 rounded-2xl" style={card}>
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
                                return [`${taken} of ${scheduled} ${scheduled === 1 ? "dose" : "doses"} taken (${value}%)`, "Adherence"];
                              }}
                            />
                            <Bar dataKey="adherence" fill="#7C6BAE" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Chart 2 — daily adherence trend (only meaningful with 2+ days) */}
                      {dailyAdherence.length > 1 && (
                        <div className="p-4 rounded-2xl" style={card}>
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
                                  return [`${value}% adherence (${taken} of ${scheduled} ${scheduled === 1 ? "dose" : "doses"})`, ""];
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
                                stroke="#A9D8B4"
                                strokeDasharray="3 3"
                                label={{ value: "90%", position: "right", fontSize: 8, fill: "#A9D8B4" }}
                              />
                              <Line
                                type={curveCatmullRom.alpha(0.5)}
                                dataKey="percentage"
                                stroke="#8FAF9B"
                                strokeWidth={2}
                                // a year of dots is a smear; past a month the line speaks alone
                                dot={dailyAdherence.length > 31 ? false : { r: 3, fill: "#8FAF9B", strokeWidth: 0 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      <Navigation />

      {showFlares && (
        <FlaresModal
          open
          mode="list"
          flares={flares}
          token={token}
          onClose={() => setShowFlares(false)}
          onChanged={() => { fetchFlares(); setReload((n) => n + 1); }}
        />
      )}
    </div>
  );
}

export default TrendsPage;
