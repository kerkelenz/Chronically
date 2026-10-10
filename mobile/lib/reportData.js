import {
  formatTime, describeSchedule, adherenceStats, resolvePattern, describeChange, describeChangeDate,
} from "../theme/medications";
import { formatWeatherLine } from "../theme/weatherFormat";
import { localToday } from "../theme/flareHelpers";
import {
  resolveReportOptions, rangeTitles, eachDay, chartLabelStep, flaresInRange, flareSummaryLine,
  flareReportLine, medChangesInRange, helpedRows, helpedReportLine, truncationNote,
} from "../theme/reportOptions";

// ── Constants (mirror generateReport.js verbatim) ─────────────────────────────

export const PURPLE        = [124, 107, 174];
export const DARK          = [45,  37,  64];
export const GRAY          = [107, 95,  122];
export const LAVENDER_FILL = [240, 235, 248];

export const METRIC_KEYS  = ["painLevel", "moodLevel", "energyLevel", "anxietyLevel", "appetiteLevel", "sleepLevel"];
export const METRIC_NAMES = { painLevel: "Pain", moodLevel: "Mood", energyLevel: "Energy", anxietyLevel: "Anxiety", appetiteLevel: "Appetite", sleepLevel: "Sleep" };

export const CHART_METRICS = [
  { key: "pain",     color: "#7C6BAE", label: "Pain"     },
  { key: "mood",     color: "#C4A8C0", label: "Mood"     },
  { key: "energy",   color: "#8FAF9B", label: "Energy"   },
  { key: "anxiety",  color: "#9BAFC4", label: "Anxiety"  },
  { key: "appetite", color: "#C4A882", label: "Appetite" },
  { key: "sleep",    color: "#9AD0C8", label: "Sleep"    },
];

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Pure helpers (verbatim from generateReport.js) ────────────────────────────

export const formatApptDatePdf = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// A calendar date at local noon, the safe hour to format one from
const atLocalNoon = (ymd) => {
  const [yr, mo, dy] = ymd.split("-").map(Number);
  return new Date(yr, mo - 1, dy, 12, 0, 0, 0);
};

