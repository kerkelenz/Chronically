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
  Modal,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../../components/BottomSheet";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import ScreenBackground from "../../components/ScreenBackground";
import api from "../../lib/api";
import { track } from "../../lib/analytics";
import { computeReportData } from "../../lib/reportData";
import { buildReportHtml } from "../../lib/reportHtml";
import { useAuth } from "../../context/AuthContext";
import {
  DAY_HEADERS,
  formatApptDate,
  formatApptTime,
  dotColor,
  toDateTimeLocal,
  toDateOnly,
} from "../../theme/appointments";

const EMPTY_FORM = {
  doctorName: "", specialty: "", date: "", location: "",
  reason: "", notesBefore: "", notesAfter: "", followUpDate: "", status: "upcoming",
};

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [popoverAppointment, setPopoverAppointment] = useState(null);
  const isFirstLoadRef = useRef(true);

  // ── Modal / form state ────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // ── Visit lifecycle sheets (prep / outcome) ───────────────────────────────
  const [prepFor, setPrepFor] = useState(null);
  const [prepText, setPrepText] = useState("");
  const [outcomeFor, setOutcomeFor] = useState(null);
  const [outcomeText, setOutcomeText] = useState("");
  const [outcomeDate, setOutcomeDate] = useState("");
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [showOutcomePicker, setShowOutcomePicker] = useState(false);
  const [tempOutcomeDate, setTempOutcomeDate] = useState(new Date());

  // ── iOS inline pickers ────────────────────────────────────────────────────
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [tempDateTime, setTempDateTime] = useState(new Date());
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [tempFollowUp, setTempFollowUp] = useState(new Date());

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchAppointments() {
    const res = await api.get("/api/appointments");
    setAppointments(res.data.appointments || []);
  }

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
      await fetchAppointments();
      setError(null);
    } catch {
      setError("Could not load appointments. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Export report ─────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startDate = start.toLocaleDateString("en-CA");

      const [checkInsRes, medsRes, logsRes, apptsRes] = await Promise.all([
        api.get("/api/checkins"),
        api.get("/api/medications"),
        api.get(`/api/medications/logs?startDate=${startDate}&endDate=${today}`),
        api.get("/api/appointments"),
      ]);

      const data = computeReportData(
        checkInsRes.data.checkIns,
        medsRes.data.medications,
        logsRes.data.logs,
        apptsRes.data.appointments,
      );
      const html = buildReportHtml(data, user?.username || "Patient");
      const { uri } = await Print.printToFileAsync({ html });
      const stamp = new Date().toLocaleDateString("en-CA");
      const fileName = `Chronically-Doctor-Report-${stamp}`;

      // Hand the PDF to the system share sheet — the user can save it to Files,
      // email it, print it, or send it anywhere. No folder picker (Android blocks
      // Download and other protected folders), works the same on iOS and Android.
      const dest = `${FileSystem.cacheDirectory}${fileName}.pdf`;
      let shareUri = uri;
      try {
        await FileSystem.copyAsync({ from: uri, to: dest }); // friendly filename
        shareUri = dest;
      } catch {
        // fall back to the original temp uri if the rename copy fails
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: "application/pdf",
          dialogTitle: "Doctor report",
          UTI: "com.adobe.pdf",
        });
        track("report_exported");
      } else {
        Alert.alert("Report ready", "Sharing isn't available on this device.");
      }
    } catch (err) {
      console.error("Export failed:", err);
      setExportError("Could not generate report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

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

  // ── Mutation handlers ─────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDateTimePicker(false);
    setShowFollowUpPicker(false);
    setShowModal(true);
  };

  const openEdit = (appt) => {
    setEditingId(appt.id);
    setForm({
      doctorName: appt.doctorName || "",
      specialty: appt.specialty || "",
      date: toDateTimeLocal(appt.date),
      location: appt.location || "",
      reason: appt.reason || "",
      notesBefore: appt.notesBefore || "",
      notesAfter: appt.notesAfter || "",
      followUpDate: toDateOnly(appt.followUpDate),
      status: appt.status || "upcoming",
    });
    setShowDateTimePicker(false);
    setShowFollowUpPicker(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDateTimePicker(false);
    setShowFollowUpPicker(false);
  };

  const handleSave = async () => {
    if (!form.doctorName.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: new Date(form.date).toISOString(),
        followUpDate: form.followUpDate
          ? new Date(form.followUpDate + "T12:00:00").toISOString()
          : null,
      };
      if (editingId) await api.put(`/api/appointments/${editingId}`, payload);
      else await api.post("/api/appointments", payload);
      await fetchAppointments();
      closeModal();
    } catch (err) {
      console.error("Failed to save appointment:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      const appt = appointments.find((a) => a.id === id);
      await api.put(`/api/appointments/${id}`, { ...appt, status: "cancelled" });
      await fetchAppointments();
    } catch (err) {
      console.error("Failed to cancel appointment:", err);
    } finally {
      setCancelConfirmId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/appointments/${id}`);
      await fetchAppointments();
      closeModal();
    } catch (err) {
      console.error("Failed to delete appointment:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // ── Visit lifecycle (prep / outcome / follow-up) ──────────────────────────

  const openPrep = (appt) => {
    setPrepFor(appt);
    setPrepText(appt.notesBefore || "");
  };

  const savePrep = async () => {
    if (!prepFor) return;
    setSavingLifecycle(true);
    try {
      await api.put(`/api/appointments/${prepFor.id}`, {
        ...prepFor,
        notesBefore: prepText,
      });
      await fetchAppointments();
      setPrepFor(null);
    } catch (err) {
      console.error("Failed to save prep notes:", err);
    } finally {
      setSavingLifecycle(false);
    }
  };

  const openOutcome = (appt) => {
    setOutcomeFor(appt);
    setOutcomeText(appt.notesAfter || "");
    setOutcomeDate(toDateOnly(appt.followUpDate));
    setShowOutcomePicker(false);
  };

  const markCompleted = async (appt) => {
    try {
      await api.put(`/api/appointments/${appt.id}`, { ...appt, status: "completed" });
      await fetchAppointments();
      openOutcome({ ...appt, status: "completed" });
    } catch (err) {
      console.error("Failed to complete appointment:", err);
    }
  };

  const saveOutcome = async () => {
    if (!outcomeFor) return;
    setSavingLifecycle(true);
    try {
      await api.put(`/api/appointments/${outcomeFor.id}`, {
        ...outcomeFor,
        notesAfter: outcomeText,
        followUpDate: outcomeDate
          ? new Date(outcomeDate + "T12:00:00").toISOString()
          : null,
      });
      await fetchAppointments();
      setOutcomeFor(null);
    } catch (err) {
      console.error("Failed to save visit notes:", err);
    } finally {
      setSavingLifecycle(false);
    }
  };

  const scheduleFollowUp = (appt) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      doctorName: appt.doctorName || "",
      specialty: appt.specialty || "",
      location: appt.location || "",
      date: toDateTimeLocal(appt.followUpDate),
    });
    setShowDateTimePicker(false);
    setShowFollowUpPicker(false);
    setShowModal(true);
  };

  // ── Date pickers ──────────────────────────────────────────────────────────

  function openOutcomeDatePickerFn() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: outcomeDate ? new Date(outcomeDate + "T12:00:00") : new Date(),
        mode: "date",
        onChange: (e, d) => {
          if (e.type !== "set" || !d) return;
          setOutcomeDate(toDateOnly(d));
        },
      });
    } else {
      setTempOutcomeDate(outcomeDate ? new Date(outcomeDate + "T12:00:00") : new Date());
      setShowOutcomePicker(true);
    }
  }

  function openDateTimePickerFn() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: form.date ? new Date(form.date) : new Date(),
        mode: "date",
        onChange: (e, d) => {
          if (e.type !== "set" || !d) return;
          DateTimePickerAndroid.open({
            value: d,
            mode: "time",
            onChange: (e2, t) => {
              if (e2.type !== "set" || !t) return;
              const combined = new Date(d);
              combined.setHours(t.getHours(), t.getMinutes(), 0, 0);
              setForm((f) => ({ ...f, date: toDateTimeLocal(combined) }));
            },
          });
        },
      });
    } else {
      setTempDateTime(form.date ? new Date(form.date) : new Date());
      setShowFollowUpPicker(false);
      setShowDateTimePicker(true);
    }
  }

  function openFollowUpPickerFn() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: form.followUpDate ? new Date(form.followUpDate + "T12:00:00") : new Date(),
        mode: "date",
        onChange: (e, d) => {
          if (e.type !== "set" || !d) return;
          setForm((f) => ({ ...f, followUpDate: toDateOnly(d) }));
        },
      });
    } else {
      setTempFollowUp(form.followUpDate ? new Date(form.followUpDate + "T12:00:00") : new Date());
      setShowDateTimePicker(false);
      setShowFollowUpPicker(true);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const todayStr = new Date().toLocaleDateString("en-CA");
  const calendarDays = loading ? [] : buildCalendarDays();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcoming = appointments
    .filter((a) => a.status === "upcoming" && new Date(a.date) >= todayStart)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = appointments
    .filter((a) => a.status !== "upcoming" || new Date(a.date) < todayStart)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // the soonest upcoming appointment gets the "export a report to bring" nudge
  const soonestUpcomingId = upcoming.length > 0 ? upcoming[0].id : null;

  const saveDisabled = saving || !form.doctorName.trim() || !form.date;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground edges={["top", "left", "right"]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
        </View>
      </ScreenBackground>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Appointments</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={15} color="white" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Calendar ─────────────────────────────────────────────────────── */}
        <View style={styles.card}>
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

          <View style={styles.dayHeaderRow}>
            {DAY_HEADERS.map((d) => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

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
                    isSelected ? styles.dayCellSelected : isToday ? styles.dayCellToday : null,
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

        {/* ── Doctor report card ────────────────────────────────────────────── */}
        <View style={styles.reportCard}>
          <Text style={styles.reportCardTitle}>Doctor Report</Text>
          <Text style={styles.reportCardDesc}>
            Export a 30-day PDF summary of health metrics, medications, adherence, and
            appointments — designed to bring to your next visit.
          </Text>
          <TouchableOpacity
            style={[styles.reportBtn, exporting && styles.reportBtnDisabled]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Export doctor report PDF"
          >
            {exporting ? (
              <>
                <ActivityIndicator size="small" color="#7C6BAE" />
                <Text style={styles.reportBtnText}>Preparing…</Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={14} color="#7C6BAE" />
                <Text style={styles.reportBtnText}>Export PDF Report</Text>
              </>
            )}
          </TouchableOpacity>
          {exportError && (
            <Text style={styles.reportErrorText}>Failed to prepare report. Please try again.</Text>
          )}
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
                <View style={styles.notesBlock}>
                  <Text style={styles.notesLabel}>Before</Text>
                  <Text style={styles.popoverDetail}>{popoverAppointment.notesBefore}</Text>
                </View>
              )}
              {!!popoverAppointment.notesAfter && (
                <View style={styles.notesBlock}>
                  <Text style={styles.notesLabel}>After</Text>
                  <Text style={styles.popoverDetail}>{popoverAppointment.notesAfter}</Text>
                </View>
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
                {extra > 0 && <Text style={styles.extraText}>and {extra} more</Text>}
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
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd} activeOpacity={0.8}>
              <Text style={styles.emptyAddBtnText}>Add your first appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Upcoming</Text>
                {upcoming.map((appt) => (
                  <View key={appt.id} style={styles.apptCard}>
                    <View style={styles.cardBodyRow}>
                      <View style={styles.cardBodyContent}>
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
                          <View style={styles.notesBlock}>
                            <Text style={styles.notesLabel}>Before</Text>
                            <Text style={styles.apptMeta}>{appt.notesBefore}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => openEdit(appt)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit appointment with ${appt.doctorName}`}
                        >
                          <Ionicons name="pencil-outline" size={13} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.iconBtn, styles.iconBtnDanger]}
                          onPress={() => setCancelConfirmId(appt.id)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Cancel appointment with ${appt.doctorName}`}
                        >
                          <Ionicons name="close" size={13} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Prepare + report-to-bring */}
                    <View style={styles.prepRow}>
                      <TouchableOpacity
                        style={styles.prepBtn}
                        onPress={() => openPrep(appt)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Prepare for visit with ${appt.doctorName}`}
                      >
                        <Ionicons
                          name="create-outline"
                          size={13}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.prepBtnText}>
                          {appt.notesBefore ? "Edit prep notes" : "Prepare"}
                        </Text>
                      </TouchableOpacity>
                      {appt.id === soonestUpcomingId && (
                        <TouchableOpacity
                          style={styles.reportShortcut}
                          onPress={handleExport}
                          disabled={exporting}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel="Export a report to bring to this visit"
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={13}
                            color="rgba(255,255,255,0.7)"
                          />
                          <Text style={styles.reportShortcutText}>
                            Export a report to bring
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Inline cancel confirm */}
                    {cancelConfirmId === appt.id && (
                      <View style={styles.cancelConfirm}>
                        <Text style={styles.cancelConfirmText}>
                          Mark this appointment as cancelled?
                        </Text>
                        <View style={styles.cancelConfirmBtns}>
                          <TouchableOpacity
                            style={styles.keepBtn}
                            onPress={() => setCancelConfirmId(null)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.keepBtnText}>Keep</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelItBtn}
                            onPress={() => handleCancel(appt.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.cancelItBtnText}>Cancel it</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
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
                  const isPastDue = appt.status === "upcoming";
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
                      <View style={styles.cardBodyRow}>
                        <View style={styles.cardBodyContent}>
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
                          {!!appt.notesBefore && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesLabel}>Before</Text>
                              <Text style={styles.apptMetaFaded}>{appt.notesBefore}</Text>
                            </View>
                          )}
                          {!!appt.notesAfter && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesLabel}>After</Text>
                              <Text style={styles.apptMetaFaded}>{appt.notesAfter}</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => openEdit(appt)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit appointment with ${appt.doctorName}`}
                        >
                          <Ionicons name="pencil-outline" size={13} color="white" />
                        </TouchableOpacity>
                      </View>

                      {/* Past-due: did this visit happen? */}
                      {isPastDue && (
                        <View style={styles.happenRow}>
                          <Text style={styles.happenText}>Did this visit happen?</Text>
                          <View style={styles.happenBtns}>
                            <TouchableOpacity
                              style={styles.happenYesBtn}
                              onPress={() => markCompleted(appt)}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`Mark visit with ${appt.doctorName} completed`}
                            >
                              <Text style={styles.happenYesText}>Yes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.happenNoBtn}
                              onPress={() => setCancelConfirmId(appt.id)}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`Mark visit with ${appt.doctorName} cancelled`}
                            >
                              <Text style={styles.happenNoText}>Cancelled</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Inline cancel confirm (shared with the chip) */}
                      {isPastDue && cancelConfirmId === appt.id && (
                        <View style={styles.cancelConfirm}>
                          <Text style={styles.cancelConfirmText}>
                            Mark this appointment as cancelled?
                          </Text>
                          <View style={styles.cancelConfirmBtns}>
                            <TouchableOpacity
                              style={styles.keepBtn}
                              onPress={() => setCancelConfirmId(null)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.keepBtnText}>Keep</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelItBtn}
                              onPress={() => handleCancel(appt.id)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.cancelItBtnText}>Cancel it</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Completed: add visit notes link when empty */}
                      {isCompleted && !appt.notesAfter && (
                        <TouchableOpacity
                          style={styles.addNotesLink}
                          onPress={() => openOutcome(appt)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Add visit notes for ${appt.doctorName}`}
                        >
                          <Ionicons name="add" size={13} color="rgba(255,255,255,0.7)" />
                          <Text style={styles.addNotesLinkText}>Add visit notes</Text>
                        </TouchableOpacity>
                      )}

                      {/* Completed: follow-up chained */}
                      {isCompleted && !!appt.followUpDate && (
                        <View style={styles.followUpRow}>
                          <View style={styles.followUpTextWrap}>
                            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.followUpText}>
                              Follow-up around {formatApptDate(appt.followUpDate)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.scheduleBtn}
                            onPress={() => scheduleFollowUp(appt)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`Schedule follow-up appointment with ${appt.doctorName}`}
                          >
                            <Text style={styles.scheduleBtnText}>Schedule</Text>
                          </TouchableOpacity>
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

      {/* ── Add / Edit modal ─────────────────────────────────────────────────── */}
      <BottomSheet visible={showModal} onClose={closeModal} cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Appointment" : "Add Appointment"}
              </Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal} hitSlop={8}>
                <Ionicons name="close" size={15} color="white" />
              </TouchableOpacity>
            </View>

            {/* Scrollable form */}
            <ScrollView
              contentContainerStyle={[styles.formContent, { paddingBottom: 12 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Doctor name */}
              <Text style={styles.fieldLabel}>Doctor name *</Text>
              <TextInput
                style={styles.input}
                value={form.doctorName}
                onChangeText={(v) => setForm((f) => ({ ...f, doctorName: v }))}
                placeholder="Dr. Smith"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Specialty */}
              <Text style={styles.fieldLabel}>Specialty</Text>
              <TextInput
                style={styles.input}
                value={form.specialty}
                onChangeText={(v) => setForm((f) => ({ ...f, specialty: v }))}
                placeholder="Neurology"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Date & time */}
              <Text style={styles.fieldLabel}>Date & time *</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerField]}
                onPress={openDateTimePickerFn}
                activeOpacity={0.8}
              >
                <Text style={form.date ? styles.pickerFieldText : styles.pickerFieldPlaceholder}>
                  {form.date
                    ? `${formatApptDate(form.date)} at ${formatApptTime(form.date)}`
                    : "Select date & time"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              {showDateTimePicker && Platform.OS === "ios" && (
                <View style={styles.inlinePicker}>
                  <DateTimePicker
                    value={tempDateTime}
                    mode="datetime"
                    display="spinner"
                    textColor="white"
                    onChange={(e, d) => { if (d) setTempDateTime(d); }}
                    style={{ width: "100%" }}
                  />
                  <TouchableOpacity
                    style={styles.pickerDoneBtn}
                    onPress={() => {
                      setForm((f) => ({ ...f, date: toDateTimeLocal(tempDateTime) }));
                      setShowDateTimePicker(false);
                    }}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Location */}
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.input}
                value={form.location}
                onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
                placeholder="Hospital or clinic name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason for visit</Text>
              <TextInput
                style={styles.input}
                value={form.reason}
                onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))}
                placeholder="Annual checkup, follow-up, etc."
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="sentences"
                returnKeyType="next"
              />

              {/* Notes before */}
              <Text style={styles.fieldLabel}>Notes before</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.notesBefore}
                onChangeText={(v) => setForm((f) => ({ ...f, notesBefore: v }))}
                placeholder="Questions to ask, things to mention..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={2}
                autoCapitalize="sentences"
                textAlignVertical="top"
              />

              {/* Status segmented */}
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.segmented}>
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.segmentedBtn,
                      form.status === value && styles.segmentedBtnActive,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, status: value }))}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.segmentedBtnText,
                        form.status === value && styles.segmentedBtnTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Completed-only fields */}
              {form.status === "completed" && (
                <>
                  <Text style={styles.fieldLabel}>Notes after</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={form.notesAfter}
                    onChangeText={(v) => setForm((f) => ({ ...f, notesAfter: v }))}
                    placeholder="What was discussed, next steps..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline
                    numberOfLines={2}
                    autoCapitalize="sentences"
                    textAlignVertical="top"
                  />

                  <Text style={styles.fieldLabel}>Follow-up date</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.pickerField]}
                    onPress={openFollowUpPickerFn}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={form.followUpDate ? styles.pickerFieldText : styles.pickerFieldPlaceholder}
                    >
                      {form.followUpDate ? formatApptDate(form.followUpDate) : "Select date"}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                  {showFollowUpPicker && Platform.OS === "ios" && (
                    <View style={styles.inlinePicker}>
                      <DateTimePicker
                        value={tempFollowUp}
                        mode="date"
                        display="spinner"
                        textColor="white"
                        onChange={(e, d) => { if (d) setTempFollowUp(d); }}
                        style={{ width: "100%" }}
                      />
                      <TouchableOpacity
                        style={styles.pickerDoneBtn}
                        onPress={() => {
                          setForm((f) => ({ ...f, followUpDate: toDateOnly(tempFollowUp) }));
                          setShowFollowUpPicker(false);
                        }}
                      >
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* Button row */}
              <View style={styles.modalBtnRow}>
                {editingId && (
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => setDeleteConfirmId(editingId)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color="white" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={closeModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, saveDisabled && styles.modalSaveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saveDisabled}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#7C6BAE" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
      </BottomSheet>

      {/* ── Prepare-for-visit sheet ──────────────────────────────────────────── */}
      <BottomSheet visible={!!prepFor} onClose={() => setPrepFor(null)}>
        <View style={styles.lifecycleHeader}>
          <Text style={styles.modalTitle}>Prepare for this visit</Text>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPrepFor(null)} hitSlop={8}>
            <Ionicons name="close" size={15} color="white" />
          </TouchableOpacity>
        </View>
        {!!prepFor && (
          <Text style={styles.lifecycleSubtitle}>
            {prepFor.doctorName}
            {prepFor.specialty ? ` — ${prepFor.specialty}` : ""}
          </Text>
        )}
        <TextInput
          style={[styles.input, styles.inputMultiline, { marginTop: 12 }]}
          value={prepText}
          onChangeText={setPrepText}
          placeholder="Questions to ask, symptoms to mention, refills to request…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
          textAlignVertical="top"
        />
        <View style={styles.lifecycleBtnRow}>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPrepFor(null)} activeOpacity={0.8}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSaveBtn, savingLifecycle && styles.modalSaveBtnDisabled]}
            onPress={savePrep}
            disabled={savingLifecycle}
            activeOpacity={0.85}
          >
            {savingLifecycle ? (
              <ActivityIndicator color="#7C6BAE" size="small" />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── How-did-it-go sheet ──────────────────────────────────────────────── */}
      <BottomSheet visible={!!outcomeFor} onClose={() => setOutcomeFor(null)}>
        <View style={styles.lifecycleHeader}>
          <Text style={styles.modalTitle}>How did it go?</Text>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setOutcomeFor(null)} hitSlop={8}>
            <Ionicons name="close" size={15} color="white" />
          </TouchableOpacity>
        </View>
        {!!outcomeFor && (
          <Text style={styles.lifecycleSubtitle}>
            {outcomeFor.doctorName}
            {outcomeFor.specialty ? ` — ${outcomeFor.specialty}` : ""}
          </Text>
        )}
        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Visit notes</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={outcomeText}
          onChangeText={setOutcomeText}
          placeholder="What was said, decisions, next steps…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
          textAlignVertical="top"
        />
        <Text style={styles.fieldLabel}>Follow-up date (optional)</Text>
        <TouchableOpacity
          style={[styles.input, styles.pickerField]}
          onPress={openOutcomeDatePickerFn}
          activeOpacity={0.8}
        >
          <Text style={outcomeDate ? styles.pickerFieldText : styles.pickerFieldPlaceholder}>
            {outcomeDate ? formatApptDate(outcomeDate) : "Select date"}
          </Text>
          <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
        {showOutcomePicker && Platform.OS === "ios" && (
          <View style={styles.inlinePicker}>
            <DateTimePicker
              value={tempOutcomeDate}
              mode="date"
              display="spinner"
              textColor="white"
              onChange={(e, d) => { if (d) setTempOutcomeDate(d); }}
              style={{ width: "100%" }}
            />
            <TouchableOpacity
              style={styles.pickerDoneBtn}
              onPress={() => {
                setOutcomeDate(toDateOnly(tempOutcomeDate));
                setShowOutcomePicker(false);
              }}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.lifecycleBtnRow}>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setOutcomeFor(null)} activeOpacity={0.8}>
            <Text style={styles.modalCancelText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSaveBtn, savingLifecycle && styles.modalSaveBtnDisabled]}
            onPress={saveOutcome}
            disabled={savingLifecycle}
            activeOpacity={0.85}
          >
            {savingLifecycle ? (
              <ActivityIndicator color="#7C6BAE" size="small" />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Delete confirm modal ──────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={!!deleteConfirmId}
        onRequestClose={() => setDeleteConfirmId(null)}
      >
        <View style={styles.deleteScrim}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Delete appointment?</Text>
            <Text style={styles.deleteBody}>This cannot be undone.</Text>
            <View style={styles.deleteFooter}>
              <TouchableOpacity
                style={styles.keepBtnWhite}
                onPress={() => setDeleteConfirmId(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.keepBtnWhiteText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => handleDelete(deleteConfirmId)}
                activeOpacity={0.85}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 12,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  addBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
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
  dayNumCurrent: { color: "white", fontWeight: "400" },
  dayNumOther: { color: "rgba(255,255,255,0.25)", fontWeight: "400" },
  dayNumSelected: { color: "#7C6BAE", fontWeight: "600" },
  dayNumBold: { fontWeight: "600" },
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

  // Popover
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
  popoverClose: { padding: 4 },
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

  // Labeled Before / After note blocks
  notesBlock: {
    marginTop: 4,
    gap: 1,
  },
  notesLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillCompleted: { backgroundColor: "rgba(140,220,160,0.28)" },
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
    fontFamily: "PlayfairDisplay_500Medium",
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
  emptyAddBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  emptyAddBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },

  // Sections
  section: { gap: 8 },
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
    gap: 8,
  },
  apptCardCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: "#A9D8B4",
  },
  apptCardCancelled: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.2)",
  },
  apptCardFaded: { opacity: 0.6 },
  cardBodyRow: {
    flexDirection: "row",
    gap: 10,
  },
  cardBodyContent: {
    flex: 1,
    gap: 6,
  },
  cardActions: {
    flexShrink: 0,
    gap: 6,
    alignSelf: "flex-start",
    paddingTop: 1,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: {
    backgroundColor: "rgba(255,100,100,0.4)",
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
    backgroundColor: "rgba(140,220,160,0.28)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  completedPillText: {
    fontFamily: "Lato_700Bold",
    fontSize: 10,
    color: "#E9F7EE",
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

  // Prepare + report-to-bring row
  prepRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  prepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  prepBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
  reportShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  reportShortcutText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "underline",
  },

  // Past-due "did this visit happen?"
  happenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  happenText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  happenBtns: {
    flexDirection: "row",
    gap: 8,
  },
  happenYesBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  happenYesText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "white",
  },
  happenNoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  happenNoText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  },

  // Completed: add-notes link + follow-up
  addNotesLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  addNotesLinkText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "underline",
  },
  followUpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  followUpTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  followUpText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    flexShrink: 1,
  },
  scheduleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  scheduleBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "white",
  },

  // Lifecycle sheets (prep / outcome)
  lifecycleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lifecycleSubtitle: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  lifecycleBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  // Cancel inline confirm
  cancelConfirm: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 12,
    gap: 8,
  },
  cancelConfirmText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  cancelConfirmBtns: {
    flexDirection: "row",
    gap: 8,
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  keepBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "white",
  },
  cancelItBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,100,100,0.5)",
  },
  cancelItBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },

  // Add / Edit modal
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 18,
    color: "white",
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  formContent: {
    padding: 20,
    paddingBottom: 8,
  },
  fieldLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "white",
  },
  inputMultiline: {
    minHeight: 66,
    paddingTop: 11,
  },
  pickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerFieldText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "white",
    flex: 1,
  },
  pickerFieldPlaceholder: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    flex: 1,
  },
  inlinePicker: {
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    alignItems: "center",
  },
  pickerDoneBtn: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  pickerDoneText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  segmented: {
    flexDirection: "row",
    gap: 6,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  segmentedBtnActive: {
    backgroundColor: "white",
    borderColor: "white",
  },
  segmentedBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  segmentedBtnTextActive: {
    fontFamily: "Lato_700Bold",
    color: "#7C6BAE",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    marginBottom: 12,
  },
  trashBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,100,100,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  modalCancelText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "white",
  },
  modalSaveBtnDisabled: { opacity: 0.5 },
  modalSaveText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "#7C6BAE",
  },

  // Doctor report card
  reportCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    padding: 16,
    gap: 8,
  },
  reportCardTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },
  reportCardDesc: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginTop: 2,
  },
  reportBtnDisabled: { opacity: 0.6 },
  reportBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "#7C6BAE",
  },
  reportErrorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },

  // Delete confirm modal
  deleteScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  deleteCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    gap: 10,
  },
  deleteTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 18,
    color: "#2D2540",
    textAlign: "center",
  },
  deleteBody: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "#6B5F7A",
    textAlign: "center",
  },
  deleteFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  keepBtnWhite: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#F0EBF8",
  },
  keepBtnWhiteText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "#6B5F7A",
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#B07088",
  },
  deleteConfirmText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
});