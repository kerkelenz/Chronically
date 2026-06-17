import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import api from "../../lib/api";
import {
  TYPE_ICONS,
  FREQUENCY_LABELS,
  SKIP_REASONS,
  DOSE_STATUS_COLORS,
  formatTime,
  isMedicationDueToday,
} from "../../theme/medications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTakenAt(isoString) {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function buildDoses(medications, todayLogs, today) {
  const now = new Date();
  const activeMeds = medications.filter((m) => m.active);
  const doses = [];

  activeMeds.forEach((med) => {
    if (!isMedicationDueToday(med, today)) return;
    const times =
      med.scheduledTimes?.length > 0 ? med.scheduledTimes : [null];

    times.forEach((scheduledTime) => {
      const doseKey = `${med.id}-${scheduledTime || "none"}`;
      const log = todayLogs.find(
        (l) =>
          l.medicationId === med.id && l.scheduledTime === scheduledTime
      );

      let status;
      if (log) {
        status = log.status;
      } else if (scheduledTime) {
        const [h, m] = scheduledTime.split(":").map(Number);
        const sched = new Date();
        sched.setHours(h, m, 0, 0);
        const minPast = (now - sched) / (1000 * 60);
        if (minPast > 60) status = "missed";
        else if (minPast > 0) status = "past-due";
        else status = "upcoming";
      } else {
        status = "upcoming";
      }

      doses.push({ med, scheduledTime, doseKey, status, log });
    });
  });

  doses.sort((a, b) =>
    (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99")
  );
  return doses;
}

// ── DoseRow ───────────────────────────────────────────────────────────────────