// One entry per day of the range, oldest first.
// Each: { date, label, pain, mood, energy, anxiety, appetite } — null when no data.
export const buildDailyAverages = (periodCheckIns, range) => {
  const result = [];
  for (const dateStr of eachDay(range.from, range.to)) {
    const label       = atLocalNoon(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dayCheckins = periodCheckIns.filter((c) => c.date === dateStr);
    const metricAvg   = (key) => {
      const vals = dayCheckins.filter((c) => c[key] != null && c[key] !== 0);
      if (vals.length === 0) return null;
      return vals.reduce((s, c) => s + c[key], 0) / vals.length;
    };
    result.push({
      date: dateStr, label,
      pain:     metricAvg("painLevel"),
      mood:     metricAvg("moodLevel"),
      energy:   metricAvg("energyLevel"),
      anxiety:  metricAvg("anxietyLevel"),
      appetite: metricAvg("appetiteLevel"),
      sleep:    metricAvg("sleepLevel"),
    });
  }
  return result;
};

// ── SVG trend chart (adaptation of drawTrendChart — same geometry, inline SVG) ─

export function buildTrendChartSvg(dailyData) {
  const plotLeft = 70, plotRight = 1180, plotTop = 20, plotBottom = 310;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const n   = dailyData.length;
  const toX = (i) => plotLeft + (i / Math.max(1, n - 1)) * plotW;
  const toY = (v) => plotBottom - ((v - 1) / 4) * plotH;
  const p   = (n) => n.toFixed(2);

  // A metric nobody answered in this period gets no line and no legend entry.
  // Sleep has always been optional and pain now is too, and a legend swatch
  // with nothing drawn beside it reads as a flatline rather than an absence.
  const activeMetrics = CHART_METRICS.filter(
    (m) => dailyData.some((d) => d[m.key] != null),
  );

  const parts = [];

  parts.push('<rect width="1200" height="360" fill="white"/>');

  // Gridlines at 1, 3, 5
  for (const v of [1, 3, 5]) {
    const yp = p(toY(v));
    parts.push(`<line x1="${plotLeft}" y1="${yp}" x2="${plotRight}" y2="${yp}" stroke="#EEEAF5" stroke-width="1"/>`);
  }

  // Y axis labels
  for (const [text, v] of [["Bad", 1], ["Mid", 3], ["Good", 5]]) {
    parts.push(`<text x="${plotLeft - 8}" y="${p(toY(v))}" text-anchor="end" dominant-baseline="middle" fill="#6B5F7A" font-size="16" font-family="sans-serif">${text}</text>`);
  }

  // X axis labels: about seven of them, whatever the range (every 5th of 31 days)
  for (let i = 0; i < n; i += chartLabelStep(n)) {
    const entry = dailyData[i];
    if (entry) {
      parts.push(`<text x="${p(toX(i))}" y="${plotBottom + 24}" text-anchor="middle" dominant-baseline="hanging" fill="#6B5F7A" font-size="14" font-family="sans-serif">${entry.label}</text>`);
    }
  }

  // Lines + dots per metric — break line at gaps, never interpolate across nulls
  for (const { key, color } of activeMetrics) {
    let d = "";
    let prev = false;
    for (let i = 0; i < n; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) { prev = false; continue; }
      const x = p(toX(i)), y = p(toY(val));
      d += prev ? `L${x} ${y} ` : `M${x} ${y} `;
      prev = true;
    }
    if (d) {
      parts.push(`<path d="${d.trim()}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    for (let i = 0; i < n; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) continue;
      parts.push(`<circle cx="${p(toX(i))}" cy="${p(toY(val))}" r="3" fill="${color}"/>`);
    }
  }

  // Centered legend row below plot
  const legendItemW  = 160;
  const legendStartX = (1200 - activeMetrics.length * legendItemW) / 2;
  const legendY      = plotBottom + 28;
  for (let i = 0; i < activeMetrics.length; i++) {
    const { color, label } = activeMetrics[i];
    const x = legendStartX + i * legendItemW;
    parts.push(`<line x1="${p(x)}" y1="${legendY}" x2="${p(x + 24)}" y2="${legendY}" stroke="${color}" stroke-width="3"/>`);
    parts.push(`<text x="${p(x + 30)}" y="${legendY}" dominant-baseline="middle" fill="#2D2540" font-size="16" font-family="sans-serif">${label}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" style="width:100%;display:block">${parts.join("")}</svg>`;
}

// ── Main computation (mirrors generateReport body — pure JS, no PDF calls) ────

/**
 * Everything the report prints, computed once. buildReportHtml lays it out.
 *
 * `options = { from, to, sections, heading }`:
 *   - `from` / `to`: "YYYY-MM-DD", inclusive, the patient's local dates. Missing
 *     means the default range (today − 30 … today); see resolveReportOptions
 *     for the clamps. Never throws over a bad range.
 *   - `sections`: keys from REPORT_SECTIONS; undefined means all of them.
 *   - `heading`: an optional subtitle printed under the title.
 *
 * Two more fields belong to the exporter (lib/exportReport.js), because the
 * positional arguments have no slot for them:
 *   - `flares`: the array GET /api/flares returned for the range.
 *   - `medHistory`: `{ [medicationId]: entries[] }` from GET /api/medications/:id/history.
 * `undefined` means "not fetched", and that section is left out. It never means
 * "none" — a report must not tell a doctor there were no flares or no changes
 * when nobody looked.
 *
 * `options = {}` computes the same report as before options existed.
 */
export function computeReportData(checkIns, medications = [], medicationLogs = [], appointments = [], weatherDays = [], options = {}) {
  const today    = new Date();
  const todayStr = localToday();
  const range    = resolveReportOptions(options, todayStr);
  const titles   = rangeTitles(range);
  const fromDate = atLocalNoon(range.from);
  const toDate   = atLocalNoon(range.to);

  const periodCheckIns   = checkIns.filter((c) => c.date >= range.from && c.date <= range.to);
  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked = daysWithCheckIns.length;

  // Callers may pass logs from a wider window; everything below counts only the range
  const periodLogs = medicationLogs.filter((l) => l.date >= range.from && l.date <= range.to);

  const dailyData = buildDailyAverages(periodCheckIns, range);

  // Metric averages — exclude null/0
  const avg = (arr, key) => {
    const vals = arr.filter((c) => c[key] != null && c[key] !== 0);
    if (vals.length === 0) return "-";
    return (vals.reduce((s, c) => s + c[key], 0) / vals.length).toFixed(1);
  };
  const avgPain     = avg(periodCheckIns, "painLevel");
  const avgMood     = avg(periodCheckIns, "moodLevel");
  const avgEnergy   = avg(periodCheckIns, "energyLevel");
  const avgAnxiety  = avg(periodCheckIns, "anxietyLevel");
  const avgAppetite = avg(periodCheckIns, "appetiteLevel");
  const avgSleep    = avg(periodCheckIns, "sleepLevel");

  // Sleep is asked once a day and skippable; pain is not asked at all of
  // someone tracking their mind. A metric nobody answered is left out of the
  // report entirely rather than printed as a dash for a clinician to interpret.
  const hasPain  = avgPain !== "-";
  const hasSleep = avgSleep !== "-";

  // Symptom frequency — counted over what the patient actually logged, not a
  // fixed list of names. The fixed list predated the catalog and silently
  // dropped every mental symptom, most of the physical ones and anything the
  // patient typed themselves: their symptoms appeared in the daily log while
  // this table said "none". Ties break by name so the ordering is stable, and
  // At a Glance reads the top row.
  const loggedSymptoms = [...new Set(periodCheckIns.flatMap((c) => c.symptoms || []))];
  const symptomStats = loggedSymptoms.map((symptom) => {
    const days = daysWithCheckIns.filter((date) =>
      periodCheckIns.filter((c) => c.date === date).some((c) => c.symptoms && c.symptoms.includes(symptom))
    ).length;
    return { name: symptom, days, percentage: totalDaysTracked > 0 ? Math.round((days / totalDaysTracked) * 100) : 0 };
  }).filter((s) => s.days > 0).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));

  // Adherence: expected-vs-logged (computed-missed) — the shared engine math.
  // missed = expected past dose with no log; today's unlogged doses are neutral
  const medStats = adherenceStats(medications, periodLogs, range.from, range.to, todayStr);

  const glanceAdherenceText = medStats.totals.expected > 0
    ? `${medStats.totals.pct}% (${medStats.totals.taken} of ${medStats.totals.expected} ${medStats.totals.expected === 1 ? "dose" : "doses"})`
    : "No medications tracked";

  // Severe days — daily average ≤ 2 (since 5 = best)
  const severeDaysByMetric = {};
  METRIC_KEYS.forEach((k) => { severeDaysByMetric[k] = []; });

  daysWithCheckIns.forEach((dateStr) => {
    const dayCheckins = periodCheckIns.filter((c) => c.date === dateStr);
    METRIC_KEYS.forEach((k) => {
      const vals = dayCheckins.filter((c) => c[k] != null && c[k] !== 0);
      if (vals.length === 0) return;
      const avgVal = vals.reduce((s, c) => s + c[k], 0) / vals.length;
      if (avgVal <= 2) severeDaysByMetric[k].push(dateStr);
    });
  });

  const topSevereKey   = METRIC_KEYS.reduce((a, b) => severeDaysByMetric[a].length >= severeDaysByMetric[b].length ? a : b);
  const topSevereCount = severeDaysByMetric[topSevereKey].length;

  const glanceSevereText      = topSevereCount > 0 ? `${METRIC_NAMES[topSevereKey]} severe on ${topSevereCount} ${topSevereCount === 1 ? "day" : "days"}` : "None";
  const glanceMostFreqSymptom = symptomStats.length > 0 ? `${symptomStats[0].name} — ${symptomStats[0].days} ${symptomStats[0].days === 1 ? "day" : "days"}` : "None logged";

  // Notable events lines
  const notableLines = [];
  METRIC_KEYS.forEach((k) => {
    const days = severeDaysByMetric[k];
    if (days.length === 0) return;
    const dateLabels = [...days].sort().slice(0, 8).map(
      (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    const extra  = days.length > 8 ? ` +${days.length - 8} more` : "";
    const suffix = days.length === 1 ? "day" : "days";
    notableLines.push(`${METRIC_NAMES[k]} was severe (avg ≤ 2) on ${days.length} ${suffix}: ${dateLabels.join(", ")}${extra}`);
  });

  // Weather joins the daily table only when the period actually has some —
  // an all-"—" column is noise on a page a doctor has to scan. The patient can
  // also leave it out.
  const weatherByDate = Object.fromEntries((weatherDays || []).map((w) => [w.date, w]));
  const hasWeather = range.sections.has("weather") && dailyData.some((d) => formatWeatherLine(weatherByDate[d.date]));

  // Daily rows (derived from dailyData so chart and table always agree)
  const dailyRows = dailyData.map((d) => {
    const dayCheckins    = periodCheckIns.filter((c) => c.date === d.date);
    const uniqueSymptoms = [...new Set(dayCheckins.flatMap((c) => c.symptoms || []))];
    const fmt = (v) => v !== null ? v.toFixed(1) : "—";
    const row = [d.label, ...(hasPain ? [fmt(d.pain)] : []),
      fmt(d.mood), fmt(d.energy), fmt(d.anxiety), fmt(d.appetite),
      uniqueSymptoms.length > 0 ? uniqueSymptoms.join(", ") : "—"];
    // appended last so the numeric columns stay contiguous from index 1
    if (hasWeather) row.push(formatWeatherLine(weatherByDate[d.date]) || "—");
    return row;
  });

  // An omitted metric should read as "never asked", not as a gap in the data a
  // doctor has to guess at. Only worth saying when something was recorded at
  // all — on an empty period every average is blank and nothing is singled out.
  const untracked = [...(hasPain ? [] : ["pain"]), ...(hasSleep ? [] : ["sleep"])];
  const untrackedNote = untracked.length === 0 || periodCheckIns.length === 0
    ? ""
    : `${untracked.join(" and ").replace(/^./, (ch) => ch.toUpperCase())} ` +
      `${untracked.length > 1 ? "were" : "was"} not recorded in this period, so ` +
      `${untracked.length > 1 ? "they are" : "it is"} omitted above rather than shown as a zero.`;


  // Notes for one day, in the order they were written. A single note prints as
  // itself; several are prefixed with their times so a clinician can tell them
  // apart. No "Note:" label and no quotes — the italic grey row marks it.
  // Mirrored verbatim in client/src/utils/generateReport.js.
  const dayNoteText = (dayCheckins) => {
    const noted = dayCheckins
      .filter((c) => typeof c.note === "string" && c.note.trim() !== "")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (noted.length === 0) return "";
    if (noted.length === 1) return noted[0].note.trim();
    return noted
      .map((c) => {
        // Newer browsers (CLDR 42+) put U+202F, a narrow no-break space, before
        // AM/PM. jsPDF has no Unicode font: one non-WinAnsi character makes it
        // re-encode the whole cell as UTF-16BE while the font stays WinAnsi, and
        // the entire line renders as garbage — not just that one space. The em
        // dash is fine (WinAnsi 0x97); this is only about the space.
        const t = new Date(c.createdAt)
          .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          .replace(/\u202f/g, " ");
        return `${t} — ${c.note.trim()}`;
      })
      .join("\n");
  };
  // aligned to dailyData/dailyRows; "" means the day has no note and gets no row.
  // "Your notes" off drops them all.
  const dailyNotes = dailyData.map((d) =>
    range.sections.has("notes") ? dayNoteText(periodCheckIns.filter((c) => c.date === d.date)) : "");

  // Adherence by day of week — same computed-missed math
  const adherenceByDay = medStats.perWeekday.map((w) => (w.pct != null ? `${w.pct}%` : null));

  // Skip reasons
  const skipReasonCounts = {};
  periodLogs.forEach((log) => {
    if (log.skipReason) skipReasonCounts[log.skipReason] = (skipReasonCounts[log.skipReason] || 0) + 1;
  });
  const skipReasonRows = Object.entries(skipReasonCounts).sort((a, b) => b[1] - a[1]).map(([r, c]) => [r, c]);

  // Appointments — recent by the local date they fell on, and already past
  const recentAppts = appointments
    .filter((a) => {
      const d = new Date(a.date);
      const day = d.toLocaleDateString("en-CA");
      return day >= range.from && day <= range.to && d <= today;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const upcomingAppts = appointments
    .filter((a) => a.status === "upcoming" && new Date(a.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Period strings
  const periodStart      = fromDate.toLocaleDateString("en-US", { month: "long",  day: "numeric", year: "numeric" });
  const periodEnd        = toDate.toLocaleDateString("en-US",   { month: "long",  day: "numeric", year: "numeric" });
  const periodStartShort = fromDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const periodEndShort   = toDate.toLocaleDateString("en-US",   { month: "short", day: "numeric", year: "numeric" });
  const generatedDate    = today.toLocaleDateString("en-US",          { year: "numeric", month: "long", day: "numeric" });

  // Current medication list rows — the schedule column speaks the app's human
  // sentences via describeSchedule
  const medListRows = medications.map((med) => [
    med.name,
    med.type || "—",
    med.dosage || "—",
    describeSchedule(med) || "—",
    med.active ? "Active" : "Inactive",
  ]);
  // Notes render full-width under their medication's row rather than squeezed
  // into a truncated column — dosing instructions are what a prescriber reads.
  const medListNotes = medications.map((med) => (med.notes || "").trim());

  // Adherence table rows — from the shared computed-missed math. PRN meds are
  // excluded (no denominator); their doses show on the as-needed line instead
  const adherenceRows = medStats.perMed
    .filter((r) => r.expected > 0)
    .map((r) => [r.name, r.expected, r.taken, r.skipped, r.missed, `${r.pct}%`]);

  // Daily medication log rows sorted by date then scheduledTime (verbatim from web medLogBody)
  const medMap = {};
  medications.forEach((m) => { medMap[m.id] = m; });
  const medLogRows = [...periodLogs]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99"))
    .map((log) => {
      const med       = medMap[log.medicationId];
      const d         = new Date(log.date + "T12:00:00");
      const shortDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeTaken = log.takenAt ? new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
      return [
        shortDate,
        med?.name ?? "Unknown",
        med?.type ?? "—",
        log.scheduledTime ? formatTime(log.scheduledTime) : "As needed",
        log.status.charAt(0).toUpperCase() + log.status.slice(1),
        timeTaken,
        log.skipReason || "—",
      ];
    });

  // The three optional datasets. Each is left out when there is nothing to
  // show — "no flares" would read to a doctor as a clinical fact we don't have.
  const flareList = options.flares === undefined ? [] : flaresInRange(options.flares, range.from, range.to);
  const flareSummary = flareSummaryLine(flareList);
  const flareRows = flareList.map((f) => ({
    line: flareReportLine(f, todayStr),
    note: range.sections.has("notes") && typeof f.note === "string" ? f.note.trim() : "",
  }));
  const medChangeRows = medChangesInRange(options.medHistory, medications, range.from, range.to)
    .map((r) => ({ date: describeChangeDate(r.changedAt), medName: r.medName, lines: describeChange(r.entry) }));
  const helpedTableRows = helpedRows(medications, periodLogs, range.from, range.to,
    (m) => resolvePattern(m).kind === "as_needed")
    .map((r) => ({ name: r.name, taken: r.taken, ratings: helpedReportLine(r.counts) }));

  return {
    // Raw (for 9b tables)
    medications, medicationLogs: periodLogs, appointments,
    // Period
    today, todayStr, range, titles, fromDate, toDate,
    truncation: truncationNote(checkIns, range.from, todayStr),
    periodStart, periodEnd, periodStartShort, periodEndShort, generatedDate,
    // Check-in data
    periodCheckIns, totalDaysTracked, dailyData,
    // Metric averages
    avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite, avgSleep,
    // Symptoms
    symptomStats,
    // Med data
    medStats, prnTaken: medStats.prnTaken,
    // Glance
    glanceAdherenceText, glanceSevereText, glanceMostFreqSymptom,
    // Severe
    severeDaysByMetric,
    // Content
    notableLines, dailyRows, adherenceByDay, skipReasonRows,
    recentAppts, upcomingAppts,
    medListRows, medListNotes, adherenceRows, medLogRows, hasWeather,
    hasPain, hasSleep, untrackedNote, dailyNotes,
    // Optional datasets — empty when absent or not fetched
    flareSummary, flareRows, medChangeRows, helpedTableRows,
  };
}
