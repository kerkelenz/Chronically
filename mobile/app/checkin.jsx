import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../components/ScreenBackground";
import { SOFT_ERROR } from "../components/FormSheet";

// Mirrors NOTE_MAX in server/lib/checkInNote.js, which is the authority and has
// the test. RN's maxLength counts the same UTF-16 units the server measures, so
// the field cannot hold a note the API would then refuse.
const NOTE_MAX = 280;
// The counter stays hidden until the limit is close; shown from the first
// keystroke it would turn a note into a word budget.
const NOTE_COUNTER_FROM = 240;
import LavenderConfetti from "../components/LavenderConfetti";
import LevelButtons from "../components/LevelButtons";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { track } from "../lib/analytics";
import { consumeDeliberateOpen } from "../lib/checkinNav";
import { METRIC_LABELS } from "../theme/metrics";
import { COMMON_SYMPTOMS, COMMON_MENTAL_SYMPTOMS, SYMPTOM_CATALOG } from "../theme/symptomCatalog";
import { SymptomIcon } from "../components/SymptomIcon";
import {
  AFFIRMATIONS,
  getTier,
  getIndividualToast,
  getComboToast,
} from "../theme/checkinCopy";
import { SUPPORT_TOAST_LINK } from "../theme/supportResources";

// dedupe a name list case-insensitively, preserving first-seen order + casing
function uniqByLower(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

// ── SymptomPicker ─────────────────────────────────────────────────────────────
// Personal symptom picker: the user's recents lead, then a condition-neutral
// default set, with search + add-your-own. Shared by the step-6 flow and the
// step-7 edit path (both route through step 6).

function SymptomPicker({ selected, onToggle, search, setSearch, recents, onAddCustom, onHide, trackingMode = "both" }) {
  const q = search.trim();
  const qLower = q.toLowerCase();

  const recentSet = new Set(recents.map((r) => r.toLowerCase()));
  // both quick-pick grids count as "shown somewhere", so a selected chip from
  // either doesn't get duplicated into YOUR SYMPTOMS
  const commonSet = new Set(
    [...COMMON_SYMPTOMS, ...COMMON_MENTAL_SYMPTOMS].map((d) => d.toLowerCase()),
  );
  // selected symptoms not shown in the non-search sections (recents / common) —
  // customs AND catalog-but-not-common picks — join YOUR SYMPTOMS so they stay
  // visible as selected this session
  const extraSelected = selected.filter(
    (s) => !recentSet.has(s.toLowerCase()) && !commonSet.has(s.toLowerCase()),
  );
  const yourAll = uniqByLower([...extraSelected, ...recents]);
  const yourShown = q
    ? yourAll.filter((s) => s.toLowerCase().includes(qLower))
    : yourAll.slice(0, 12);

  const yourSet = new Set(yourAll.map((s) => s.toLowerCase()));
  const SEARCH_MIN = 2;   // catalog search kicks in at 2+ chars
  const SEARCH_CAP = 12;  // ranked results shown before "keep typing"

  // resting view: the COMMON list; searching (2+ chars): the whole catalog
  const searchingCatalog = qLower.length >= SEARCH_MIN;
  // Resting view is mode-aware; searching always covers the whole catalog
  // whatever the mode — a mode changes what is offered first, never what exists.
  const showCommon = trackingMode !== "mental";
  const showMental = trackingMode !== "physical";
  const commonBase = searchingCatalog
    ? SYMPTOM_CATALOG.map((c) => c.name)
    : showCommon ? COMMON_SYMPTOMS : [];
  const commonAll = commonBase.filter((s) => !yourSet.has(s.toLowerCase()));

  let commonShown;
  let truncatedFrom = 0;
  if (!q) {
    commonShown = commonAll;
  } else {
    const matches = commonAll
      .filter((s) => s.toLowerCase().includes(qLower))
      .sort((a, b) => {
        const ra = a.toLowerCase().startsWith(qLower) ? 0 : 1;
        const rb = b.toLowerCase().startsWith(qLower) ? 0 : 1;
        return ra - rb || a.localeCompare(b);
      });
    if (matches.length > SEARCH_CAP) truncatedFrom = matches.length;
    commonShown = matches.slice(0, SEARCH_CAP);
  }

  // MOOD & MIND only appears at rest — in search everything is one Results list
  const commonShownSet = new Set(commonShown.map((x) => x.toLowerCase()));
  const mentalShown =
    searchingCatalog || q || !showMental
      ? []
      : COMMON_MENTAL_SYMPTOMS.filter(
          (x) => !yourSet.has(x.toLowerCase()) && !commonShownSet.has(x.toLowerCase()),
        );

  const visible = [...yourShown, ...commonShown, ...mentalShown];
  const showAdd = qLower.length >= SEARCH_MIN && visible.length === 0;

  const renderChip = (s, removable) => {
    const active = selected.includes(s);
    return (
      <View key={s} style={[styles.symptomChip, active && styles.symptomChipActive]}>
        <TouchableOpacity
          onPress={() => onToggle(s)}
          style={styles.symptomChipMain}
          activeOpacity={0.8}
        >
          <SymptomIcon symptom={s} size={16} color={active ? "#7C6BAE" : "white"} />
          <Text style={[styles.symptomText, active && styles.symptomTextActive]}>{s}</Text>
        </TouchableOpacity>
        {removable && (
          <TouchableOpacity
            onPress={() => onHide(s)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${s} from your symptoms`}
          >
            <Ionicons
              name="close"
              size={12}
              color={active ? "#7C6BAE" : "rgba(255,255,255,0.7)"}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.pickerWrap}>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search or add a symptom…" accessibilityLabel="Search or add a symptom"
        placeholderTextColor="rgba(255,255,255,0.4)"
        autoCapitalize="none"
        returnKeyType="done"
      />
      {searchingCatalog ? (
        visible.length > 0 && (
          <View style={styles.pickerSection}>
            <Text style={styles.sectionLabel}>Results</Text>
            <View style={styles.symptomsGrid}>
              {yourShown.map((s) => renderChip(s, recentSet.has(s.toLowerCase())))}
              {commonShown.map((s) => renderChip(s, false))}
            </View>
          </View>
        )
      ) : (
        <>
          {yourShown.length > 0 && (
            <View style={styles.pickerSection}>
              <Text style={styles.sectionLabel}>Your symptoms</Text>
              <View style={styles.symptomsGrid}>
                {yourShown.map((s) => renderChip(s, recentSet.has(s.toLowerCase())))}
              </View>
            </View>
          )}
          {commonShown.length > 0 && (
            <View style={styles.pickerSection}>
              <Text style={styles.sectionLabel}>Common</Text>
              <View style={styles.symptomsGrid}>
                {commonShown.map((s) => renderChip(s, false))}
              </View>
            </View>
          )}
          {mentalShown.length > 0 && (
            <View style={styles.pickerSection}>
              <Text style={styles.sectionLabel}>Mood &amp; mind</Text>
              <View style={styles.symptomsGrid}>
                {mentalShown.map((s) => renderChip(s, false))}
              </View>
            </View>
          )}
        </>
      )}
      {truncatedFrom > 0 && (
        <Text style={styles.searchHint}>
          Showing {commonShown.length} of {truncatedFrom} — keep typing to narrow
        </Text>
      )}
      {showAdd && (
        <TouchableOpacity style={styles.addChip} onPress={() => onAddCustom(q)} activeOpacity={0.85}>
          <Text style={styles.addChipText}>+ Add "{q}"</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

function ReviewRow({ label, value, labelMap, onEdit, emptyLabel = "Skipped" }) {
  return (
    <View style={styles.reviewRow}>
      {/* Left spacer mirrors the edit icon width for true centering */}
      <View style={styles.reviewSpacer} />
      <View style={styles.reviewCenter}>
        <Text style={styles.reviewLabel}>{label}</Text>
        {/* null means not asked or skipped — never a value, never a zero. Pain
            words it as "No pain" so the review echoes the button that set it. */}
        <Text style={styles.reviewValue}>{value == null ? emptyLabel : labelMap[value]}</Text>
      </View>
      <TouchableOpacity accessibilityLabel={`Edit ${label}`}
        style={styles.reviewSpacer}
        onPress={onEdit}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="create-outline"
          size={16}
          color="rgba(255,255,255,0.5)"
        />
      </TouchableOpacity>
    </View>
  );
}

// ── CheckInScreen ─────────────────────────────────────────────────────────────

export default function CheckInScreen() {
  const router = useRouter();

  // Sleep is asked only on the first check-in of the day. The launcher passes
  // askSleep=false for a later same-day check-in; default true (skip is always
  // available as the safety valve). Params arrive as strings.
  const { askSleep: askSleepParam, prefill: prefillParam } = useLocalSearchParams();
  const { user } = useAuth();
  const askSleep = askSleepParam !== "false";
  // Pain is skipped entirely for someone tracking their mind — not hidden,
  // just not asked. Profile -> Tracking focus brings it back.
  const trackingMode = user?.trackingMode || "both";
  const askPain = trackingMode !== "mental";
  // walking forwards, step 1 is passed over when pain isn't asked
  const nextStep = (n) => (n === 1 && !askPain ? 2 : n);
  const firstStep = askSleep ? 0 : nextStep(1);

  // "Same as last time": the launcher hands us the previous check-in's answers
  // and we open straight on the review step. Sleep is deliberately NOT copied.
  const prefill = (() => {
    if (!prefillParam) return null;
    try { return JSON.parse(prefillParam); } catch { return null; }
  })();
  const prefilled = !!prefill;

  function dismiss() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  const [step, setStep] = useState(prefilled ? 7 : firstStep);
  const [sleepLevel, setSleepLevel] = useState(null);
  const [painLevel, setPainLevel] = useState(prefill?.painLevel ?? null);
  const [moodLevel, setMoodLevel] = useState(prefill?.moodLevel ?? null);
  const [energyLevel, setEnergyLevel] = useState(prefill?.energyLevel ?? null);
  const [anxietyLevel, setAnxietyLevel] = useState(prefill?.anxietyLevel ?? null);
  const [appetiteLevel, setAppetiteLevel] = useState(prefill?.appetiteLevel ?? null);
  const [symptoms, setSymptoms] = useState(prefill?.symptoms ?? []);
  // set while editing a single answer from a pre-filled review, so choosing a
  // value returns to the review instead of marching forward through the flow
  const [returnToReview, setReturnToReview] = useState(false);
  const [sleepSkipped, setSleepSkipped] = useState(false);
  // Today's note belongs to today, so it is never copied from the prefill — the
  // same reasoning that leaves sleep out of the quick path.
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  // open once asked for, and stay open if there is already text to show
  const noteExpanded = noteOpen || note.trim() !== "";
  const [recentSymptoms, setRecentSymptoms] = useState([]);
  const [symptomSearch, setSymptomSearch] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  // Shown only when the user themselves answered mood or anxiety at its lowest.
  // This responds to an explicit choice — the app never infers a state.
  const [toastSupport, setToastSupport] = useState(false);

  const [affirmation] = useState(
    () => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)],
  );

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef(null);
  const toastAnimRef = useRef(null);

  useEffect(() => {
    if (!consumeDeliberateOpen()) {
      router.replace("/(tabs)");
    }
  }, []);

  // fetch the user's personal recent symptoms; silent-fail to none
  useEffect(() => {
    let active = true;
    api
      .get("/api/checkins/symptoms")
      .then((res) => {
        if (active) setRecentSymptoms((res.data || []).map((r) => r.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastAnimRef.current) toastAnimRef.current.stop();
    };
  }, []);

  function showToast(message, withSupport = false) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastAnimRef.current) toastAnimRef.current.stop();

    // Appear instantly (matches web's same-render opacity:1 behavior)
    toastOpacity.setValue(1);
    setToastMessage(message);
    setToastSupport(withSupport);

    // A toast carrying the support link waits for the user instead of expiring.
    // Someone who just reported their lowest mood should not have a lifeline
    // flash past them in two seconds. Every other toast is untouched below.
    if (withSupport) return;

    // After 1500ms, fade out over 500ms then clear — matching web timing exactly
    toastTimerRef.current = setTimeout(() => {
      toastAnimRef.current = Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      });
      toastAnimRef.current.start(({ finished }) => {
        if (finished) {
          setToastMessage("");
          setToastSupport(false);
        }
      });
    }, 1500);
  }

  // Dismissing a persistent toast. The step underneath has already advanced —
  // the toast is only a curtain — so this just draws it back.
  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastAnimRef.current) toastAnimRef.current.stop();
    toastAnimRef.current = Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    });
    toastAnimRef.current.start(({ finished }) => {
      if (finished) {
        setToastMessage("");
        setToastSupport(false);
      }
    });
  }

  // ── Answer helpers ──────────────────────────────────────────────────────────
  // Steps are indexed in this order, so a metric's step === its index here.
  const ORDER = ["sleep", "pain", "mood", "energy", "anxiety", "appetite"];
  const SETTERS = {
    sleep: setSleepLevel, pain: setPainLevel, mood: setMoodLevel,
    energy: setEnergyLevel, anxiety: setAnxietyLevel, appetite: setAppetiteLevel,
  };

  // Picking a value. In the normal flow this invalidates the answers that come
  // after it and advances; when editing from a pre-filled review it updates just
  // that one answer and returns to the review.
  function chooseMetric(key, level) {
    SETTERS[key](level);
    // the user picked the lowest value for mood or anxiety — offer the door,
    // without changing the toast's copy or its timing
    const offerSupport = level === 1 && (key === "mood" || key === "anxiety");
    showToast(getIndividualToast(getTier(level), key), offerSupport);
    if (returnToReview) {
      setReturnToReview(false);
      setStep(7);
      return;
    }
    const i = ORDER.indexOf(key);
    for (const k of ORDER.slice(i + 1)) SETTERS[k](null);
    setSymptoms([]);
    setStep(nextStep(i + 1));
  }

  // Skip on the pain step behaves like sleep's: an answer, minus a value.
  function skipPainStep() {
    setPainLevel(null);
    if (returnToReview) {
      setReturnToReview(false);
      setStep(7);
      return;
    }
    for (const k of ORDER.slice(2)) SETTERS[k](null);
    setSymptoms([]);
    setStep(2);
  }

  // Skip on the sleep step behaves like any other answer, minus a value.
  function skipSleepStep() {
    setSleepLevel(null);
    setSleepSkipped(true);
    if (returnToReview) {
      setReturnToReview(false);
      setStep(7);
      return;
    }
    for (const k of ORDER.slice(1)) SETTERS[k](null);
    setSymptoms([]);
    setStep(nextStep(1));
  }

  // Review-row edit: destructive chain-restart in the normal flow, single-answer
  // edit when the review was pre-filled.
  function onEditMetric(key) {
    const i = ORDER.indexOf(key);
    if (prefilled) {
      return () => { setReturnToReview(true); setStep(i); };
    }
    return () => {
      for (const k of ORDER.slice(i)) SETTERS[k](null);
      setSymptoms([]);
      setStep(i);
    };
  }

  function toggleSymptom(s) {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function addCustomSymptom(text) {
    let v = text.trim();
    if (!v) return;
    v = (v.charAt(0).toUpperCase() + v.slice(1)).slice(0, 40);
    setSymptoms((prev) =>
      prev.some((s) => s.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v],
    );
    setSymptomSearch("");
  }

  async function handleHideSymptom(name) {
    const prev = recentSymptoms;
    // optimistic: drop from suggestions + deselect if picked
    setRecentSymptoms((r) => r.filter((x) => x.toLowerCase() !== name.toLowerCase()));
    setSymptoms((sel) => sel.filter((x) => x.toLowerCase() !== name.toLowerCase()));
    try {
      await api.post("/api/checkins/symptoms/hide", { name });
    } catch {
      setRecentSymptoms(prev); // restore on error
    }
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      await api.post("/api/checkins", {
        painLevel,
        moodLevel,
        energyLevel,
        anxietyLevel,
        appetiteLevel,
        sleepLevel,
        symptoms: symptoms.length > 0 ? symptoms : null,
        date: today,
        note: note.trim() || null,
      });
      track("checkin_completed");
      setStep(8);
    } catch (err) {
      setError(
        err.response?.data?.error || "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <ScreenBackground>
        {/* Toast overlay — hides step content while showing */}
        {toastMessage ? (
          <Animated.View style={[styles.toastView, { opacity: toastOpacity }]}>
            <Text style={styles.toastText}>{toastMessage}</Text>
            {toastSupport ? (
              <TouchableOpacity
                onPress={() => router.push("/support")}
                hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={SUPPORT_TOAST_LINK}
                style={styles.toastSupportBtn}
              >
                <Text style={styles.toastSupportText}>{SUPPORT_TOAST_LINK}</Text>
              </TouchableOpacity>
            ) : null}
            {toastSupport ? (
              <TouchableOpacity
                onPress={dismissToast}
                hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Continue the check-in"
                style={styles.toastContinueBtn}
              >
                <Text style={styles.toastContinueText}>Continue</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : (
          // The note field sits low on the review step and this screen had no
          // keyboard avoidance at all. Same behaviour choice BottomSheet makes:
          // iOS needs padding, Android resizes the window itself.
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.outerWrap}>
              {/* ── Step content ───────────────────────────────────────── */}
              <View style={styles.stepWrap}>
                {/* Step 0 — Sleep (first check-in of the day only) */}
                {step === 0 && (
                  <>
                    <Text style={styles.heading}>How did you sleep?</Text>
                    <LevelButtons
                      labels={METRIC_LABELS.sleep}
                      selected={sleepLevel}
                      onSelect={(level) => chooseMetric("sleep", level)}
                    />
                    <TouchableOpacity onPress={skipSleepStep}>
                      <Text style={styles.skipLink}>Skip</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 1 — Pain */}
                {step === 1 && (
                  <>
                    <Text style={styles.heading}>How is your pain right now?</Text>
                    <LevelButtons
                      labels={METRIC_LABELS.pain}
                      selected={painLevel}
                      onSelect={(level) => chooseMetric("pain", level)}
                    />
                    <TouchableOpacity onPress={skipPainStep}>
                      <Text style={styles.skipLink}>No pain</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 2 — Mood */}
                {step === 2 && (
                  <>
                    <Text style={styles.heading}>How is your mood right now?</Text>
                    <LevelButtons
                      labels={METRIC_LABELS.mood}
                      selected={moodLevel}
                      onSelect={(level) => chooseMetric("mood", level)}
                    />
                  </>
                )}

                {/* Step 3 — Energy */}
                {step === 3 && (
                  <>
                    <Text style={styles.heading}>
                      How is your energy right now?
                    </Text>
                    <LevelButtons
                      labels={METRIC_LABELS.energy}
                      selected={energyLevel}
                      onSelect={(level) => chooseMetric("energy", level)}
                    />
                  </>
                )}

                {/* Step 4 — Anxiety */}
                {step === 4 && (
                  <>
                    <Text style={styles.heading}>
                      How is your anxiety right now?
                    </Text>
                    <LevelButtons
                      labels={METRIC_LABELS.anxiety}
                      selected={anxietyLevel}
                      onSelect={(level) => chooseMetric("anxiety", level)}
                    />
                  </>
                )}

                {/* Step 5 — Appetite */}
                {step === 5 && (
                  <>
                    <Text style={styles.heading}>
                      How is your appetite right now?
                    </Text>
                    <LevelButtons
                      labels={METRIC_LABELS.appetite}
                      selected={appetiteLevel}
                      onSelect={(level) => chooseMetric("appetite", level)}
                    />
                  </>
                )}

                {/* Step 6 — Symptoms */}
                {step === 6 && (
                  <>
                    <Text style={styles.heading}>Any symptoms right now?</Text>
                    <SymptomPicker
                      selected={symptoms}
                      onToggle={toggleSymptom}
                      search={symptomSearch}
                      setSearch={setSymptomSearch}
                      recents={recentSymptoms}
                      onAddCustom={addCustomSymptom}
                      onHide={handleHideSymptom}
                      trackingMode={trackingMode}
                    />
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => {
                        if (returnToReview) {
                          setReturnToReview(false);
                          setStep(7);
                          return;
                        }
                        const combo = getComboToast(
                          painLevel,
                          moodLevel,
                          energyLevel,
                          anxietyLevel,
                          appetiteLevel,
                          sleepLevel,
                        );
                        if (combo) showToast(combo);
                        setStep(7);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryBtnText}>
                        {symptoms.length > 0 ? "Continue" : "Skip"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 7 — Review & Submit */}
                {step === 7 && (
                  <>
                    {prefilled && (
                      <Text style={styles.copiedNote}>
                        Copied from your last check-in — change anything that's different.
                      </Text>
                    )}
                    {/* Sleep isn't copied. On the day's first check-in, ask it
                        right here as one optional row instead of reopening the flow. */}
                    {prefilled && askSleep && sleepLevel === null && !sleepSkipped && (
                      <View style={styles.sleepRowBox}>
                        <Text style={styles.reviewLabel}>How did you sleep?</Text>
                        <LevelButtons
                          labels={METRIC_LABELS.sleep}
                          selected={sleepLevel}
                          onSelect={(level) => setSleepLevel(level)}
                        />
                        <TouchableOpacity onPress={() => setSleepSkipped(true)}>
                          <Text style={styles.skipLink}>Skip</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {sleepLevel !== null && (
                      <ReviewRow
                        label="Sleep"
                        value={sleepLevel}
                        labelMap={METRIC_LABELS.sleep}
                        onEdit={onEditMetric("sleep")}
                      />
                    )}
                    {(askPain || painLevel !== null) && (
                      <ReviewRow
                        label="Pain level"
                        value={painLevel}
                        labelMap={METRIC_LABELS.pain}
                        onEdit={onEditMetric("pain")}
                        emptyLabel="No pain"
                      />
                    )}
                    <ReviewRow
                      label="Mood level"
                      value={moodLevel}
                      labelMap={METRIC_LABELS.mood}
                      onEdit={onEditMetric("mood")}
                    />
                    <ReviewRow
                      label="Energy level"
                      value={energyLevel}
                      labelMap={METRIC_LABELS.energy}
                      onEdit={onEditMetric("energy")}
                    />
                    <ReviewRow
                      label="Anxiety level"
                      value={anxietyLevel}
                      labelMap={METRIC_LABELS.anxiety}
                      onEdit={onEditMetric("anxiety")}
                    />
                    <ReviewRow
                      label="Appetite level"
                      value={appetiteLevel}
                      labelMap={METRIC_LABELS.appetite}
                      onEdit={onEditMetric("appetite")}
                    />

                    {/* Symptoms review */}
                    {symptoms.length > 0 ? (
                      <View style={styles.reviewSymptomsBox}>
                        <View style={styles.reviewSymptomsHeader}>
                          <Text style={styles.reviewLabel}>Symptoms</Text>
                          <TouchableOpacity accessibilityLabel="Edit symptoms"
                            onPress={() => {
                              // pre-filled review edits the list; the normal
                              // flow restarts the symptom step from empty
                              if (prefilled) setReturnToReview(true);
                              else setSymptoms([]);
                              setStep(6);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="create-outline"
                              size={16}
                              color="rgba(255,255,255,0.5)"
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.reviewSymptomChips}>
                          {symptoms.map((s) => (
                            <View key={s} style={styles.reviewSymptomChip}>
                              <SymptomIcon symptom={s} size={13} color="white" />
                              <Text style={styles.reviewSymptomText}>{s}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          if (prefilled) setReturnToReview(true);
                          setStep(6);
                        }}
                      >
                        <Text style={styles.addSymptomsLink}>
                          + add symptoms
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Optional note. Collapsed until asked for — nothing here
                        should read as a prompt to explain yourself. */}
                    {noteExpanded ? (
                      <View style={styles.noteBox}>
                        <Text style={styles.reviewLabel}>Anything else about today?</Text>
                        <TextInput
                          style={styles.noteInput}
                          value={note}
                          onChangeText={setNote}
                          multiline
                          maxLength={NOTE_MAX}
                          blurOnSubmit
                          returnKeyType="done"
                          autoFocus
                          placeholder="A few words, if you like"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          accessibilityLabel="Anything else about today?"
                        />
                        <View style={styles.noteFooter}>
                          <TouchableOpacity
                            onPress={() => { setNote(""); setNoteOpen(false); }}
                            style={styles.noteRemoveBtn}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Remove note"
                          >
                            <Text style={styles.noteRemoveText}>Remove</Text>
                          </TouchableOpacity>
                          {/* only once the limit is near — a counter from the
                              first keystroke would turn a note into a budget */}
                          {note.length >= NOTE_COUNTER_FROM ? (
                            <Text style={styles.noteCounter} accessibilityLiveRegion="polite">
                              {note.length}/{NOTE_MAX}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setNoteOpen(true)}
                        style={styles.addNoteBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Add a note to this check-in"
                      >
                        <Text style={styles.addSymptomsLink}>+ add a note</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        submitting && styles.primaryBtnDisabled,
                      ]}
                      onPress={handleSubmit}
                      disabled={submitting}
                      activeOpacity={0.85}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#7C6BAE" />
                      ) : (
                        <Text style={styles.primaryBtnText}>
                          Submit Check-in
                        </Text>
                      )}
                    </TouchableOpacity>

                    {!!error && <Text style={styles.errorText}>{error}</Text>}
                  </>
                )}

                {/* Step 8 — Celebration */}
                {step === 8 && (
                  <View style={styles.celebrationWrap}>
                    <Text style={styles.celebrationTitle}>
                      {affirmation.title}
                    </Text>
                    <Text style={styles.celebrationMessage}>
                      {affirmation.message}
                    </Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={dismiss}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryBtnText}>
                        Back to Dashboard
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ── Back / Cancel (all steps except 8) ──────────────────── */}
              {step !== 8 && (
                <View style={styles.navLinks}>
                  {(returnToReview || (!prefilled && step > firstStep)) && (
                    <TouchableOpacity
                      onPress={() => {
                        if (returnToReview) {
                          setReturnToReview(false);
                          setStep(7);
                        } else setStep(step - 1);
                      }}
                    >
                      <Text style={styles.navLink}>back</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={dismiss}>
                    <Text style={styles.navLink}>cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        )}
        {step === 8 && <LavenderConfetti />}
      </ScreenBackground>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Toast
  toastView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  toastText: {
    fontFamily: "Lato_400Regular",
    fontSize: 17,
    color: "white",
    textAlign: "center",
    lineHeight: 26,
  },
  // quiet, underlined, well clear of the copy above it — an offer, not a nudge
  toastSupportBtn: { marginTop: 18, paddingVertical: 8, paddingHorizontal: 12 },
  toastContinueBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 24 },
  toastContinueText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  toastSupportText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textDecorationLine: "underline",
    textAlign: "center",
  },

  // Outer layout
  outerWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  stepWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },

  // Heading
  heading: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
    textAlign: "center",
    lineHeight: 36,
  },

  // Primary button (white, #7C6BAE text)
  primaryBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 16,
    color: "#7C6BAE",
    letterSpacing: 0.4,
  },

  // Symptoms step
  pickerWrap: {
    width: "100%",
    gap: 14,
  },
  pickerSection: {
    gap: 8,
  },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  sectionLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  searchHint: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  addChip: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderStyle: "dashed",
  },
  addChipText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  symptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  symptomChipMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  symptomChipActive: {
    backgroundColor: "white",
  },
  symptomText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "white",
  },
  symptomTextActive: {
    color: "#7C6BAE",
    fontFamily: "Lato_700Bold",
  },

  // Review step
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  reviewSpacer: {
    width: 28,
    alignItems: "center",
  },
  reviewCenter: {
    flex: 1,
    alignItems: "center",
  },
  reviewLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 3,
    textAlign: "center",
  },
  reviewValue: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
    textAlign: "center",
  },

  // Symptoms review box
  reviewSymptomsBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  reviewSymptomsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewSymptomChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  reviewSymptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  reviewSymptomText: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "white",
  },

  addSymptomsLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  // the collapsed link needs a real target, not just its text box
  addNoteBtn: {
    minHeight: 44,
    justifyContent: "center",
  },
  // matches reviewSymptomsBox so the note reads as one of the review rows
  noteBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    gap: 8,
  },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 58,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
    textAlignVertical: "top",
  },
  noteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteRemoveBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingRight: 8,
  },
  noteRemoveText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },
  noteCounter: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  skipLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  copiedNote: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 2,
  },
  sleepRowBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    gap: 12,
  },
  errorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: SOFT_ERROR,
    textAlign: "center",
    marginTop: 4,
  },

  // Celebration
  celebrationWrap: {
    alignItems: "center",
    gap: 20,
  },
  celebrationTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 34,
    color: "white",
    textAlign: "center",
    lineHeight: 42,
  },
  celebrationMessage: {
    fontFamily: "Lato_400Regular",
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 24,
  },

  // Nav links
  navLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    paddingTop: 16,
  },
  navLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
});
