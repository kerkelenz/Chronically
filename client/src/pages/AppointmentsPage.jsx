import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiCalendar, FiPlus, FiEdit2, FiTrash2, FiX, FiMapPin, FiClock,
  FiChevronLeft, FiChevronRight, FiDownload,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { exportDoctorReport } from "../utils/exportReport";
import Navigation, { NavHamburger } from "../components/Navigation";

const EMPTY_FORM = {
  doctorName:   "",
  specialty:    "",
  date:         "",
  location:     "",
  reason:       "",
  notesBefore:  "",
  notesAfter:   "",
  followUpDate: "",
  status:       "upcoming",
};

const formatApptDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatApptTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toDateTimeLocal = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toDateOnly = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dotColor = (status) => {
  if (status === "completed") return "#A9D8B4";
  if (status === "cancelled") return "rgba(255,255,255,0.3)";
  return "white";
};

const inputStyle = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  color: "white",
};

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function AppointmentsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  // Visit lifecycle sheets (prep / outcome)
  const [prepFor, setPrepFor] = useState(null);
  const [prepText, setPrepText] = useState("");
  const [outcomeFor, setOutcomeFor] = useState(null);
  const [outcomeText, setOutcomeText] = useState("");
  const [outcomeDate, setOutcomeDate] = useState("");
  const [savingLifecycle, setSavingLifecycle] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [popoverAppointment, setPopoverAppointment] = useState(null);

  const hdrs = { Authorization: `Bearer ${token}` };

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/appointments`, { headers: hdrs });
      setAppointments(res.data.appointments);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAppointments();
  }, [token]);

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

  const buildCalendarDays = () => {
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
      const date = new Date(year, month, i);
      const dateStr = date.toLocaleDateString("en-CA");
      const appts = appointments.filter(
        (a) => new Date(a.date).toLocaleDateString("en-CA") === dateStr,
      );
      days.push({ day: i, currentMonth: true, date: dateStr, appointments: appts });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false, date: null });
    }
    return days;
  };

  const handleDayClick = (dayObj) => {
    if (!dayObj.currentMonth || !dayObj.appointments || dayObj.appointments.length === 0) {
      setSelectedDate(null);
      setPopoverAppointment(null);
      return;
    }
    setSelectedDate(dayObj.date);
    setPopoverAppointment(dayObj.appointments[0]);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (appt) => {
    setEditingId(appt.id);
    setForm({
      doctorName:   appt.doctorName   || "",
      specialty:    appt.specialty    || "",
      date:         toDateTimeLocal(appt.date),
      location:     appt.location     || "",
      reason:       appt.reason       || "",
      notesBefore:  appt.notesBefore  || "",
      notesAfter:   appt.notesAfter   || "",
      followUpDate: toDateOnly(appt.followUpDate),
      status:       appt.status       || "upcoming",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.doctorName.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: new Date(form.date).toISOString(),
        followUpDate: form.followUpDate ? new Date(form.followUpDate + "T12:00:00").toISOString() : null,
      };
      if (editingId) {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/appointments/${editingId}`, payload, { headers: hdrs });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/appointments`, payload, { headers: hdrs });
      }
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
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/appointments/${id}`,
        { ...appt, status: "cancelled" },
        { headers: hdrs },
      );
      await fetchAppointments();
    } catch (err) {
      console.error("Failed to cancel appointment:", err);
    } finally {
      setCancelConfirmId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/appointments/${id}`, { headers: hdrs });
      await fetchAppointments();
      closeModal();
    } catch (err) {
      console.error("Failed to delete appointment:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      await exportDoctorReport({ token, username: user?.username });
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(true);
      setTimeout(() => setExportError(false), 5000);
    } finally {
      setExporting(false);
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
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/appointments/${prepFor.id}`,
        { ...prepFor, notesBefore: prepText },
        { headers: hdrs },
      );
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
  };

  const markCompleted = async (appt) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/appointments/${appt.id}`,
        { ...appt, status: "completed" },
        { headers: hdrs },
      );
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
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/appointments/${outcomeFor.id}`,
        {
          ...outcomeFor,
          notesAfter: outcomeText,
          followUpDate: outcomeDate ? new Date(outcomeDate + "T12:00:00").toISOString() : null,
        },
        { headers: hdrs },
      );
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
    setShowModal(true);
  };

  const todayStr = new Date().toLocaleDateString("en-CA");
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

  const calendarDays = loading ? [] : buildCalendarDays();

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
            Appointments
          </h1>
          <div className="flex items-center gap-3">
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
        className="relative z-10 p-6 pb-24 flex flex-col gap-6"
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
        ) : (
          <>
            {/* Calendar */}
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              {/* Month nav */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-full transition-all duration-200 hover:opacity-70"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <FiChevronLeft size={16} color="white" />
                </button>
                <p className="text-sm font-medium" style={{ color: "white" }}>
                  {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-full transition-all duration-200 hover:opacity-70"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <FiChevronRight size={16} color="white" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="flex justify-center">
                    <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{d}</span>
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-1">
                {calendarDays.map((dayObj, idx) => {
                  const isToday = dayObj.currentMonth && dayObj.date === todayStr;
                  const isSelected = dayObj.currentMonth && dayObj.date === selectedDate;
                  const hasAppts = dayObj.currentMonth && dayObj.appointments && dayObj.appointments.length > 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDayClick(dayObj)}
                      className="flex flex-col items-center py-1 rounded-xl transition-all duration-150"
                      style={{
                        background: isSelected ? "rgba(255,255,255,0.9)" : isToday ? "rgba(255,255,255,0.2)" : "transparent",
                        cursor: hasAppts ? "pointer" : dayObj.currentMonth ? "default" : "default",
                      }}
                    >
                      <span
                        className="text-xs leading-none"
                        style={{
                          color: isSelected
                            ? "#7C6BAE"
                            : dayObj.currentMonth
                            ? "white"
                            : "rgba(255,255,255,0.25)",
                          fontWeight: isToday || isSelected ? "600" : "400",
                        }}
                      >
                        {dayObj.day}
                      </span>
                      {hasAppts && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayObj.appointments.slice(0, 3).map((a, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: isSelected ? "#7C6BAE" : dotColor(a.status) }}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Popover */}
            {popoverAppointment && selectedDate && (() => {
              const dayAppts = appointments.filter(
                (a) => new Date(a.date).toLocaleDateString("en-CA") === selectedDate,
              );
              const extra = dayAppts.length - 1;
              return (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)" }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                      <p className="text-sm font-medium" style={{ color: "white" }}>
                        {popoverAppointment.doctorName}
                      </p>
                      {popoverAppointment.specialty && (
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {popoverAppointment.specialty}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => { setPopoverAppointment(null); setSelectedDate(null); }}
                      className="flex-shrink-0 p-1 rounded-full hover:opacity-70 transition-opacity"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                      <FiX size={14} />
                    </button>
                  </div>

                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {formatApptDate(popoverAppointment.date)} at {formatApptTime(popoverAppointment.date)}
                  </p>
                  {popoverAppointment.location && (
                    <p className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <FiMapPin size={11} />
                      {popoverAppointment.location}
                    </p>
                  )}
                  {popoverAppointment.reason && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Reason: {popoverAppointment.reason}
                    </p>
                  )}
                  {popoverAppointment.notesBefore && (
                    <div className="mt-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Before</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{popoverAppointment.notesBefore}</p>
                    </div>
                  )}
                  {popoverAppointment.notesAfter && (
                    <div className="mt-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>After</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{popoverAppointment.notesAfter}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background:
                          popoverAppointment.status === "completed"
                            ? "rgba(140,220,160,0.28)"
                            : popoverAppointment.status === "cancelled"
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(124,107,174,0.4)",
                        color: "white",
                      }}
                    >
                      {popoverAppointment.status.charAt(0).toUpperCase() + popoverAppointment.status.slice(1)}
                    </span>
                    {extra > 0 && (
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        and {extra} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Appointment lists */}
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.2)" }}
                >
                  <FiCalendar size={24} color="white" />
                </div>
                <div className="text-center flex flex-col gap-1">
                  <p className="text-base font-medium" style={{ color: "white" }}>No appointments yet</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Track your doctor visits and upcoming appointments</p>
                </div>
                <button
                  onClick={openAdd}
                  className="px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90"
                  style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
                >
                  Add your first appointment
                </button>
              </div>
            ) : (
              <>
                {/* Upcoming */}
                {upcoming.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Upcoming
                    </p>
                    {upcoming.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-4 rounded-2xl flex flex-col gap-3"
                        style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FiCalendar size={13} color="rgba(255,255,255,0.7)" />
                              <span className="text-sm font-medium" style={{ color: "white" }}>
                                {formatApptDate(appt.date)}
                              </span>
                              <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                                at {formatApptTime(appt.date)}
                              </span>
                            </div>
                            <p className="text-sm font-medium" style={{ color: "white" }}>
                              {appt.doctorName}{appt.specialty ? ` — ${appt.specialty}` : ""}
                            </p>
                            {appt.location && (
                              <div className="flex items-center gap-1.5">
                                <FiMapPin size={11} color="rgba(255,255,255,0.5)" />
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{appt.location}</p>
                              </div>
                            )}
                            {appt.reason && (
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                                Reason: {appt.reason}
                              </p>
                            )}
                            {appt.notesBefore && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Before</p>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{appt.notesBefore}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex flex-col gap-2 self-start pt-0.5">
                            <button
                              onClick={() => openEdit(appt)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
                              style={{ background: "rgba(255,255,255,0.25)" }}
                              aria-label={`Edit appointment with ${appt.doctorName}`}
                            >
                              <FiEdit2 size={12} color="white" />
                            </button>
                            <button
                              onClick={() => setCancelConfirmId(appt.id)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
                              style={{ background: "rgba(255,100,100,0.4)" }}
                              aria-label={`Cancel appointment with ${appt.doctorName}`}
                            >
                              <FiX size={12} color="white" />
                            </button>
                          </div>
                        </div>

                        {/* Prepare + report-to-bring */}
                        <div className="flex items-center flex-wrap gap-2">
                          <button
                            onClick={() => openPrep(appt)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:opacity-80"
                            style={{ background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.3)" }}
                            aria-label={`Prepare for visit with ${appt.doctorName}`}
                          >
                            <FiEdit2 size={11} />
                            {appt.notesBefore ? "Edit prep notes" : "Prepare"}
                          </button>
                          {appt.id === soonestUpcomingId && (
                            <button
                              onClick={handleExport}
                              disabled={exporting}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all duration-200 hover:opacity-80 underline"
                              style={{ color: "rgba(255,255,255,0.7)" }}
                              aria-label="Export a report to bring to this visit"
                            >
                              <FiDownload size={11} />
                              {exporting ? "Preparing…" : "Export a report to bring"}
                            </button>
                          )}
                        </div>

                        {cancelConfirmId === appt.id && (
                          <div
                            className="rounded-xl p-3 flex flex-col gap-2"
                            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
                          >
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
                              Mark this appointment as cancelled?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setCancelConfirmId(null)}
                                className="flex-1 py-1.5 rounded-lg text-xs transition-all duration-200 hover:opacity-80"
                                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                              >
                                Keep
                              </button>
                              <button
                                onClick={() => handleCancel(appt.id)}
                                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:opacity-80"
                                style={{ background: "rgba(255,100,100,0.5)", color: "white" }}
                              >
                                Cancel it
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Past */}
                {past.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Past
                    </p>
                    {past.map((appt) => {
                      const isCompleted = appt.status === "completed";
                      const isCancelled = appt.status === "cancelled";
                      const isPastDue = appt.status === "upcoming";
                      return (
                        <div
                          key={appt.id}
                          className="p-4 rounded-2xl flex flex-col gap-2"
                          style={{
                            background: "rgba(255,255,255,0.15)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            borderLeft: isCompleted ? "3px solid #A9D8B4" : isCancelled ? "3px solid rgba(255,255,255,0.2)" : undefined,
                            opacity: isCancelled ? 0.6 : 1,
                          }}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {isCompleted && (
                                  <span
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                    style={{ background: "rgba(140,220,160,0.28)", color: "#E9F7EE" }}
                                  >
                                    COMPLETED
                                  </span>
                                )}
                                {isCancelled && (
                                  <span
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                    style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                                  >
                                    CANCELLED
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <FiCalendar size={13} color="rgba(255,255,255,0.5)" />
                                <span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                                  {formatApptDate(appt.date)} at {formatApptTime(appt.date)}
                                </span>
                              </div>
                              <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                                {appt.doctorName}{appt.specialty ? ` — ${appt.specialty}` : ""}
                              </p>
                              {appt.location && (
                                <div className="flex items-center gap-1.5">
                                  <FiMapPin size={11} color="rgba(255,255,255,0.4)" />
                                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{appt.location}</p>
                                </div>
                              )}
                              {appt.reason && (
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                                  Reason: {appt.reason}
                                </p>
                              )}
                              {appt.notesBefore && (
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Before</p>
                                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{appt.notesBefore}</p>
                                </div>
                              )}
                              {appt.notesAfter && (
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>After</p>
                                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{appt.notesAfter}</p>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => openEdit(appt)}
                              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80"
                              style={{ background: "rgba(255,255,255,0.2)" }}
                              aria-label={`Edit appointment with ${appt.doctorName}`}
                            >
                              <FiEdit2 size={12} color="white" />
                            </button>
                          </div>

                          {/* Past-due: did this visit happen? */}
                          {isPastDue && (
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>Did this visit happen?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => markCompleted(appt)}
                                  className="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:opacity-80"
                                  style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
                                  aria-label={`Mark visit with ${appt.doctorName} completed`}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setCancelConfirmId(appt.id)}
                                  className="px-3.5 py-1.5 rounded-full text-xs transition-all duration-200 hover:opacity-80"
                                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
                                  aria-label={`Mark visit with ${appt.doctorName} cancelled`}
                                >
                                  Cancelled
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inline cancel confirm (shared with the chip) */}
                          {isPastDue && cancelConfirmId === appt.id && (
                            <div
                              className="rounded-xl p-3 flex flex-col gap-2"
                              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
                            >
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
                                Mark this appointment as cancelled?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCancelConfirmId(null)}
                                  className="flex-1 py-1.5 rounded-lg text-xs transition-all duration-200 hover:opacity-80"
                                  style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                                >
                                  Keep
                                </button>
                                <button
                                  onClick={() => handleCancel(appt.id)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:opacity-80"
                                  style={{ background: "rgba(255,100,100,0.5)", color: "white" }}
                                >
                                  Cancel it
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Completed: add visit notes link when empty */}
                          {isCompleted && !appt.notesAfter && (
                            <button
                              onClick={() => openOutcome(appt)}
                              className="self-start flex items-center gap-1 text-xs underline transition-all duration-200 hover:opacity-80"
                              style={{ color: "rgba(255,255,255,0.7)" }}
                              aria-label={`Add visit notes for ${appt.doctorName}`}
                            >
                              <FiPlus size={12} />
                              Add visit notes
                            </button>
                          )}

                          {/* Completed: follow-up chained */}
                          {isCompleted && appt.followUpDate && (
                            <div
                              className="flex items-center justify-between flex-wrap gap-2 pt-2.5"
                              style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FiClock size={12} color="rgba(255,255,255,0.5)" />
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                                  Follow-up around {formatApptDate(appt.followUpDate)}
                                </p>
                              </div>
                              <button
                                onClick={() => scheduleFollowUp(appt)}
                                className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:opacity-80"
                                style={{ background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
                                aria-label={`Schedule follow-up appointment with ${appt.doctorName}`}
                              >
                                Schedule
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {upcoming.length === 0 && (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>No upcoming appointments</p>
                    <button
                      onClick={openAdd}
                      className="text-xs px-4 py-2 rounded-full transition-all duration-200 hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                    >
                      + Add appointment
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && (
          <div
            className="rounded-2xl p-5 flex flex-col gap-2"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            <p className="text-white font-medium text-sm">Doctor Report</p>
            <p className="text-white/70 text-xs leading-relaxed">
              Export a 30-day PDF summary of health metrics, medications, adherence,
              and appointments — designed to bring to your next visit.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="mt-1 px-4 py-2 rounded-full bg-white text-sm font-medium self-start flex items-center gap-2 hover:scale-105 transition-all duration-200"
              style={{ color: "#7C6BAE" }}
            >
              {exporting ? "Preparing..." : <><FiDownload size={14} /> Export PDF Report</>}
            </button>
            {exportError && (
              <p className="text-[11px]" style={{ color: "rgba(255,120,120,0.9)" }}>
                Failed to prepare report. Please try again.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col"
            style={{
              background: "rgba(100,85,145,0.92)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.25)",
              maxHeight: "90vh",
            }}
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-3">
              <p className="font-medium" style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}>
                {editingId ? "Edit Appointment" : "Add Appointment"}
              </p>
              <button onClick={closeModal} className="p-1.5 rounded-full hover:opacity-70 transition-opacity" style={{ background: "rgba(255,255,255,0.15)" }}>
                <FiX size={14} color="white" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-3">
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Doctor name *</p>
                <input
                  type="text"
                  value={form.doctorName}
                  onChange={(e) => setForm((f) => ({ ...f, doctorName: e.target.value }))}
                  placeholder="Dr. Smith"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                  style={inputStyle}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Specialty</p>
                <input
                  type="text"
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="Neurology"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                  style={inputStyle}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Date & time *</p>
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ ...inputStyle, colorScheme: "dark" }}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Location</p>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Hospital or clinic name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                  style={inputStyle}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Reason for visit</p>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Annual checkup, follow-up, etc."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                  style={inputStyle}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Notes before</p>
                <textarea
                  rows={2}
                  value={form.notesBefore}
                  onChange={(e) => setForm((f) => ({ ...f, notesBefore: e.target.value }))}
                  placeholder="Questions to ask, things to mention..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder-white/30"
                  style={inputStyle}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Status</p>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="upcoming"  style={{ background: "#6B5F7A", color: "white" }}>Upcoming</option>
                  <option value="completed" style={{ background: "#6B5F7A", color: "white" }}>Completed</option>
                  <option value="cancelled" style={{ background: "#6B5F7A", color: "white" }}>Cancelled</option>
                </select>
              </div>
              {form.status === "completed" && (
                <div>
                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Notes after</p>
                  <textarea
                    rows={2}
                    value={form.notesAfter}
                    onChange={(e) => setForm((f) => ({ ...f, notesAfter: e.target.value }))}
                    placeholder="What was discussed, next steps..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder-white/30"
                    style={inputStyle}
                  />
                </div>
              )}
              {form.status === "completed" && (
                <div>
                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Follow-up date</p>
                  <input
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {editingId && (
                  <button
                    onClick={() => setDeleteConfirmId(editingId)}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:opacity-80"
                    style={{ background: "rgba(255,100,100,0.4)" }}
                  >
                    <FiTrash2 size={14} color="white" />
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-full text-sm transition-all duration-200 hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.doctorName.trim() || !form.date}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90"
                  style={{ background: "white", color: "#7C6BAE", opacity: (saving || !form.doctorName.trim() || !form.date) ? 0.5 : 1 }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prepare-for-visit modal */}
      {prepFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPrepFor(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col p-5 gap-3"
            style={{ background: "rgba(100,85,145,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <div className="flex justify-between items-center">
              <p className="font-medium" style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}>
                Prepare for this visit
              </p>
              <button onClick={() => setPrepFor(null)} className="p-1.5 rounded-full hover:opacity-70 transition-opacity" style={{ background: "rgba(255,255,255,0.15)" }}>
                <FiX size={14} color="white" />
              </button>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
              {prepFor.doctorName}{prepFor.specialty ? ` — ${prepFor.specialty}` : ""}
            </p>
            <textarea
              rows={4}
              value={prepText}
              onChange={(e) => setPrepText(e.target.value)}
              placeholder="Questions to ask, symptoms to mention, refills to request…"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder-white/30"
              style={inputStyle}
              autoFocus
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPrepFor(null)}
                className="flex-1 py-2.5 rounded-full text-sm transition-all duration-200 hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
              >
                Cancel
              </button>
              <button
                onClick={savePrep}
                disabled={savingLifecycle}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90"
                style={{ background: "white", color: "#7C6BAE", opacity: savingLifecycle ? 0.5 : 1 }}
              >
                {savingLifecycle ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How-did-it-go modal */}
      {outcomeFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOutcomeFor(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col p-5 gap-3"
            style={{ background: "rgba(100,85,145,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <div className="flex justify-between items-center">
              <p className="font-medium" style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}>
                How did it go?
              </p>
              <button onClick={() => setOutcomeFor(null)} className="p-1.5 rounded-full hover:opacity-70 transition-opacity" style={{ background: "rgba(255,255,255,0.15)" }}>
                <FiX size={14} color="white" />
              </button>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
              {outcomeFor.doctorName}{outcomeFor.specialty ? ` — ${outcomeFor.specialty}` : ""}
            </p>
            <div>
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Visit notes</p>
              <textarea
                rows={4}
                value={outcomeText}
                onChange={(e) => setOutcomeText(e.target.value)}
                placeholder="What was said, decisions, next steps…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder-white/30"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Follow-up date (optional)</p>
              <input
                type="date"
                value={outcomeDate}
                onChange={(e) => setOutcomeDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ ...inputStyle, colorScheme: "dark" }}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOutcomeFor(null)}
                className="flex-1 py-2.5 rounded-full text-sm transition-all duration-200 hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
              >
                Skip
              </button>
              <button
                onClick={saveOutcome}
                disabled={savingLifecycle}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90"
                style={{ background: "white", color: "#7C6BAE", opacity: savingLifecycle ? 0.5 : 1 }}
              >
                {savingLifecycle ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-sm p-6 rounded-2xl flex flex-col gap-4"
            style={{ background: "white" }}
          >
            <div className="flex flex-col gap-1">
              <p className="font-medium" style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}>
                Delete appointment?
              </p>
              <p className="text-sm" style={{ color: "#6B5F7A" }}>This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 rounded-full text-sm transition-all duration-200"
                style={{ background: "#F0EBF8", color: "#6B5F7A" }}
              >
                Keep
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2 rounded-full text-sm text-white font-medium transition-all duration-200"
                style={{ background: "#B07088" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

export default AppointmentsPage;
