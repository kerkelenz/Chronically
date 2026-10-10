import { useState } from "react";
import FormModal, { ModalFooter, labelClass } from "./FormModal";
import { localToday } from "../utils/flareHelpers";
import {
  REPORT_SECTIONS, SECTION_KEYS, RANGE_PRESETS, MAX_RANGE_DAYS,
  addDays, isYmd, resolveReportOptions, describeRange,
} from "../utils/reportOptions";
import { loadReportPrefs, saveReportPrefs } from "../utils/reportPrefs";

const inputStyle = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  color: "white",
  colorScheme: "dark",
};

// the two choices beyond the presets; their dates are never remembered
const OTHER_CHOICES = [
  { key: "since", label: "Since a date…" },
  { key: "custom", label: "Custom dates…" },
];

// Weather and notes live inside the daily health log, so they mean nothing
// without it
const NEEDS_DAILY_LOG = ["weather", "notes"];

/**
 * "Customize report": the dates and the sections, then Export. Opens on the
 * remembered choice; the parent remounts it (via `key`) each time it opens so
 * it never shows a half-edited state from last time.
 */
export default function ReportOptionsModal({ open, onClose, onExport }) {
  const today = localToday();
  const earliest = addDays(today, -MAX_RANGE_DAYS);
  const [saved] = useState(loadReportPrefs);
  const [choice, setChoice] = useState(saved.preset);
  const [sinceFrom, setSinceFrom] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(today);
  const [sections, setSections] = useState(() => new Set(saved.sections));

  const preset = RANGE_PRESETS.find((p) => p.key === choice);
  const dates = preset
    ? { from: addDays(today, -preset.days), to: today }
    : choice === "since"
      ? { from: sinceFrom, to: today }
      : { from: customFrom, to: customTo };
  const datesValid = isYmd(dates.from) && isYmd(dates.to);
  const range = datesValid ? resolveReportOptions(dates, today) : null;

  // weather and notes alone, with the daily log off, would export an empty report
  const printable = [...sections].filter((k) => !(NEEDS_DAILY_LOG.includes(k) && !sections.has("dailyLog")));
  const error = printable.length === 0
    ? "Choose at least one section."
    : !isYmd(dates.from)
      ? "Choose a start date."
      : !isYmd(dates.to)
        ? "Choose an end date."
        : "";

  const toggle = (key) => {
    if (NEEDS_DAILY_LOG.includes(key) && !sections.has("dailyLog")) return;
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const reset = () => {
    setChoice(RANGE_PRESETS[0].key);
    setSections(new Set(SECTION_KEYS));
  };

  const handleExport = () => {
    if (error || !range) return;
    saveReportPrefs({ preset: preset ? choice : null, sections: [...sections] });
    onExport({
      from: range.from,
      to: range.to,
      // all on is sent as "all", so the default resolves exactly like {}
      sections: sections.size === SECTION_KEYS.length ? undefined : SECTION_KEYS.filter((k) => sections.has(k)),
    });
  };

  const dateField = (id, label, value, onChange, min) => (
    <div className="flex-1 min-w-0">
      <label htmlFor={id} className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={inputStyle}
      />
    </div>
  );

  const radio = (key, label) => (
    <label key={key} htmlFor={`report-range-${key}`} className="flex items-center gap-2.5 cursor-pointer" style={{ minHeight: 44 }}>
      <input
        id={`report-range-${key}`}
        type="radio"
        name="report-range"
        checked={choice === key}
        onChange={() => setChoice(key)}
        className="w-4 h-4 flex-shrink-0 accent-white cursor-pointer"
      />
      <span className="text-sm text-white/85">{label}</span>
    </label>
  );

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Customize report"
      subtitle="Choose the dates and what to include."
      footer={
        <ModalFooter
          onCancel={onClose}
          onSave={handleExport}
          saveLabel="Export"
          canSave={!error}
          error={error}
        />
      }
    >
      <fieldset className="mb-4">
        <legend className={labelClass}>Dates</legend>
        {RANGE_PRESETS.map((p) => radio(p.key, p.label))}
        {radio(OTHER_CHOICES[0].key, OTHER_CHOICES[0].label)}
        {choice === "since" && (
          <div className="flex gap-3 pl-7 pb-2">
            {dateField("report-since-from", "From", sinceFrom, setSinceFrom, earliest)}
          </div>
        )}
        {radio(OTHER_CHOICES[1].key, OTHER_CHOICES[1].label)}
        {choice === "custom" && (
          <div className="flex gap-3 pl-7 pb-2">
            {dateField("report-custom-from", "From", customFrom, setCustomFrom, earliest)}
            {dateField("report-custom-to", "To", customTo, setCustomTo, isYmd(customFrom) ? customFrom : earliest)}
          </div>
        )}
        <p className="text-xs text-white/60 mt-1" aria-live="polite">
          {range ? describeRange(range) : ""}
        </p>
      </fieldset>

      <fieldset className="mb-2">
        <legend className={labelClass}>Include</legend>
        {REPORT_SECTIONS.map((s) => {
          const disabled = NEEDS_DAILY_LOG.includes(s.key) && !sections.has("dailyLog");
          return (
            <label
              key={s.key}
              htmlFor={`report-section-${s.key}`}
              className={`flex items-center gap-2.5 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ minHeight: 44 }}
            >
              <input
                id={`report-section-${s.key}`}
                type="checkbox"
                checked={sections.has(s.key)}
                onChange={() => toggle(s.key)}
                aria-disabled={disabled || undefined}
                className="w-4 h-4 flex-shrink-0 accent-white cursor-pointer"
              />
              <span className="text-sm text-white/85">{s.label}</span>
            </label>
          );
        })}
        <button
          type="button"
          onClick={reset}
          className="text-sm text-white/70 hover:text-white underline-offset-2 hover:underline transition-colors"
          style={{ minHeight: 44 }}
        >
          Reset to default
        </button>
      </fieldset>
    </FormModal>
  );
}
