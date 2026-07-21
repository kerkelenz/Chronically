import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import BottomSheet from "../../components/BottomSheet";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import api from "../../lib/api";
import { track } from "../../lib/analytics";
import { MedicationTypeIcon } from "../../components/SymptomIcon";
import {
  SKIP_REASONS,
  formatTime,
  resolvePattern,
  expectedDosesOn,
  describeSchedule,
  nextDueDate,
} from "../../theme/medications";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  type: "pill",
  dosage: "",
  pattern: "daily", // daily | specific_days | every_n_days | monthly | as_needed
  daysOfWeek: [],
  intervalDays: 2,
  startDate: "", // filled with today when the sheet opens
  scheduledTimes: ["08:00"],
  notes: "",
};

const TYPE_OPTIONS = ["pill", "injection", "infusion", "supplement"];

const PATTERN_OPTIONS = [
  { key: "daily", label: "Every day" },
  { key: "specific_days", label: "Specific days" },
  { key: "every_n_days", label: "Every N days" },
  { key: "monthly", label: "Monthly" },
  { key: "as_needed", label: "As needed" },
];

// display Mon-first; stored ints stay 0=Sun … 6=Sat
const DAY_CHIPS = [
  { d: 1, label: "Mon" },
  { d: 2, label: "Tue" },
  { d: 3, label: "Wed" },
  { d: 4, label: "Thu" },
  { d: 5, label: "Fri" },
  { d: 6, label: "Sat" },
  { d: 0, label: "Sun" },
];

const MAX_TIMES = 4;

// ── Date/time helpers ─────────────────────────────────────────────────────────

