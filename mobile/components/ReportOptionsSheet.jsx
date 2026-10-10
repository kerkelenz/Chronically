import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import BottomSheet from "./BottomSheet";
import { SheetHeader, SheetFooter, formStyles } from "./FormSheet";
import { localToday } from "../theme/flareHelpers";
import {
  REPORT_SECTIONS, SECTION_KEYS, RANGE_PRESETS, MAX_RANGE_DAYS,
  addDays, isYmd, resolveReportOptions, describeRange, normalizeReportPrefs,
} from "../theme/reportOptions";
import { saveReportPrefs } from "../lib/reportPrefs";

const PRIMARY = "#7C6BAE";

// the two choices beyond the presets; their dates are never remembered
const OTHER_CHOICES = [
  { key: "since", label: "Since a date…" },
  { key: "custom", label: "Custom dates…" },
];

// Weather and notes live inside the daily health log, so they mean nothing
// without it
const NEEDS_DAILY_LOG = ["weather", "notes"];

const toYmd = (d) => d.toLocaleDateString("en-CA");
const atNoon = (ymd) => new Date(`${ymd}T12:00:00`);

/**
 * "Customize report": the dates and the sections, then Export. Opens on the
 * remembered choice (`prefs`, loaded by the screen); the screen remounts it
 * (via `key`) each time it opens so it never shows last time's half-edit.
 * The web twin is client/src/components/ReportOptionsModal.jsx.
 */
