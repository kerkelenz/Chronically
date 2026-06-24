import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  Modal,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import CircularDial from "../../components/CircularDial";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import { openCheckIn } from "../../lib/checkinNav";
import { METRICS, METRIC_LABELS, SYMPTOM_LIST } from "../../theme/metrics";
import { SymptomIcon } from "../../components/SymptomIcon";
import MilestoneCelebration from "../../components/MilestoneCelebration";
import { MILESTONES, totalCheckInDays } from "../../lib/milestones";

const BAR_HEIGHTS = [12, 16, 20, 24, 28];
const BAR_COLORS = {
  painLevel: "rgba(255,255,255,0.95)",
  moodLevel: "#D87AB0",
  energyLevel: "#4FB882",
  anxietyLevel: "#6E9DE0",
  appetiteLevel: "#DDA53F",
};

function CheckInRow({ checkIn, onEdit, onDelete, isLatest }) {
  const symptoms = Array.isArray(checkIn.symptoms) ? checkIn.symptoms : [];
  const time = new Date(checkIn.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTime}>{time}</Text>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.rowBtn}
            onPress={() => onEdit(checkIn)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={13} color="white" />
          </TouchableOpacity>
          {isLatest && (
            <TouchableOpacity
              style={[styles.rowBtn, styles.rowBtnDelete]}
              onPress={() => onDelete(checkIn.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={13} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.metricList}>
        {METRICS.map(({ key, label }) => {
          const val = checkIn[key];
          if (val == null) return null;
          return (
            <View key={key} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{label}</Text>
              <View style={styles.barGroup}>
                {BAR_HEIGHTS.map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor:
                          i < val ? BAR_COLORS[key] : "rgba(255,255,255,0.16)",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {symptoms.length > 0 && (
        <View style={styles.symptomIconRow}>
          {symptoms.map((s) => (
            <SymptomIcon key={s} symptom={s} size={24} color="white" />
          ))}
        </View>
      )}
    </View>
  );
}

function formatApptLabel(dateStr) {
  const appt = new Date(dateStr);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const apptDay = new Date(appt);
  apptDay.setHours(0, 0, 0, 0);
  if (apptDay.getTime() === todayStart.getTime()) return "Today";
  if (apptDay.getTime() === tomorrowStart.getTime()) return "Tomorrow";
  return appt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [checkIns, setCheckIns] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const isFirstLoadRef = useRef(true);
  const seededRef = useRef(false);

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

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!user || loading) return;
    const total = totalCheckInDays(checkIns);
    const achieved = MILESTONES.filter((m) => total >= m);
    const current = user.celebratedMilestones || [];
    const newly = achieved.filter((m) => !current.includes(m));
    if (newly.length === 0) {
      seededRef.current = true;
      return;
    }
    const merged = [...current, ...newly];
    const wasSeeded = seededRef.current;
    seededRef.current = true;
    api
      .put("/api/users/milestones", { celebratedMilestones: merged })
      .then(() => updateUser({ ...user, celebratedMilestones: merged }))
      .then(() => {
        if (wasSeeded) setCelebration(Math.max(...newly));
      })
      .catch(() => {});
  }, [checkIns, user, loading]);

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

  const handleDeleteCheckIn = (id) => {
    Alert.alert("Delete check-in?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/checkins/${id}`);
            setCheckIns((prev) => prev.filter((c) => c.id !== id));
          } catch (e) {
            console.error("Delete check-in failed:", e);
          }
        },
      },
    ]);
  };

  const handleUpdateCheckIn = async () => {
    if (!editingCheckIn) return;
    try {
      const res = await api.put(`/api/checkins/${editingCheckIn.id}`, {
        painLevel: editingCheckIn.painLevel,
        moodLevel: editingCheckIn.moodLevel,
        energyLevel: editingCheckIn.energyLevel,
        anxietyLevel: editingCheckIn.anxietyLevel,
        appetiteLevel: editingCheckIn.appetiteLevel,
        symptoms:
          editingCheckIn.symptoms?.length > 0 ? editingCheckIn.symptoms : null,
      });
      setCheckIns((prev) =>
        prev.map((c) => (c.id === editingCheckIn.id ? res.data.checkIn : c)),
      );
      setEditingCheckIn(null);
    } catch (e) {
      console.error("Update check-in failed:", e);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
  const todaysDone = checkIns[0]
    ? new Date(checkIns[0].createdAt).getTime() > fourHoursAgo
    : false;

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12
      ? "Good morning,"
      : hour < 17
        ? "Good afternoon,"
        : "Good evening,";

  const nextCheckIn =
    todaysDone && checkIns[0]
      ? new Date(
          new Date(checkIns[0].createdAt).getTime() + 4 * 60 * 60 * 1000,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  // Use noon to avoid timezone-edge-case shifts
  const recent = checkIns.filter(
    (c) => new Date(c.date + "T12:00:00") >= fourteenDaysAgo,
  );

  // Per-metric 14-day average; for optional metrics, divide only by non-null count
  const averages = {};
  for (const { key } of METRICS) {
    const vals = recent.map((c) => c[key]).filter((v) => v != null);
    averages[key] =
      vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentCheckIns = checkIns.filter(
    (c) => new Date(c.createdAt) >= cutoff,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingAppts = appointments
    .filter(
      (a) =>
        a.status === "upcoming" &&
        new Date(a.date) >= todayStart &&
        new Date(a.date) <= sevenDaysFromNow,
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const uniqueSymptomDays = [
    ...new Set(
      recent
        .filter((c) => c.symptoms && c.symptoms.length > 0)
        .map((c) => c.date),
    ),
  ].length;
  const symptomDayCounts = {};
  recent
    .filter((c) => c.symptoms && c.symptoms.length > 0)
    .forEach((c) => {
      c.symptoms.forEach((s) => {
        if (!symptomDayCounts[s]) symptomDayCounts[s] = new Set();
        symptomDayCounts[s].add(c.date);
      });
    });
  const topSymptoms = Object.entries(symptomDayCounts)
    .map(([s, dates]) => ({ s, n: dates.size }))
    .filter(({ n }) => n >= uniqueSymptomDays * 0.3)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  // ── Loading state (first launch only) ────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground edges={["top", "left", "right"]}>
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
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Avatar user={user} size={36} />
          <View style={styles.greetingCol}>
            <Text style={styles.greeting}>
              {timeGreeting} {user?.username || "there"}
            </Text>
            <Text style={styles.greetingSubtext}>
              {todaysDone && nextCheckIn
                ? `Next check-in at ${nextCheckIn}`
                : "Ready to check in?"}
            </Text>
          </View>
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

        {/* Check-in prompt */}
        {!error && (checkIns.length === 0 || !todaysDone) && (
          <View style={styles.checkInPrompt}>
            <Text style={styles.checkInPromptTitle}>
              How are you feeling right now?
            </Text>
            <Text style={styles.checkInPromptSub}>It only takes a moment.</Text>
            <TouchableOpacity
              style={styles.checkInPromptBtn}
              onPress={openCheckIn}
              activeOpacity={0.85}
            >
              <Text style={styles.checkInPromptBtnText}>Start Check-in</Text>
            </TouchableOpacity>
          </View>
        )}

        {checkIns.length > 0 && (
          <>
            {/* 14-day dials */}
            <View style={styles.dialsSection}>
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

            {/* Common symptoms (last 14 days) */}
            <View style={styles.commonCard}>
              <Text style={styles.commonHeader}>Common symptoms</Text>
              {topSymptoms.length > 0 ? (
                <View style={styles.commonGrid}>
                  {topSymptoms.map(({ s, n }) => (
                    <View key={s} style={styles.commonItem}>
                      <SymptomIcon symptom={s} size={36} color="white" />
                      <Text style={styles.commonName}>{s}</Text>
                      <Text style={styles.commonCount}>{n}d</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.commonEmpty}>
                  No symptoms logged recently
                </Text>
              )}
            </View>

            {/* Upcoming appointments reminder (within 7 days) */}
            {upcomingAppts.length > 0 && (
              <View style={[styles.card, styles.apptReminderCard]}>
                <Text style={styles.apptReminderTitle}>
                  Upcoming appointments
                </Text>
                {upcomingAppts.map((appt) => (
                  <TouchableOpacity
                    key={appt.id}
                    style={styles.apptRow}
                    onPress={() => router.push("/(tabs)/appointments")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.apptIconCircle}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color="white"
                      />
                    </View>
                    <View style={styles.apptRowInfo}>
                      <Text style={styles.apptDoctorText}>
                        {appt.doctorName}
                        {appt.specialty ? ` — ${appt.specialty}` : ""}
                      </Text>
                      <Text style={styles.apptTimeText}>
                        {formatApptLabel(appt.date)} at{" "}
                        {new Date(appt.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Last 24 hours */}
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>Last 24 hours</Text>
              {recentCheckIns.length === 0 ? (
                <Text style={styles.emptyRecentText}>
                  No check-ins in the last 24 hours
                </Text>
              ) : (
                recentCheckIns.map((c, i) => (
                  <CheckInRow
                    key={c.id}
                    checkIn={c}
                    onEdit={setEditingCheckIn}
                    onDelete={handleDeleteCheckIn}
                    isLatest={i === 0}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!editingCheckIn}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCheckIn(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <ScrollView
              contentContainerStyle={{ gap: 14, padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.editTitle}>Edit Check-in</Text>
              {METRICS.map(({ key, label }) => {
                const name = key.replace("Level", "");
                return (
                  <View key={key}>
                    <Text style={styles.editLabel}>{label} level</Text>
                    <View style={styles.levelRow}>
                      {[5, 4, 3, 2, 1].map((level) => {
                        const selected = editingCheckIn?.[key] === level;
                        return (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.levelBtn,
                              selected && styles.levelBtnSelected,
                            ]}
                            onPress={() =>
                              setEditingCheckIn((prev) => ({
                                ...prev,
                                [key]: level,
                              }))
                            }
                            activeOpacity={0.8}
                          >
                            <Text style={styles.levelBtnText}>
                              {METRIC_LABELS[name][level]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              <View>
                <Text style={styles.editLabel}>Symptoms</Text>
                <View style={styles.symptomChipWrap}>
                  {SYMPTOM_LIST.map((s) => {
                    const active = (editingCheckIn?.symptoms || []).includes(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.symptomChipBtn,
                          active && styles.symptomChipActive,
                        ]}
                        onPress={() =>
                          setEditingCheckIn((prev) => {
                            const cur = prev.symptoms || [];
                            return {
                              ...prev,
                              symptoms: active
                                ? cur.filter((x) => x !== s)
                                : [...cur, s],
                            };
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <Text style={styles.symptomChipText}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={() => setEditingCheckIn(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={handleUpdateCheckIn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.editSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {celebration && (
        <MilestoneCelebration
          milestone={celebration}
          onDismiss={() => setCelebration(null)}
        />
      )}
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
  greetingCol: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
    flexShrink: 1,
  },
  greetingSubtext: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
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
  checkInPrompt: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  checkInPromptTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 23,
    color: "white",
    textAlign: "center",
  },
  checkInPromptSub: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  checkInPromptBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  checkInPromptBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },
  cardTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  dialsSection: {
    marginBottom: 12,
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
  emptyRecentText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
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
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  rowTime: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  rowActions: { flexDirection: "row", gap: 8 },
  rowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBtnDelete: { backgroundColor: "rgba(225,90,90,0.45)" },
  metricList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 6,
    rowGap: 10,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "47%",
  },
  metricLabel: {
    width: 52,
    fontSize: 11,
    fontFamily: "Lato_400Regular",
    color: "rgba(255,255,255,0.82)",
  },
  barGroup: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 8, borderRadius: 1.5 },
  symptomIconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  commonCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: 20,
  },
  commonHeader: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 12,
  },
  commonGrid: { flexDirection: "row", justifyContent: "space-around" },
  commonItem: { flex: 1, alignItems: "center", gap: 2 },
  commonName: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 14,
  },
  commonCount: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  commonEmpty: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  editModalCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "88%",
    backgroundColor: "rgba(90,75,130,0.97)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  editTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
    color: "white",
  },
  editLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  levelRow: { flexDirection: "row", gap: 6 },
  levelBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelBtnSelected: { backgroundColor: "#7C6BAE" },
  levelBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    lineHeight: 12,
    color: "white",
    textAlign: "center",
  },
  symptomChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symptomChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  symptomChipActive: { backgroundColor: "#7C6BAE" },
  symptomChipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "white",
  },
  editActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  editCancelText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
  },
  editSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#7C6BAE",
    alignItems: "center",
  },
  editSaveText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "white" },
});