function timeStrToDate(timeStr) {
  const d = new Date();
  const [h, m] = (timeStr || "08:00").split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeStr(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function ymdToDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatYmd(ymd) {
  if (!ymd) return "";
  return ymdToDate(ymd).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTakenAt(isoString) {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/** Last n local dates ending at endYmd, oldest → newest. */
function lastNDates(n, endYmd) {
  const end = ymdToDate(endYmd);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (n - 1 - i));
    return d.toLocaleDateString("en-CA");
  });
}

// Today groups: Morning < 12:00 · Afternoon 12:00–16:59 · Evening ≥ 17:00 · null = anytime
function slotGroup(slot) {
  if (!slot) return "anytime";
  const hour = Number(slot.split(":")[0]);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const GROUP_ORDER = [
  { key: "morning", label: "Morning", icon: "sunny-outline" },
  { key: "afternoon", label: "Afternoon", icon: "partly-sunny-outline" },
  { key: "evening", label: "Evening", icon: "moon-outline" },
  { key: "anytime", label: "Anytime today", icon: "time-outline" },
];

/** "Next: today · 8:00 AM" / "Next: tomorrow" / "Next: Friday" / "Next: Aug 12" — null for PRN. */
function nextDoseLabel(med, today) {
  const next = nextDueDate(med, today);
  if (!next) return null;
  const firstTime = (med.scheduledTimes || []).filter(Boolean)[0];
  if (next === today) {
    return firstTime ? `Next: today · ${formatTime(firstTime)}` : "Next: today";
  }
  const diff = Math.round((ymdToDate(next) - ymdToDate(today)) / 86400000);
  if (diff === 1) return "Next: tomorrow";
  if (diff <= 6) return `Next: ${ymdToDate(next).toLocaleDateString("en-US", { weekday: "long" })}`;
  return `Next: ${ymdToDate(next).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// ── Zone 1: dose row ──────────────────────────────────────────────────────────
// Neutral all day: unlogged doses read as grey "not logged" — never red, never
// "missed", no countdowns. Past unlogged doses are a statistics concept only.

function DoseRow({
  dose,
  reasonEditKey,
  onTake,
  onSkip,
  onReasonOpen,
  onReasonPick,
  onReasonCancel,
  onUndo,
  actionLoading,
  actionError,
}) {
  const { med, slot, doseKey, log } = dose;
  const isActing = actionLoading === doseKey;
  const isEditingReason = reasonEditKey === doseKey;

  let statusLine;
  if (log?.status === "taken") {
    statusLine = `Taken at ${formatTakenAt(log.takenAt)}`;
  } else if (log?.status === "skipped") {
    statusLine = log.skipReason ? `Skipped · ${log.skipReason}` : "Skipped";
  } else {
    statusLine = `${slot ? formatTime(slot) : "Anytime"} · not logged`;
  }

  return (
    <View style={styles.doseCard}>
      <View style={styles.doseMain}>
        <View style={styles.doseInfo}>
          <Text style={styles.doseName}>
            {med.name}
            {med.dosage ? ` · ${med.dosage}` : ""}
          </Text>
          <Text style={[styles.doseStatus, log?.status === "taken" && styles.doseStatusTaken]}>
            {statusLine}
          </Text>
          {actionError === doseKey && (
            <Text style={styles.doseError}>Couldn't save, try again</Text>
          )}
        </View>

        <View style={styles.doseActions}>
          {log ? (
            <View style={styles.doseActionRow}>
              {log.status === "taken" ? (
                <Ionicons name="checkmark-circle" size={18} color="#D6F2DF" style={{ marginRight: 6 }} />
              ) : (
                <TouchableOpacity
                  style={styles.skippedChip}
                  onPress={() => onReasonOpen(doseKey)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Skipped — tap to add a reason"
                >
                  <Text style={styles.skippedChipText}>Skipped</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onUndo(log.id, doseKey)}
                disabled={isActing}
                activeOpacity={0.7}
                style={styles.undoBtn}
                accessibilityRole="button"
                accessibilityLabel="Undo"
              >
                {isActing ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                ) : (
                  <Ionicons name="arrow-undo" size={15} color="rgba(255,255,255,0.6)" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
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
                  <Text style={styles.takeBtnText}>Taken ✓</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => onSkip(dose)}
                disabled={isActing}
                activeOpacity={0.8}
              >
                <Text style={styles.skipBtnText}>skip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {isEditingReason && log?.status === "skipped" && (
        <View style={styles.skipReasonWrap}>
          <Text style={styles.skipReasonLabel}>Reason (optional)</Text>
          <View style={styles.skipReasonChips}>
            {SKIP_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.skipReasonChip,
                  log.skipReason === reason && styles.skipReasonChipActive,
                ]}
                onPress={() => onReasonPick(log, reason, doseKey)}
                activeOpacity={0.75}
              >
                <Text style={styles.skipReasonChipText}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.skipCancelBtn}
            onPress={onReasonCancel}
            activeOpacity={0.75}
          >
            <Text style={styles.skipCancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Zone 2: adherence dots ────────────────────────────────────────────────────

function AdherenceDot({ med, day, weekLogs, today }) {
  const isToday = day === today;
  const weekday = ymdToDate(day).toLocaleDateString("en-US", { weekday: "long" });
  const isPrn = resolvePattern(med).kind === "as_needed";
  const dayLogs = weekLogs.filter((l) => l.medicationId === med.id && l.date === day);
  const takenLogs = dayLogs.filter((l) => l.status === "taken").length;

  let expected = 0;
  let pct = 0;
  let label;
  if (isPrn) {
    pct = takenLogs > 0 ? 1 : 0;
    label = `${weekday}: ${
      takenLogs > 0
        ? `${takenLogs} as-needed dose${takenLogs === 1 ? "" : "s"} logged`
        : "no as-needed doses logged"
    }`;
  } else {
    expected = expectedDosesOn(med, day).length;
    if (expected === 0) {
      label = `${weekday}: nothing scheduled`;
    } else {
      const taken = Math.min(takenLogs, expected);
      pct = taken / expected;
      label = `${weekday}: ${taken} of ${expected} dose${expected === 1 ? "" : "s"} taken`;
    }
  }

  const hasSchedule = isPrn ? pct > 0 : expected > 0;
  const borderColor = isToday
    ? "#B7A6D9"
    : hasSchedule
      ? "rgba(255,255,255,0.5)"
      : "rgba(255,255,255,0.18)";
  const fillColor = isToday ? "#B7A6D9" : "rgba(255,255,255,0.85)";

  return (
    <View accessible accessibilityLabel={label} style={[styles.dot, { borderColor }]}>
      {pct > 0 && (
        <View
          style={[styles.dotFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: fillColor }]}
        />
      )}
    </View>
  );
}

// ── Zone 2: cabinet card ──────────────────────────────────────────────────────

function CabinetCard({ med, weekDates, weekLogs, today, onEdit, onSetActive, onDeleteRequest }) {
  const paused = !med.active;
  return (
    <View style={styles.medCard}>
      <View style={styles.medCardTop}>
        <MedicationTypeIcon type={med.type} size={18} color="rgba(255,255,255,0.75)" />
        <View style={styles.medCardInfo}>
          <Text style={styles.medCardName}>
            {med.name}
            {med.dosage ? ` · ${med.dosage}` : ""}
          </Text>
          <Text style={styles.medCardSub}>{describeSchedule(med)}</Text>
          {!paused && nextDoseLabel(med, today) && (
            <Text style={styles.nextDoseLine}>{nextDoseLabel(med, today)}</Text>
          )}
        </View>
        <View style={styles.medCardActions}>
          <TouchableOpacity
            onPress={() => onEdit(med)}
            style={styles.medCardActionBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${med.name}`}
          >
            <Ionicons name="pencil" size={15} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSetActive(med, paused)}
            style={styles.medCardActionBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={paused ? `Resume ${med.name}` : `Pause ${med.name}`}
          >
            <Ionicons
              name={paused ? "play" : "pause"}
              size={15}
              color="rgba(255,255,255,0.55)"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDeleteRequest(med.id)}
            style={styles.medCardActionBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${med.name}`}
          >
            <Ionicons name="trash-outline" size={15} color="rgba(255,120,120,0.65)" />
          </TouchableOpacity>
        </View>
      </View>
      {!paused && (
        <View style={styles.dotsRow} accessibilityLabel="Last 7 days">
          {weekDates.map((day) => (
            <AdherenceDot key={day} med={med} day={day} weekLogs={weekLogs} today={today} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Add/edit sheet — five patterns ────────────────────────────────────────────

function MedModal({ visible, form, setForm, onSave, onCancel, saving, saveError }) {
  const [editingTimeIndex, setEditingTimeIndex] = useState(null);
  const [editingStartDate, setEditingStartDate] = useState(false);

  const showTimes = form.pattern !== "as_needed";
  const showStartDate = form.pattern === "every_n_days" || form.pattern === "monthly";
  const needsDays = form.pattern === "specific_days" && form.daysOfWeek.length === 0;
  const canSave = form.name.trim() && !needsDays && !saving;

  function handlePatternChange(key) {
    let times = form.scheduledTimes;
    if (key === "as_needed") times = [];
    else if (times.length === 0) times = ["08:00"];
    setForm({ ...form, pattern: key, scheduledTimes: times });
    setEditingTimeIndex(null);
    setEditingStartDate(false);
  }

  function toggleDay(d) {
    const days = form.daysOfWeek.includes(d)
      ? form.daysOfWeek.filter((x) => x !== d)
      : [...form.daysOfWeek, d];
    setForm({ ...form, daysOfWeek: days });
  }

  function handleTimeChange(event, date) {
    if (Platform.OS === "android") {
      setEditingTimeIndex(null);
      if (event.type === "dismissed" || !date) return;
      const newTimes = [...form.scheduledTimes];
      newTimes[editingTimeIndex] = dateToTimeStr(date);
      setForm({ ...form, scheduledTimes: newTimes });
    } else {
      if (!date) return;
      const newTimes = [...form.scheduledTimes];
      newTimes[editingTimeIndex] = dateToTimeStr(date);
      setForm({ ...form, scheduledTimes: newTimes });
    }
  }

  function handleStartDateChange(event, date) {
    if (Platform.OS === "android") {
      setEditingStartDate(false);
      if (event.type === "dismissed" || !date) return;
      setForm({ ...form, startDate: date.toLocaleDateString("en-CA") });
    } else {
      if (!date) return;
      setForm({ ...form, startDate: date.toLocaleDateString("en-CA") });
    }
  }

  function addTime() {
    if (form.scheduledTimes.length >= MAX_TIMES) return;
    setForm({ ...form, scheduledTimes: [...form.scheduledTimes, "08:00"] });
  }

  function removeTime(i) {
    const newTimes = form.scheduledTimes.filter((_, idx) => idx !== i);
    setForm({ ...form, scheduledTimes: newTimes });
    setEditingTimeIndex(null);
  }

  return (
    <BottomSheet visible={visible} onClose={onCancel} cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {form.id ? "Edit Medication" : "Add Medication"}
            </Text>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Name ── */}
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Baclofen"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              returnKeyType="done"
            />

            {/* ── Type ── */}
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    form.type === t && styles.typeBtnActive,
                  ]}
                  onPress={() => setForm({ ...form, type: t })}
                  activeOpacity={0.8}
                >
                  <MedicationTypeIcon type={t} size={18} color={form.type === t ? "white" : "rgba(255,255,255,0.7)"} />
                  <Text
                    style={[
                      styles.typeBtnLabel,
                      form.type === t && styles.typeBtnLabelActive,
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Dosage ── */}
            <Text style={styles.fieldLabel}>Dosage (optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 20mg"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={form.dosage}
              onChangeText={(v) => setForm({ ...form, dosage: v })}
              returnKeyType="done"
            />

            {/* ── Schedule pattern ── */}
            <Text style={styles.fieldLabel}>Schedule</Text>
            <View style={styles.patternRow}>
              {PATTERN_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.patternChip,
                    form.pattern === p.key && styles.patternChipActive,
                  ]}
                  onPress={() => handlePatternChange(p.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.patternChipText,
                      form.pattern === p.key && styles.patternChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Specific days ── */}
            {form.pattern === "specific_days" && (
              <>
                <Text style={styles.fieldLabel}>Which days?</Text>
                <View style={styles.dayRow}>
                  {DAY_CHIPS.map(({ d, label }) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.dayChip,
                        form.daysOfWeek.includes(d) && styles.dayChipActive,
                      ]}
                      onPress={() => toggleDay(d)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          form.daysOfWeek.includes(d) && styles.dayChipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {needsDays && (
                  <Text style={styles.fieldHint}>Pick at least one day.</Text>
                )}
              </>
            )}

            {/* ── Every N days ── */}
            {form.pattern === "every_n_days" && (
              <>
                <Text style={styles.fieldLabel}>Every how many days?</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={String(form.intervalDays)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n))
                      setForm({
                        ...form,
                        intervalDays: Math.min(90, Math.max(1, n)),
                      });
                  }}
                  returnKeyType="done"
                />
              </>
            )}

            {/* ── Start date (every N days + monthly) ── */}
            {showStartDate && (
              <>
                <Text style={styles.fieldLabel}>
                  {form.pattern === "monthly" ? "Starts on (sets the day of the month)" : "Starting from"}
                </Text>
                <TouchableOpacity
                  style={[styles.selectField, editingStartDate && styles.selectFieldActive]}
                  onPress={() => {
                    setEditingTimeIndex(null);
                    setEditingStartDate((p) => !p);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.5)" />
                  <Text style={[styles.selectFieldText, { marginLeft: 6, flex: 1 }]}>
                    {formatYmd(form.startDate)}
                  </Text>
                </TouchableOpacity>
                {editingStartDate && (
                  <View style={styles.timePickerWrap}>
                    <DateTimePicker
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      value={form.startDate ? ymdToDate(form.startDate) : new Date()}
                      onChange={handleStartDateChange}
                      themeVariant="dark"
                    />
                    {Platform.OS === "ios" && (
                      <TouchableOpacity
                        style={styles.timePickerDoneBtn}
                        onPress={() => setEditingStartDate(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.timePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}

            {/* ── Times ── */}
            {showTimes && (
              <>
                <Text style={styles.fieldLabel}>
                  Time{form.scheduledTimes.length === 1 ? "" : "s"} (optional — leave empty for anytime)
                </Text>
                {form.scheduledTimes.map((t, i) => (
                  <View key={i} style={styles.timeRow}>
                    <TouchableOpacity
                      style={[
                        styles.selectField,
                        { flex: 1, marginBottom: 0 },
                        editingTimeIndex === i && styles.selectFieldActive,
                      ]}
                      onPress={() => {
                        setEditingStartDate(false);
                        setEditingTimeIndex(editingTimeIndex === i ? null : i);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="time-outline"
                        size={15}
                        color="rgba(255,255,255,0.5)"
                      />
                      <Text style={[styles.selectFieldText, { marginLeft: 6, flex: 1 }]}>
                        {formatTime(t || "08:00")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.timeRemoveBtn}
                      onPress={() => removeTime(i)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${formatTime(t || "08:00")}`}
                    >
                      <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </View>
                ))}

                {form.scheduledTimes.length < MAX_TIMES && (
                  <TouchableOpacity
                    style={styles.addTimeBtn}
                    onPress={addTime}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add" size={14} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.addTimeBtnText}>Add time</Text>
                  </TouchableOpacity>
                )}

                {/* Time picker — inline, only shown when a slot is being edited */}
                {editingTimeIndex !== null && (
                  <View style={styles.timePickerWrap}>
                    <DateTimePicker
                      mode="time"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      value={timeStrToDate(
                        form.scheduledTimes[editingTimeIndex] || "08:00"
                      )}
                      onChange={handleTimeChange}
                      themeVariant="dark"
                    />
                    {Platform.OS === "ios" && (
                      <TouchableOpacity
                        style={styles.timePickerDoneBtn}
                        onPress={() => setEditingTimeIndex(null)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.timePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}

            {/* ── Notes ── */}
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMulti]}
              placeholder="Any notes about this medication…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          {saveError ? (
            <Text style={[styles.saveError, { paddingHorizontal: 20 }]}>
              {saveError}
            </Text>
          ) : null}

          {/* ── Footer (pinned) ── */}
          <View style={[styles.modalFooter, { paddingBottom: 12 }]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={onSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
    </BottomSheet>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({ visible, onCancel, onConfirm, deleting }) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.deleteScrim}>
        <View style={styles.deleteCard}>
          <Text style={styles.deleteTitle}>Delete this medication?</Text>
          <Text style={styles.deleteBody}>
            All associated logs will also be deleted. This cannot be undone.
          </Text>
          <View style={styles.deleteFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteConfirmBtn, deleting && styles.saveBtnDisabled]}
              onPress={onConfirm}
              disabled={deleting}
              activeOpacity={0.85}
            >
              {deleting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.deleteConfirmText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── MedicationsScreen ─────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const [medications, setMedications] = useState([]);
  const [weekLogs, setWeekLogs] = useState([]); // last 7 days incl. today
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // dose actions
  const [reasonEditKey, setReasonEditKey] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);

  // cabinet collapse (session state only)
  const [cabinetOpen, setCabinetOpen] = useState(false);

  // add/edit/delete
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isFirstLoadRef = useRef(true);
  const today = new Date().toLocaleDateString("en-CA");
  const weekDates = lastNDates(7, today);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // One range call covers both zones: today's checklist reads the today slice,
  // the cabinet dots read the whole week.

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const [medsRes, logsRes] = await Promise.all([
            api.get("/api/medications"),
            api.get(`/api/medications/logs?startDate=${weekDates[0]}&endDate=${today}`),
          ]);
          if (!active) return;
          setMedications(medsRes.data.medications || []);
          setWeekLogs(logsRes.data.logs || []);
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
        api.get(`/api/medications/logs?startDate=${weekDates[0]}&endDate=${today}`),
      ]);
      setMedications(medsRes.data.medications || []);
      setWeekLogs(logsRes.data.logs || []);
      setError(null);
    } catch {
      setError("Could not load medications. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Dose actions ──────────────────────────────────────────────────────────

  async function handleTake(dose) {
    const { med, slot, doseKey } = dose;
    setActionLoading(doseKey);
    setActionError(null);
    try {
      const res = await api.post("/api/medications/logs", {
        medicationId: med.id,
        date: today,
        scheduledTime: slot,
        takenAt: new Date().toISOString(),
        status: "taken",
      });
      track("medication_logged", { status: "taken" });
      setWeekLogs((prev) => [...prev, res.data.log]);
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  // skip logs immediately, no reason required — the Skipped chip offers one after
  async function handleSkip(dose) {
    const { med, slot, doseKey } = dose;
    setActionLoading(doseKey);
    setActionError(null);
    try {
      const res = await api.post("/api/medications/logs", {
        medicationId: med.id,
        date: today,
        scheduledTime: slot,
        status: "skipped",
      });
      track("medication_logged", { status: "skipped" });
      setWeekLogs((prev) => [...prev, res.data.log]);
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReasonPick(log, reason, doseKey) {
    setActionLoading(doseKey);
    setActionError(null);
    try {
      const res = await api.put(`/api/medications/logs/${log.id}`, {
        skipReason: reason,
      });
      setWeekLogs((prev) =>
        prev.map((l) => (l.id === log.id ? res.data.log : l))
      );
      setReasonEditKey(null);
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePrnLog(med) {
    const doseKey = `prn-${med.id}`;
    setActionLoading(doseKey);
    setActionError(null);
    try {
      const res = await api.post("/api/medications/logs", {
        medicationId: med.id,
        date: today,
        scheduledTime: null,
        takenAt: new Date().toISOString(),
        status: "taken",
      });
      track("medication_logged", { status: "taken" });
      setWeekLogs((prev) => [...prev, res.data.log]);
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
      setWeekLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      setActionError(doseKey);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Cabinet actions ───────────────────────────────────────────────────────

  function openAdd() {
    setForm({ ...EMPTY_FORM, startDate: today });
    setSaveError("");
    setShowModal(true);
  }

  function openEdit(med) {
    const p = resolvePattern(med);
    const pattern = ["daily", "specific_days", "every_n_days", "monthly", "as_needed"].includes(p.kind)
      ? p.kind
      : "daily";
    const anchorYmd =
      med.startDate || new Date(med.createdAt).toLocaleDateString("en-CA");
    setForm({
      id: med.id,
      name: med.name,
      type: med.type,
      dosage: med.dosage || "",
      pattern,
      daysOfWeek: p.kind === "specific_days" ? p.days : [],
      intervalDays: p.kind === "every_n_days" ? p.n : 2,
      startDate: anchorYmd,
      scheduledTimes: med.scheduledTimes || [],
      notes: med.notes || "",
    });
    setSaveError("");
    setShowModal(true);
  }

  // saving always writes the canonical shape — the legacy enums are never written again
  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError("");
    const times = form.pattern === "as_needed" ? [] : form.scheduledTimes.filter(Boolean);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      dosage: form.dosage.trim() || null,
      frequency: form.pattern,
      frequencyWeeks: null,
      scheduledTimes: form.pattern === "as_needed" ? [] : times.length > 0 ? times : null,
      daysOfWeek: form.pattern === "specific_days" ? form.daysOfWeek : null,
      intervalDays: form.pattern === "every_n_days" ? form.intervalDays : null,
      startDate:
        form.pattern === "every_n_days" || form.pattern === "monthly"
          ? form.startDate || today
          : null,
      notes: form.notes.trim() || null,
    };
    try {
      if (form.id) {
        const res = await api.put(`/api/medications/${form.id}`, payload);
        setMedications((prev) =>
          prev.map((m) => (m.id === form.id ? res.data.medication : m))
        );
      } else {
        const res = await api.post("/api/medications", payload);
        setMedications((prev) => [...prev, res.data.medication]);
      }
      setShowModal(false);
    } catch {
      setSaveError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(med, nextActive) {
    try {
      const res = await api.put(`/api/medications/${med.id}`, { active: nextActive });
      setMedications((prev) =>
        prev.map((m) => (m.id === med.id ? res.data.medication : m))
      );
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    try {
      await api.delete(`/api/medications/${id}`);
      setMedications((prev) => prev.filter((m) => m.id !== id));
      setWeekLogs((prev) => prev.filter((l) => l.medicationId !== id));
      setDeleteConfirm(null);
    } catch {
      // leave dialog open; user can retry
    } finally {
      setDeleting(false);
    }
  }

  // ── Derived: today's checklist + cabinet groups ───────────────────────────

  const todayLogs = weekLogs.filter((l) => l.date === today);
  const activeMeds = medications.filter((m) => m.active);
  const pausedMeds = medications.filter((m) => !m.active);
  const prnMeds = activeMeds.filter((m) => resolvePattern(m).kind === "as_needed");
  const scheduledMeds = activeMeds.filter((m) => resolvePattern(m).kind !== "as_needed");

  const doses = [];
  scheduledMeds.forEach((med) => {
    expectedDosesOn(med, today).forEach((slot) => {
      const doseKey = `${med.id}-${slot || "anytime"}`;
      const log = todayLogs.find(
        (l) => l.medicationId === med.id && l.scheduledTime === slot
      );
      doses.push({ med, slot, doseKey, log, group: slotGroup(slot) });
    });
  });
  doses.sort((a, b) => (a.slot || "99:99").localeCompare(b.slot || "99:99"));

  const groups = GROUP_ORDER.map((g) => ({
    ...g,
    doses: doses.filter((d) => d.group === g.key),
  })).filter((g) => g.doses.length > 0);

  // today progress: expected scheduled slots (PRN excluded) vs those logged
  const todayExpected = doses.length;
  const todayLogged = doses.filter((d) => d.log).length;
  const allLogged = todayExpected > 0 && todayLogged === todayExpected;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenBackground edges={["top", "left", "right"]}>
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
        {/* Page header + Add button */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Medications</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openAdd}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={15} color="white" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Zone 1: Today ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today</Text>

          {activeMeds.length === 0 ? (
            <Text style={styles.emptyText}>
              No active medications yet. Tap Add to create one.
            </Text>
          ) : doses.length === 0 ? (
            <Text style={styles.emptyText}>
              Nothing scheduled today — your as-needed medications are below.
            </Text>
          ) : (
            <>
              {/* Today progress — states a fact, nothing more */}
              <View style={styles.progressWrap}>
                <Text style={styles.progressText}>
                  {todayLogged} of {todayExpected} doses logged
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round((todayLogged / todayExpected) * 100)}%` },
                    ]}
                  />
                </View>
              </View>

              {allLogged && (
                <Text style={styles.allDoneText}>All logged for today 💜</Text>
              )}
              {groups.map((g) => (
                <View key={g.key}>
                  <View style={styles.groupTitleRow}>
                    <Ionicons name={g.icon} size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={[styles.groupTitle, { marginTop: 0, marginBottom: 0 }]}>
                      {g.label}
                    </Text>
                  </View>
                  {g.doses.map((dose) => (
                    <DoseRow
                      key={dose.doseKey}
                      dose={dose}
                      reasonEditKey={reasonEditKey}
                      onTake={handleTake}
                      onSkip={handleSkip}
                      onReasonOpen={setReasonEditKey}
                      onReasonPick={handleReasonPick}
                      onReasonCancel={() => setReasonEditKey(null)}
                      onUndo={handleUndo}
                      actionLoading={actionLoading}
                      actionError={actionError}
                    />
                  ))}
                </View>
              ))}
            </>
          )}

          {/* As-needed lane */}
          {prnMeds.length > 0 && (
            <>
              <Text style={styles.groupTitle}>As needed</Text>
              {prnMeds.map((med) => {
                const prnKey = `prn-${med.id}`;
                const logs = todayLogs.filter((l) => l.medicationId === med.id);
                return (
                  <View key={med.id} style={styles.doseCard}>
                    <View style={styles.doseMain}>
                      <View style={styles.doseInfo}>
                        <Text style={styles.doseName}>
                          {med.name}
                          {med.dosage ? ` · ${med.dosage}` : ""}
                        </Text>
                        {logs.length === 0 && (
                          <Text style={styles.doseStatus}>No doses logged today</Text>
                        )}
                        {actionError === prnKey && (
                          <Text style={styles.doseError}>Couldn't save, try again</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.takeBtn, actionLoading === prnKey && styles.btnDisabled]}
                        onPress={() => handlePrnLog(med)}
                        disabled={actionLoading === prnKey}
                        activeOpacity={0.8}
                      >
                        {actionLoading === prnKey ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.takeBtnText}>Log a dose</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    {logs.map((l) => (
                      <View key={l.id} style={styles.prnLogRow}>
                        <Text style={styles.prnLogText}>
                          Taken at {formatTakenAt(l.takenAt)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleUndo(l.id, `log-${l.id}`)}
                          disabled={actionLoading === `log-${l.id}`}
                          activeOpacity={0.7}
                          style={styles.undoBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Undo this dose"
                        >
                          {actionLoading === `log-${l.id}` ? (
                            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                          ) : (
                            <Ionicons name="arrow-undo" size={15} color="rgba(255,255,255,0.6)" />
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* ── Zone 2: Medicine cabinet (collapsed by default) ───────────────── */}
        {medications.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.cabinetHeader}
              onPress={() => setCabinetOpen((o) => !o)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: cabinetOpen }}
              accessibilityLabel={`Medicine cabinet, ${activeMeds.length} active medication${activeMeds.length === 1 ? "" : "s"}`}
            >
              <Text style={styles.regimenTitle}>
                Medicine cabinet ({activeMeds.length})
              </Text>
              <Ionicons
                name={cabinetOpen ? "chevron-down" : "chevron-forward"}
                size={18}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>

            {cabinetOpen && (
              <>
                {activeMeds.map((med) => (
                  <CabinetCard
                    key={med.id}
                    med={med}
                    weekDates={weekDates}
                    weekLogs={weekLogs}
                    today={today}
                    onEdit={openEdit}
                    onSetActive={handleSetActive}
                    onDeleteRequest={setDeleteConfirm}
                  />
                ))}

                {pausedMeds.length > 0 && (
                  <>
                    <Text style={styles.pausedTitle}>Paused</Text>
                    {pausedMeds.map((med) => (
                      <CabinetCard
                        key={med.id}
                        med={med}
                        weekDates={weekDates}
                        weekLogs={weekLogs}
                        today={today}
                        onEdit={openEdit}
                        onSetActive={handleSetActive}
                        onDeleteRequest={setDeleteConfirm}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <MedModal
        visible={showModal}
        form={form}
        setForm={setForm}
        onSave={handleSave}
        onCancel={() => setShowModal(false)}
        saving={saving}
        saveError={saveError}
      />

      <DeleteModal
        visible={!!deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm)}
        deleting={deleting}
      />
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

  // Header
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: {
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

  // Cards / errors
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
  groupTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 8,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },

  // Today progress
  progressWrap: {
    gap: 6,
    marginBottom: 4,
  },
  progressText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#C4A8C0",
  },
  allDoneText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: 2,
  },
  emptyText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 21,
    textAlign: "center",
    paddingVertical: 8,
  },

  // ── Dose rows (neutral — no status colors on pending doses) ────────────────

  doseCard: {
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    paddingHorizontal: 12,
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
  doseStatusTaken: { color: "#D6F2DF" },
  doseError: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,180,180,0.8)",
    marginTop: 3,
  },
  doseActions: { alignItems: "flex-end" },
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
  btnDisabled: { opacity: 0.55 },
  takeBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  skipBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },
  skippedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  skippedChipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  undoBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // PRN lane
  prnLogRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  prnLogText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "#D6F2DF",
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
  skipReasonChipActive: {
    backgroundColor: "#7C6BAE",
    borderColor: "#7C6BAE",
  },
  skipReasonChipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "white",
  },
  skipCancelBtn: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 4 },
  skipCancelText: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)" },

  // ── Cabinet cards ──────────────────────────────────────────────────────────

  regimenTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
    color: "white",
  },
  cabinetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  pausedTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 17,
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
    marginBottom: 10,
  },
  medCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    gap: 10,
  },
  medCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  medCardInfo: { flex: 1 },
  medCardName: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
    marginBottom: 2,
  },
  medCardSub: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  nextDoseLine: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  medCardActions: {
    flexDirection: "row",
    gap: 4,
  },
  medCardActionBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 30, // aligns dots under the text column, past the type icon
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    overflow: "hidden",
    flexDirection: "row",
  },
  dotFill: {
    height: "100%",
  },

  // ── MedModal ───────────────────────────────────────────────────────────────

  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 22,
    color: "white",
  },
  modalBody: {
    padding: 20,
    gap: 4,
    paddingBottom: 32,
  },
  fieldLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 14,
  },
  fieldHint: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  textInputMulti: {
    minHeight: 72,
    paddingTop: 12,
  },

  // Type selector
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    gap: 4,
  },
  typeBtnActive: {
    backgroundColor: "#7C6BAE",
    borderColor: "#7C6BAE",
  },
  typeBtnLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
  },
  typeBtnLabelActive: {
    color: "white",
    fontFamily: "Lato_700Bold",
  },

  // Pattern picker
  patternRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  patternChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  patternChipActive: {
    backgroundColor: "#7C6BAE",
    borderColor: "#7C6BAE",
  },
  patternChipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  patternChipTextActive: {
    fontFamily: "Lato_700Bold",
    color: "white",
  },

  // Day-of-week chips
  dayRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  dayChipActive: {
    backgroundColor: "#7C6BAE",
    borderColor: "#7C6BAE",
  },
  dayChipText: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  dayChipTextActive: {
    fontFamily: "Lato_700Bold",
    color: "white",
  },

  // Select fields / pickers
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  selectFieldActive: {
    borderColor: "rgba(124,107,174,0.7)",
  },
  selectFieldText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  timeRemoveBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  addTimeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderStyle: "dashed",
    marginBottom: 4,
  },
  addTimeBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },

  // Time picker
  timePickerWrap: {
    backgroundColor: "rgba(30,20,55,0.8)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 4,
  },
  timePickerDoneBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  timePickerDoneText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "#7C6BAE",
  },

  saveError: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,180,180,0.9)",
    textAlign: "center",
    marginTop: 8,
  },

  // Shared footer buttons
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  cancelBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#7C6BAE",
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },

  // ── DeleteModal ────────────────────────────────────────────────────────────

  deleteScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  deleteCard: {
    backgroundColor: "rgba(52,38,86,0.98)",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    gap: 12,
  },
  deleteTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
    color: "white",
    textAlign: "center",
  },
  deleteBody: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 21,
  },
  deleteFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#B07088",
  },
  deleteConfirmText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },
});