export default function ReportOptionsSheet({ visible, onClose, onExport, prefs }) {
  const today = localToday();
  const earliest = addDays(today, -MAX_RANGE_DAYS);
  const [saved] = useState(() => normalizeReportPrefs(prefs));
  const [choice, setChoice] = useState(saved.preset);
  const [dates, setDates] = useState({ sinceFrom: "", customFrom: "", customTo: today });
  const [sections, setSections] = useState(() => new Set(saved.sections));
  const [picker, setPicker] = useState(null); // which date field is open on iOS

  const preset = RANGE_PRESETS.find((p) => p.key === choice);
  const span = preset
    ? { from: addDays(today, -preset.days), to: today }
    : choice === "since"
      ? { from: dates.sinceFrom, to: today }
      : { from: dates.customFrom, to: dates.customTo };
  const range = isYmd(span.from) && isYmd(span.to) ? resolveReportOptions(span, today) : null;

  // weather and notes alone, with the daily log off, would export an empty report
  const printable = [...sections].filter((k) => !(NEEDS_DAILY_LOG.includes(k) && !sections.has("dailyLog")));
  const error = printable.length === 0
    ? "Choose at least one section."
    : !isYmd(span.from)
      ? "Choose a start date."
      : !isYmd(span.to)
        ? "Choose an end date."
        : "";

  const choose = (key) => { setChoice(key); setPicker(null); };

  const toggle = (key) => {
    if (NEEDS_DAILY_LOG.includes(key) && !sections.has("dailyLog")) return;
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const reset = () => {
    choose(RANGE_PRESETS[0].key);
    setSections(new Set(SECTION_KEYS));
  };

  const exportNow = async () => {
    if (error || !range) return;
    await saveReportPrefs({ preset: preset ? choice : null, sections: [...sections] });
    onExport({
      from: range.from,
      to: range.to,
      // all on is sent as "all", so the default resolves exactly like {}
      sections: sections.size === SECTION_KEYS.length ? undefined : SECTION_KEYS.filter((k) => sections.has(k)),
    });
  };

  const minFor = (field) =>
    field === "customTo" && isYmd(dates.customFrom) ? dates.customFrom : earliest;

  // Android opens a modal picker; iOS shows an inline spinner — the same as
  // the flare sheet
  const pickDate = (field) => {
    const current = dates[field] ? atNoon(dates[field]) : atNoon(today);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: atNoon(today),
        minimumDate: atNoon(minFor(field)),
        onChange: (e, d) => {
          if (e.type !== "set" || !d) return;
          setDates((s) => ({ ...s, [field]: toYmd(d) }));
        },
      });
    } else {
      setPicker(field);
    }
  };

  const dateRow = (field, label) => (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => pickDate(field)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${dates[field] || "not set"}`}
      >
        <Text style={styles.dateText}>{dates[field] || "Choose a date"}</Text>
        <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
      {picker === field && Platform.OS === "ios" ? (
        <View style={styles.inlinePicker}>
          <DateTimePicker
            value={dates[field] ? atNoon(dates[field]) : atNoon(today)}
            mode="date"
            display="spinner"
            themeVariant="dark"
            maximumDate={atNoon(today)}
            minimumDate={atNoon(minFor(field))}
            onChange={(e, d) => { if (d) setDates((s) => ({ ...s, [field]: toYmd(d) })); }}
          />
          <TouchableOpacity onPress={() => setPicker(null)} style={styles.pickerDone} activeOpacity={0.7}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const radio = (key, label) => {
    const checked = choice === key;
    return (
      <TouchableOpacity
        key={key}
        style={styles.row}
        onPress={() => choose(key)}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
      >
        <View style={[styles.dot, checked && styles.dotChecked]}>
          {checked ? <View style={styles.dotInner} /> : null}
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      scrollable={false}
      cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <SheetHeader title="Customize report" subtitle="Choose the dates and what to include." />

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[formStyles.label, { marginTop: 0 }]}>Dates</Text>
        <View accessibilityRole="radiogroup">
          {RANGE_PRESETS.map((p) => radio(p.key, p.label))}
          {radio(OTHER_CHOICES[0].key, OTHER_CHOICES[0].label)}
          {choice === "since" ? (
            <View style={styles.dates}>{dateRow("sinceFrom", "From")}</View>
          ) : null}
          {radio(OTHER_CHOICES[1].key, OTHER_CHOICES[1].label)}
          {choice === "custom" ? (
            <View style={styles.dates}>
              {dateRow("customFrom", "From")}
              {dateRow("customTo", "To")}
            </View>
          ) : null}
        </View>
        <Text style={styles.caption} accessibilityLiveRegion="polite">
          {range ? describeRange(range) : ""}
        </Text>

        <Text style={formStyles.label}>Include</Text>
        {REPORT_SECTIONS.map((s) => {
          const checked = sections.has(s.key);
          const disabled = NEEDS_DAILY_LOG.includes(s.key) && !sections.has("dailyLog");
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.row, disabled && styles.disabled]}
              onPress={() => toggle(s.key)}
              activeOpacity={disabled ? 1 : 0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled }}
              accessibilityLabel={s.label}
            >
              <View style={[styles.box, checked && styles.boxChecked]}>
                {checked ? <Text style={styles.tick}>✓</Text> : null}
              </View>
              <Text style={styles.rowLabel}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={reset}
          style={styles.reset}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reset to default"
        >
          <Text style={styles.resetText}>Reset to default</Text>
        </TouchableOpacity>
      </ScrollView>

      <SheetFooter
        onCancel={onClose}
        onSave={exportNow}
        saveLabel="Export"
        canSave={!error}
        error={error}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  rowLabel: { fontFamily: "Lato_400Regular", fontSize: 15, color: "rgba(255,255,255,0.85)", flexShrink: 1 },
  disabled: { opacity: 0.5 },

  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dotChecked: { borderColor: "white" },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "white" },

  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxChecked: { backgroundColor: "white", borderColor: "white" },
  tick: { color: PRIMARY, fontSize: 13, fontWeight: "700", lineHeight: 16 },

  dates: { paddingLeft: 30, paddingBottom: 6, gap: 8 },
  dateField: {},
  dateLabel: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  dateText: { fontFamily: "Lato_400Regular", fontSize: 15, color: "white" },
  inlinePicker: { marginTop: 8, alignItems: "center" },
  pickerDone: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  pickerDoneText: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },

  caption: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  reset: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  resetText: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)" },
});
