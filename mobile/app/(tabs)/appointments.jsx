import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import api from "../../lib/api";
import {
  DAY_HEADERS,
  formatApptDate,
  formatApptTime,
  dotColor,
} from "../../theme/appointments";

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [popoverAppointment, setPopoverAppointment] = useState(null);
  const isFirstLoadRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const res = await api.get("/api/appointments");
          if (active) {
            setAppointments(res.data.appointments || []);
            setError(null);
            isFirstLoadRef.current = false;
          }
        } catch {
          if (active) setError("Could not load appointments. Pull down to try again.");
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
      const res = await api.get("/api/appointments");
      setAppointments(res.data.appointments || []);
      setError(null);
    } catch {
      setError("Could not load appointments. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────

  const prevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    setSelectedDate(null);
    setPopoverAppointment(null);
  };

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
    setSelectedDate(null);
    setPopoverAppointment(null);
  };

  function buildCalendarDays() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const days = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, currentMonth: false, date: null });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(year, month, i).toLocaleDateString("en-CA");
      const appts = appointments.filter(
        (a) => new Date(a.date).toLocaleDateString("en-CA") === dateStr
      );
      days.push({ day: i, currentMonth: true, date: dateStr, appointments: appts });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false, date: null });
    }
    return days;
  }

  function handleDayClick(dayObj) {
    if (!dayObj.currentMonth || !dayObj.appointments || dayObj.appointments.length === 0) {
      setSelectedDate(null);
      setPopoverAppointment(null);
      return;
    }
    setSelectedDate(dayObj.date);
    setPopoverAppointment(dayObj.appointments[0]);
  }

  const todayStr = new Date().toLocaleDateString("en-CA");
  const calendarDays = loading ? [] : buildCalendarDays();

  const upcoming = appointments
    .filter((a) => a.status === "upcoming")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = appointments
    .filter((a) => a.status !== "upcoming")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
        </View>
      </ScreenBackground>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Calendar ─────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.chevronBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={16} color="white" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity style={styles.chevronBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaderRow}>
            {DAY_HEADERS.map((d) => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.dayGrid}>
            {calendarDays.map((dayObj, idx) => {
              const isToday = dayObj.currentMonth && dayObj.date === todayStr;
              const isSelected = dayObj.currentMonth && dayObj.date === selectedDate;
              const hasAppts = dayObj.currentMonth && dayObj.appointments?.length > 0;

              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.dayCell,
                    isSelected
                      ? styles.dayCellSelected
                      : isToday
                      ? styles.dayCellToday
                      : null,
                  ]}
                  onPress={() => handleDayClick(dayObj)}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected
                        ? styles.dayNumSelected
                        : dayObj.currentMonth
                        ? styles.dayNumCurrent
                        : styles.dayNumOther,
                      (isToday || isSelected) && styles.dayNumBold,
                    ]}
                  >
                    {dayObj.day}
                  </Text>
                  {hasAppts && (
                    <View style={styles.dotRow}>
                      {dayObj.appointments.slice(0, 3).map((a, i) => (
                        <View
                          key={i}
                          style={[
                            styles.dot,
                            { backgroundColor: isSelected ? "#7C6BAE" : dotColor(a.status) },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Selected-day panel ────────────────────────────────────────────── */}
        {popoverAppointment && selectedDate && (() => {
          const dayAppts = appointments.filter(
            (a) => new Date(a.date).toLocaleDateString("en-CA") === selectedDate
          );
          const extra = dayAppts.length - 1;
          return (
            <View style={styles.popoverCard}>
              <View style={styles.popoverHeader}>
                <View style={styles.popoverHeaderLeft}>
                  <Text style={styles.popoverDoctor}>{popoverAppointment.doctorName}</Text>
                  {!!popoverAppointment.specialty && (
                    <Text style={styles.popoverSpecialty}>{popoverAppointment.specialty}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.popoverClose}
                  onPress={() => { setPopoverAppointment(null); setSelectedDate(null); }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <Text style={styles.popoverDate}>
                {formatApptDate(popoverAppointment.date)} at {formatApptTime(popoverAppointment.date)}
              </Text>

              {!!popoverAppointment.location && (
                <View style={styles.popoverRow}>
                  <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.popoverDetail}>{popoverAppointment.location}</Text>
                </View>
              )}
              {!!popoverAppointment.reason && (
                <Text style={styles.popoverDetail}>Reason: {popoverAppointment.reason}</Text>
              )}
              {!!popoverAppointment.notesBefore && (
                <Text style={[styles.popoverDetail, { marginTop: 2 }]}>
                  Notes: {popoverAppointment.notesBefore}
                </Text>
              )}
              {popoverAppointment.status === "completed" && !!popoverAppointment.notesAfter && (
                <Text style={[styles.popoverDetail, { marginTop: 2 }]}>
                  Outcome: {popoverAppointment.notesAfter}
                </Text>
              )}

              <View style={styles.popoverFooter}>
                <View
                  style={[
                    styles.statusPill,
                    popoverAppointment.status === "completed"
                      ? styles.pillCompleted
                      : popoverAppointment.status === "cancelled"
                      ? styles.pillCancelled
                      : styles.pillUpcoming,
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {popoverAppointment.status.charAt(0).toUpperCase() +
                      popoverAppointment.status.slice(1)}
                  </Text>
                </View>
                {extra > 0 && (
                  <Text style={styles.extraText}>and {extra} more</Text>
                )}
              </View>
            </View>
          );
        })()}

        {/* ── Lists ────────────────────────────────────────────────────────── */}
        {appointments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={28} color="white" />
            </View>
            <Text style={styles.emptyTitle}>No appointments yet</Text>
            <Text style={styles.emptySubtitle}>
              Track your doctor visits and upcoming appointments
            </Text>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Upcoming</Text>
                {upcoming.map((appt) => (
                  <View key={appt.id} style={styles.apptCard}>
                    <View style={styles.apptRow}>
                      <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.apptDateText}>{formatApptDate(appt.date)}</Text>
                      <Text style={styles.apptTimeText}>at {formatApptTime(appt.date)}</Text>
                    </View>
                    <Text style={styles.apptDoctor}>
                      {appt.doctorName}{appt.specialty ? ` — ${appt.specialty}` : ""}
                    </Text>
                    {!!appt.location && (
                      <View style={styles.apptRow}>
                        <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.apptMeta}>{appt.location}</Text>
                      </View>
                    )}
                    {!!appt.reason && (
                      <Text style={styles.apptMeta}>Reason: {appt.reason}</Text>
                    )}
                    {!!appt.notesBefore && (
                      <Text style={styles.apptMeta}>Notes: {appt.notesBefore}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {past.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Past</Text>
                {past.map((appt) => {
                  const isCompleted = appt.status === "completed";
                  const isCancelled = appt.status === "cancelled";
                  return (
                    <View
                      key={appt.id}
                      style={[
                        styles.apptCard,
                        isCompleted && styles.apptCardCompleted,
                        isCancelled && styles.apptCardCancelled,
                        isCancelled && styles.apptCardFaded,
                      ]}
                    >
                      <View style={styles.pastPillRow}>
                        {isCompleted && (
                          <View style={styles.completedPill}>
                            <Text style={styles.completedPillText}>COMPLETED</Text>
                          </View>
                        )}
                        {isCancelled && (
                          <View style={styles.cancelledPill}>
                            <Text style={styles.cancelledPillText}>CANCELLED</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.apptRow}>
                        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.apptDateFaded}>
                          {formatApptDate(appt.date)} at {formatApptTime(appt.date)}
                        </Text>
                      </View>
                      <Text style={styles.apptDoctorFaded}>
                        {appt.doctorName}{appt.specialty ? ` — ${appt.specialty}` : ""}
                      </Text>
                      {!!appt.location && (
                        <View style={styles.apptRow}>
                          <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.4)" />
                          <Text style={styles.apptMetaFaded}>{appt.location}</Text>
                        </View>
                      )}
                      {!!appt.reason && (
                        <Text style={styles.apptMetaFaded}>Reason: {appt.reason}</Text>
                      )}
                      {isCompleted && !!appt.notesAfter && (
                        <Text style={styles.apptMetaFaded}>Notes after: {appt.notesAfter}</Text>
                      )}
                      {isCompleted && !!appt.followUpDate && (
                        <View style={styles.apptRow}>
                          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.4)" />
                          <Text style={styles.apptMetaFaded}>
                            Follow-up: {formatApptDate(appt.followUpDate)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {upcoming.length === 0 && (
              <View style={styles.noUpcoming}>
                <Text style={styles.noUpcomingText}>No upcoming appointments</Text>
              </View>
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
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },

  // Error
  errorCard: {
    backgroundColor: "rgba(176,112,136,0.2)",
    borderColor: "rgba(176,112,136,0.35)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
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

  // Card base
  card: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    padding: 14,
  },

  // Calendar
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chevronBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  dayHeaderRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: "14.2857%",
    alignItems: "center",
  },
  dayHeaderText: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    alignItems: "center",
    paddingVertical: 5,
    borderRadius: 10,
  },
  dayCellToday: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dayCellSelected: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  dayNum: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
  },
  dayNumCurrent: {
    color: "white",
    fontWeight: "400",
  },
  dayNumOther: {
    color: "rgba(255,255,255,0.25)",
    fontWeight: "400",
  },
  dayNumSelected: {
    color: "#7C6BAE",
    fontWeight: "600",
  },
  dayNumBold: {
    fontWeight: "600",
  },
  dotRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // Popover / selected-day panel
  popoverCard: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    padding: 14,
    gap: 4,
  },
  popoverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  popoverHeaderLeft: {
    flex: 1,
    paddingRight: 8,
    gap: 2,
  },
  popoverDoctor: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  popoverSpecialty: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  popoverClose: {
    padding: 4,
  },
  popoverDate: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  popoverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  popoverDetail: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    flexShrink: 1,
  },
  popoverFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillCompleted: { backgroundColor: "rgba(127,175,138,0.3)" },
  pillCancelled: { backgroundColor: "rgba(255,255,255,0.15)" },
  pillUpcoming:  { backgroundColor: "rgba(124,107,174,0.4)" },
  statusPillText: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "white",
  },
  extraText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: "white",
  },
  emptySubtitle: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    paddingHorizontal: 16,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Appointment cards
  apptCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    padding: 14,
    gap: 6,
  },
  apptCardCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: "#7FAF8A",
  },
  apptCardCancelled: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.2)",
  },
  apptCardFaded: {
    opacity: 0.6,
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  apptDateText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  apptTimeText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  apptDoctor: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  apptMeta: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    flexShrink: 1,
  },
  apptDateFaded: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  apptDoctorFaded: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  apptMetaFaded: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    flexShrink: 1,
  },
  pastPillRow: {
    flexDirection: "row",
    gap: 6,
  },
  completedPill: {
    backgroundColor: "rgba(127,175,138,0.25)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  completedPillText: {
    fontFamily: "Lato_700Bold",
    fontSize: 10,
    color: "#7FAF8A",
  },
  cancelledPill: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cancelledPillText: {
    fontFamily: "Lato_700Bold",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  noUpcoming: {
    alignItems: "center",
    paddingVertical: 12,
  },
  noUpcomingText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
});