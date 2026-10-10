import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import { PLUM_TINT, SOFT_ERROR } from "../../components/FormSheet";
import FlaresSheet from "../../components/FlaresSheet";
import { flareSinceLabel, flareCardLabel, localToday } from "../../theme/flareHelpers";

// Mirrors NOTE_MAX in server/lib/checkInNote.js, which is the authority.
const NOTE_MAX = 280;
const NOTE_COUNTER_FROM = 240;
import CircularDial from "../../components/CircularDial";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import { openCheckIn } from "../../lib/checkinNav";
import { METRICS, METRIC_LABELS } from "../../theme/metrics";
import { COMMON_SYMPTOMS } from "../../theme/symptomCatalog";
import { SymptomIcon } from "../../components/SymptomIcon";
import MilestoneCelebration from "../../components/MilestoneCelebration";
import WelcomeModal from "../../components/WelcomeModal";
import NotificationPrimer from "../../components/NotificationPrimer";
import AnnouncementCard from "../../components/AnnouncementCard";
import { formatWeatherLine, deviceLocale } from "../../theme/weatherFormat";
import { getPushDeclined } from "../../lib/storage";
import { getPermissionState } from "../../lib/pushNotifications";
import ConfirmDialog from "../../components/ConfirmDialog";
import { MILESTONES, totalCheckInDays } from "../../lib/milestones";

const BAR_HEIGHTS = [12, 16, 20, 24, 28];
const BAR_COLORS = {
  painLevel: "rgba(255,255,255,0.95)",
  moodLevel: "#D87AB0",
  energyLevel: "#4FB882",
  anxietyLevel: "#6E9DE0",
  appetiteLevel: "#DDA53F",
  sleepLevel: "#9AD0C8",
};

