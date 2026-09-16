import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../../components/BottomSheet";
import { SheetHeader, SheetFooter, formStyles } from "../../components/FormSheet";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import ScreenBackground from "../../components/ScreenBackground";
import Card from "../../components/Card";
import api from "../../lib/api";
import { track } from "../../lib/analytics";

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function parseDateStr(dateStr) {
  return new Date(dateStr + "T12:00:00");
}

function shiftDate(dateStr, delta) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

function formatDateLabel(dateStr) {
  const today = todayStr();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === tomorrow) return "Tomorrow";
  return parseDateStr(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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
    month: "long",
    year: "numeric",
  });
}

// the calendar starts expanded; collapsing it is remembered across visits
const CAL_OPEN_KEY = "spoon_calendar_open";

// ── Budget ring ───────────────────────────────────────────────────────────────

const RING_SIZE = 180;
const RING_R = 73;
const RING_C = RING_SIZE / 2;
const RING_SW = 14;
const RING_CIRC = 2 * Math.PI * RING_R;

function BudgetRing({ spent, budget }) {
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const offset = RING_CIRC * (1 - ratio);
  const remaining = budget - spent;
  const over = spent > budget;

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* track */}
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={RING_SW}
          fill="none"
        />
        {/* arc */}
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          stroke={over ? "#DEC8DA" : "white"}
          strokeWidth={RING_SW}
          fill="none"
          strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90, ${RING_C}, ${RING_C})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringNum, over && { color: "#DEC8DA" }]}>
          {Math.abs(remaining)}
        </Text>
        <Text style={[styles.ringSubLabel, over && { color: "rgba(222,200,218,0.75)" }]}>
          {over ? "over" : "spoons left"}
        </Text>
        <Text style={styles.ringTotal}>
          {spent} / {budget}
        </Text>
      </View>
    </View>
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
      ? `: ${summary.spent} of ${summary.budget} spoons ${isFuture ? "planned" : "used"}`
      : ": nothing planned"
  }`;

  // a past or current day's bar reads as spoons spent; a future day's as spoons
  // pencilled in. the deep purple stays legible against the light card, where
  // a lighter lavender would wash out
  const barColor = over ? "#E6C79A" : isFuture ? "#4F4178" : "white";

  return (
    <TouchableOpacity
      onPress={() => onSelect(date)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.calCell,
        isSelected && styles.calCellSelected,
        isToday && !isSelected && styles.calCellToday,
      ]}
    >
      <Text
        style={[
          styles.calCellNum,
          !planned && !isSelected && styles.calCellNumEmpty,
          isSelected && styles.calCellNumSelected,
          (isToday || isSelected) && styles.calCellNumStrong,
        ]}
      >
        {Number(date.slice(8))}
      </Text>
      {/* fullness bar - the track only appears on days with a plan */}
      <View style={[styles.calBarTrack, planned && styles.calBarTrackOn, isSelected && planned && styles.calBarTrackSelected]}>
        {planned && (
          <View
            style={{
              height: "100%",
              width: `${Math.max(Math.round(ratio * 100), 12)}%`,
              backgroundColor: isSelected && !over ? "#7C6BAE" : barColor,
            }}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

function MonthCalendar({
  month,
  monthDays,
  selectedDate,
  today,
  onSelectDate,
  onMoveMonth,
  onJumpToMonth,
}) {
  const cells = buildMonthGrid(month);
  const viewingOtherMonth = month !== monthOf(today);

  return (
    <View>
      {/* Month header */}
      <View style={styles.calHeader}>
        <TouchableOpacity
          onPress={() => onMoveMonth(-1)}
          style={styles.calNavBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={14} color="white" />
        </TouchableOpacity>
        <View style={styles.calHeaderMid}>
          <Text style={styles.calMonthLabel}>{formatMonthLabel(month)}</Text>
          {viewingOtherMonth && (
            <TouchableOpacity
              onPress={onJumpToMonth}
              style={styles.calThisMonthBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.calThisMonthText}>This month</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => onMoveMonth(1)}
          style={styles.calNavBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={14} color="white" />
        </TouchableOpacity>
      </View>

      {/* Weekday header */}
      <View style={styles.calRow}>
        {WEEKDAY_INITIALS.map((w, i) => (
          <Text key={i} style={styles.calWeekday}>
            {w}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.calGrid}>
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
            <View key={`pad-${i}`} style={styles.calCellPad} />
          )
        )}
      </View>

      {/* Legend */}
      <View style={styles.calLegend}>
        <LegendItem color="white" label="Spoons used" />
        <LegendItem color="#4F4178" label="Planned ahead" />
        <LegendItem color="#E6C79A" label="Over budget" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SpoonCenterScreen() {
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [day, setDay] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);

  // modal flags
  const [showAdd, setShowAdd] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  // form state
  const [editingCosts, setEditingCosts] = useState(false);
  const [baselineInput, setBaselineInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCost, setCustomCost] = useState("");

  // calendar: the month on screen, its per-day summaries, and whether it's open
  const [calMonth, setCalMonth] = useState(monthOf(todayStr()));
  // { month, days: { [date]: summary } } — the key travels with the map so a
  // map from the previous month is never mistaken for the one on screen
  const [monthDays, setMonthDays] = useState(null);
  const [calOpen, setCalOpen] = useState(true);

  // the previous day's entries, offered as a starting point on an empty day
  const [prevEntries, setPrevEntries] = useState([]);

  // the day fetch's closure predates the month fetch, so it reads the map by ref
  const monthDaysRef = useRef(null);

  const baselinePromptedRef = useRef(false);
  const isFirstLoadRef = useRef(true);
  // once per session: a removed auto-filled entry must not come back on refocus
  const autoFillDoneRef = useRef(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchActivities() {
    const res = await api.get("/api/spoons/activities");
    const acts = res.data.activities || [];
    setActivities(acts);
    return acts;
  }

  async function fetchDay(date) {
    const res = await api.get(`/api/spoons/day?date=${date}`);
    setDay(res.data.day);
    setEntries(res.data.entries || []);
    const bl = res.data.baseline;
    setBaseline(bl);
    if (bl === null && !baselinePromptedRef.current) {
      baselinePromptedRef.current = true;
      setBaselineInput("");
      setShowBaseline(true);
    }
    return res.data;
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          const acts = await fetchActivities();
          const dayData = await fetchDay(selectedDate);
          let currentEntries = dayData.entries || [];

          // auto-plan the pinned routine into an empty today
          if (selectedDate === todayStr() && !autoFillDoneRef.current) {
            autoFillDoneRef.current = true;
            const pinned = acts
              .filter((a) => a.pinned)
              .sort((a, b) => a.name.localeCompare(b.name));
            if (dayData.day && currentEntries.length === 0 && pinned.length > 0) {
              const created = [];
              for (const act of pinned) {
                const res = await api.post(
                  `/api/spoons/day/${dayData.day.id}/entries`,
                  { name: act.name, cost: act.cost }
                );
                created.push(res.data.entry);
              }
              if (created.length > 0) track("spoon_day_planned");
              currentEntries = created;
              setEntries(created);
            }
          }

          // the empty state offers to copy the previous day's plan, so peek at
          // it - but only when the month view doesn't already know that day is
          // empty. GET /day creates the row it returns, so skipping the call
          // also keeps browsing the calendar from seeding days nobody planned
          if (currentEntries.length === 0) {
            const prevDate = shiftDate(selectedDate, -1);
            const known = monthDaysRef.current;
            const knownEmpty =
              known &&
              known.month === monthOf(prevDate) &&
              !(known.days[prevDate]?.planned > 0);
            if (knownEmpty) {
              setPrevEntries([]);
            } else {
              const prevRes = await api.get(`/api/spoons/day?date=${prevDate}`);
              setPrevEntries(prevRes.data.entries || []);
            }
          } else {
            setPrevEntries([]);
          }
        } catch (err) {
          console.error("Spoon Center fetch failed:", err);
        } finally {
          if (active) {
            setLoading(false);
            isFirstLoadRef.current = false;
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  // one request per month for the calendar. the endpoint is read-only, so
  // paging through months never creates day rows the user hasn't opened.
  // re-runs on focus and when the viewed day changes, so a day that was edited
  // and then navigated away from keeps its bar in the grid
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await api.get(`/api/spoons/month?month=${calMonth}`);
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
      return () => {
        active = false;
      };
    }, [calMonth, selectedDate])
  );

  // remember whether the calendar is expanded between visits
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(CAL_OPEN_KEY)
      .then((v) => {
        if (active && v === "0") setCalOpen(false);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function toggleCalendar() {
    setCalOpen((v) => {
      AsyncStorage.setItem(CAL_OPEN_KEY, v ? "0" : "1").catch(() => {});
      return !v;
    });
  }

  // ── Date navigation ────────────────────────────────────────────────────────

  // every path that changes the day goes through here so the calendar's month
  // always follows the day being viewed
  function selectDate(date) {
    if (date === selectedDate) return;
    setLoading(true);
    setSelectedDate(date);
    setCalMonth(monthOf(date));
  }

  function navigateDay(delta) {
    selectDate(shiftDate(selectedDate, delta));
  }

  function jumpToToday() {
    selectDate(todayStr());
  }

  // ── Entry actions ──────────────────────────────────────────────────────────

  async function toggleEntry(entry) {
    try {
      const res = await api.put(`/api/spoons/entries/${entry.id}`, {
        completed: !entry.completed,
      });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.data.entry : e)));
    } catch (err) {
      console.error("Toggle entry failed:", err);
    }
  }

  async function removeEntry(id) {
    try {
      await api.delete(`/api/spoons/entries/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Remove entry failed:", err);
    }
  }

  // ── Add modal actions ──────────────────────────────────────────────────────

  async function addFromLibrary(activity) {
    if (!day) return;
    try {
      const res = await api.post(`/api/spoons/day/${day.id}/entries`, {
        name: activity.name,
        cost: activity.cost,
      });
      // planning starts when the day's first entry lands
      if (entries.length === 0) track("spoon_day_planned");
      setEntries((prev) => [...prev, res.data.entry]);
      setShowAdd(false);
    } catch (err) {
      console.error("Add from library failed:", err);
    }
  }

  async function addCustomActivity() {
    if (!customName.trim() || !customCost || !day) return;
    const cost = parseInt(customCost, 10);
    if (!cost || cost < 1) return;
    try {
      const actRes = await api.post("/api/spoons/activities", {
        name: customName.trim(),
        cost,
      });
      const act = actRes.data.activity;
      setActivities((prev) => [...prev, act]);
      const entRes = await api.post(`/api/spoons/day/${day.id}/entries`, {
        name: act.name,
        cost: act.cost,
      });
      if (entries.length === 0) track("spoon_day_planned");
      setEntries((prev) => [...prev, entRes.data.entry]);
      setCustomName("");
      setCustomCost("");
      setShowAdd(false);
    } catch (err) {
      console.error("Add custom failed:", err);
    }
  }

  async function updateActivityCost(id, rawVal) {
    const cost = parseInt(rawVal, 10);
    if (!cost || cost < 1) return;
    try {
      const res = await api.put(`/api/spoons/activities/${id}`, { cost });
      setActivities((prev) => prev.map((a) => (a.id === id ? res.data.activity : a)));
    } catch (err) {
      console.error("Update activity cost failed:", err);
    }
  }

  async function archiveActivity(id) {
    try {
      await api.put(`/api/spoons/activities/${id}`, { archived: true });
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Archive activity failed:", err);
    }
  }

  async function togglePin(act) {
    try {
      const res = await api.put(`/api/spoons/activities/${act.id}`, {
        pinned: !act.pinned,
      });
      setActivities((prev) =>
        prev.map((a) => (a.id === act.id ? res.data.activity : a))
      );
    } catch (err) {
      console.error("Toggle pin failed:", err);
    }
  }

  // add a batch of {name, cost} onto the selected day, skipping anything already
  // on it - shared by "copy the previous day" and "add my routine"
  async function addEntries(items) {
    if (!day || items.length === 0) return;
    try {
      const existing = new Set(entries.map((e) => e.name));
      const created = [];
      for (const item of items) {
        if (existing.has(item.name)) continue;
        const res = await api.post(`/api/spoons/day/${day.id}/entries`, {
          name: item.name,
          cost: item.cost,
        });
        created.push(res.data.entry);
      }
      if (entries.length === 0 && created.length > 0) track("spoon_day_planned");
      if (created.length > 0) setEntries((prev) => [...prev, ...created]);
    } catch (err) {
      console.error("Bulk add failed:", err);
    }
  }

  function copyPreviousDay() {
    return addEntries(prevEntries);
  }

  // the pinned routine auto-fills today only; this puts it on any other day
  function addRoutine() {
    return addEntries(
      [...pinnedActivities].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  // ── Baseline & budget ──────────────────────────────────────────────────────

  async function saveBaseline() {
    const val = parseInt(baselineInput, 10);
    if (!val || val < 1) return;
    try {
      await api.put("/api/spoons/baseline", { baseline: val });
      setBaseline(val);
      setShowBaseline(false);
      setLoading(true);
      await fetchDay(selectedDate);
      setLoading(false);
    } catch (err) {
      console.error("Save baseline failed:", err);
    }
  }

  async function saveBudget() {
    if (!day) return;
    const val = parseInt(budgetInput, 10);
    if (!val || val < 1) return;
    try {
      const res = await api.put(`/api/spoons/day/${day.id}`, { budget: val });
      setDay(res.data.day);
      setShowBudget(false);
    } catch (err) {
      console.error("Save budget failed:", err);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const today = todayStr();
  const spent = entries.reduce((s, e) => s + e.cost, 0);
  const over = day ? spent > day.budget : false;
  const isToday = selectedDate === today;
  const isPast = selectedDate < today;
  const isFuture = selectedDate > today;
  const pinnedActivities = activities.filter((a) => a.pinned);
  const bottomPad = insets.bottom + 72;

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
            },
          }
        : monthDays.days
      : null;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading && !day) {
    return (
      <ScreenBackground edges={["top", "left", "right"]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </ScreenBackground>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <ScreenBackground edges={["top", "left", "right"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Spoon Center</Text>
          <TouchableOpacity
            style={[styles.addBtn, !day && { opacity: 0.4 }]}
            onPress={() => {
              setShowAdd(true);
              setEditingCosts(false);
            }}
            activeOpacity={0.8}
            disabled={!day}
          >
            <Ionicons name="add" size={15} color="white" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Date selector */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            onPress={() => navigateDay(-1)}
            style={styles.chevronBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={18} color="white" />
          </TouchableOpacity>

          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>

          <TouchableOpacity
            onPress={() => navigateDay(1)}
            style={styles.chevronBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={18} color="white" />
          </TouchableOpacity>

          {!isToday && (
            <TouchableOpacity
              onPress={jumpToToday}
              style={styles.todayBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Budget ring card */}
        {loading || !day ? (
          <Card style={styles.ringCard}>
            <View style={styles.ringPlaceholder}>
              <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
            </View>
          </Card>
        ) : (
          <Card style={styles.ringCard}>
            <BudgetRing spent={spent} budget={day.budget} />
            {isToday &&
              day.budgetEdited === false &&
              baseline != null &&
              day.budget !== baseline && (
                <Text style={styles.budgetAdjustNote}>
                  Adjusted from your baseline ({baseline}) after today's check-in
                </Text>
              )}
            {isFuture && day.budgetEdited === false && (
              <Text style={styles.budgetAdjustNote}>
                Planning ahead — this budget will adjust once you check in that day.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => {
                setBudgetInput(String(day.budget));
                setShowBudget(true);
              }}
              activeOpacity={0.75}
              style={{ marginTop: 10 }}
            >
              <Text style={styles.adjustLink}>
                {isToday ? "Adjust today's budget" : "Adjust this day's budget"}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Calendar — outside the day's loading branch so switching days never
            takes the grid away mid-navigation */}
        <Card>
          <TouchableOpacity
            onPress={toggleCalendar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ expanded: calOpen }}
            style={styles.calToggle}
          >
            <Text style={styles.calToggleLabel}>Calendar</Text>
            <View style={styles.calToggleRight}>
              {!calOpen && (
                <Text style={styles.calToggleMonth}>{formatMonthLabel(calMonth)}</Text>
              )}
              <Ionicons
                name={calOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color="rgba(255,255,255,0.7)"
              />
            </View>
          </TouchableOpacity>
          {calOpen && (
            <View style={{ marginTop: 12 }}>
              <MonthCalendar
                month={calMonth}
                monthDays={calendarDays}
                selectedDate={selectedDate}
                today={today}
                onSelectDate={selectDate}
                onMoveMonth={(delta) => setCalMonth((m) => shiftMonth(m, delta))}
                onJumpToMonth={() => setCalMonth(monthOf(today))}
              />
            </View>
          )}
        </Card>

        {!loading && day && (
          <>
            {/* Over-budget nudge */}
            {over && (
              <Card>
                <Text style={styles.nudgeText}>
                  That's a fuller day than usual — anything that can wait until tomorrow? 💜
                </Text>
              </Card>
            )}

            {/* Activity list */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {entries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {isPast
                      ? "Nothing was planned for this day — you can still fill it in."
                      : isFuture
                        ? `Nothing planned for ${formatDateLabel(selectedDate)} yet — sketch the day out ahead of time.`
                        : "No activities planned yet — add the first one for your day."}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => {
                      setShowAdd(true);
                      setEditingCosts(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyAddBtnText}>+ Add activity</Text>
                  </TouchableOpacity>
                  {/* the auto-plan only runs for today, so any other day gets
                      the routine on request instead */}
                  {!isToday && pinnedActivities.length > 0 && (
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={addRoutine}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.copyBtnText}>
                        Add my routine ({pinnedActivities.length}{" "}
                        {pinnedActivities.length === 1 ? "activity" : "activities"})
                      </Text>
                    </TouchableOpacity>
                  )}
                  {prevEntries.length > 0 && (
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={copyPreviousDay}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.copyBtnText}>
                        Copy {isToday ? "yesterday's" : "the day before's"} plan (
                        {prevEntries.length}{" "}
                        {prevEntries.length === 1 ? "activity" : "activities"})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  {entries.map((entry, idx) => (
                    <View
                      key={entry.id}
                      style={[
                        styles.entryRow,
                        idx < entries.length - 1 && styles.entryDivider,
                        entry.completed && styles.entryDimmed,
                      ]}
                    >
                      {/* Check toggle */}
                      <TouchableOpacity
                        onPress={() => toggleEntry(entry)}
                        style={[
                          styles.checkCircle,
                          entry.completed && styles.checkCircleActive,
                        ]}
                        activeOpacity={0.7}
                      >
                        {entry.completed && (
                          <Ionicons name="checkmark" size={13} color="white" />
                        )}
                      </TouchableOpacity>

                      {/* Name · cost */}
                      <Text
                        style={[
                          styles.entryName,
                          entry.completed && styles.entryNameStruck,
                        ]}
                        numberOfLines={1}
                      >
                        {entry.name}
                        <Text style={styles.entryCost}> · {entry.cost}</Text>
                      </Text>

                      {/* Remove */}
                      <TouchableOpacity
                        onPress={() => removeEntry(entry.id)}
                        style={styles.removeBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={13} color="rgba(255,255,255,0.5)" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add-more footer */}
                  <View style={styles.addMoreRow}>
                    <TouchableOpacity
                      style={styles.addMoreBtn}
                      onPress={() => {
                        setShowAdd(true);
                        setEditingCosts(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addMoreBtnText}>+ Add activity</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {/* ── Add Activity Sheet ──────────────────────────────────────────────── */}
      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} scrollable={false} cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
            {/* Sheet header */}
            <SheetHeader
              title="Add to day"
              right={(
                <View style={styles.sheetHeaderRight}>
                  <TouchableOpacity
                    onPress={() => setEditingCosts((v) => !v)}
                    style={[styles.editCostsBtn, editingCosts && styles.editCostsBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editCostsBtnText}>
                      {editingCosts ? "Done" : "Edit costs"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <ScrollView
              contentContainerStyle={{ paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Library rows */}
              {hasPinned && <Text style={styles.routineLabel}>Routine</Text>}
              {sortedActivities.length === 0 ? (
                <Text style={[styles.emptyText, { padding: 16 }]}>
                  No activities in library yet.
                </Text>
              ) : (
                sortedActivities.map((act) => (
                  <TouchableOpacity
                    key={act.id}
                    style={styles.libraryRow}
                    onPress={!editingCosts ? () => addFromLibrary(act) : undefined}
                    activeOpacity={editingCosts ? 1 : 0.72}
                  >
                    {!editingCosts ? (
                      <>
                        <Text style={styles.libraryName}>{act.name}</Text>
                        <Text style={styles.libraryCost}>{act.cost} spoons</Text>
                        <TouchableOpacity
                          onPress={() => togglePin(act)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={
                            act.pinned
                              ? `Unpin ${act.name} from routine`
                              : `Pin ${act.name} to routine`
                          }
                        >
                          <Ionicons
                            name={act.pinned ? "pin" : "pin-outline"}
                            size={16}
                            color={act.pinned ? "#B7A6D9" : "rgba(255,255,255,0.4)"}
                          />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.libraryName, { flex: 1 }]}>{act.name}</Text>
                        <TextInput
                          key={`cost-${act.id}-${act.cost}`}
                          style={styles.costInput}
                          keyboardType="number-pad"
                          defaultValue={String(act.cost)}
                          onEndEditing={(e) => updateActivityCost(act.id, e.nativeEvent.text)}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          onPress={() => archiveActivity(act.id)}
                          style={styles.hideBtn}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.hideBtnText}>Hide</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* Custom activity form */}
              <View style={styles.customSection}>
                <Text style={styles.sectionLabel}>Add a custom activity</Text>
                <View style={styles.customRow}>
                  <TextInput
                    style={styles.customNameInput}
                    placeholder="Activity name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={customName}
                    onChangeText={setCustomName}
                    returnKeyType="done"
                  />
                  <TextInput
                    style={styles.customCostInput}
                    placeholder="Cost"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="number-pad"
                    value={customCost}
                    onChangeText={setCustomCost}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!customName.trim() || !customCost) && styles.btnDisabled,
                  ]}
                  onPress={addCustomActivity}
                  disabled={!customName.trim() || !customCost}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Add &amp; save to library</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Single-action footer — taps apply immediately, nothing to cancel */}
            <SheetFooter onSave={() => setShowAdd(false)} saveLabel="Done" />
      </BottomSheet>

      {/* ── Baseline Modal ──────────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={showBaseline}
        onRequestClose={() => setShowBaseline(false)}
      >
        <KeyboardAvoidingView
          style={styles.scrimCenter}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.dialog}>
            <SheetHeader
              title="Your spoon baseline"
              style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
            />
            <View style={{ rowGap: 6 }}>
              <Text style={styles.explainerText}>
                🥄 Spoon theory is the community's shorthand for limited daily energy —
                each activity spends some of today's spoons.
              </Text>
              <Text style={styles.exampleText}>
                Examples (yours may differ): Shower 2 · Cooking a meal 2 · Errand 3 ·
                Work meeting 2 · Social visit 3–4
              </Text>
              <Text style={styles.exampleText}>
                Most people start somewhere around 10–14. Yours is yours — change it
                anytime.
              </Text>
            </View>
            <Text style={styles.fieldLabel}>
              How many spoons is a typical day for you?
            </Text>
            <TextInput
              style={formStyles.input}
              keyboardType="number-pad"
              placeholder="e.g. 12"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={baselineInput}
              onChangeText={setBaselineInput}
              autoFocus
            />
            <Text style={styles.hintText}>
              Spoon Center will gently adjust your daily budget based on how you feel each day.
            </Text>
            <SheetFooter
              onCancel={() => setShowBaseline(false)}
              onSave={saveBaseline}
              saveLabel="Set my baseline"
              canSave={!!baselineInput && parseInt(baselineInput, 10) >= 1}
              style={{ paddingHorizontal: 0 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Budget Modal ────────────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={showBudget}
        onRequestClose={() => setShowBudget(false)}
      >
        <KeyboardAvoidingView
          style={styles.scrimCenter}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.dialog}>
            <SheetHeader
              title={isToday ? "Adjust today's budget" : "Adjust this day's budget"}
              style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
            />
            <Text style={styles.hintText}>
              Overrides the auto-computed budget for this day only.
            </Text>
            <TextInput
              style={formStyles.input}
              keyboardType="number-pad"
              value={budgetInput}
              onChangeText={setBudgetInput}
              autoFocus
            />
            <SheetFooter
              onCancel={() => setShowBudget(false)}
              onSave={saveBudget}
              canSave={!!budgetInput && parseInt(budgetInput, 10) >= 1}
              style={{ paddingHorizontal: 0 }}
            />
            <TouchableOpacity
              onPress={() => {
                setShowBudget(false);
                setBaselineInput(baseline != null ? String(baseline) : "");
                setShowBaseline(true);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.baselineLink}>Adjust my baseline instead</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────────
  scroll: {
    padding: 16,
    rowGap: 12,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 12,
  },
  loadingText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },

  // ── Page header ───────────────────────────────────────────────────────────
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 22,
    color: "white",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  addBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "white",
  },

  // ── Date selector ─────────────────────────────────────────────────────────
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
  },
  chevronBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dateLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "white",
    minWidth: 110,
    textAlign: "center",
  },
  todayBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  todayBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "white",
  },

  // ── Budget ring ───────────────────────────────────────────────────────────
  ringCard: {
    alignItems: "center",
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 40,
    color: "white",
    lineHeight: 46,
  },
  ringSubLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  ringTotal: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
  },
  adjustLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textDecorationLine: "underline",
    textAlign: "center",
  },

  budgetAdjustNote: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginTop: 8,
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  ringPlaceholder: {
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  calToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calToggleLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "white",
  },
  calToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  calToggleMonth: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calHeaderMid: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  calMonthLabel: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 15,
    color: "white",
  },
  calNavBtn: {
    padding: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  calThisMonthBtn: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  calThisMonthText: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },
  calRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  calWeekday: {
    fontFamily: "Lato_400Regular",
    flexBasis: `${100 / 7}%`,
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  // each cell claims a seventh of the row, so weeks line up under the headers
  calCell: {
    flexBasis: `${100 / 7}%`,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  calCellPad: {
    flexBasis: `${100 / 7}%`,
    height: 42,
  },
  calCellSelected: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  calCellToday: {
    borderColor: "#B7A6D9",
  },
  calCellNum: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "white",
  },
  calCellNumEmpty: {
    color: "rgba(255,255,255,0.62)",
  },
  calCellNumSelected: {
    color: "#7C6BAE",
  },
  calCellNumStrong: {
    fontFamily: "Lato_700Bold",
  },
  calBarTrack: {
    width: 18,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  calBarTrackOn: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  calBarTrackSelected: {
    backgroundColor: "rgba(124,107,174,0.25)",
  },
  calLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 14,
    rowGap: 4,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 3,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
  },

  // ── Nudge ─────────────────────────────────────────────────────────────────
  nudgeText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "#DEC8DA",
    lineHeight: 20,
  },

  // ── Entry list ────────────────────────────────────────────────────────────
  emptyState: {
    padding: 24,
    alignItems: "center",
    rowGap: 14,
  },
  emptyText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
  },
  emptyAddBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "white",
  },
  emptyAddBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "#7C6BAE",
  },
  copyBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  copyBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    columnGap: 10,
  },
  entryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  entryDimmed: {
    opacity: 0.48,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleActive: {
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  entryName: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "white",
    flex: 1,
  },
  entryNameStruck: {
    textDecorationLine: "line-through",
  },
  entryCost: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  addMoreRow: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  addMoreBtn: {
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: "center",
  },
  addMoreBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "#7C6BAE",
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  scrimCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dialog: {
    backgroundColor: "rgba(70,55,108,0.98)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 22,
    rowGap: 14,
  },
  sheetHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  editCostsBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  editCostsBtnActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  editCostsBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },

  // Library list
  routineLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    columnGap: 10,
  },
  libraryName: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "white",
    flex: 1,
  },
  libraryCost: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  costInput: {
    width: 52,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    color: "white",
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  hideBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(176,112,136,0.4)",
  },
  hideBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },

  // Custom section
  customSection: {
    padding: 16,
    rowGap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  sectionLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  customRow: {
    flexDirection: "row",
    columnGap: 8,
  },
  customNameInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    color: "white",
    fontFamily: "Lato_400Regular",
    fontSize: 14,
  },
  customCostInput: {
    width: 70,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    color: "white",
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    textAlign: "center",
  },

  // Shared form fields
  fieldLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  explainerText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
  },
  exampleText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
  },
  hintText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.38,
  },
  primaryBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "#7C6BAE",
  },
  baselineLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
    textAlign: "center",
  },
});
