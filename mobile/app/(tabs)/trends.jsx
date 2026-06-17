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

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEFRAME_TABS = [
  { label: "3d",    value: 2  },
  { label: "Week",  value: 7  },
  { label: "Month", value: 30 },
];

// ── Data computations (mirror web exactly) ────────────────────────────────────

function getChartData(checkIns, timeframe) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeframe);
  const cutoffStr = cutoff.toLocaleDateString("en-CA");

  const byDate = {};
  checkIns
    .filter((c) => c.date >= cutoffStr)
    .forEach((c) => {
      if (!byDate[c.date])
        byDate[c.date] = {
          pains: [],
          moods: [],
          energies: [],
          anxieties: [],
          appetites: [],
        };
      byDate[c.date].pains.push(c.painLevel);
      byDate[c.date].moods.push(c.moodLevel);
      if (c.energyLevel)   byDate[c.date].energies.push(c.energyLevel);
      if (c.anxietyLevel)  byDate[c.date].anxieties.push(c.anxietyLevel);
      if (c.appetiteLevel) byDate[c.date].appetites.push(c.appetiteLevel);
    });

  const avg = (arr) =>
    parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1));

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      pain:     avg(d.pains),
      mood:     avg(d.moods),
      energy:   d.energies.length   ? avg(d.energies)   : null,
      anxiety:  d.anxieties.length  ? avg(d.anxieties)  : null,
      appetite: d.appetites.length  ? avg(d.appetites)  : null,
    }));
}

function getPeriodLogs(medLogs, timeframe) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeframe);
  const cutoffStr = cutoff.toLocaleDateString("en-CA");
  return medLogs.filter((l) => l.date >= cutoffStr);
}

function getMedicationAdherence(periodLogs, medications) {
  return medications
    .filter((m) => m.active)
    .map((med) => {
      const logs = periodLogs.filter((l) => l.medicationId === med.id);
      const taken = logs.filter((l) => l.status === "taken").length;
      const scheduled = logs.length;
      const percentage = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 0;
      return { name: med.name, adherence: percentage, taken, scheduled };
    })
    .filter((m) => m.scheduled > 0);
}

function getDailyAdherenceData(periodLogs) {
  const byDate = {};
  periodLogs.forEach((log) => {
    if (!byDate[log.date]) byDate[log.date] = { taken: 0, total: 0 };
    byDate[log.date].total++;
    if (log.status === "taken") byDate[log.date].taken++;
  });
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { taken, total }]) => ({
      date,
      percentage: Math.round((taken / total) * 100),
      taken,
      scheduled: total,
    }));
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const { width } = useWindowDimensions();
  const [checkIns, setCheckIns] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medLogs, setMedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState(2);
  const isFirstLoadRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const startDate = thirtyDaysAgo.toLocaleDateString("en-CA");
          const endDate = new Date().toLocaleDateString("en-CA");

          const [checkInsRes, medsRes, logsRes] = await Promise.all([
            api.get("/api/checkins"),
            api.get("/api/medications"),
            api.get(`/api/medications/logs?startDate=${startDate}&endDate=${endDate}`),
          ]);
          if (!active) return;
          setCheckIns(checkInsRes.data.checkIns || []);
          setMedications(medsRes.data.medications || []);
          setMedLogs(logsRes.data.logs || []);
          setError(null);
          isFirstLoadRef.current = false;
        } catch {
          if (!active) return;
          setError("Could not load your data. Pull down to try again.");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => { active = false; };
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toLocaleDateString("en-CA");
      const endDate = new Date().toLocaleDateString("en-CA");

      const [checkInsRes, medsRes, logsRes] = await Promise.all([
        api.get("/api/checkins"),
        api.get("/api/medications"),
        api.get(`/api/medications/logs?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setCheckIns(checkInsRes.data.checkIns || []);
      setMedications(medsRes.data.medications || []);
      setMedLogs(logsRes.data.logs || []);
      setError(null);
    } catch {
      setError("Could not load your data. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  // screenPad × 2 + cardPad × 2 = 40 + 32 = 72
  const chartWidth = width - 72;
  const chartData = getChartData(checkIns, timeframe);
  const hasActiveMeds = medications.some((m) => m.active);

  const periodLogs = getPeriodLogs(medLogs, timeframe);
  const medAdherence = getMedicationAdherence(periodLogs, medications);
  const dailyAdherence = getDailyAdherenceData(periodLogs);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground>
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
    <ScreenBackground>
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
        {/* Page header + timeframe pills (shared by all charts) */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Trends</Text>
          <View style={styles.timeframePills}>
            {TIMEFRAME_TABS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.pill,
                  timeframe === t.value && styles.pillActive,
                ]}
                onPress={() => setTimeframe(t.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.pillText,
                    timeframe === t.value && styles.pillTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Health metrics chart ─────────────────────────────────────────── */}
        {checkIns.length === 0 && !error ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              No data yet. Complete a check-in to see your trends.
            </Text>
          </View>
        ) : checkIns.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>
              Energy · Mood · Pain · Anxiety · Appetite
            </Text>
            <MetricsLineChart data={chartData} width={chartWidth} />
          </View>
        ) : null}

        {/* ── Medication adherence section ─────────────────────────────────── */}
        {!error && hasActiveMeds && (
          <>
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
          </>
        )}
      </ScrollView>
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
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: "white",
  },
  timeframePills: {
    flexDirection: "row",
    gap: 4,
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
});