function CheckInRow({ checkIn, onEdit, onDelete, isLatest }) {
  const symptoms = Array.isArray(checkIn.symptoms) ? checkIn.symptoms : [];
  const note = typeof checkIn.note === "string" ? checkIn.note.trim() : "";
  const time = new Date(checkIn.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTime}>{time}</Text>
        <View style={styles.rowActions}>
          <TouchableOpacity accessibilityLabel={`Edit the ${time} check-in`}
            style={styles.rowBtn}
            onPress={() => onEdit(checkIn)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={13} color="white" />
          </TouchableOpacity>
          {isLatest && (
            <TouchableOpacity accessibilityLabel={`Delete the ${time} check-in`}
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
      {/* their own words, shown back as written; nothing renders when absent */}
      {note ? <Text style={styles.rowNote}>{note}</Text> : null}
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
  const [announcement, setAnnouncement] = useState(null);
  const [weather, setWeather] = useState([]);
  const [editingCheckIn, setEditingCheckIn] = useState(null);
  const [editError, setEditError] = useState("");
  // null means "we don't know" — the fetch failed, so the block renders nothing
  // rather than offering to start a second flare blind.
  const [flares, setFlares] = useState(null);
  const [flareView, setFlareView] = useState(null); // "start" | "ease" | "edit"
  const [celebration, setCelebration] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showPrimer, setShowPrimer] = useState(false);
  const [deleteCheckInId, setDeleteCheckInId] = useState(null);
  const [deletingCheckIn, setDeletingCheckIn] = useState(false);
  const isFirstLoadRef = useRef(true);
  const seededRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const [checkInsRes, apptRes, ann, flareList] = await Promise.all([
            api.get("/api/checkins"),
            api.get("/api/appointments"),
            // Chronicle's card is a bonus — it must never turn the dashboard
            // into an error state
            api.get("/api/announcements").then((r) => r.data.announcement).catch(() => null),
            // same for flares: a failure leaves the block out entirely
            api.get("/api/flares").then((r) => r.data.flares || []).catch(() => null),
          ]);
          if (active) {
            setCheckIns(checkInsRes.data.checkIns || []);
            setWeather(checkInsRes.data.weather || []);
            setAppointments(apptRes.data.appointments || []);
            setAnnouncement(ann || null);
            setFlares(flareList);
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
    if (user && user.hasSeenWelcome === false) setShowWelcome(true);
  }, [user]);

  // Ask about notifications once, and only after Welcome is out of the way —
  // two modals stacked on a first launch is not a welcome. Asked once ever:
  // "Not now" is remembered, and Profile is where it can be turned on later.
  useEffect(() => {
    let active = true;
    if (!user || showWelcome) return;
    (async () => {
      if (await getPushDeclined()) return;
      const state = await getPermissionState();
      if (active && state === "undetermined") setShowPrimer(true);
    })();
    return () => {
      active = false;
    };
  }, [user, showWelcome]);

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

  async function refetchFlares() {
    try {
      const r = await api.get("/api/flares");
      setFlares(r.data.flares || []);
    } catch {
      setFlares(null);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      const [checkInsRes, apptRes, ann, flareList] = await Promise.all([
        api.get("/api/checkins"),
        api.get("/api/appointments"),
        api.get("/api/announcements").then((r) => r.data.announcement).catch(() => null),
        api.get("/api/flares").then((r) => r.data.flares || []).catch(() => null),
      ]);
      setCheckIns(checkInsRes.data.checkIns || []);
      setWeather(checkInsRes.data.weather || []);
      setAppointments(apptRes.data.appointments || []);
      setAnnouncement(ann || null);
      setFlares(flareList);
      setError(null);
    } catch {
      setError("Could not load your data. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // Optimistic: the card has already animated itself out by the time this runs,
  // so drop it locally whatever the server says
  const dismissAnnouncement = async (id) => {
    setAnnouncement(null);
    try {
      await api.post(`/api/announcements/${id}/dismiss`);
    } catch {
      // it will simply be offered again on a later load
    }
  };

  const handleDeleteCheckIn = (id) => setDeleteCheckInId(id);

  const confirmDeleteCheckIn = async () => {
    if (!deleteCheckInId) return;
    setDeletingCheckIn(true);
    try {
      await api.delete(`/api/checkins/${deleteCheckInId}`);
      setCheckIns((prev) => prev.filter((c) => c.id !== deleteCheckInId));
    } catch (e) {
      console.error("Delete check-in failed:", e);
    } finally {
      setDeletingCheckIn(false);
      setDeleteCheckInId(null);
    }
  };

  const handleUpdateCheckIn = async () => {
    if (!editingCheckIn) return;
    setEditError("");
    try {
      const res = await api.put(`/api/checkins/${editingCheckIn.id}`, {
        painLevel: editingCheckIn.painLevel,
        moodLevel: editingCheckIn.moodLevel,
        energyLevel: editingCheckIn.energyLevel,
        anxietyLevel: editingCheckIn.anxietyLevel,
        appetiteLevel: editingCheckIn.appetiteLevel,
        sleepLevel: editingCheckIn.sleepLevel,
        symptoms:
          editingCheckIn.symptoms?.length > 0 ? editingCheckIn.symptoms : null,
        // always sent, so emptying the field clears the note
        note: (editingCheckIn.note ?? "").trim() || null,
      });
      setCheckIns((prev) =>
        prev.map((c) => (c.id === editingCheckIn.id ? res.data.checkIn : c)),
      );
      setEditingCheckIn(null);
    } catch (e) {
      console.error("Update check-in failed:", e);
      // a rejected note used to vanish into the console while the dialog sat
      // there looking as though nothing had happened
      setEditError(e.response?.data?.error || "Couldn't save that change. Please try again.");
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
  const todaysDone = checkIns[0]
    ? new Date(checkIns[0].createdAt).getTime() > fourHoursAgo
    : false;

  // the re-check nudge waits an hour so it doesn't nag right after a check-in
  const overAnHourSinceCheckIn =
    checkIns[0] &&
    Date.now() - new Date(checkIns[0].createdAt).getTime() >= 60 * 60 * 1000;

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

  // All six metrics render as a fixed 3×2 grid — three dials per row, sized for
  // three-across (with two 8px column gaps) and capped so they don't balloon on
  // large phones/tablets. Sleep is always present; an empty average shows "—".
  const DIAL_SIZE = Math.min(100, Math.floor((width - 48 - 8 * 2) / 3));

  // sleep is asked only on the first check-in of the day
  const todayStr = new Date().toLocaleDateString("en-CA");
  const askSleep = !checkIns.some((c) => c.date === todayStr);

  // "Same as last time" — only offered when there's a check-in recent enough to
  // still mean something. Sleep is deliberately left out of the copy.
  const lastCheckIn = checkIns[0];
  const repeatPrefill =
    lastCheckIn &&
    Date.now() - new Date(lastCheckIn.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000
      ? {
          painLevel: lastCheckIn.painLevel,
          moodLevel: lastCheckIn.moodLevel,
          energyLevel: lastCheckIn.energyLevel,
          anxietyLevel: lastCheckIn.anxietyLevel,
          appetiteLevel: lastCheckIn.appetiteLevel,
          symptoms: Array.isArray(lastCheckIn.symptoms) ? lastCheckIn.symptoms : [],
        }
      : null;

  const locale = deviceLocale();
  const weatherByDate = Object.fromEntries((weather || []).map((w) => [w.date, w]));

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

  // "Having a flare?" sits beside "Same as last time" while the check-in prompt
  // is up, and on its own line once it is not. An ongoing flare is a card, not
  // a link, and stays where it is. flares === null means the fetch failed: no
  // control at all beats offering to start a second flare blind.
  const showCheckInPrompt = !error && (checkIns.length === 0 || !todaysDone);
  const offerFlare =
    !error && !loading && flares !== null && !flares.some((f) => !f.endDate);

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

        <AnnouncementCard announcement={announcement} onDismiss={dismissAnnouncement} />

        {/* Check-in prompt */}
        {showCheckInPrompt && (
          <View style={styles.checkInPrompt}>
            <Text style={styles.checkInPromptTitle}>
              How are you feeling right now?
            </Text>
            <Text style={styles.checkInPromptSub}>It only takes a moment.</Text>
            <TouchableOpacity
              style={styles.checkInPromptBtn}
              onPress={() => openCheckIn(askSleep)}
              activeOpacity={0.85}
            >
              <Text style={styles.checkInPromptBtnText}>Start Check-in</Text>
            </TouchableOpacity>
            {(repeatPrefill || offerFlare) && (
              // two quiet ways to tell the app how today is going, on one line;
              // each keeps a full 44pt touch target
              <View style={styles.promptLinkRow}>
                {repeatPrefill && (
                  <TouchableOpacity
                    onPress={() => openCheckIn(askSleep, repeatPrefill)}
                    style={styles.promptLinkBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Same as last time"
                  >
                    <Text style={styles.promptLinkText}>Same as last time</Text>
                  </TouchableOpacity>
                )}
                {repeatPrefill && offerFlare && (
                  <Text
                    style={styles.promptLinkDot}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    ·
                  </Text>
                )}
                {offerFlare && (
                  <TouchableOpacity
                    onPress={() => setFlareView("start")}
                    style={styles.promptLinkBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Having a flare?"
                  >
                    <Text style={styles.promptLinkText}>Having a flare?</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Off-window re-check */}
        {!error && todaysDone && overAnHourSinceCheckIn && (
          <View style={styles.recheckPrompt}>
            <Text style={styles.recheckText}>Feeling different than earlier?</Text>
            <TouchableOpacity
              style={styles.recheckBtn}
              onPress={() => openCheckIn(askSleep)}
              activeOpacity={0.85}
            >
              <Text style={styles.recheckBtnText}>Check in now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Flares. Hidden while loading or in the error state, and hidden
            entirely if the fetch failed — better no control than offering to
            start a second flare blind. */}
        {!error && !loading && flares !== null ? (
          (() => {
            const ongoing = flares.find((f) => !f.endDate);
            const today = localToday();
            if (!ongoing) {
              // while the check-in prompt is up, the link lives inside it
              if (showCheckInPrompt) return null;
              return (
                <View style={styles.flareLinkWrap}>
                  <TouchableOpacity
                    onPress={() => setFlareView("start")}
                    style={styles.flareLinkBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Having a flare?"
                  >
                    <Text style={styles.flareLinkText}>Having a flare?</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <View
                style={styles.flareCard}
                accessible
                accessibilityLabel={flareCardLabel(ongoing.startDate, today)}
              >
                <Text style={styles.flareCardTitle}>
                  {flareSinceLabel(ongoing.startDate, today)}
                </Text>
                {ongoing.note ? (
                  <Text style={styles.flareCardNote} numberOfLines={1}>{ongoing.note}</Text>
                ) : null}
                <View style={styles.flareCardActions}>
                  <TouchableOpacity
                    style={styles.flareEasedBtn}
                    onPress={() => setFlareView("ease")}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="End this flare"
                  >
                    <Text style={styles.flareEasedText}>It&apos;s eased</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.flareEditBtn}
                    onPress={() => setFlareView("edit")}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Edit this flare"
                  >
                    <Text style={styles.flareEditText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()
        ) : null}

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
                recentCheckIns.map((c, i) => {
                  // the rolling 24h window can straddle two dates, and weather
                  // belongs to the day — so it shows once, above that date's
                  // first row, rather than repeating on every check-in
                  const newDay = i === 0 || c.date !== recentCheckIns[i - 1].date;
                  const line = newDay
                    ? formatWeatherLine(weatherByDate[c.date], locale)
                    : null;
                  return (
                    <View key={c.id}>
                      {line ? <Text style={styles.weatherLine}>{line}</Text> : null}
                      <CheckInRow
                        checkIn={c}
                        onEdit={setEditingCheckIn}
                        onDelete={handleDeleteCheckIn}
                        isLatest={i === 0}
                      />
                    </View>
                  );
                })
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
        {/* this dialog predates the kits and had no keyboard avoidance; the
            note field is the first thing in it that opens a keyboard */}
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
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
                  {COMMON_SYMPTOMS.map((s) => {
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

              {/* Note — always shown here, unlike the check-in review: this is
                  an edit form, and an existing note has to be visible to be
                  changed. Emptying the field and saving clears it. */}
              <View>
                <Text style={styles.editLabel}>Note</Text>
                <TextInput
                  style={styles.editNoteInput}
                  value={editingCheckIn?.note ?? ""}
                  onChangeText={(v) => setEditingCheckIn((prev) => ({ ...prev, note: v }))}
                  multiline
                  maxLength={NOTE_MAX}
                  blurOnSubmit
                  returnKeyType="done"
                  placeholder="A few words, if you like"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  accessibilityLabel="Note"
                />
                {(editingCheckIn?.note ?? "").length >= NOTE_COUNTER_FROM ? (
                  <Text style={styles.editNoteCounter} accessibilityLiveRegion="polite">
                    {(editingCheckIn?.note ?? "").length}/{NOTE_MAX}
                  </Text>
                ) : null}
              </View>

              {editError ? <Text style={styles.editErrorText}>{editError}</Text> : null}

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={() => { setEditError(""); setEditingCheckIn(null); }}
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
        </KeyboardAvoidingView>
      </Modal>

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {showPrimer && <NotificationPrimer onDone={() => setShowPrimer(false)} />}

      {celebration && (
        <MilestoneCelebration
          milestone={celebration}
          onDismiss={() => setCelebration(null)}
        />
      )}

      {flareView ? (
        <FlaresSheet
          visible
          mode={flareView}
          flare={(flares || []).find((f) => !f.endDate) || null}
          flares={flares || []}
          onClose={() => setFlareView(null)}
          onChanged={refetchFlares}
        />
      ) : null}

      <ConfirmDialog
        visible={!!deleteCheckInId}
        title="Delete check-in?"
        message="This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleteCheckInId(null)}
        onConfirm={confirmDeleteCheckIn}
        busy={deletingCheckIn}
      />
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
    paddingVertical: 16,
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
  // quieter secondary actions — never compete with the primary button
  promptLinkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  promptLinkBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  promptLinkText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  promptLinkDot: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
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
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
    columnGap: 8,
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
  // quiet by design — this app is not a weather app
  weatherLine: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
    marginBottom: 4,
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
  rowBtnDelete: { backgroundColor: PLUM_TINT },
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
  editNoteInput: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 58,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
    textAlignVertical: "top",
  },
  editNoteCounter: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "right",
    marginTop: 4,
  },
  editErrorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: SOFT_ERROR,
  },
  // the note as written, under the row's symptom icons
  rowNote: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
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
  recheckPrompt: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  // a quiet text link, not a second button competing with the check-in prompt
  flareLinkWrap: { alignItems: "center" },
  flareLinkBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  flareLinkText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  flareCard: {
    backgroundColor: "rgba(52,38,86,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  flareCardTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 17,
    color: "white",
  },
  flareCardNote: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  flareCardActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  flareEasedBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingHorizontal: 20,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  flareEasedText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "#7C6BAE" },
  flareEditBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  flareEditText: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)" },
  recheckText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  recheckBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 9,
    paddingHorizontal: 22,
  },
  recheckBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
});
