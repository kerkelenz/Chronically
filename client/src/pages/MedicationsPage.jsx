import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { track } from "../lib/analytics";
import {
  FiEdit2, FiTrash2, FiRotateCcw, FiPlus, FiPause, FiPlay, FiX,
  FiSunrise, FiSun, FiMoon, FiClock, FiChevronDown, FiChevronRight,
} from "react-icons/fi";
import Navigation, { NavHamburger } from "../components/Navigation";
import {
  formatTime,
  resolvePattern,
  expectedDosesOn,
  describeSchedule,
  nextDueDate,
} from "../utils/medicationHelpers";
import { MedicationTypeIcon } from "../components/SymptomIcon";

const EMPTY_FORM = {
  name: "",
  type: "pill",
  dosage: "",
  pattern: "daily", // daily | specific_days | every_n_days | monthly | as_needed
  daysOfWeek: [],
  intervalDays: 2,
  startDate: "", // filled with today when the modal opens
  scheduledTimes: ["08:00"],
  notes: "",
};

const SKIP_REASONS = [
  "Forgot",
  "Felt sick / threw up",
  "Side effects",
  "Ran out",
  "Doctor advised",
  "Already took it",
  "Too painful to take",
];

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

// ── Date helpers ──────────────────────────────────────────────────────────────

function ymdToDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTakenAt(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  { key: "morning", label: "Morning", Icon: FiSunrise },
  { key: "afternoon", label: "Afternoon", Icon: FiSun },
  { key: "evening", label: "Evening", Icon: FiMoon },
  { key: "anytime", label: "Anytime today", Icon: FiClock },
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
    <div
      role="img"
      aria-label={label}
      title={label}
      className="overflow-hidden flex"
      style={{
        width: "12px",
        height: "12px",
        borderRadius: "6px",
        border: `1.5px solid ${borderColor}`,
      }}
    >
      {pct > 0 && (
        <div style={{ width: `${Math.round(pct * 100)}%`, height: "100%", background: fillColor }} />
      )}
    </div>
  );
}

// ── Zone 2: cabinet card ──────────────────────────────────────────────────────

