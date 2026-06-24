import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { FiEdit2, FiTrash2, FiRotateCcw, FiPlus } from "react-icons/fi";
import Navigation, { NavHamburger } from "../components/Navigation";
import {
  FREQUENCY_LABELS,
  FREQUENCY_TIME_COUNTS,
  formatTime,
  isMedicationDueToday,
} from "../utils/medicationHelpers";
import { MedicationTypeIcon } from "../components/SymptomIcon";

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

const SKIP_REASONS = [
  "Forgot",
  "Felt sick / threw up",
  "Side effects",
  "Ran out",
  "Doctor advised",
  "Already took it",
  "Too painful to take",
];

function MedModal({ form, setForm, onSave, onClose, saving }) {
  const timeCount = FREQUENCY_TIME_COUNTS[form.frequency] ?? 1;

  const handleFrequencyChange = (newFreq) => {
    const count = FREQUENCY_TIME_COUNTS[newFreq] ?? 1;
    const current = form.scheduledTimes || [];
    let times;
    if (count === 0) {
      times = [];
    } else if (count > current.length) {
      times = [...current, ...Array(count - current.length).fill("08:00")];
    } else {
      times = current.slice(0, count);
    }
    setForm({ ...form, frequency: newFreq, scheduledTimes: times });
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
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
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
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
            placeholder="e.g. 20mg"
          />
        </div>

        {/* Frequency */}
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Frequency</p>
          <select
            value={form.frequency}
            onChange={(e) => handleFrequencyChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
          >
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value} style={{ background: "#6B5F7A", color: "white" }}>{label}</option>
            ))}
          </select>
          {form.frequency === "every_x_weeks" && (
            <input
              type="number"
              min={1}
              max={52}
              value={form.frequencyWeeks}
              onChange={(e) => setForm({ ...form, frequencyWeeks: parseInt(e.target.value) || 2 })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mt-2"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
              placeholder="Number of weeks"
            />
          )}
        </div>

        {/* Scheduled times */}
        {timeCount > 0 && (
          <div>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
              Scheduled time{timeCount > 1 ? "s" : ""}
            </p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: timeCount }).map((_, i) => (
                <input
                  key={i}
                  type="time"
                  value={form.scheduledTimes?.[i] || "08:00"}
                  onChange={(e) => {
                    const times = [...(form.scheduledTimes || [])];
                    times[i] = e.target.value;
                    setForm({ ...form, scheduledTimes: times });
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
                />
              ))}
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
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
            placeholder="Any notes…"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "white" }}>Active</p>
          <button
            onClick={() => setForm({ ...form, active: !form.active })}
            className="w-10 h-6 rounded-full transition-all duration-200 relative flex-shrink-0"
            style={{ background: form.active ? "#7C6BAE" : "rgba(255,255,255,0.2)" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
              style={{ background: "white", left: form.active ? "calc(100% - 22px)" : "2px" }}
            />
          </button>
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
            disabled={!form.name.trim() || saving}
            className="flex-1 py-2 rounded-full text-sm text-white transition-all duration-200"
            style={{ background: "#7C6BAE", opacity: !form.name.trim() || saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MedCard({ med, onEdit, onDelete }) {
  const freqLabel = FREQUENCY_LABELS[med.frequency] || med.frequency;
  const times = med.scheduledTimes?.map(formatTime).filter(Boolean).join(" · ") || "";

  return (
    <div
      className="p-4 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.3)",
        opacity: med.active ? 1 : 0.6,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <MedicationTypeIcon type={med.type} size={24} style={{ marginTop: "2px" }} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm" style={{ color: "white" }}>{med.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              {[med.dosage, freqLabel].filter(Boolean).join(" · ")}
            </p>
            {times && (
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{times}</p>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={() => onEdit(med)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            <FiEdit2 size={12} color="white" />
          </button>
          <button
            onClick={() => onDelete(med.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
            style={{ background: "rgba(255,100,100,0.4)" }}
          >
            <FiTrash2 size={12} color="white" />
          </button>
        </div>
      </div>
      {!med.active && (
        <span
          className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px]"
          style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
        >
          Inactive
        </span>
      )}
    </div>
  );
}

function MedicationsPage() {
  const { token } = useAuth();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);
  const [skippingDoseKey, setSkippingDoseKey] = useState(null);

  useEffect(() => {
    const fetchMedications = async () => {
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const [medsRes, logsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/medications/logs?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setMedications(medsRes.data.medications);
        setTodayLogs(logsRes.data.logs);
      } catch (err) {
        console.error("Error fetching medications:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchMedications();
  }, [token]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (med) => {
    setForm({
      id:             med.id,
      name:           med.name,
      type:           med.type,
      dosage:         med.dosage || "",
      frequency:      med.frequency,
      frequencyWeeks: med.frequencyWeeks || 2,
      scheduledTimes: med.scheduledTimes || [],
      notes:          med.notes || "",
      active:         med.active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name:           form.name.trim(),
        type:           form.type,
        dosage:         form.dosage.trim() || null,
        frequency:      form.frequency,
        frequencyWeeks: form.frequency === "every_x_weeks" ? form.frequencyWeeks : null,
        scheduledTimes: form.scheduledTimes?.length > 0 ? form.scheduledTimes : null,
        notes:          form.notes.trim() || null,
        active:         form.active,
      };
      if (form.id) {
        const res = await axios.put(
          `${import.meta.env.VITE_API_URL}/api/medications/${form.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMedications(medications.map((m) => m.id === form.id ? res.data.medication : m));
      } else {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/medications`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMedications([...medications, res.data.medication]);
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving medication:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/medications/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMedications(medications.filter((m) => m.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting medication:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleTake = async (med, scheduledTime) => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime, takenAt: new Date().toISOString(), status: "taken" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTodayLogs((prev) => [...prev, res.data.log]);
    } catch (err) {
      console.error("Error logging take:", err);
    }
  };

  const handleUndoLog = async (logId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/medications/logs/${logId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTodayLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error("Error undoing log:", err);
    }
  };

  const handleSkip = async (med, scheduledTime, reason) => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/medications/logs`,
        { medicationId: med.id, date: today, scheduledTime, status: "skipped", skipReason: reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTodayLogs((prev) => [...prev, res.data.log]);
      setSkippingDoseKey(null);
    } catch (err) {
      console.error("Error logging skip:", err);
    }
  };

  const activeMeds   = medications.filter((m) => m.active);
  const inactiveMeds = medications.filter((m) => !m.active);

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
            {activeMeds.length > 0 && (() => {
              const today = new Date().toLocaleDateString("en-CA");
              const now = new Date();
              const doses = [];

              activeMeds.forEach((med) => {
                if (!isMedicationDueToday(med, today)) return;
                const times = med.scheduledTimes?.length > 0 ? med.scheduledTimes : [null];
                times.forEach((scheduledTime) => {
                  const doseKey = `${med.id}-${scheduledTime || "none"}`;
                  const log = todayLogs.find(
                    (l) => l.medicationId === med.id && l.scheduledTime === scheduledTime,
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

              doses.sort((a, b) => {
                const aTime = a.scheduledTime || "99:99";
                const bTime = b.scheduledTime || "99:99";
                return aTime.localeCompare(bTime);
              });

              const borderColor = {
                taken: "#7FAF8A",
                skipped: "rgba(255,255,255,0.3)",
                missed: "#FF6B8A",
                "past-due": "#C4A882",
                upcoming: "transparent",
              };

              return (
                <div className="flex flex-col gap-3">
                  <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Today's doses
                  </p>
                  <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                    {doses.length === 0 ? (
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                        No medications scheduled for today
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {doses.map(({ med, scheduledTime, doseKey, status, log }) => (
                          <div
                            key={doseKey}
                            className="p-3 rounded-xl"
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              borderLeft: `3px solid ${borderColor[status] || "transparent"}`,
                            }}
                          >
                            {skippingDoseKey === doseKey ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                                  Why are you skipping?
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {SKIP_REASONS.map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => handleSkip(med, scheduledTime, r)}
                                      className="px-2 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-80"
                                      style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                                    >
                                      {r}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setSkippingDoseKey(null)}
                                  className="text-[10px] text-left hover:opacity-70"
                                  style={{ color: "rgba(255,255,255,0.6)" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
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
                                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                                      {status === "taken" && log?.takenAt
                                        ? `Taken at ${new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                        : status === "skipped"
                                        ? `Skipped${log?.skipReason ? ` · ${log.skipReason}` : ""}`
                                        : status === "missed"
                                        ? "Missed"
                                        : scheduledTime
                                        ? formatTime(scheduledTime)
                                        : FREQUENCY_LABELS[med.frequency] || ""}
                                    </p>
                                  </div>
                                </div>
                                {(status === "taken" || status === "skipped") && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {status === "taken" && (
                                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>✓</span>
                                    )}
                                    <button
                                      onClick={() => handleUndoLog(log.id)}
                                      title="Undo"
                                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
                                      style={{ background: "rgba(255,255,255,0.25)" }}
                                    >
                                      <FiRotateCcw size={12} color="white" />
                                    </button>
                                  </div>
                                )}
                                {(status === "upcoming" || status === "past-due") && (
                                  <div className="flex gap-1.5 flex-shrink-0">
                                    <button
                                      onClick={() => handleTake(med, scheduledTime)}
                                      className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-200 hover:opacity-80"
                                      style={{ background: "#7C6BAE", color: "white" }}
                                    >
                                      Take
                                    </button>
                                    <button
                                      onClick={() => setSkippingDoseKey(doseKey)}
                                      className="px-2.5 py-1 rounded-full text-[10px] transition-all duration-200 hover:opacity-80"
                                      style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                                    >
                                      Skip
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {activeMeds.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Active
                </p>
                {activeMeds.map((med) => (
                  <MedCard
                    key={med.id}
                    med={med}
                    onEdit={openEdit}
                    onDelete={setDeleteConfirm}
                  />
                ))}
              </div>
            )}
            {inactiveMeds.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Inactive
                </p>
                {inactiveMeds.map((med) => (
                  <MedCard
                    key={med.id}
                    med={med}
                    onEdit={openEdit}
                    onDelete={setDeleteConfirm}
                  />
                ))}
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
