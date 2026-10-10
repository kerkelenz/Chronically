import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FiPlus, FiCheck, FiX, FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp,
} from "react-icons/fi";
import { BsPin, BsPinFill } from "react-icons/bs";
import { useAuth } from "../hooks/useAuth";
import { track } from "../lib/analytics";
import Navigation from "../components/Navigation";
import PageHeader from "../components/PageHeader";
import FormModal, { ModalFooter, labelClass, ConfirmDialog } from "../components/FormModal";

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

function formatFullDate(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ── Month helpers (a month key is "YYYY-MM") ─────────────────────────────────

function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

function shiftMonth(month, delta) {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });
}

// the calendar starts expanded; collapsing it is remembered across visits
// Sunday-first, to match buildMonthGrid. Never mix the two conventions.
function weekStartOf(dateStr) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// whole days, via local noon like parseDateStr, so a clock change cannot shift it
function shiftDateStr(dateStr, delta) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Oct 4 - 10", "Sep 27 - Oct 3", "Dec 27, 2026 - Jan 2, 2027"
function formatWeekLabel(startStr) {
  const start = parseDateStr(startStr);
  const end = parseDateStr(shiftDateStr(startStr, 6));
  const sameYear = start.getFullYear() === end.getFullYear();
  const thisYear = new Date().getFullYear();
  const withYear = !sameYear || start.getFullYear() !== thisYear;

  const left = start.toLocaleDateString("en-US",
    withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
  const right = end.toLocaleDateString("en-US",
    withYear
      ? { month: "short", day: "numeric", year: "numeric" }
      : start.getMonth() === end.getMonth()
        ? { day: "numeric" }
        : { month: "short", day: "numeric" });
  return `${left} \u2013 ${right}`;
}

const CAL_OPEN_KEY = "spoonCalendarOpen";
const CAL_MODE_KEY = "spoonCalendarMode";

// Today's card only appears in the evening: asking at 9am how the day went is
// a question nobody can answer yet.
const REFLECTION_OPENS_HOUR = 17;
const REFLECTION_NOTE_MAX = 280;
const REFLECTION_COUNTER_FROM = 240;
const REFLECTION_CHOICES = [
  { value: "lighter", label: "Lighter than planned" },
  { value: "about_right", label: "About right" },
  { value: "heavier", label: "Heavier than planned" },
];

function readCalOpenPref() {
  try {
    return localStorage.getItem(CAL_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

// Week is the default: seven days with real numbers answers "how is this week
// going" better than a month of 3px bars. The choice is remembered per device.
function readCalModePref() {
  try {
    return localStorage.getItem(CAL_MODE_KEY) === "month" ? "month" : "week";
  } catch {
    return "week";
  }
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
          {over ? "over" : Math.abs(remaining) === 1 ? "spoon left" : "spoons left"}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 5 }}>
          {spent} / {budget}
        </span>
      </div>
    </div>
  );
}

// ── Month calendar ────────────────────────────────────────────────────────────

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

// the grid a month is drawn on, Sunday-first, padded with nulls so every row is
// full - blank cells render as gaps rather than the neighbouring months' days
function buildMonthGrid(month) {
  const [year, mon] = month.split("-").map(Number);
  const lead = new Date(year, mon - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, mon, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// one day cell: the date, plus a bar showing how full that day is
function CalendarDay({ date, summary, isSelected, isToday, isFuture, onSelect }) {
  const planned = !!summary && summary.planned > 0;
  const over = planned && summary.budget > 0 && summary.spent > summary.budget;
  const ratio =
    planned && summary.budget > 0 ? Math.min(summary.spent / summary.budget, 1) : 0;

  const label = `${formatFullDate(date)}${
    planned
      ? `: ${summary.spent} of ${summary.budget} ${summary.budget === 1 ? "spoon" : "spoons"} ${isFuture ? "planned" : "used"}`
      : ": nothing planned"
  }`;

  // a past or current day's bar reads as spoons spent; a future day's as spoons
  // pencilled in. the deep purple stays legible against the light card, where
  // a lighter lavender would wash out
  const barColor = over ? "#E6C79A" : isFuture ? "#4F4178" : "white";

  return (
    <button
      onClick={() => onSelect(date)}
      aria-label={label}
      aria-current={isSelected ? "date" : undefined}
      title={label}
      className="flex flex-col items-center justify-center gap-1 rounded-lg transition-all hover:opacity-80"
      style={{
        height: 42,
        background: isSelected ? "rgba(255,255,255,0.9)" : "transparent",
        border: isToday && !isSelected ? "1.5px solid #B7A6D9" : "1.5px solid transparent",
      }}
    >
      <span
        style={{
          fontSize: 13,
          lineHeight: 1,
          color: isSelected
            ? "#7C6BAE"
            : planned
              ? "white"
              : "rgba(255,255,255,0.62)",
          fontWeight: isToday || isSelected ? 600 : 400,
        }}
      >
        {Number(date.slice(8))}
      </span>
      {/* fullness bar - hidden entirely on days with no plan */}
      <span
        style={{
          width: 18,
          height: 3,
          borderRadius: 2,
          overflow: "hidden",
          background: planned
            ? isSelected
              ? "rgba(124,107,174,0.25)"
              : "rgba(255,255,255,0.22)"
            : "transparent",
        }}
      >
        {planned && (
          <span
            style={{
              display: "block",
              height: "100%",
              width: `${Math.max(Math.round(ratio * 100), 12)}%`,
              background: isSelected && !over ? "#7C6BAE" : barColor,
            }}
          />
        )}
      </span>
    </button>
  );
}

function MonthCalendar({
  month,
  monthDays,
  selectedDate,
  today,
  loading,
  onSelectDate,
  onMoveMonth,
  onJumpToMonth,
}) {
  const cells = buildMonthGrid(month);
  const viewingOtherMonth = month !== today.slice(0, 7);

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onMoveMonth(-1)}
          aria-label="Previous month"
          className="p-1.5 rounded-full hover:opacity-70 transition-opacity"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <FiChevronLeft size={14} color="white" />
        </button>
        <div className="flex items-center gap-2">
          <span
            className="text-white text-sm"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            {formatMonthLabel(month)}
          </span>
          {viewingOtherMonth && (
            <button
              onClick={onJumpToMonth}
              className="px-2 py-0.5 rounded-full text-xs hover:opacity-80 transition-opacity"
              style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
            >
              This month
            </button>
          )}
        </div>
        <button
          onClick={() => onMoveMonth(1)}
          aria-label="Next month"
          className="p-1.5 rounded-full hover:opacity-70 transition-opacity"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <FiChevronRight size={14} color="white" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_INITIALS.map((w, i) => (
          <span
            key={i}
            className="text-center"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1" style={{ opacity: loading ? 0.5 : 1 }}>
        {cells.map((date, i) =>
          date ? (
            <CalendarDay
              key={date}
              date={date}
              summary={monthDays?.[date]}
              isSelected={date === selectedDate}
              isToday={date === today}
              isFuture={date > today}
              onSelect={onSelectDate}
            />
          ) : (
            <span key={`pad-${i}`} />
          )
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3">
        <LegendItem color="white" label="Spoons used" />
        <LegendItem color="#4F4178" label="Planned ahead" />
        <LegendItem color="#E6C79A" label="Over budget" />
      </div>
    </div>
  );
}

/**
 * Seven days at once, Sunday to Saturday. The month grid only has room for a
 * 3px bar; a week has room for the numbers, which is the whole reason this mode
 * exists. Colours and the bar come from CalendarDay rather than a new palette.
 *
 * A day with no plan shows only its date: no 0/12, no dash. Null is nothing.
 */
function WeekStrip({
  weekStart,
  weekDays,
  selectedDate,
  today,
  loading,
  onSelectDate,
  onMoveWeek,
  onJumpToWeek,
}) {
  const dates = Array.from({ length: 7 }, (_, i) => shiftDateStr(weekStart, i));
  const viewingOtherWeek = weekStart !== weekStartOf(today);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onMoveWeek(-1)}
          aria-label="Previous week"
          className="p-1.5 rounded-full hover:opacity-70 transition-opacity"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <FiChevronLeft size={14} color="white" />
        </button>
        <div className="flex items-center gap-2">
          <span
            className="text-white text-sm"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            {formatWeekLabel(weekStart)}
          </span>
          {viewingOtherWeek && (
            <button
              onClick={onJumpToWeek}
              className="px-2 py-0.5 rounded-full text-xs hover:opacity-80 transition-opacity"
              style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
            >
              This week
            </button>
          )}
        </div>
        <button
          onClick={() => onMoveWeek(1)}
          aria-label="Next week"
          className="p-1.5 rounded-full hover:opacity-70 transition-opacity"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <FiChevronRight size={14} color="white" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" style={{ opacity: loading ? 0.5 : 1 }}>
        {dates.map((date, i) => (
          <WeekCell
            key={date}
            date={date}
            initial={WEEKDAY_INITIALS[i]}
            summary={weekDays?.[date]}
            isSelected={date === selectedDate}
            isToday={date === today}
            isFuture={date > today}
            onSelect={onSelectDate}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3">
        <LegendItem color="white" label="Spoons used" />
        <LegendItem color="#4F4178" label="Planned ahead" />
        <LegendItem color="#E6C79A" label="Over budget" />
        <LegendItem color="#DEC8DA" label="Reflected" dot />
      </div>
    </div>
  );
}

function WeekCell({ date, initial, summary, isSelected, isToday, isFuture, onSelect }) {
  const planned = !!summary && summary.planned > 0;
  const over = planned && summary.budget > 0 && summary.spent > summary.budget;
  const ratio = planned && summary.budget > 0 ? Math.min(summary.spent / summary.budget, 1) : 0;
  // a future day cannot have been reflected on, so it never shows the dot
  const reflected = !!summary && summary.reflection != null && !isFuture;

  const REFLECTION_WORDS = {
    lighter: "lighter than planned",
    about_right: "about right",
    heavier: "heavier than planned",
  };
  const label = `${formatFullDate(date)}${
    planned
      ? `: ${summary.spent} of ${summary.budget} ${summary.budget === 1 ? "spoon" : "spoons"} ${isFuture ? "planned" : "used"}`
      : ": nothing planned"
  }${reflected ? `. You noted it felt ${REFLECTION_WORDS[summary.reflection]}` : ""}`;

  const barColor = over ? "#E6C79A" : isFuture ? "#4F4178" : "white";

  return (
    <button
      onClick={() => onSelect(date)}
      aria-label={label}
      aria-current={isSelected ? "date" : undefined}
      title={label}
      className="flex flex-col items-center justify-start gap-0.5 rounded-lg py-1.5 transition-all hover:opacity-80"
      style={{
        minHeight: 72,
        background: isSelected ? "rgba(255,255,255,0.9)" : "transparent",
        border: isToday && !isSelected ? "1.5px solid #B7A6D9" : "1.5px solid transparent",
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1, color: isSelected ? "rgba(124,107,174,0.75)" : "rgba(255,255,255,0.45)" }}>
        {initial}
      </span>
      <span
        style={{
          fontSize: 13,
          lineHeight: 1.3,
          color: isSelected ? "#7C6BAE" : planned ? "white" : "rgba(255,255,255,0.62)",
          fontWeight: isToday || isSelected ? 600 : 400,
        }}
      >
        {Number(date.slice(8))}
      </span>
      {planned && (
        <>
          <span style={{ fontSize: 11, lineHeight: 1.2, color: isSelected ? "#7C6BAE" : "rgba(255,255,255,0.85)" }}>
            {summary.spent}/{summary.budget}
          </span>
          <span
            style={{
              width: 18, height: 3, borderRadius: 2, overflow: "hidden",
              background: isSelected ? "rgba(124,107,174,0.25)" : "rgba(255,255,255,0.22)",
            }}
          >
            <span
              style={{
                display: "block", height: "100%",
                width: `${Math.max(Math.round(ratio * 100), 12)}%`,
                background: isSelected && !over ? "#7C6BAE" : barColor,
              }}
            />
          </span>
        </>
      )}
      {reflected && (
        <span style={{ width: 6, height: 6, borderRadius: 3, background: "#DEC8DA", marginTop: 2 }} />
      )}
    </button>
  );
}

function LegendItem({ color, label, dot }) {
  return (
    <span className="flex items-center gap-1.5">
      <span style={dot
        ? { width: 6, height: 6, borderRadius: 3, background: color }
        : { width: 12, height: 3, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{label}</span>
    </span>
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

  // calendar: the month on screen, its per-day summaries, and whether it's open
  const [calMonth,     setCalMonth]       = useState(monthOf(todayDateStr()));
  // { month, days: { [date]: summary } } — the key travels with the map so a
  // map from the previous month is never mistaken for the one on screen
  const [monthDays,    setMonthDays]      = useState(null);
  const [calOpen,      setCalOpen]        = useState(readCalOpenPref);
  const [calMode,      setCalMode]        = useState(readCalModePref);
  const [calWeekStart, setCalWeekStart]   = useState(() => weekStartOf(todayDateStr()));
  // { start, days: { [date]: summary } } — the key travels with the map so a
  // previous week's summaries are never drawn for the week on screen
  const [weekDays,     setWeekDays]       = useState(null);

  // the end-of-day reflection
  const [reflectError, setReflectError]   = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteDraft,    setNoteDraft]      = useState("");
  const [clearConfirm, setClearConfirm]   = useState(false);

  // the previous day's entries, offered as a starting point on an empty day
  const [prevEntries,  setPrevEntries]    = useState([]);

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

  // loadDay's closure predates the month fetch, so it reads the map through a ref
  const monthDaysRef = useRef(null);

  const baselinePromptedRef = useRef(false);
  // once per session: a removed auto-filled entry must not come back on revisit
  const autoFillDoneRef = useRef(false);

  // ── API helpers ─────────────────────────────────────────────────────────────

  const loadActivities = async () => {
    const res = await axios.get(`${API}/api/spoons/activities`, { headers: hdrs });
    const acts = res.data.activities || [];
    setActivities(acts);
    return acts;
  };

  const loadDay = async (date, acts = activities) => {
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

      let currentEntries = res.data.entries || [];

      // auto-plan the pinned routine into an empty today
      if (date === todayDateStr() && !autoFillDoneRef.current) {
        autoFillDoneRef.current = true;
        const pinned = acts
          .filter((a) => a.pinned)
          .sort((a, b) => a.name.localeCompare(b.name));
        if (res.data.day && currentEntries.length === 0 && pinned.length > 0) {
          const created = [];
          for (const act of pinned) {
            const entRes = await axios.post(
              `${API}/api/spoons/day/${res.data.day.id}/entries`,
              { name: act.name, cost: act.cost },
              { headers: hdrs },
            );
            created.push(entRes.data.entry);
          }
          if (created.length > 0) track("spoon_day_planned");
          currentEntries = created;
          setEntries(created);
        }
      }

      // the empty state offers to copy the previous day's plan, so peek at it -
      // but only when the month view doesn't already know that day is empty.
      // GET /day creates the row it returns, so skipping the call also keeps
      // browsing the calendar from seeding days nobody planned
      if (currentEntries.length === 0) {
        const prev = parseDateStr(date);
        prev.setDate(prev.getDate() - 1);
        const prevDate = prev.toLocaleDateString("en-CA");
        const known = monthDaysRef.current;
        const knownEmpty =
          known &&
          known.month === monthOf(prevDate) &&
          !(known.days[prevDate]?.planned > 0);
        if (knownEmpty) {
          setPrevEntries([]);
        } else {
          const prevRes = await axios.get(
            `${API}/api/spoons/day?date=${prevDate}`,
            { headers: hdrs },
          );
          setPrevEntries(prevRes.data.entries || []);
        }
      } else {
        setPrevEntries([]);
      }
    } catch (err) {
      console.error("Failed to load day:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      let acts = activities;
      try {
        acts = await loadActivities();
      } catch (err) {
        console.error("Load activities failed:", err);
      }
      loadDay(selectedDate, acts);
    })();
  }, [token, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // one request per month for the calendar. the endpoint is read-only, so
  // paging through months never creates day rows the user hasn't opened.
  // re-runs when the viewed day changes too, so a day that was edited and then
  // navigated away from keeps its bar in the grid
  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/spoons/month?month=${calMonth}`, {
          headers: hdrs,
        });
        if (!active) return;
        const days = {};
        for (const d of res.data.days || []) days[d.date] = d;
        const next = { month: calMonth, days };
        monthDaysRef.current = next;
        setMonthDays(next);
      } catch (err) {
        console.error("Month fetch failed:", err);
        if (active) {
          const next = { month: calMonth, days: {} };
          monthDaysRef.current = next;
          setMonthDays(next);
        }
      }
    })();
    return () => { active = false; };
  }, [token, calMonth, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // one request per week, for the same reasons as the month: read-only, so
  // paging never creates rows, and it re-runs when the viewed day changes so an
  // edited day keeps its numbers in the strip
  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/spoons/week?date=${calWeekStart}`, {
          headers: hdrs,
        });
        if (!active) return;
        const days = {};
        for (const d of res.data.days || []) days[d.date] = d;
        setWeekDays({ start: calWeekStart, days });
      } catch (err) {
        console.error("Week fetch failed:", err);
        // an empty strip, never an error banner: the week is a convenience
        if (active) setWeekDays({ start: calWeekStart, days: {} });
      }
    })();
    return () => { active = false; };
  }, [token, calWeekStart, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // remember whether the calendar is expanded between visits
  useEffect(() => {
    try {
      localStorage.setItem(CAL_OPEN_KEY, calOpen ? "1" : "0");
    } catch {
      // private mode / storage disabled - the preference just won't stick
    }
  }, [calOpen]);

  // and which mode it was left in
  useEffect(() => {
    try {
      localStorage.setItem(CAL_MODE_KEY, calMode);
    } catch {
      // private mode / storage disabled - the preference just won't stick
    }
  }, [calMode]);

  // ── Date nav ────────────────────────────────────────────────────────────────

  // every path that changes the day goes through here so the calendar's month
  // always follows the day being viewed
  const selectDate = (date) => {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setCalMonth(monthOf(date));
    setCalWeekStart(weekStartOf(date));
  };

  const moveDay = (delta) => {
    const d = parseDateStr(selectedDate);
    d.setDate(d.getDate() + delta);
    selectDate(d.toLocaleDateString("en-CA"));
  };

  // ── Reflection ──────────────────────────────────────────────────────────────

  // Optimistic: the pill answers at once. A failure puts the old value back and
  // says so quietly in the card, never red.
  const saveReflection = async (body, optimistic) => {
    if (!day) return;
    const previous = { reflection: day.reflection ?? null, reflectionNote: day.reflectionNote ?? null };
    setReflectError("");
    setDay((d) => ({ ...d, ...optimistic }));
    try {
      const res = await axios.put(`${API}/api/spoons/day/${day.id}/reflection`, body, { headers: hdrs });
      setDay(res.data.day);
    } catch (err) {
      console.error("Reflection save failed:", err);
      setDay((d) => ({ ...d, ...previous }));
      setReflectError("Couldn't save that \u2014 try again in a moment.");
    }
  };

  // no note key, so an existing note survives changing the answer
  const pickReflection = (value) => {
    if (!day || day.reflection === value) return;
    saveReflection({ reflection: value }, { reflection: value });
  };

  const saveReflectionNote = async () => {
    const text = noteDraft.trim();
    await saveReflection(
      { reflection: day.reflection, reflectionNote: text || null },
      { reflectionNote: text || null },
    );
    setShowNoteEditor(false);
  };

  const clearReflection = async () => {
    setClearConfirm(false);
    await saveReflection({ reflection: null }, { reflection: null, reflectionNote: null });
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

  const togglePin = async (act) => {
    try {
      const res = await axios.put(
        `${API}/api/spoons/activities/${act.id}`,
        { pinned: !act.pinned },
        { headers: hdrs },
      );
      setActivities((prev) => prev.map((a) => (a.id === act.id ? res.data.activity : a)));
    } catch (err) {
      console.error("Toggle pin failed:", err);
    }
  };

  // add a batch of {name, cost} onto the selected day, skipping anything already
  // on it - shared by "copy the previous day" and "add my routine"
  const addEntries = async (items) => {
    if (!day || items.length === 0) return;
    try {
      const existing = new Set(entries.map((e) => e.name));
      const created = [];
      for (const item of items) {
        if (existing.has(item.name)) continue;
        const res = await axios.post(
          `${API}/api/spoons/day/${day.id}/entries`,
          { name: item.name, cost: item.cost },
          { headers: hdrs },
        );
        created.push(res.data.entry);
      }
      if (entries.length === 0 && created.length > 0) track("spoon_day_planned");
      if (created.length > 0) setEntries((prev) => [...prev, ...created]);
    } catch (err) {
      console.error("Bulk add failed:", err);
    }
  };

  const copyPreviousDay = () => addEntries(prevEntries);

  // the pinned routine auto-fills today only; this puts it on any other day
  const addRoutine = () =>
    addEntries(
      [...pinnedActivities].sort((a, b) => a.name.localeCompare(b.name))
    );

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

  const today   = todayDateStr();
  const spent   = entries.reduce((s, e) => s + e.cost, 0);
  const over    = day ? spent > day.budget : false;
  const isToday = selectedDate === today;
  const isPast  = selectedDate < today;
  const isFuture = selectedDate > today;
  const pinnedActivities = activities.filter((a) => a.pinned);

  // library sorted routine-first, then alphabetical
  const sortedActivities = [...activities].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const hasPinned = sortedActivities.some((a) => a.pinned);

  // the grid draws the fetched month, with the day being viewed overlaid from
  // live state so edits land in its cell without waiting for a refetch
  const calendarDays =
    monthDays && monthDays.month === calMonth
      ? day && day.date === selectedDate && monthOf(selectedDate) === calMonth
        ? {
            ...monthDays.days,
            [selectedDate]: {
              date: selectedDate,
              budget: day.budget,
              budgetEdited: day.budgetEdited,
              spent,
              planned: entries.length,
              completed: entries.filter((e) => e.completed).length,
              reflection: day.reflection ?? null,
              hasNote: !!(day.reflectionNote && day.reflectionNote.trim()),
            },
          }
        : monthDays.days
      : null;

  // the selected day's cell is drawn from live state, so a reflection or a
  // completed activity shows in the strip without waiting for a refetch
  const liveCell = day && day.date === selectedDate
    ? {
        date: selectedDate,
        budget: day.budget,
        budgetEdited: day.budgetEdited,
        spent,
        planned: entries.length,
        completed: entries.filter((e) => e.completed).length,
        reflection: day.reflection ?? null,
        hasNote: !!(day.reflectionNote && day.reflectionNote.trim()),
      }
    : null;

  const weekCells =
    weekDays && weekDays.start === calWeekStart
      ? liveCell && selectedDate >= calWeekStart && selectedDate <= shiftDateStr(calWeekStart, 6)
        ? { ...weekDays.days, [selectedDate]: liveCell }
        : weekDays.days
      : null;

  /**
   * Never for a future day. For today, only from the evening — or already, if
   * they have answered. For a past day, only when there was a plan to compare
   * with, or an answer already given.
   */
  const showReflection = (() => {
    if (!day || selectedDate > today) return false;
    if (day.reflection) return true;
    if (selectedDate === today) return new Date().getHours() >= REFLECTION_OPENS_HOUR;
    return entries.length > 0;
  })();

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
        <PageHeader
          title="Spoon Center"
          actions={
            <>
              <button
                onClick={() => { setShowAdd(true); setEditingCosts(false); }}
                disabled={!day}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
              >
                <FiPlus size={14} /> Add
              </button>
            </>
          }
        />
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
            aria-label="Previous day"
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
            aria-label="Next day"
            className="p-2 rounded-full hover:opacity-70 transition-opacity"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <FiChevronRight size={16} color="white" />
          </button>
          {!isToday && (
            <button
              onClick={() => selectDate(today)}
              className="px-3 py-1 rounded-full text-xs hover:opacity-80 transition-opacity"
              style={{ background: "rgba(255,255,255,0.25)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              Today
            </button>
          )}
        </div>

        {loading || !day ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
            />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Loading…</p>
          </div>
        ) : (
          <>
            {/* Budget ring card */}
            <div
              className="rounded-2xl p-6 flex flex-col items-center gap-3"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              <BudgetRing spent={spent} budget={day.budget} />
              {isToday &&
                day.budgetEdited === false &&
                baseline != null &&
                day.budget !== baseline && (
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Adjusted from your baseline ({baseline}) after today's check-in
                  </p>
                )}
              {isFuture && day.budgetEdited === false && (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Planning ahead — this budget will adjust once you check in that day.
                </p>
              )}
              <button
                onClick={() => { setBudgetInput(String(day.budget)); setShowBudgetEdit(true); }}
                className="text-xs hover:opacity-80 transition-opacity"
                style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline" }}
              >
                {isToday ? "Adjust today's budget" : "Adjust this day's budget"}
              </button>
            </div>
          </>
        )}

        {/* Calendar — outside the day's loading branch so switching days never
            takes the grid away mid-navigation */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setCalOpen((v) => !v)}
              aria-expanded={calOpen}
              className="flex-1 flex items-center justify-between gap-2 hover:opacity-80 transition-opacity text-left"
            >
              <span className="text-sm text-white">Calendar</span>
              {!calOpen && (
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {calMode === "week" ? formatWeekLabel(calWeekStart) : formatMonthLabel(calMonth)}
                </span>
              )}
            </button>

            {/* Week | Month. One card, two modes: the card already owns
                collapse, day selection and the live overlay. */}
            {calOpen && (
              <div
                className="flex rounded-full p-0.5"
                style={{ background: "rgba(255,255,255,0.15)" }}
                role="group"
                aria-label="Calendar mode"
              >
                {[["week", "Week"], ["month", "Month"]].map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setCalMode(mode)}
                    aria-pressed={calMode === mode}
                    className="px-4 rounded-full text-xs transition-all"
                    style={{
                      minHeight: 44,
                      background: calMode === mode ? "white" : "transparent",
                      color: calMode === mode ? "#7C6BAE" : "rgba(255,255,255,0.75)",
                      fontWeight: calMode === mode ? 700 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setCalOpen((v) => !v)}
              aria-expanded={calOpen}
              aria-label={calOpen ? "Collapse calendar" : "Expand calendar"}
              className="p-2 hover:opacity-80 transition-opacity"
            >
              {calOpen
                ? <FiChevronUp size={16} color="rgba(255,255,255,0.7)" />
                : <FiChevronDown size={16} color="rgba(255,255,255,0.7)" />}
            </button>
          </div>
          {calOpen && (
            <>
              <div className="mt-3">
                {calMode === "week" ? (
                  <WeekStrip
                    weekStart={calWeekStart}
                    weekDays={weekCells}
                    selectedDate={selectedDate}
                    today={today}
                    loading={!weekCells}
                    onSelectDate={selectDate}
                    onMoveWeek={(delta) => setCalWeekStart((w) => shiftDateStr(w, delta * 7))}
                    onJumpToWeek={() => setCalWeekStart(weekStartOf(today))}
                  />
                ) : (
                  <MonthCalendar
                    month={calMonth}
                    monthDays={calendarDays}
                    selectedDate={selectedDate}
                    today={today}
                    loading={!calendarDays}
                    onSelectDate={selectDate}
                    onMoveMonth={(delta) => setCalMonth((m) => shiftMonth(m, delta))}
                    onJumpToMonth={() => setCalMonth(monthOf(today))}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {loading || !day ? null : (
          <>
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
                    {isPast
                      ? "Nothing was planned for this day — you can still fill it in."
                      : isFuture
                        ? `Nothing planned for ${formatDateLabel(selectedDate)} yet — sketch the day out ahead of time.`
                        : "No activities planned yet — add the first one for your day."}
                  </p>
                  <button
                    onClick={() => { setShowAdd(true); setEditingCosts(false); }}
                    className="px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90"
                    style={{ background: "white", color: "#7C6BAE" }}
                  >
                    + Add activity
                  </button>
                  {/* the auto-plan only runs for today, so any other day gets the
                      routine on request instead */}
                  {!isToday && pinnedActivities.length > 0 && (
                    <button
                      onClick={addRoutine}
                      className="px-5 py-2 rounded-full text-sm transition-all hover:opacity-90"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(255,255,255,0.3)",
                      }}
                    >
                      Add my routine ({pinnedActivities.length}{" "}
                      {pinnedActivities.length === 1 ? "activity" : "activities"})
                    </button>
                  )}
                  {prevEntries.length > 0 && (
                    <button
                      onClick={copyPreviousDay}
                      className="px-5 py-2 rounded-full text-sm transition-all hover:opacity-90"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(255,255,255,0.3)",
                      }}
                    >
                      Copy {isToday ? "yesterday's" : "the day before's"} plan (
                      {prevEntries.length}{" "}
                      {prevEntries.length === 1 ? "activity" : "activities"})
                    </button>
                  )}
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
                      <button role="checkbox" aria-checked={entry.completed} aria-label={entry.name}
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
                      <button aria-label={`Remove ${entry.name}`}
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

            {/* ── End-of-day reflection ────────────────────────────────────── */}
            {showReflection && (
              <div
                className="rounded-2xl px-5 py-4 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <div>
                  <p className="text-white" style={{ fontSize: 15 }}>
                    {selectedDate === today ? "How did today actually go?" : "How did this day actually go?"}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                    One tap is enough. Only you see this.
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label={selectedDate === today ? "How did today actually go?" : "How did this day actually go?"}
                  className="flex flex-wrap gap-2"
                >
                  {REFLECTION_CHOICES.map((choice) => {
                    const selected = day.reflection === choice.value;
                    return (
                      <button
                        key={choice.value}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => pickReflection(choice.value)}
                        className="px-4 rounded-full text-sm transition-all hover:opacity-90"
                        style={{
                          minHeight: 44,
                          background: selected ? "white" : "rgba(255,255,255,0.12)",
                          border: "1px solid rgba(255,255,255,0.18)",
                          color: selected ? "#7C6BAE" : "white",
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>

                {day.reflection && (
                  <>
                    {day.reflectionNote && (
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-line" }}>
                        {day.reflectionNote}
                      </p>
                    )}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => { setNoteDraft(day.reflectionNote || ""); setShowNoteEditor(true); }}
                        className="text-xs underline hover:opacity-80 transition-opacity"
                        style={{ color: "rgba(255,255,255,0.7)", minHeight: 44 }}
                      >
                        {day.reflectionNote ? "Edit note" : "Add a note"}
                      </button>
                      <button
                        onClick={() => (day.reflectionNote ? setClearConfirm(true) : clearReflection())}
                        className="text-xs underline hover:opacity-80 transition-opacity"
                        style={{ color: "rgba(255,255,255,0.7)", minHeight: 44 }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                )}

                {reflectError && (
                  <p style={{ fontSize: 12, color: "#DEC8DA" }}>{reflectError}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Reflection note editor ──────────────────────────────────────────── */}
      {showNoteEditor && (
        <FormModal
          open
          onClose={() => setShowNoteEditor(false)}
          title="A note about this day"
          footer={
            <ModalFooter
              onCancel={() => setShowNoteEditor(false)}
              onSave={saveReflectionNote}
              canSave={noteDraft.length <= REFLECTION_NOTE_MAX}
            />
          }
        >
          <div className="pb-1">
            <label htmlFor="reflection-note" className={labelClass}>
              Note (optional)
            </label>
            <textarea
              id="reflection-note"
              rows={3}
              maxLength={REFLECTION_NOTE_MAX}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What made it lighter or heavier?"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder-white/40"
              style={frostedInput}
            />
            {noteDraft.length >= REFLECTION_COUNTER_FROM && (
              <p className="text-[11px] text-right mt-1 text-white/60" aria-live="polite">
                {noteDraft.length}/{REFLECTION_NOTE_MAX}
              </p>
            )}
          </div>
        </FormModal>
      )}

      <ConfirmDialog
        open={clearConfirm}
        onCancel={() => setClearConfirm(false)}
        onConfirm={clearReflection}
        title="Clear this reflection?"
        message="Your note for this day will be removed too."
        confirmLabel="Clear"
        cancelLabel="Keep"
      />

      {/* ── Add Activity modal ──────────────────────────────────────────────── */}
      {showAdd && (
        <FormModal
          open
          onClose={() => setShowAdd(false)}
          title="Add to day"
          bodyClassName=""
          right={
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
            </div>
          }
          footer={<ModalFooter onSave={() => setShowAdd(false)} saveLabel="Done" />}
        >
            {/* Library list */}
              {hasPinned && (
                <p
                  className="px-5 pt-3 pb-1 uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}
                >
                  Routine
                </p>
              )}
              {sortedActivities.length === 0 ? (
                <p className="px-5 py-4 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  No activities yet — add one below.
                </p>
              ) : (
                sortedActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center px-5 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {!editingCosts ? (
                      <>
                        <button
                          className="flex-1 text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
                          onClick={() => addFromLibrary(act)}
                        >
                          <span className="text-sm text-white">{act.name}</span>
                          <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.55)" }}>
                            {act.cost} {act.cost === 1 ? "spoon" : "spoons"}
                          </span>
                        </button>
                        <button
                          onClick={() => togglePin(act)}
                          aria-label={
                            act.pinned
                              ? `Unpin ${act.name} from routine`
                              : `Pin ${act.name} to routine`
                          }
                          className="flex-shrink-0 ml-3 p-1 hover:opacity-80 transition-opacity"
                        >
                          {act.pinned ? (
                            <BsPinFill size={14} color="#B7A6D9" />
                          ) : (
                            <BsPin size={14} color="rgba(255,255,255,0.4)" />
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-white flex-1">{act.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            defaultValue={act.cost} aria-label={`Spoon cost for ${act.name}`}
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
                    placeholder="Activity name" aria-label="Activity name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                    style={frostedInput}
                  />
                  <input
                    type="number"
                    placeholder="Cost" aria-label="Spoon cost"
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
        </FormModal>
      )}

      {/* ── Baseline modal ──────────────────────────────────────────────────── */}
      {showBaseline && (
        <FormModal
          open
          onClose={() => setShowBaseline(false)}
          title="Your spoon baseline"
          footer={
            <ModalFooter
              onCancel={() => setShowBaseline(false)}
              onSave={saveBaseline}
              saveLabel="Set my baseline"
              canSave={!!baselineInput && parseInt(baselineInput) >= 1}
            />
          }
        >
          <div className="flex flex-col gap-4 pb-1">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                🥄 Spoon theory is the community's shorthand for limited daily energy — each activity spends some of today's spoons.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                Examples (yours may differ): Shower 2 · Cooking a meal 2 · Errand 3 · Work meeting 2 · Social visit 3–4
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                Most people start somewhere around 10–14. Yours is yours — change it anytime.
              </p>
            </div>
            <label htmlFor="spoons-baseline" className="block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              How many spoons is a typical day for you?
            </label>
            <input
              id="spoons-baseline"
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
          </div>
        </FormModal>
      )}

      {/* ── Budget edit modal ───────────────────────────────────────────────── */}
      {showBudgetEdit && day && (
        <FormModal
          open
          onClose={() => setShowBudgetEdit(false)}
          title={isToday ? "Adjust today's budget" : "Adjust this day's budget"}
          footer={
            <ModalFooter
              onCancel={() => setShowBudgetEdit(false)}
              onSave={saveBudget}
              canSave={!!budgetInput && parseInt(budgetInput) >= 1}
            />
          }
        >
          <div className="flex flex-col gap-4 pb-1">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              Overrides the auto-computed budget for this day only. Future check-ins won't update it.
            </p>
            <input
              type="number"
              min={1}
              value={budgetInput} aria-label={isToday ? "Today's spoon budget" : "This day's spoon budget"}
              onChange={(e) => setBudgetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={frostedInput}
              autoFocus
            />
            <button
              onClick={() => {
                setShowBudgetEdit(false);
                setBaselineInput(baseline != null ? String(baseline) : "");
                setShowBaseline(true);
              }}
              className="text-xs text-center self-center hover:opacity-80 transition-opacity"
              style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}
            >
              Adjust my baseline instead
            </button>
          </div>
        </FormModal>
      )}

      <Navigation />
    </div>
  );
}