function CabinetCard({ med, weekDates, weekLogs, today, onEdit, onSetActive, onDelete }) {
  const paused = !med.active;
  return (
    <div
      className="p-4 rounded-2xl flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.3)",
        opacity: paused ? 0.7 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <MedicationTypeIcon
            type={med.type}
            size={18}
            style={{ marginTop: "2px", color: "rgba(255,255,255,0.75)" }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm" style={{ color: "white" }}>
              {med.name}
              {med.dosage && (
                <span className="font-normal ml-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {med.dosage}
                </span>
              )}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              {describeSchedule(med)}
            </p>
            {!paused && nextDoseLabel(med, today) && (
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                {nextDoseLabel(med, today)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={() => onEdit(med)}
            aria-label={`Edit ${med.name}`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            <FiEdit2 size={12} color="white" />
          </button>
          <button
            onClick={() => onSetActive(med, paused)}
            aria-label={paused ? `Resume ${med.name}` : `Pause ${med.name}`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            {paused ? <FiPlay size={12} color="white" /> : <FiPause size={12} color="white" />}
          </button>
          <button
            onClick={() => onDelete(med.id)}
            aria-label={`Remove ${med.name}`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
            style={{ background: "rgba(255,100,100,0.4)" }}
          >
            <FiTrash2 size={12} color="white" />
          </button>
        </div>
      </div>
      {!paused && (
        <div className="flex gap-2" style={{ paddingLeft: "26px" }} aria-label="Last 7 days">
          {weekDates.map((day) => (
            <AdherenceDot key={day} med={med} day={day} weekLogs={weekLogs} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add/edit modal — five patterns ────────────────────────────────────────────

function MedModal({ form, setForm, onSave, onClose, saving }) {
  const showTimes = form.pattern !== "as_needed";
  const showStartDate = form.pattern === "every_n_days" || form.pattern === "monthly";
  const needsDays = form.pattern === "specific_days" && form.daysOfWeek.length === 0;
  const canSave = form.name.trim() && !needsDays && !saving;

  const handlePatternChange = (key) => {
    let times = form.scheduledTimes;
    if (key === "as_needed") times = [];
    else if (times.length === 0) times = ["08:00"];
    setForm({ ...form, pattern: key, scheduledTimes: times });
  };

  const toggleDay = (d) => {
    const days = form.daysOfWeek.includes(d)
      ? form.daysOfWeek.filter((x) => x !== d)
      : [...form.daysOfWeek, d];
    setForm({ ...form, daysOfWeek: days });
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "white",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm mx-4 p-6 rounded-2xl flex flex-col gap-4 overflow-y-auto"
        style={{
          background: "rgba(255,255,255,0.2)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.3)",
          maxHeight: "90vh",
        }}
      >
        <p
          className="font-medium"
          style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}
        >
          {form.id ? "Edit Medication" : "Add Medication"}
        </p>

        {/* Name */}
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Name</p>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
            placeholder="e.g. Baclofen"
          />
        </div>

        {/* Type */}
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Type</p>
          <div className="flex gap-2">
            {[
              { value: "pill",       label: "Pill" },
              { value: "injection",  label: "Injection" },
              { value: "infusion",   label: "Infusion" },
              { value: "supplement", label: "Supplement" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setForm({ ...form, type: value })}
                className="flex-1 py-2 rounded-xl text-[10px] font-medium leading-tight transition-all duration-200 flex flex-col items-center gap-0.5"
                style={{
                  background: form.type === value ? "#7C6BAE" : "rgba(255,255,255,0.15)",
                  color: "white",
                }}
              >
                <MedicationTypeIcon type={value} size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dosage */}
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Dosage (optional)</p>
          <input
            type="text"
            value={form.dosage}
            onChange={(e) => setForm({ ...form, dosage: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
            placeholder="e.g. 20mg"
          />
        </div>

        {/* Schedule pattern */}
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Schedule</p>
          <div className="flex flex-wrap gap-1.5">
            {PATTERN_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => handlePatternChange(p.key)}
                className="px-3 py-1.5 rounded-full text-xs transition-all duration-200"
                style={{
                  background: form.pattern === p.key ? "#7C6BAE" : "rgba(255,255,255,0.15)",
                  color: "white",
                  fontWeight: form.pattern === p.key ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Specific days */}
        {form.pattern === "specific_days" && (
          <div>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Which days?</p>
            <div className="flex gap-1">
              {DAY_CHIPS.map(({ d, label }) => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] transition-all duration-200"
                  style={{
                    background: form.daysOfWeek.includes(d) ? "#7C6BAE" : "rgba(255,255,255,0.15)",
                    color: "white",
                    fontWeight: form.daysOfWeek.includes(d) ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {needsDays && (
              <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                Pick at least one day.
              </p>
            )}
          </div>
        )}

        {/* Every N days */}
        {form.pattern === "every_n_days" && (
          <div>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Every how many days?</p>
            <input
              type="number"
              min={1}
              max={90}
              value={form.intervalDays}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setForm({ ...form, intervalDays: Math.min(90, Math.max(1, n)) });
              }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>
        )}

        {/* Start date (every N days + monthly) */}
        {showStartDate && (
          <div>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
              {form.pattern === "monthly" ? "Starts on (sets the day of the month)" : "Starting from"}
            </p>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>
        )}

        {/* Times — free-form 1–4, empty = anytime */}
        {showTimes && (
          <div>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
              Time{form.scheduledTimes.length === 1 ? "" : "s"} (optional — leave empty for anytime)
            </p>
            <div className="flex flex-col gap-2">
              {form.scheduledTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={t || "08:00"}
                    onChange={(e) => {
                      const times = [...form.scheduledTimes];
                      times[i] = e.target.value;
                      setForm({ ...form, scheduledTimes: times });
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                  <button
                    onClick={() =>
                      setForm({
                        ...form,
                        scheduledTimes: form.scheduledTimes.filter((_, idx) => idx !== i),
                      })
                    }
                    aria-label={`Remove ${formatTime(t || "08:00")}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                  >
                    <FiX size={12} color="white" />
                  </button>
                </div>
              ))}
              {form.scheduledTimes.length < MAX_TIMES && (
                <button
                  onClick={() =>
                    setForm({ ...form, scheduledTimes: [...form.scheduledTimes, "08:00"] })
                  }
                  className="py-2 rounded-lg text-xs transition-all duration-200 hover:opacity-80"
                  style={{
                    border: "1px dashed rgba(255,255,255,0.3)",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  + Add time
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Notes (optional)</p>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={inputStyle}
            placeholder="Any notes…"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-full text-sm"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="flex-1 py-2 rounded-full text-sm text-white transition-all duration-200"
            style={{ background: "#7C6BAE", opacity: canSave ? 1 : 0.6 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MedicationsPage ───────────────────────────────────────────────────────────

function MedicationsPage() {
  const { token } = useAuth();
  const [medications, setMedications] = useState([]);
  const [weekLogs, setWeekLogs] = useState([]); // last 7 days incl. today
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reasonEditKey, setReasonEditKey] = useState(null);
  const [actionError, setActionError] = useState(null);
  // cabinet collapse (session state only)
  const [cabinetOpen, setCabinetOpen] = useState(false);

  const hdrs = { Authorization: `Bearer ${token}` };
  const today = new Date().toLocaleDateString("en-CA");
  const weekDates = lastNDates(7, today);

  // One range call covers both zones: today's checklist reads the today slice,
  // the cabinet dots read the whole week.
  useEffect(() => {
    const fetchMedications = async () => {
      try {
        const [medsRes, logsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications`, { headers: hdrs }),
          axios.get(
            `${import.meta.env.VITE_API_URL}/api/medications/logs?startDate=${weekDates[0]}&endDate=${today}`,
            { headers: hdrs },
          ),
        ]);
        setMedications(medsRes.data.medications);
        setWeekLogs(logsRes.data.logs);
      } catch (err) {
        console.error("Error fetching medications:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchMedications();
  }, [token]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, startDate: today });
    setShowModal(true);
  };

  const openEdit = (med) => {
    const p = resolvePattern(med);
    const pattern = ["daily", "specific_days", "every_n_days", "monthly", "as_needed"].includes(p.kind)
      ? p.kind
      : "daily";
    const anchorYmd = med.startDate || new Date(med.createdAt).toLocaleDateString("en-CA");
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
    setShowModal(true);
  };

  // saving always writes the canonical shape — the legacy enums are never
  // written again, and `active` is omitted so editing a paused med keeps it paused
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
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
      if (form.id) {
        const res = await axios.put(
          `${import.meta.env.VITE_API_URL}/api/medications/${form.id}`,
          payload,
          { headers: hdrs },
        );
        setMedications((prev) => prev.map((m) => (m.id === form.id ? res.data.medication : m)));
      } else {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/medications`,
          payload,
          { headers: hdrs },
        );
        setMedications((prev) => [...prev, res.data.medication]);
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving medication:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (med, nextActive) => {
    try {
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/medications/${med.id}`,
        { active: nextActive },
        { headers: hdrs },
      );
      setMedications((prev) => prev.map((m) => (m.id === med.id ? res.data.medication : m)));
    } catch (err) {
      console.error("Error updating medication:", err);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/medications/${id}`, { headers: hdrs });
      setMedications((prev) => prev.filter((m) => m.id !== id));
      setWeekLogs((prev) => prev.filter((l) => l.medicationId !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting medication:", err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Dose actions ────────────────────────────────────────────────────────────

  const handleTake = async (dose) => {
    const { med, slot, doseKey } = dose;
    setActionError(null);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime: slot, takenAt: new Date().toISOString(), status: "taken" },
        { headers: hdrs },
      );
      track("medication_logged", { status: "taken" });
      setWeekLogs((prev) => [...prev, res.data.log]);
    } catch (err) {
      console.error("Error logging take:", err);
      setActionError(doseKey);
    }
  };

  // skip logs immediately, no reason required — the Skipped chip offers one after
  const handleSkip = async (dose) => {
    const { med, slot, doseKey } = dose;
    setActionError(null);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime: slot, status: "skipped" },
        { headers: hdrs },
      );
      track("medication_logged", { status: "skipped" });
      setWeekLogs((prev) => [...prev, res.data.log]);
    } catch (err) {
      console.error("Error logging skip:", err);
      setActionError(doseKey);
    }
  };

  const handleReasonPick = async (log, reason, doseKey) => {
    setActionError(null);
    try {
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/medications/logs/${log.id}`,
        { skipReason: reason },
        { headers: hdrs },
      );
      setWeekLogs((prev) => prev.map((l) => (l.id === log.id ? res.data.log : l)));
      setReasonEditKey(null);
    } catch (err) {
      console.error("Error saving skip reason:", err);
      setActionError(doseKey);
    }
  };

  const handlePrnLog = async (med) => {
    const doseKey = `prn-${med.id}`;
    setActionError(null);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime: null, takenAt: new Date().toISOString(), status: "taken" },
        { headers: hdrs },
      );
      track("medication_logged", { status: "taken" });
      setWeekLogs((prev) => [...prev, res.data.log]);
    } catch (err) {
      console.error("Error logging dose:", err);
      setActionError(doseKey);
    }
  };

  const handleUndoLog = async (logId, doseKey) => {
    setActionError(null);
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/medications/logs/${logId}`, {
        headers: hdrs,
      });
      setWeekLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error("Error undoing log:", err);
      setActionError(doseKey);
    }
  };

  // ── Derived: today's checklist + cabinet groups ─────────────────────────────

  const todayLogs = weekLogs.filter((l) => l.date === today);
  const activeMeds = medications.filter((m) => m.active);
  const pausedMeds = medications.filter((m) => !m.active);
  const prnMeds = activeMeds.filter((m) => resolvePattern(m).kind === "as_needed");
  const scheduledMeds = activeMeds.filter((m) => resolvePattern(m).kind !== "as_needed");

  const doses = [];
  scheduledMeds.forEach((med) => {
    expectedDosesOn(med, today).forEach((slot) => {
      const doseKey = `${med.id}-${slot || "anytime"}`;
      const log = todayLogs.find((l) => l.medicationId === med.id && l.scheduledTime === slot);
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

  // ── Dose row renderer ───────────────────────────────────────────────────────

  const renderDoseRow = (dose) => {
    const { med, slot, doseKey, log } = dose;
    const isEditingReason = reasonEditKey === doseKey;

    let statusLine;
    let statusColor = "rgba(255,255,255,0.6)";
    if (log?.status === "taken") {
      statusLine = `Taken at ${formatTakenAt(log.takenAt)}`;
      statusColor = "#D6F2DF";
    } else if (log?.status === "skipped") {
      statusLine = log.skipReason ? `Skipped · ${log.skipReason}` : "Skipped";
    } else {
      statusLine = `${slot ? formatTime(slot) : "Anytime"} · not logged`;
    }

    return (
      <div
        key={doseKey}
        className="p-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MedicationTypeIcon type={med.type} size={22} />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight" style={{ color: "white" }}>
                {med.name}
                {med.dosage && (
                  <span className="font-normal ml-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {med.dosage}
                  </span>
                )}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: statusColor }}>
                {statusLine}
              </p>
              {actionError === doseKey && (
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,180,180,0.8)" }}>
                  Couldn't save, try again
                </p>
              )}
            </div>
          </div>

          {log ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {log.status === "taken" ? (
                <span className="text-sm" style={{ color: "#D6F2DF" }}>✓</span>
              ) : (
                <button
                  onClick={() => setReasonEditKey(isEditingReason ? null : doseKey)}
                  aria-label="Skipped — click to add a reason"
                  className="px-2.5 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-80"
                  style={{
                    background: "rgba(255,255,255,0.14)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  Skipped
                </button>
              )}
              <button
                onClick={() => handleUndoLog(log.id, doseKey)}
                title="Undo"
                aria-label="Undo"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                <FiRotateCcw size={12} color="white" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleTake(dose)}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-200 hover:opacity-80"
                style={{ background: "#7C6BAE", color: "white" }}
              >
                Taken ✓
              </button>
              <button
                onClick={() => handleSkip(dose)}
                className="px-2 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-70"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                skip
              </button>
            </div>
          )}
        </div>

        {isEditingReason && log?.status === "skipped" && (
          <div
            className="flex flex-col gap-2 mt-2 pt-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
          >
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Reason (optional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SKIP_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleReasonPick(log, r, doseKey)}
                  className="px-2 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-80"
                  style={{
                    background: log.skipReason === r ? "#7C6BAE" : "rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={() => setReasonEditKey(null)}
              className="text-[10px] text-left hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Background blobs */}
      <div className="absolute rounded-full opacity-20" style={{ width: "300px", height: "300px", background: "#5C4E8A", filter: "blur(80px)", top: "-50px", left: "-100px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "250px", height: "250px", background: "#DEC8DA", filter: "blur(70px)", top: "200px", right: "-80px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "280px", height: "280px", background: "#9B8EC4", filter: "blur(75px)", bottom: "300px", left: "-50px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "200px", height: "200px", background: "#C4A8C0", filter: "blur(60px)", bottom: "100px", right: "-30px", pointerEvents: "none" }} />

      {/* Header */}
      <div className="relative z-20">
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ maxWidth: "1024px", margin: "0 auto" }}
        >
          <h1
            className="text-white font-medium text-lg"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Medications
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              <FiPlus size={14} />
              Add
            </button>
            <NavHamburger />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className="relative z-10 p-6 pb-20 flex flex-col gap-4"
        style={{ maxWidth: "1024px", margin: "0 auto" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
            />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Loading...</p>
          </div>
        ) : medications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <MedicationTypeIcon type="pill" size={48} />
            <p
              className="text-lg font-medium mt-2"
              style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}
            >
              No medications yet
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)", maxWidth: "280px" }}>
              Add your first medication to start tracking.
            </p>
            <button
              onClick={openAdd}
              className="mt-2 px-6 py-2 rounded-full text-white text-sm hover:scale-105 transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              + Add Medication
            </button>
          </div>
        ) : (
          <>
            {/* ── Zone 1: Today ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                Today
              </p>
              <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                {activeMeds.length === 0 ? (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                    No active medications yet. Tap Add to create one.
                  </p>
                ) : doses.length === 0 ? (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Nothing scheduled today — your as-needed medications are below.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Today progress — states a fact, nothing more */}
                    <div className="flex flex-col gap-1.5 mb-1">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {todayLogged} of {todayExpected} doses logged
                      </p>
                      <div
                        className="w-full rounded-full overflow-hidden"
                        style={{ height: "4px", background: "rgba(255,255,255,0.15)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.round((todayLogged / todayExpected) * 100)}%`,
                            background: "#C4A8C0",
                          }}
                        />
                      </div>
                    </div>

                    {allLogged && (
                      <p
                        className="text-sm text-center pt-2"
                        style={{ color: "rgba(255,255,255,0.75)" }}
                      >
                        All logged for today 💜
                      </p>
                    )}
                    {groups.map((g) => (
                      <div key={g.key} className="flex flex-col gap-2">
                        <p
                          className="text-[10px] uppercase tracking-wide mt-1 flex items-center gap-1.5"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          <g.Icon size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
                          {g.label}
                        </p>
                        {g.doses.map(renderDoseRow)}
                      </div>
                    ))}
                  </div>
                )}

                {/* As-needed lane */}
                {prnMeds.length > 0 && (
                  <div className="flex flex-col gap-2 mt-3">
                    <p
                      className="text-[10px] uppercase tracking-wide"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      As needed
                    </p>
                    {prnMeds.map((med) => {
                      const prnKey = `prn-${med.id}`;
                      const logs = todayLogs.filter((l) => l.medicationId === med.id);
                      return (
                        <div
                          key={med.id}
                          className="p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <MedicationTypeIcon type={med.type} size={22} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-tight" style={{ color: "white" }}>
                                  {med.name}
                                  {med.dosage && (
                                    <span className="font-normal ml-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                                      {med.dosage}
                                    </span>
                                  )}
                                </p>
                                {logs.length === 0 && (
                                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                                    No doses logged today
                                  </p>
                                )}
                                {actionError === prnKey && (
                                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,180,180,0.8)" }}>
                                    Couldn't save, try again
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handlePrnLog(med)}
                              className="px-2.5 py-1 rounded-full text-[10px] font-medium flex-shrink-0 transition-all duration-200 hover:opacity-80"
                              style={{ background: "#7C6BAE", color: "white" }}
                            >
                              Log a dose
                            </button>
                          </div>
                          {logs.map((l) => (
                            <div
                              key={l.id}
                              className="flex items-center justify-between mt-2 pt-2"
                              style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
                            >
                              <p className="text-[10px]" style={{ color: "#D6F2DF" }}>
                                Taken at {formatTakenAt(l.takenAt)}
                              </p>
                              <button
                                onClick={() => handleUndoLog(l.id, `log-${l.id}`)}
                                title="Undo"
                                aria-label="Undo this dose"
                                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
                                style={{ background: "rgba(255,255,255,0.25)" }}
                              >
                                <FiRotateCcw size={12} color="white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Zone 2: Medicine cabinet (collapsed by default) ───────────── */}
            {medications.length > 0 && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setCabinetOpen((o) => !o)}
                  aria-expanded={cabinetOpen}
                  className="flex items-center gap-1.5 text-left w-fit"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  <span className="text-xs uppercase tracking-wide">
                    Medicine cabinet ({activeMeds.length})
                  </span>
                  {cabinetOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>

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
                        onDelete={setDeleteConfirm}
                      />
                    ))}

                    {pausedMeds.length > 0 && (
                      <>
                        <p
                          className="text-xs uppercase tracking-wide mt-1"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                        >
                          Paused
                        </p>
                        {pausedMeds.map((med) => (
                          <CabinetCard
                            key={med.id}
                            med={med}
                            weekDates={weekDates}
                            weekLogs={weekLogs}
                            today={today}
                            onEdit={openEdit}
                            onSetActive={handleSetActive}
                            onDelete={setDeleteConfirm}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {showModal && (
        <MedModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-sm mx-4 p-6 rounded-2xl flex flex-col gap-4"
            style={{
              background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <div className="flex flex-col gap-1">
              <p
                className="font-medium"
                style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}
              >
                Delete this medication?
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                All associated logs will also be deleted. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-full text-sm"
                style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-2 rounded-full text-sm text-white transition-all duration-200"
                style={{ background: "#B07088", opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

export default MedicationsPage;
