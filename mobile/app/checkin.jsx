import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../components/ScreenBackground";
import LevelButtons from "../components/LevelButtons";
import api from "../lib/api";
import { track } from "../lib/analytics";
import { consumeDeliberateOpen } from "../lib/checkinNav";
import { METRIC_LABELS, SYMPTOM_LIST } from "../theme/metrics";
import {
  AFFIRMATIONS,
  getTier,
  getIndividualToast,
  getComboToast,
} from "../theme/checkinCopy";

// ── ReviewRow ─────────────────────────────────────────────────────────────────

function ReviewRow({ label, value, labelMap, onEdit }) {
  return (
    <View style={styles.reviewRow}>
      {/* Left spacer mirrors the edit icon width for true centering */}
      <View style={styles.reviewSpacer} />
      <View style={styles.reviewCenter}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewValue}>{labelMap[value]}</Text>
      </View>
      <TouchableOpacity
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

  function dismiss() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  const [step, setStep] = useState(1);
  const [painLevel, setPainLevel] = useState(null);
  const [moodLevel, setMoodLevel] = useState(null);
  const [energyLevel, setEnergyLevel] = useState(null);
  const [anxietyLevel, setAnxietyLevel] = useState(null);
  const [appetiteLevel, setAppetiteLevel] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastAnimRef.current) toastAnimRef.current.stop();
    };
  }, []);

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastAnimRef.current) toastAnimRef.current.stop();

    // Appear instantly (matches web's same-render opacity:1 behavior)
    toastOpacity.setValue(1);
    setToastMessage(message);

    // After 1500ms, fade out over 500ms then clear — matching web timing exactly
    toastTimerRef.current = setTimeout(() => {
      toastAnimRef.current = Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      });
      toastAnimRef.current.start(({ finished }) => {
        if (finished) setToastMessage("");
      });
    }, 1500);
  }

  function toggleSymptom(s) {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
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
        symptoms: symptoms.length > 0 ? symptoms : null,
        date: today,
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
          </Animated.View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.outerWrap}>
              {/* ── Step content ───────────────────────────────────────── */}
              <View style={styles.stepWrap}>
                {/* Step 1 — Pain */}
                {step === 1 && (
                  <>
                    <Text style={styles.heading}>How is your pain today?</Text>
                    <LevelButtons
                      labels={METRIC_LABELS.pain}
                      selected={painLevel}
                      onSelect={(level) => {
                        setPainLevel(level);
                        setMoodLevel(null);
                        setEnergyLevel(null);
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        showToast(getIndividualToast(getTier(level), "pain"));
                        setStep(2);
                      }}
                    />
                  </>
                )}

                {/* Step 2 — Mood */}
                {step === 2 && (
                  <>
                    <Text style={styles.heading}>How is your mood today?</Text>
                    <LevelButtons
                      labels={METRIC_LABELS.mood}
                      selected={moodLevel}
                      onSelect={(level) => {
                        setMoodLevel(level);
                        setEnergyLevel(null);
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        showToast(getIndividualToast(getTier(level), "mood"));
                        setStep(3);
                      }}
                    />
                  </>
                )}

                {/* Step 3 — Energy */}
                {step === 3 && (
                  <>
                    <Text style={styles.heading}>
                      How is your energy today?
                    </Text>
                    <LevelButtons
                      labels={METRIC_LABELS.energy}
                      selected={energyLevel}
                      onSelect={(level) => {
                        setEnergyLevel(level);
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        showToast(getIndividualToast(getTier(level), "energy"));
                        setStep(4);
                      }}
                    />
                  </>
                )}

                {/* Step 4 — Anxiety */}
                {step === 4 && (
                  <>
                    <Text style={styles.heading}>
                      How is your anxiety today?
                    </Text>
                    <LevelButtons
                      labels={METRIC_LABELS.anxiety}
                      selected={anxietyLevel}
                      onSelect={(level) => {
                        setAnxietyLevel(level);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        showToast(
                          getIndividualToast(getTier(level), "anxiety"),
                        );
                        setStep(5);
                      }}
                    />
                  </>
                )}

                {/* Step 5 — Appetite */}
                {step === 5 && (
                  <>
                    <Text style={styles.heading}>
                      How is your appetite today?
                    </Text>
                    <LevelButtons
                      labels={METRIC_LABELS.appetite}
                      selected={appetiteLevel}
                      onSelect={(level) => {
                        setAppetiteLevel(level);
                        setSymptoms([]);
                        showToast(
                          getIndividualToast(getTier(level), "appetite"),
                        );
                        setStep(6);
                      }}
                    />
                  </>
                )}

                {/* Step 6 — Symptoms */}
                {step === 6 && (
                  <>
                    <Text style={styles.heading}>Any symptoms today?</Text>
                    <View style={styles.symptomsGrid}>
                      {SYMPTOM_LIST.map((s) => {
                        const active = symptoms.includes(s);
                        return (
                          <TouchableOpacity
                            key={s}
                            onPress={() => toggleSymptom(s)}
                            style={[
                              styles.symptomChip,
                              active && styles.symptomChipActive,
                            ]}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.symptomText,
                                active && styles.symptomTextActive,
                              ]}
                            >
                              {s}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => {
                        const combo = getComboToast(
                          painLevel,
                          moodLevel,
                          energyLevel,
                          anxietyLevel,
                          appetiteLevel,
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
                    <ReviewRow
                      label="Pain level"
                      value={painLevel}
                      labelMap={METRIC_LABELS.pain}
                      onEdit={() => {
                        setPainLevel(null);
                        setMoodLevel(null);
                        setEnergyLevel(null);
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        setStep(1);
                      }}
                    />
                    <ReviewRow
                      label="Mood level"
                      value={moodLevel}
                      labelMap={METRIC_LABELS.mood}
                      onEdit={() => {
                        setMoodLevel(null);
                        setEnergyLevel(null);
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        setStep(2);
                      }}
                    />
                    <ReviewRow
                      label="Energy level"
                      value={energyLevel}
                      labelMap={METRIC_LABELS.energy}
                      onEdit={() => {
                        setEnergyLevel(null);
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        setStep(3);
                      }}
                    />
                    <ReviewRow
                      label="Anxiety level"
                      value={anxietyLevel}
                      labelMap={METRIC_LABELS.anxiety}
                      onEdit={() => {
                        setAnxietyLevel(null);
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        setStep(4);
                      }}
                    />
                    <ReviewRow
                      label="Appetite level"
                      value={appetiteLevel}
                      labelMap={METRIC_LABELS.appetite}
                      onEdit={() => {
                        setAppetiteLevel(null);
                        setSymptoms([]);
                        setStep(5);
                      }}
                    />

                    {/* Symptoms review */}
                    {symptoms.length > 0 ? (
                      <View style={styles.reviewSymptomsBox}>
                        <View style={styles.reviewSymptomsHeader}>
                          <Text style={styles.reviewLabel}>Symptoms</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setSymptoms([]);
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
                              <Text style={styles.reviewSymptomText}>{s}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => setStep(6)}>
                        <Text style={styles.addSymptomsLink}>
                          + add symptoms
                        </Text>
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
                  {step > 1 && (
                    <TouchableOpacity onPress={() => setStep(step - 1)}>
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
        )}
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
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  symptomChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
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
  errorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,200,200,0.9)",
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
