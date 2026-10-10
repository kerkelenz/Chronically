import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import ScreenBackground from "../../components/ScreenBackground";
import MetricsLineChart from "../../components/MetricsLineChart";
import AdherenceBars from "../../components/AdherenceBars";
import AdherenceLineChart from "../../components/AdherenceLineChart";
import api from "../../lib/api";
import FlaresSheet from "../../components/FlaresSheet";
import { adherenceStats, describeChange } from "../../theme/medications";
import { formatFlareRange, localToday } from "../../theme/flareHelpers";
import {
  TREND_RANGES, DEFAULT_RANGE_DAYS, COMPARE_METRICS, rangeWindow, buildAnnotations,
  dayIndex, formatComparison, comparisonTitle, comparisonFootnote, emptyRangeText,
  COMPARISON_CAPTION, COMPARISON_NONE,
} from "../../theme/trendHelpers";
import ChronicleMark from "../../components/ChronicleMark";
// Adherence via the shared computed-missed engine math, so the charts, the
// cabinet dots, and the doctor report can never disagree. Follows the range.
function getAdherenceView(medications, medLogs, win) {
  const todayStr = localToday();
  const stats = adherenceStats(medications, medLogs, win.startDate, win.endDate, todayStr);
  const medAdherence = stats.perMed
    .filter((m) => m.expected > 0)
    .map((m) => ({ name: m.name, adherence: m.pct, taken: m.taken, scheduled: m.expected }));
  const dailyAdherence = stats.perDay
    .filter((d) => d.expected > 0)
    .map((d) => ({
      date: d.date,
      percentage: Math.round((d.taken / d.expected) * 100),
      taken: d.taken,
      scheduled: d.expected,
    }));
  return { medAdherence, dailyAdherence };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const { width } = useWindowDimensions();
  // "Your flares" lists every flare, whatever the range; the chart's bands come
  // from the ranged fetch in load().
  const [flares, setFlares] = useState([]);
  const [showFlares, setShowFlares] = useState(false);
  const [medications, setMedications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  // everything that belongs to one window, replaced together so the chart
  // never mixes one range's rows with another's annotations
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const requestId = useRef(0);
  const rangeRef = useRef(DEFAULT_RANGE_DAYS);
  const hasViewRef = useRef(false);

  async function fetchFlares() {
    try {
      const r = await api.get("/api/flares");
      setFlares(r.data.flares || []);
    } catch {
      // a bonus list; never turn the screen into an error state over it
    }
  }

  /**
   * The one loader — focus, pull-to-refresh and every range change. One window
   * drives every ranged fetch; a response that lands after a newer request is
   * dropped, so 7 → 365 → 7 ends on 7. A failed summary keeps the last view;
   * the annotation fetches fail silently.
   */
  async function load(days, { withStatic = false } = {}) {
    const id = ++requestId.current;
    const win = rangeWindow(localToday(), days);
    const q = `startDate=${win.startDate}&endDate=${win.endDate}`;
    if (withStatic) {
      // Insights fetch is independent + silent-fail: on error the section hides
      api.get("/api/insights").then((r) => setInsights(r.data)).catch(() => setInsights(null));
      api.get("/api/medications").then((r) => setMedications(r.data.medications || [])).catch(() => {});
      api.get("/api/appointments").then((r) => setAppointments(r.data.appointments || [])).catch(() => {});
    }
    const [summary, rangeFlares, changes, logs] = await Promise.all([
      api.get(`/api/trends/summary?${q}`).then((r) => r.data).catch(() => null),
      api.get(`/api/flares?${q}`).then((r) => r.data.flares || []).catch(() => []),
      api.get(`/api/medications/changes?${q}`).then((r) => r.data.changes || []).catch(() => []),
      api.get(`/api/medications/logs?${q}`).then((r) => r.data.logs || []).catch(() => null),
    ]);
    if (id !== requestId.current) return;
    if (summary) {
      hasViewRef.current = true;
      setView({ win, summary, rangeFlares, changes, logs });
      setError(null);
    } else if (!hasViewRef.current) {
      // only when there is nothing to show; a failed switch keeps the last view
      setError("Could not load your data. Pull down to try again.");
    }
    setLoading(false);
    setSwitching(false);
  }

  useFocusEffect(
    useCallback(() => {
      load(rangeRef.current, { withStatic: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(rangeRef.current, { withStatic: true });
    setRefreshing(false);
  }

  const chooseRange = (days) => {
    if (days === rangeDays) return;
    rangeRef.current = days;
    setRangeDays(days);
    setSwitching(true);
    load(days);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // screenPad × 2 + cardPad × 2 = 40 + 32 = 72
  const chartWidth = width - 72;
  const hasActiveMeds = medications.some((m) => m.active);
  const win = view?.win;
  const summary = view?.summary;
  const rows = summary ? summary.days.map((d) => ({ ...d, x: dayIndex(win.startDate, d.date) })) : [];
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
  const comparable = summary ? COMPARE_METRICS.filter((k) => summary.comparison[k]?.comparable) : [];
  const notComparable = summary ? COMPARE_METRICS.filter((k) => !summary.comparison[k]?.comparable) : [];
  const adherence = view && view.logs ? getAdherenceView(medications, view.logs, win) : null;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground edges={["top", "left", "right"]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={styles.loadingText}>Loading your trends…</Text>
          <Text style={styles.loadingHint}>
            The server may take a moment to wake up.
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <ScreenBackground edges={["top", "left", "right"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.8)"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Page header + range pills (shared by all charts) */}
        <View style={styles.pageHeader}>
          <View style={styles.pageTitleRow}>
            <Text style={styles.pageTitle}>Trends</Text>
            <TouchableOpacity
              onPress={() => { fetchFlares(); setShowFlares(true); }}
              style={styles.flareLinkBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Your flares"
            >
              <Text style={styles.flareLinkText}>Your flares</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.timeframePills}>
          {TREND_RANGES.map((r) => {
            const selected = rangeDays === r.days;
            return (
              <TouchableOpacity
                key={r.days}
                style={[styles.pill, selected && styles.pillActive]}
                onPress={() => chooseRange(r.days)}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={r.label}
              >
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Insights ─────────────────────────────────────────────────────── */}
        {insights && (
          <View style={styles.insightsSection}>
            <Text style={styles.adherenceHeader}>Insights</Text>
            {insights.cards.length > 0 ? (
              insights.cards.map((card) => (
                <View key={card.id} style={styles.card}>
                  <Text style={styles.insightHeadline}>{card.headline}</Text>
                  <Text style={styles.insightBody}>{card.body}</Text>
                  <Text style={styles.insightEvidence}>{card.evidence}</Text>
                </View>
              ))
            ) : (
              /* Chronicle keeps the empty state company. He appears only here —
                 once there are real cards, they speak for themselves. */
              <View style={[styles.card, styles.insightEmptyRow]}>
                <ChronicleMark size={36} />
                <Text style={[styles.insightBody, styles.insightEmptyText]}>
                  {insights.meta.message}
                </Text>
              </View>
            )}
            {insights.meta.sleepHint && (
              <Text style={styles.insightHint}>
                Answering the sleep question unlocks sleep insights.
              </Text>
            )}
          </View>
        )}

        {/* ── Health metrics chart ─────────────────────────────────────────── */}
        {summary && !summary.everLogged ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              No data yet. Complete a check-in to see your trends.
            </Text>
          </View>
        ) : summary ? (
          <View style={{ opacity: switching ? 0.55 : 1 }}>
            <View style={styles.card}>
              <Text style={styles.cardSubtitle}>
                Energy · Mood · Pain · Anxiety · Appetite · Sleep
              </Text>
              {rows.length === 0 ? (
                <Text style={styles.emptyText}>{emptyRangeText(win.days)}</Text>
              ) : (
                <MetricsLineChart
                  data={rows}
                  width={chartWidth}
                  win={win}
                  bands={annotations.bands}
                  markers={annotations.markers}
                />
              )}
            </View>

            {/* ── Period comparison — numbers and day counts only ─────────── */}
            {rows.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.compareTitle}>{comparisonTitle(win.days)}</Text>
                <Text style={styles.compareCaption}>{COMPARISON_CAPTION}</Text>
                {comparable.length === 0 ? (
                  <Text style={styles.compareRow}>{COMPARISON_NONE}</Text>
                ) : (
                  <>
                    {comparable.map((k) => (
                      <Text key={k} style={styles.compareRow}>
                        {formatComparison(k.charAt(0).toUpperCase() + k.slice(1), summary.comparison[k], win.days)}
                      </Text>
                    ))}
                    {notComparable.length > 0 ? (
                      <Text style={styles.compareFoot}>{comparisonFootnote(notComparable)}</Text>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Medication adherence section — follows the range, no markers ── */}
        {adherence && hasActiveMeds && (() => {
          const { medAdherence, dailyAdherence } = adherence;
          return (
          <View style={{ opacity: switching ? 0.55 : 1 }}>
            <Text style={styles.adherenceHeader}>Medication Adherence</Text>

            {medAdherence.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>
                  No medication data for this period.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Adherence by medication</Text>
                  <AdherenceBars data={medAdherence} />
                </View>

                {dailyAdherence.length > 1 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Daily adherence trend</Text>
                    <AdherenceLineChart
                      data={dailyAdherence}
                      width={chartWidth}
                    />
                  </View>
                )}
              </>
            )}
          </View>
          );
        })()}
      </ScrollView>

      {showFlares ? (
        <FlaresSheet
          visible
          mode="list"
          flares={flares}
          onClose={() => setShowFlares(false)}
          onChanged={() => { fetchFlares(); load(rangeRef.current); }}
        />
      ) : null}
    </ScreenBackground>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontFamily: "Lato_400Regular",
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
  },
  loadingHint: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pageTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
  },
  pageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flareLinkBtn: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  flareLinkText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  timeframePills: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pillActive: {
    backgroundColor: "#7C6BAE",
    borderColor: "#7C6BAE",
  },
  pillText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  pillTextActive: {
    color: "white",
  },
  insightEmptyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  insightEmptyText: { flex: 1 },
  card: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    padding: 16,
    marginBottom: 12,
  },
  errorCard: {
    backgroundColor: "rgba(176,112,136,0.2)",
    borderColor: "rgba(176,112,136,0.35)",
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  retryText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },
  emptyText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 21,
    textAlign: "center",
    paddingVertical: 8,
  },
  cardSubtitle: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  adherenceHeader: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 10,
  },
  insightsSection: {
    marginBottom: 4,
  },
  insightHeadline: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },
  insightBody: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    marginTop: 4,
  },
  insightEvidence: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },
  compareTitle: { fontFamily: "Lato_700Bold", fontSize: 14, color: "white" },
  compareCaption: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
    marginBottom: 10,
  },
  compareRow: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    marginBottom: 6,
  },
  compareFoot: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  insightHint: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 12,
  },
});
