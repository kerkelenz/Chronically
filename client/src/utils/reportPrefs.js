// The doctor report's remembered choice — a preset and the sections — kept per
// device. Every storage access is wrapped: private windows and blocked site
// data throw, and the report must still export with the defaults.
import {
  RANGE_PRESETS, SECTION_KEYS, addDays, normalizeReportPrefs,
} from "./reportOptions";

const KEY = "reportPrefs.v1";

export function loadReportPrefs() {
  try {
    return normalizeReportPrefs(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return normalizeReportPrefs(null);
  }
}

/**
 * `preset` is saved only when one was chosen — a custom range leaves the last
 * preset in place. `sections` are always saved.
 */
export function saveReportPrefs({ preset, sections }) {
  const current = loadReportPrefs();
  const next = normalizeReportPrefs({
    preset: RANGE_PRESETS.some((p) => p.key === preset) ? preset : current.preset,
    sections,
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // not remembered this time; the export itself still runs
  }
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
