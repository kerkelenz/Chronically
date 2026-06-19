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
  Switch,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../../components/ScreenBackground";
import api from "../../lib/api";
import { MedicationTypeIcon } from "../../components/SymptomIcon";
import {
  FREQUENCY_LABELS,
  FREQUENCY_TIME_COUNTS,
  SKIP_REASONS,
  DOSE_STATUS_COLORS,
  formatTime,
  isMedicationDueToday,
} from "../../theme/medications";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  type: "pill",
  dosage: "",
  frequency: "daily",
  frequencyWeeks: 2,
  scheduledTimes: ["08:00"],
  notes: "",
  active: true,
};

const TYPE_OPTIONS = ["pill", "injection", "infusion", "supplement"];
const FREQUENCY_OPTIONS = Object.keys(FREQUENCY_LABELS);

// ── Time helpers ──────────────────────────────────────────────────────────────

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

// ── Dose helpers (from 5a) ────────────────────────────────────────────────────

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
    const times = med.scheduledTimes?.length > 0 ? med.scheduledTimes : [null];

    times.forEach((scheduledTime) => {
      const doseKey = `${med.id}-${scheduledTime || "none"}`;
      const log = todayLogs.find(
        (l) => l.medicationId === med.id && l.scheduledTime === scheduledTime
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

// ── DoseRow (from 5a, unchanged) ──────────────────────────────────────────────

function DoseRow({
  dose,
  skippingDoseKey,
  onTake,
  onSkipOpen,
  onSkipReason,
  onSkipCancel,
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

        <View style={styles.doseActions}>
          {(status === "taken" || status === "skipped") && (
            <View style={styles.doseActionRow}>
              {status === "taken" && (
                <Ionicons name="checkmark-circle" size={18} color="#7FAF8A" style={{ marginRight: 6 }} />
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
          <TouchableOpacity
            style={styles.skipCancelBtn}
            onPress={onSkipCancel}
            activeOpacity={0.75}
          >
            <Text style={styles.skipCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── MedCard (editable) ────────────────────────────────────────────────────────

function MedCard({ med, onEdit, onDeleteRequest }) {
  const subParts = [med.dosage, FREQUENCY_LABELS[med.frequency]].filter(Boolean);
  const timePart =
    med.scheduledTimes?.length > 0
      ? med.scheduledTimes.map(formatTime).join(" · ")
      : null;

  return (
    <View style={styles.medCard}>
      <MedicationTypeIcon type={med.type} size={22} color="rgba(255,255,255,0.9)" />
      <View style={styles.medCardInfo}>
        <Text style={styles.medCardName}>{med.name}</Text>
        <Text style={styles.medCardSub}>
          {[subParts.join(" · "), timePart].filter(Boolean).join(" — ")}
        </Text>
      </View>
      <View style={styles.medCardActions}>
        <TouchableOpacity
          onPress={() => onEdit(med)}
          style={styles.medCardActionBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <Ionicons name="pencil" size={15} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDeleteRequest(med.id)}
          style={styles.medCardActionBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Ionicons name="trash-outline" size={15} color="rgba(255,120,120,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── MedModal ──────────────────────────────────────────────────────────────────

function MedModal({ visible, form, setForm, onSave, onCancel, saving, saveError }) {
  const [showFreqPicker, setShowFreqPicker] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState(null);

  const timeCount = FREQUENCY_TIME_COUNTS[form.frequency] ?? 1;

  function handleFrequencyChange(newFreq) {
    const count = FREQUENCY_TIME_COUNTS[newFreq] ?? 1;
    const current = form.scheduledTimes || [];
    let times;
    if (count === 0) times = [];
    else if (count > current.length)
      times = [...current, ...Array(count - current.length).fill("08:00")];
    else times = current.slice(0, count);
    setForm({ ...form, frequency: newFreq, scheduledTimes: times });
    setShowFreqPicker(false);
    setEditingTimeIndex(null);
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

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.modalScrim}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={styles.modalCard}>
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

            {/* ── Frequency ── */}
            <Text style={styles.fieldLabel}>Frequency</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => {
                setShowFreqPicker((p) => !p);
                setEditingTimeIndex(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.selectFieldText}>
                {FREQUENCY_LABELS[form.frequency]}
              </Text>
              <Ionicons
                name={showFreqPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>

            {showFreqPicker && (
              <View style={styles.freqList}>
                {FREQUENCY_OPTIONS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.freqOption,
                      form.frequency === f && styles.freqOptionActive,
                    ]}
                    onPress={() => handleFrequencyChange(f)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.freqOptionText,
                        form.frequency === f && styles.freqOptionTextActive,
                      ]}
                    >
                      {FREQUENCY_LABELS[f]}
                    </Text>
                    {form.frequency === f && (
                      <Ionicons name="checkmark" size={14} color="#7C6BAE" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Every-X-weeks number ── */}
            {form.frequency === "every_x_weeks" && (
              <>
                <Text style={styles.fieldLabel}>Every how many weeks?</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={String(form.frequencyWeeks)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n))
                      setForm({
                        ...form,
                        frequencyWeeks: Math.min(52, Math.max(1, n)),
                      });
                  }}
                  returnKeyType="done"
                />
              </>
            )}

            {/* ── Scheduled times ── */}
            {timeCount > 0 && (
              <>
                <Text style={styles.fieldLabel}>
                  Scheduled time{timeCount > 1 ? "s" : ""}
                </Text>
                {Array.from({ length: timeCount }).map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.selectField,
                      editingTimeIndex === i && styles.selectFieldActive,
                    ]}
                    onPress={() => {
                      setShowFreqPicker(false);
                      setEditingTimeIndex(editingTimeIndex === i ? null : i);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={[styles.selectFieldText, { marginLeft: 6 }]}>
                      {formatTime(form.scheduledTimes[i] || "08:00")}
                    </Text>
                  </TouchableOpacity>
                ))}

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

            {/* ── Active ── */}
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel} style={styles.switchLabel}>
                Active
              </Text>
              <Switch
                value={form.active}
                onValueChange={(v) => setForm({ ...form, active: v })}
                trackColor={{
                  false: "rgba(255,255,255,0.2)",
                  true: "#7C6BAE",
                }}
                thumbColor="white"
              />
            </View>

            {saveError ? (
              <Text style={styles.saveError}>{saveError}</Text>
            ) : null}

            {/* ── Footer ── */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (!form.name.trim() || saving) && styles.saveBtnDisabled,
                ]}
                onPress={onSave}
                disabled={!form.name.trim() || saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {saving ? "Saving…" : "Save"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const [todayLogs, setTodayLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // dose actions (5a)
  const [skippingDoseKey, setSkippingDoseKey] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);

  // management (5b)
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isFirstLoadRef = useRef(true);
  const today = new Date().toLocaleDateString("en-CA");

  // ── Fetch ─────────────────────────────────────────────────────────────────

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

  // ── Dose actions (5a) ─────────────────────────────────────────────────────

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

  function handleSkipCancel() {
    setSkippingDoseKey(null);
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

  // ── Management actions (5b) ───────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setSaveError("");
    setShowModal(true);
  }

  function openEdit(med) {
    setForm({
      id: med.id,
      name: med.name,
      type: med.type,
      dosage: med.dosage || "",
      frequency: med.frequency,
      frequencyWeeks: med.frequencyWeeks || 2,
      scheduledTimes: med.scheduledTimes || [],
      notes: med.notes || "",
      active: med.active,
    });
    setSaveError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError("");
    const payload = {
      name: form.name.trim(),
      type: form.type,
      dosage: form.dosage.trim() || null,
      frequency: form.frequency,
      frequencyWeeks:
        form.frequency === "every_x_weeks" ? form.frequencyWeeks : null,
      scheduledTimes:
        form.scheduledTimes?.length > 0 ? form.scheduledTimes : null,
      notes: form.notes.trim() || null,
      active: form.active,
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

  async function handleDelete(id) {
    setDeleting(true);
    try {
      await api.delete(`/api/medications/${id}`);
      setMedications((prev) => prev.filter((m) => m.id !== id));
      setTodayLogs((prev) => prev.filter((l) => l.medicationId !== id));
      setDeleteConfirm(null);
    } catch {
      // leave dialog open; user can retry
    } finally {
      setDeleting(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeMeds = medications.filter((m) => m.active);
  const inactiveMeds = medications.filter((m) => !m.active);
  const doses = buildDoses(medications, todayLogs, today);

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

        {/* ── Today's dose timeline ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today</Text>

          {activeMeds.length === 0 ? (
            <Text style={styles.emptyText}>
              No active medications yet. Tap Add to create one.
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
                onSkipCancel={handleSkipCancel}
                onUndo={handleUndo}
                actionLoading={actionLoading}
                actionError={actionError}
              />
            ))
          )}
        </View>

        {/* ── Active medications ───────────────────────────────────────────── */}
        {activeMeds.length > 0 && (
          <>
            <Text style={styles.regimenTitle}>Active</Text>
            {activeMeds.map((med) => (
              <MedCard
                key={med.id}
                med={med}
                onEdit={openEdit}
                onDeleteRequest={setDeleteConfirm}
              />
            ))}
          </>
        )}

        {/* ── Inactive medications ─────────────────────────────────────────── */}
        {inactiveMeds.length > 0 && (
          <>
            <Text style={styles.regimenTitle}>Inactive</Text>
            {inactiveMeds.map((med) => (
              <MedCard
                key={med.id}
                med={med}
                onEdit={openEdit}
                onDeleteRequest={setDeleteConfirm}
              />
            ))}
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
  doseStatusTaken: { color: "#7FAF8A" },
  doseStatusMissed: { color: "#FF6B8A" },
  doseStatusPastDue: { color: "#C4A882" },
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
  skipCancelBtn: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 4 },
  skipCancelText: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)" },

  // ── Med cards (editable) ───────────────────────────────────────────────────

  regimenTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
    color: "white",
    marginBottom: 10,
    marginTop: 4,
  },
  medCard: {
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
  medCardActions: {
    flexDirection: "row",
    gap: 4,
  },
  medCardActionBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  // ── MedModal ───────────────────────────────────────────────────────────────

  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: "rgba(52,38,86,0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
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

  // Frequency selector
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  freqList: {
    backgroundColor: "rgba(30,20,55,0.95)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    marginBottom: 4,
  },
  freqOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  freqOptionActive: {
    backgroundColor: "rgba(124,107,174,0.2)",
  },
  freqOptionText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  freqOptionTextActive: {
    fontFamily: "Lato_700Bold",
    color: "white",
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

  // Switch row
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 4,
  },
  switchLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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
    marginTop: 20,
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
