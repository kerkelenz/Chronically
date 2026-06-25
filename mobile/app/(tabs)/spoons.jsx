import { useCallback, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import ScreenBackground from "../../components/ScreenBackground";
import Card from "../../components/Card";
import api from "../../lib/api";

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

  const baselinePromptedRef = useRef(false);
  const isFirstLoadRef = useRef(true);

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchActivities() {
    const res = await api.get("/api/spoons/activities");
    setActivities(res.data.activities || []);
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
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);

      (async () => {
        try {
          await fetchActivities();
          await fetchDay(selectedDate);
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

  // ── Date navigation ────────────────────────────────────────────────────────

  function navigateDay(delta) {
    setLoading(true);
    setSelectedDate((prev) => shiftDate(prev, delta));
  }

  function jumpToToday() {
    setLoading(true);
    setSelectedDate(todayStr());
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

  const spent = entries.reduce((s, e) => s + e.cost, 0);
  const over = day ? spent > day.budget : false;
  const isToday = selectedDate === todayStr();
  const bottomPad = insets.bottom + 72;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
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

        {day && (
          <>
            {/* Budget ring card */}
            <Card style={styles.ringCard}>
              <BudgetRing spent={spent} budget={day.budget} />
              <TouchableOpacity
                onPress={() => {
                  setBudgetInput(String(day.budget));
                  setShowBudget(true);
                }}
                activeOpacity={0.75}
                style={{ marginTop: 10 }}
              >
                <Text style={styles.adjustLink}>Adjust today's budget</Text>
              </TouchableOpacity>
            </Card>

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
                    No activities planned yet — add the first one for your day.
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
      <Modal
        animationType="slide"
        transparent
        statusBarTranslucent
        visible={showAdd}
        onRequestClose={() => setShowAdd(false)}
      >
        <KeyboardAvoidingView
          style={styles.scrimBottom}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAdd(false)} />
          <View style={styles.sheet}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Add to day</Text>
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
                <TouchableOpacity
                  onPress={() => setShowAdd(false)}
                  style={styles.closeCircleBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Library rows */}
              {activities.length === 0 ? (
                <Text style={[styles.emptyText, { padding: 16 }]}>
                  No activities in library yet.
                </Text>
              ) : (
                activities.map((act) => (
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
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
            <Text style={styles.modalTitle}>Your spoon baseline 🥄</Text>
            <Text style={styles.explainerText}>
              Spoon theory is a way to budget limited daily energy. You decide what a typical day
              looks like, and Spoon Center helps you plan against it.
            </Text>
            <Text style={styles.fieldLabel}>
              How many spoons is a typical day for you?
            </Text>
            <TextInput
              style={styles.textInput}
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
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!baselineInput || parseInt(baselineInput, 10) < 1) && styles.btnDisabled,
              ]}
              onPress={saveBaseline}
              disabled={!baselineInput || parseInt(baselineInput, 10) < 1}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Set my baseline</Text>
            </TouchableOpacity>
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
            <View style={styles.dialogTitleRow}>
              <Text style={styles.modalTitle}>Adjust today's budget</Text>
              <TouchableOpacity
                onPress={() => setShowBudget(false)}
                style={styles.closeCircleBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              Overrides the auto-computed budget for this day only.
            </Text>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              value={budgetInput}
              onChangeText={setBudgetInput}
              autoFocus
            />
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.ghostBtn, { flex: 1 }]}
                onPress={() => setShowBudget(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { flex: 1 },
                  (!budgetInput || parseInt(budgetInput, 10) < 1) && styles.btnDisabled,
                ]}
                onPress={saveBudget}
                disabled={!budgetInput || parseInt(budgetInput, 10) < 1}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
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
  scrimBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  scrimCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "rgba(52,38,86,0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  dialog: {
    backgroundColor: "rgba(70,55,108,0.98)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 22,
    rowGap: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  sheetHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  dialogTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 17,
    color: "white",
  },
  closeCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
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
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    color: "white",
    fontFamily: "Lato_400Regular",
    fontSize: 15,
  },
  explainerText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
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
  ghostBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostBtnText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  btnRow: {
    flexDirection: "row",
    columnGap: 10,
  },
  baselineLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
    textAlign: "center",
  },
});
