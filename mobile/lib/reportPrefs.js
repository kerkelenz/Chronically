// The doctor report's remembered choice — a preset and the sections — kept per
// device. Storage failures never block an export: a failed read gives the
// defaults, a failed write just isn't remembered. The web twin is
// client/src/utils/reportPrefs.js.
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  RANGE_PRESETS, SECTION_KEYS, addDays, normalizeReportPrefs,
} from "../theme/reportOptions";

const KEY = "report_prefs_v1";

export async function loadReportPrefs() {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  try {
    return normalizeReportPrefs(JSON.parse(raw || "null"));
  } catch {
    return normalizeReportPrefs(null);
  }
}

/**
 * `preset` is saved only when one was chosen — a custom range leaves the last
 * preset in place. `sections` are always saved.
 */
export async function saveReportPrefs({ preset, sections }) {
  const current = await loadReportPrefs();
  const next = normalizeReportPrefs({
    preset: RANGE_PRESETS.some((p) => p.key === preset) ? preset : current.preset,
    sections,
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

/** Export options for a remembered choice. All sections on → `sections` left out, exactly like `{}`. */
export function prefsToOptions(prefs, today) {
  const p = normalizeReportPrefs(prefs);
  const days = RANGE_PRESETS.find((x) => x.key === p.preset).days;
  return {
    from: addDays(today, -days),
    to: today,
    sections: p.sections.length === SECTION_KEYS.length ? undefined : p.sections,
  };
}
