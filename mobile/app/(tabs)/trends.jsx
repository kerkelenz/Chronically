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
import api from "../../lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEFRAME_TABS = [
  { label: "3d",    value: 2  },
  { label: "Week",  value: 7  },
  { label: "Month", value: 30 },
];

// ── Data computation (mirrors web exactly) ────────────────────────────────────

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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const { width } = useWindowDimensions();
  const [checkIns, setCheckIns] = useState([]);
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
          const res = await api.get("/api/checkins");
          if (!active) return;
          setCheckIns(res.data.checkIns || []);
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
      const res = await api.get("/api/checkins");
      setCheckIns(res.data.checkIns || []);
      setError(null);
    } catch {
      setError("Could not load your data. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // screenPad × 2 + cardPad × 2 = 40 + 32 = 72
  const chartWidth = width - 72;
  const chartData = getChartData(checkIns, timeframe);

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
        <Text style={styles.pageTitle}>Trends</Text>

        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {checkIns.length === 0 && !error ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              No data yet. Complete a check-in to see your trends.
            </Text>
          </View>
        ) : checkIns.length > 0 ? (
          <View style={styles.card}>
            {/* Card header: subtitle + timeframe pills */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                Energy · Mood · Pain · Anxiety · Appetite
              </Text>
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

            <MetricsLineChart data={chartData} width={chartWidth} />
          </View>
        ) : null}
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
  pageTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: "white",
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  cardSubtitle: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    flex: 1,
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
});
