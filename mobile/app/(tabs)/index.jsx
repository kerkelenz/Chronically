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
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import CircularDial from "../../components/CircularDial";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import { METRICS, METRIC_LABELS } from "../../theme/metrics";

function formatDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}`;
}

function CheckInRow({ checkIn }) {
  const symptoms = Array.isArray(checkIn.symptoms) ? checkIn.symptoms : [];
  return (
    <View style={styles.row}>
      <Text style={styles.rowDate}>{formatDate(checkIn.date)}</Text>
      <View style={styles.chips}>
        {METRICS.map(({ key, label }) => {
          const val = checkIn[key];
          if (val == null) return null;
          const name = key.replace("Level", "");
          return (
            <View key={key} style={styles.chip}>
              <Text style={styles.chipText}>
                {label} · {METRIC_LABELS[name][val]}
              </Text>
            </View>
          );
        })}
        {symptoms.length > 0 && (
          <View style={[styles.chip, styles.symptomChip]}>
            <Text style={styles.chipText}>
              {symptoms.length} symptom{symptoms.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function formatApptLabel(dateStr) {
  const appt = new Date(dateStr);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const apptDay = new Date(appt); apptDay.setHours(0, 0, 0, 0);
  if (apptDay.getTime() === todayStart.getTime()) return "Today";
  if (apptDay.getTime() === tomorrowStart.getTime()) return "Tomorrow";
  return appt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [checkIns, setCheckIns] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstLoadRef = useRef(true);

  // 5 dials across, 24px side padding each, 8px between each dial (4 gaps)
  const DIAL_SIZE = Math.max(50, Math.floor((width - 48 - 32) / 5));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const [checkInsRes, apptRes] = await Promise.all([
            api.get("/api/checkins"),
            api.get("/api/appointments"),
          ]);
          if (active) {
            setCheckIns(checkInsRes.data.checkIns || []);
            setAppointments(apptRes.data.appointments || []);
            setError(null);
            isFirstLoadRef.current = false;
          }
        } catch {
          if (active) {
            setError("Could not load your data. Pull down to try again.");
          }
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
      const [checkInsRes, apptRes] = await Promise.all([
        api.get("/api/checkins"),
        api.get("/api/appointments"),
      ]);
      setCheckIns(checkInsRes.data.checkIns || []);
      setAppointments(apptRes.data.appointments || []);
      setError(null);
    } catch {
      setError("Could not load your data. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString("en-CA");
  const todaysDone = checkIns.some((c) => c.date === today);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  // Use noon to avoid timezone-edge-case shifts
  const recent = checkIns.filter(
    (c) => new Date(c.date + "T12:00:00") >= fourteenDaysAgo
  );

  // Per-metric 14-day average; for optional metrics, divide only by non-null count
  const averages = {};
  for (const { key } of METRICS) {
    const vals = recent.map((c) => c[key]).filter((v) => v != null);
    averages[key] =
      vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const recentList = checkIns.slice(0, 10);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingAppts = appointments
    .filter((a) => a.status === "upcoming" && new Date(a.date) >= todayStart && new Date(a.date) <= sevenDaysFromNow)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // ── Loading state (first launch only) ────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={styles.loadingText}>Loading your data…</Text>
          <Text style={styles.loadingHint}>
            The server may take a moment to wake up.
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────

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
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Avatar user={user} size={36} />
          <Text style={styles.greeting}>Hi, {user?.username || "there"} 👋</Text>
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state */}
        {!error && checkIns.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              No check-ins yet — they'll show up here once you start logging.
            </Text>
            <TouchableOpacity
              style={styles.checkInBtn}
              onPress={() => router.push("/checkin")}
              activeOpacity={0.85}
            >
              <Text style={styles.checkInBtnText}>Log today's check-in</Text>
            </TouchableOpacity>
          </View>
        )}

        {checkIns.length > 0 && (
          <>
            {/* Today's status */}
            <View style={styles.card}>
              {todaysDone ? (
                <Text style={styles.statusText}>Today's check-in is logged 💙</Text>
              ) : (
                <>
                  <Text style={styles.statusText}>No check-in yet today</Text>
                  <TouchableOpacity
                    style={styles.checkInBtn}
                    onPress={() => router.push("/checkin")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.checkInBtnText}>Log today's check-in</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* 14-day dials */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Last 14 days</Text>
              <View style={styles.dialsRow}>
                {METRICS.map((m) => (
                  <CircularDial
                    key={m.key}
                    value={averages[m.key]}
                    color={m.color}
                    label={m.label}
                    size={DIAL_SIZE}
                  />
                ))}
              </View>
            </View>

            {/* Upcoming appointments reminder (within 7 days) */}
            {upcomingAppts.length > 0 && (
              <View style={[styles.card, styles.apptReminderCard]}>
                <Text style={styles.apptReminderTitle}>Upcoming appointments</Text>
                {upcomingAppts.map((appt) => (
                  <TouchableOpacity
                    key={appt.id}
                    style={styles.apptRow}
                    onPress={() => router.push("/(tabs)/appointments")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.apptIconCircle}>
                      <Ionicons name="calendar-outline" size={13} color="white" />
                    </View>
                    <View style={styles.apptRowInfo}>
                      <Text style={styles.apptDoctorText}>
                        {appt.doctorName}{appt.specialty ? ` — ${appt.specialty}` : ""}
                      </Text>
                      <Text style={styles.apptTimeText}>
                        {formatApptLabel(appt.date)} at{" "}
                        {new Date(appt.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent check-ins */}
            <Text style={styles.sectionHeading}>Recent</Text>
            {recentList.map((c) => (
              <CheckInRow key={c.id} checkIn={c} />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

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
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  greeting: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
    flexShrink: 1,
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
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 22,
  },
  statusText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 12,
  },
  checkInBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  checkInBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "#7C6BAE",
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  dialsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  // Appointments reminder
  apptReminderCard: {
    borderColor: "rgba(255,255,255,0.3)",
    gap: 8,
  },
  apptReminderTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 10,
  },
  apptIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  apptRowInfo: {
    flex: 1,
    gap: 2,
  },
  apptDoctorText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },
  apptTimeText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },

  sectionHeading: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
    color: "white",
    marginBottom: 10,
    marginTop: 4,
  },
  row: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  rowDate: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
    marginBottom: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  symptomChip: {
    backgroundColor: "rgba(155,175,196,0.2)",
    borderColor: "rgba(155,175,196,0.35)",
  },
  chipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
});