import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FiPlus, FiCheck, FiX, FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { track } from "../lib/analytics";
import Navigation, { NavHamburger } from "../components/Navigation";

const API = import.meta.env.VITE_API_URL;

function todayDateStr() {
  return new Date().toLocaleDateString("en-CA");
}

// parse a YYYY-MM-DD string as local noon so we never cross a date boundary
function parseDateStr(dateStr) {
  return new Date(dateStr + "T12:00:00");
}

function formatDateLabel(dateStr) {
  const today = todayDateStr();
  const yd = parseDateStr(today); yd.setDate(yd.getDate() - 1);
  const tm = parseDateStr(today); tm.setDate(tm.getDate() + 1);
  const yesterday = yd.toLocaleDateString("en-CA");
  const tomorrow  = tm.toLocaleDateString("en-CA");
  if (dateStr === today)     return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === tomorrow)  return "Tomorrow";
  return parseDateStr(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

const frostedInput = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  color: "white",
};

// ── Budget ring ───────────────────────────────────────────────────────────────
function BudgetRing({ spent, budget }) {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const ratio  = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const offset = circumference * (1 - ratio);
  const remaining = budget - spent;
  const over = spent > budget;

  return (
    <div style={{ position: "relative", width: 180, height: 180 }}>
      <svg width="180" height="180">
        <circle
          cx="90" cy="90" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="14"
        />
        <circle
          cx="90" cy="90" r={r}
          fill="none"
          stroke={over ? "#DEC8DA" : "white"}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "90px 90px",
            transition: "stroke-dashoffset 0.4s ease",
          }}
        />
      </svg>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <span style={{
          fontFamily: "Playfair Display, Georgia, serif",
          fontSize: 36,
          color: over ? "#DEC8DA" : "white",
          lineHeight: 1,
        }}>
          {Math.abs(remaining)}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>
          {over ? "over" : "spoons left"}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 5 }}>
          {spent} / {budget}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SpoonCenterPage() {
  const { token } = useAuth();
  const hdrs = { Authorization: `Bearer ${token}` };

  const [selectedDate, setSelectedDate]   = useState(todayDateStr());
  const [day,          setDay]            = useState(null);
  const [entries,      setEntries]        = useState([]);
  const [activities,   setActivities]     = useState([]);
  const [baseline,     setBaseline]       = useState(null);
  const [loading,      setLoading]        = useState(true);

  // modal visibility
  const [showAdd,        setShowAdd]        = useState(false);
  const [showBaseline,   setShowBaseline]   = useState(false);
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);

  // form state
  const [baselineInput, setBaselineInput] = useState("");
  const [budgetInput,   setBudgetInput]   = useState("");
  const [customName,    setCustomName]    = useState("");
  const [customCost,    setCustomCost]    = useState("");
  const [editingCosts,  setEditingCosts]  = useState(false);

  const baselinePromptedRef = useRef(false);

  // ── API helpers ─────────────────────────────────────────────────────────────

  const loadActivities = async () => {
    const res = await axios.get(`${API}/api/spoons/activities`, { headers: hdrs });
    setActivities(res.data.activities);
  };

  const loadDay = async (date) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/spoons/day?date=${date}`, { headers: hdrs });
      setDay(res.data.day);
      setEntries(res.data.entries);
      const bl = res.data.baseline;
      setBaseline(bl);
      if (bl === null && !baselinePromptedRef.current) {
        baselinePromptedRef.current = true;
        setBaselineInput("");
        setShowBaseline(true);
      }
    } catch (err) {
      console.error("Failed to load day:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadActivities();
    loadDay(todayDateStr());
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    loadDay(selectedDate);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Date nav ────────────────────────────────────────────────────────────────

  const moveDay = (delta) => {
    const d = parseDateStr(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toLocaleDateString("en-CA"));
  };

  // ── Entry actions ───────────────────────────────────────────────────────────

  const toggleEntry = async (entry) => {
    try {
      const res = await axios.put(
        `${API}/api/spoons/entries/${entry.id}`,
        { completed: !entry.completed },
        { headers: hdrs },
      );
      setEntries((prev) => prev.map((e) => e.id === entry.id ? res.data.entry : e));
    } catch (err) {
      console.error("Toggle entry failed:", err);
    }
  };

  const removeEntry = async (id) => {
    try {
      await axios.delete(`${API}/api/spoons/entries/${id}`, { headers: hdrs });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Remove entry failed:", err);
    }
  };

  // ── Add-modal actions ───────────────────────────────────────────────────────

  const addFromLibrary = async (activity) => {
    if (!day) return;
    try {
      const res = await axios.post(
        `${API}/api/spoons/day/${day.id}/entries`,
        { name: activity.name, cost: activity.cost },
        { headers: hdrs },
      );
      // planning starts when the day's first entry lands
      if (entries.length === 0) track("spoon_day_planned");
      setEntries((prev) => [...prev, res.data.entry]);
      setShowAdd(false);
    } catch (err) {
      console.error("Add from library failed:", err);
    }
  };

  const addCustom = async () => {
    if (!customName.trim() || !customCost || !day) return;
    try {
      // save to library so it's reusable
      const actRes = await axios.post(
        `${API}/api/spoons/activities`,
        { name: customName.trim(), cost: parseInt(customCost) },
        { headers: hdrs },
      );
      const act = actRes.data.activity;
      setActivities((prev) => [...prev, act]);
      // then snapshot onto today
      const entRes = await axios.post(
        `${API}/api/spoons/day/${day.id}/entries`,
        { name: act.name, cost: act.cost },
        { headers: hdrs },
      );
      if (entries.length === 0) track("spoon_day_planned");
      setEntries((prev) => [...prev, entRes.data.entry]);
      setCustomName("");
      setCustomCost("");
      setShowAdd(false);
    } catch (err) {
      console.error("Add custom failed:", err);
    }
  };

  // save an activity's cost on blur (value comes directly from the input to avoid stale closure)
  const saveActivityCost = async (id, rawVal) => {
    const val = parseInt(rawVal);
    if (!val || val < 1) return;
    try {
      const res = await axios.put(
        `${API}/api/spoons/activities/${id}`,
        { cost: val },
        { headers: hdrs },
      );
      setActivities((prev) => prev.map((a) => a.id === id ? res.data.activity : a));
    } catch (err) {
      console.error("Save activity cost failed:", err);
    }
  };

  const archiveActivity = async (id) => {
    try {
      await axios.put(`${API}/api/spoons/activities/${id}`, { archived: true }, { headers: hdrs });
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Archive activity failed:", err);
    }
  };

  // ── Baseline & budget ───────────────────────────────────────────────────────

  const saveBaseline = async () => {
    const val = parseInt(baselineInput);
    if (!val || val < 1) return;
    try {
      await axios.put(`${API}/api/spoons/baseline`, { baseline: val }, { headers: hdrs });
      setBaseline(val);
      setShowBaseline(false);
      await loadDay(selectedDate);
    } catch (err) {
      console.error("Save baseline failed:", err);
    }
  };

  const saveBudget = async () => {
    if (!day) return;
    const val = parseInt(budgetInput);
    if (!val || val < 1) return;
    try {
      const res = await axios.put(
        `${API}/api/spoons/day/${day.id}`,
        { budget: val },
        { headers: hdrs },
      );
      setDay(res.data.day);
      setShowBudgetEdit(false);
    } catch (err) {
      console.error("Save budget failed:", err);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const spent = entries.reduce((s, e) => s + e.cost, 0);
  const over  = day ? spent > day.budget : false;
  const isToday = selectedDate === todayDateStr();

  // ── Render ──────────────────────────────────────────────────────────────────

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
            Spoon Center
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAdd(true); setEditingCosts(false); }}
              disabled={!day}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              <FiPlus size={14} /> Add
            </button>
            <NavHamburger />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className="relative z-10 p-6 pb-20 flex flex-col gap-4"
        style={{ maxWidth: "1024px", margin: "0 auto", width: "100%" }}
      >
        {/* Date selector */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => moveDay(-1)}
            className="p-2 rounded-full hover:opacity-70 transition-opacity"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <FiChevronLeft size={16} color="white" />
          </button>
          <span
            className="text-white font-medium text-sm"
            style={{ minWidth: 128, textAlign: "center" }}
          >
            {formatDateLabel(selectedDate)}
          </span>
          <button
            onClick={() => moveDay(1)}
            className="p-2 rounded-full hover:opacity-70 transition-opacity"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <FiChevronRight size={16} color="white" />
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayDateStr())}
              className="px-3 py-1 rounded-full text-xs hover:opacity-80 transition-opacity"
              style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              Today
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
            />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Loading…</p>
          </div>
        ) : day ? (
          <>
            {/* Budget ring card */}
            <div
              className="rounded-2xl p-6 flex flex-col items-center gap-3"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              <BudgetRing spent={spent} budget={day.budget} />
              <button
                onClick={() => { setBudgetInput(String(day.budget)); setShowBudgetEdit(true); }}
                className="text-xs hover:opacity-80 transition-opacity"
                style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline" }}
              >
                Adjust today's budget
              </button>
            </div>

            {/* Over-budget nudge */}
            {over && (
              <div
                className="rounded-2xl px-5 py-4"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
              >
                <p className="text-sm" style={{ color: "#DEC8DA" }}>
                  That's a fuller day than usual — anything that can wait until tomorrow? 💜
                </p>
              </div>
            )}

            {/* Activity list */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              {entries.length === 0 ? (
                <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    No activities planned yet — add the first one for your day.
                  </p>
                  <button
                    onClick={() => { setShowAdd(true); setEditingCosts(false); }}
                    className="px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90"
                    style={{ background: "white", color: "#7C6BAE" }}
                  >
                    + Add activity
                  </button>
                </div>
              ) : (
                <>
                  {entries.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-4 py-3 transition-opacity"
                      style={{
                        borderBottom: idx < entries.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined,
                        opacity: entry.completed ? 0.5 : 1,
                      }}
                    >
                      {/* Check toggle */}
                      <button
                        onClick={() => toggleEntry(entry)}
                        className="flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                        style={{
                          borderColor: entry.completed ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                          background: entry.completed ? "rgba(255,255,255,0.18)" : "transparent",
                        }}
                      >
                        {entry.completed && <FiCheck size={12} color="white" />}
                      </button>

                      {/* Name + cost */}
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-sm"
                          style={{
                            color: "white",
                            textDecoration: entry.completed ? "line-through" : "none",
                          }}
                        >
                          {entry.name}
                        </span>
                        <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                          · {entry.cost}
                        </span>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:opacity-75 transition-opacity"
                        style={{ background: "rgba(255,255,255,0.15)" }}
                      >
                        <FiX size={11} color="rgba(255,255,255,0.7)" />
                      </button>
                    </div>
                  ))}

                  {/* Add-more row */}
                  <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => { setShowAdd(true); setEditingCosts(false); }}
                      className="w-full py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
                      style={{ background: "white", color: "#7C6BAE" }}
                    >
                      + Add activity
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* ── Add Activity modal ──────────────────────────────────────────────── */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
            style={{
              background: "rgba(90,75,130,0.97)",
              border: "1px solid rgba(255,255,255,0.25)",
              maxHeight: "85vh",
            }}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center px-5 pt-5 pb-3 flex-shrink-0">
              <p
                className="font-medium text-white"
                style={{ fontFamily: "Playfair Display, Georgia, serif" }}
              >
                Add to day
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingCosts((v) => !v)}
                  className="px-3 py-1 rounded-full text-xs transition-all"
                  style={{
                    background: editingCosts ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {editingCosts ? "Done editing" : "Edit costs"}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="p-1.5 rounded-full hover:opacity-70"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <FiX size={14} color="white" />
                </button>
              </div>
            </div>

            {/* Library list */}
            <div className="overflow-y-auto flex-1">
              {activities.length === 0 ? (
                <p className="px-5 py-4 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  No activities yet — add one below.
                </p>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center px-5 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {!editingCosts ? (
                      <button
                        className="flex-1 text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
                        onClick={() => addFromLibrary(act)}
                      >
                        <span className="text-sm text-white">{act.name}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {act.cost} spoons
                        </span>
                      </button>
                    ) : (
                      <>
                        <span className="text-sm text-white flex-1">{act.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            defaultValue={act.cost}
                            onBlur={(e) => saveActivityCost(act.id, e.target.value)}
                            className="w-14 px-2 py-1 rounded-lg text-sm text-center outline-none"
                            style={frostedInput}
                          />
                          <button
                            onClick={() => archiveActivity(act.id)}
                            className="text-xs px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
                            style={{ background: "rgba(176,112,136,0.4)", color: "rgba(255,255,255,0.85)" }}
                          >
                            Hide
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}

              {/* Custom activity form */}
              <div
                className="px-5 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
              >
                <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Add a custom activity
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Activity name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                    style={frostedInput}
                  />
                  <input
                    type="number"
                    placeholder="Cost"
                    min={1}
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    className="w-20 px-3 py-2 rounded-lg text-sm text-center outline-none placeholder-white/30"
                    style={frostedInput}
                  />
                </div>
                <button
                  onClick={addCustom}
                  disabled={!customName.trim() || !customCost}
                  className="w-full py-2 rounded-full text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "white", color: "#7C6BAE" }}
                >
                  Add &amp; save to library
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Baseline modal ──────────────────────────────────────────────────── */}
      {showBaseline && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
            style={{ background: "rgba(90,75,130,0.97)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <p
              className="text-lg font-medium text-white"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              Your spoon baseline 🥄
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
              Spoon theory is a way to budget limited daily energy. You decide what a typical day looks like, and Spoon Center helps you plan against it.
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              How many spoons is a typical day for you?
            </p>
            <input
              type="number"
              min={1}
              placeholder="e.g. 12"
              value={baselineInput}
              onChange={(e) => setBaselineInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveBaseline()}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
              style={frostedInput}
              autoFocus
            />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              Spoon Center will gently adjust your daily budget up or down based on how you feel each day.
            </p>
            <button
              onClick={saveBaseline}
              disabled={!baselineInput || parseInt(baselineInput) < 1}
              className="w-full py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "white", color: "#7C6BAE" }}
            >
              Set my baseline
            </button>
          </div>
        </div>
      )}

      {/* ── Budget edit modal ───────────────────────────────────────────────── */}
      {showBudgetEdit && day && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
            style={{ background: "rgba(90,75,130,0.97)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <div className="flex justify-between items-center">
              <p
                className="font-medium text-white"
                style={{ fontFamily: "Playfair Display, Georgia, serif" }}
              >
                Adjust today's budget
              </p>
              <button
                onClick={() => setShowBudgetEdit(false)}
                className="p-1.5 rounded-full hover:opacity-70"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <FiX size={14} color="white" />
              </button>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              Overrides the auto-computed budget for this day only. Future check-ins won't update it.
            </p>
            <input
              type="number"
              min={1}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={frostedInput}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowBudgetEdit(false)}
                className="flex-1 py-2 rounded-full text-sm"
                style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}
              >
                Cancel
              </button>
              <button
                onClick={saveBudget}
                disabled={!budgetInput || parseInt(budgetInput) < 1}
                className="flex-1 py-2 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-40"
                style={{ background: "white", color: "#7C6BAE" }}
              >
                Save
              </button>
            </div>
            <button
              onClick={() => {
                setShowBudgetEdit(false);
                setBaselineInput(baseline != null ? String(baseline) : "");
                setShowBaseline(true);
              }}
              className="text-xs text-center hover:opacity-80 transition-opacity"
              style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}
            >
              Adjust my baseline instead
            </button>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