function DoseRow({
  dose,
  skippingDoseKey,
  onTake,
  onSkipOpen,
  onSkipReason,
  onUndo,
  actionLoading,
  actionError,
}) {
  const { med, scheduledTime, doseKey, status, log } = dose;
  const isSkipping = skippingDoseKey === doseKey;
  const isActing = actionLoading === doseKey;
  const borderColor = DOSE_STATUS_COLORS[status] || "transparent";

  let statusLine;
  if (status === "taken" && log?.takenAt) {
    statusLine = `Taken at ${formatTakenAt(log.takenAt)}`;
  } else if (status === "skipped") {
    statusLine = log?.skipReason ? `Skipped · ${log.skipReason}` : "Skipped";
  } else if (status === "missed") {
    statusLine = "Missed";
  } else if (scheduledTime) {
    statusLine = formatTime(scheduledTime);
  } else {
    statusLine = FREQUENCY_LABELS[med.frequency] || "";
  }

  return (
    <View style={[styles.doseCard, { borderLeftColor: borderColor }]}>
      <View style={styles.doseMain}>
        {/* Left: name + status */}
        <View style={styles.doseInfo}>
          <Text style={styles.doseName}>
            {med.name}
            {med.dosage ? ` · ${med.dosage}` : ""}
          </Text>
          <Text
            style={[
              styles.doseStatus,
              status === "missed" && styles.doseStatusMissed,
              status === "past-due" && styles.doseStatusPastDue,
              status === "taken" && styles.doseStatusTaken,
            ]}
          >
            {statusLine}
          </Text>
          {actionError === doseKey && (
            <Text style={styles.doseError}>Couldn't save, try again</Text>
          )}
        </View>

        {/* Right: actions */}
        <View style={styles.doseActions}>
          {(status === "taken" || status === "skipped") && (
            <View style={styles.doseActionRow}>
              {status === "taken" && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#7FAF8A"
                  style={{ marginRight: 6 }}
                />
              )}
              <TouchableOpacity
                onPress={() => onUndo(log.id, doseKey)}
                disabled={isActing}
                activeOpacity={0.7}
                style={styles.undoBtn}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                ) : (
                  <Ionicons name="arrow-undo" size={15} color="rgba(255,255,255,0.6)" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {(status === "upcoming" || status === "past-due") && !isSkipping && (
            <View style={styles.doseActionRow}>
              <TouchableOpacity
                style={[styles.takeBtn, isActing && styles.btnDisabled]}
                onPress={() => onTake(dose)}
                disabled={isActing}
                activeOpacity={0.8}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.takeBtnText}>Take</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => onSkipOpen(doseKey)}
                disabled={isActing}
                activeOpacity={0.8}
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Skip reason chips */}
      {isSkipping && (
        <View style={styles.skipReasonWrap}>
          <Text style={styles.skipReasonLabel}>Reason for skipping</Text>
          <View style={styles.skipReasonChips}>
            {SKIP_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.skipReasonChip}
                onPress={() => onSkipReason(dose, reason)}
                activeOpacity={0.75}
              >
                <Text style={styles.skipReasonChipText}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── MedicationsScreen ─────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const [medications, setMedications] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [skippingDoseKey, setSkippingDoseKey] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const isFirstLoadRef = useRef(true);

  const today = new Date().toLocaleDateString("en-CA");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const [medsRes, logsRes] = await Promise.all([
            api.get("/api/medications"),
            api.get(`/api/medications/logs?date=${today}`),
          ]);
          if (!active) return;
          setMedications(medsRes.data.medications || []);
          setTodayLogs(logsRes.data.logs || []);
          setError(null);
          isFirstLoadRef.current = false;
        } catch {
          if (!active) return;
          setError("Could not load medications. Pull down to try again.");
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
      const [medsRes, logsRes] = await Promise.all([
        api.get("/api/medications"),
        api.get(`/api/medications/logs?date=${today}`),
      ]);
      setMedications(medsRes.data.medications || []);
      setTodayLogs(logsRes.data.logs || []);
      setError(null);
    } catch {
      setError("Could not load medications. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleTake(dose) {
    const { med, scheduledTime, doseKey } = dose;
    setActionLoading(doseKey);
    setActionError(null);
    try {
      const res = await api.post("/api/medications/logs", {
        medicationId: med.id,
        date: today,
        scheduledTime,
        takenAt: new Date().toISOString(),
        status: "taken",
      });
      setTodayLogs((prev) => [...prev, res.data.log]);
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  function handleSkipOpen(doseKey) {
    setSkippingDoseKey(doseKey);
    setActionError(null);
  }

  async function handleSkipReason(dose, reason) {
    const { med, scheduledTime, doseKey } = dose;
    setActionLoading(doseKey);
    setActionError(null);
    try {
      const res = await api.post("/api/medications/logs", {
        medicationId: med.id,
        date: today,
        scheduledTime,
        status: "skipped",
        skipReason: reason,
      });
      setTodayLogs((prev) => [...prev, res.data.log]);
      setSkippingDoseKey(null);
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUndo(logId, doseKey) {
    setActionLoading(doseKey);
    setActionError(null);
    try {
      await api.delete(`/api/medications/logs/${logId}`);
      setTodayLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeMeds = medications.filter((m) => m.active);
  const doses = buildDoses(medications, todayLogs, today);

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={styles.loadingText}>Loading medications…</Text>
          <Text style={styles.loadingHint}>
            The server may take a moment to wake up.
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────────

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
        <Text style={styles.pageTitle}>Medications</Text>

        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Today's dose timeline ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today</Text>

          {activeMeds.length === 0 ? (
            <Text style={styles.emptyText}>
              No medications added yet. Add them from the web app — medication
              management is coming to mobile soon.
            </Text>
          ) : doses.length === 0 ? (
            <Text style={styles.emptyText}>No doses scheduled today.</Text>
          ) : (
            doses.map((dose) => (
              <DoseRow
                key={dose.doseKey}
                dose={dose}
                skippingDoseKey={skippingDoseKey}
                onTake={handleTake}
                onSkipOpen={handleSkipOpen}
                onSkipReason={handleSkipReason}
                onUndo={handleUndo}
                actionLoading={actionLoading}
                actionError={actionError}
              />
            ))
          )}
        </View>

        {/* ── Active medications regimen (read-only) ───────────────────────── */}
        {activeMeds.length > 0 && (
          <>
            <Text style={styles.regimenTitle}>Your regimen</Text>
            {activeMeds.map((med) => {
              const subParts = [
                med.dosage,
                FREQUENCY_LABELS[med.frequency],
              ].filter(Boolean);
              const timePart =
                med.scheduledTimes?.length > 0
                  ? med.scheduledTimes.map(formatTime).join(" · ")
                  : null;
              return (
                <View key={med.id} style={styles.regimenRow}>
                  <Text style={styles.regimenIcon}>
                    {TYPE_ICONS[med.type] || "💊"}
                  </Text>
                  <View style={styles.regimenInfo}>
                    <Text style={styles.regimenName}>{med.name}</Text>
                    <Text style={styles.regimenSub}>
                      {[subParts.join(" · "), timePart]
                        .filter(Boolean)
                        .join(" — ")}
                    </Text>
                  </View>
                </View>
              );
            })}
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
  sectionTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 21,
    textAlign: "center",
    paddingVertical: 8,
  },

  // ── Dose rows ──────────────────────────────────────────────────────────────

  doseCard: {
    borderLeftWidth: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    paddingRight: 10,
    paddingLeft: 12,
    marginBottom: 8,
  },
  doseMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doseInfo: {
    flex: 1,
    marginRight: 10,
  },
  doseName: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
    marginBottom: 2,
  },
  doseStatus: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  doseStatusTaken: {
    color: "#7FAF8A",
  },
  doseStatusMissed: {
    color: "#FF6B8A",
  },
  doseStatusPastDue: {
    color: "#C4A882",
  },
  doseError: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,180,180,0.8)",
    marginTop: 3,
  },
  doseActions: {
    alignItems: "flex-end",
  },
  doseActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  takeBtn: {
    backgroundColor: "#7C6BAE",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  takeBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },
  skipBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  skipBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  undoBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // ── Skip reason chips ──────────────────────────────────────────────────────

  skipReasonWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  skipReasonLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  skipReasonChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skipReasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  skipReasonChipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "white",
  },

  // ── Regimen list ───────────────────────────────────────────────────────────

  regimenTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: "white",
    marginBottom: 10,
    marginTop: 4,
  },
  regimenRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    gap: 12,
  },
  regimenIcon: {
    fontSize: 22,
  },
  regimenInfo: {
    flex: 1,
  },
  regimenName: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
    marginBottom: 2,
  },
  regimenSub: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
});
