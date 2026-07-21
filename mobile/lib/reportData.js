import { formatTime, describeSchedule, adherenceStats } from "../theme/medications";

// ── Constants (mirror generateReport.js verbatim) ─────────────────────────────

export const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
  "Dizziness", "Headache", "Muscle weakness", "Joint pain",
  "Shortness of breath", "Nausea", "Sleep disturbance", "Bladder urgency",
];

export const PURPLE        = [124, 107, 174];
export const DARK          = [45,  37,  64];
export const GRAY          = [107, 95,  122];
export const LAVENDER_FILL = [240, 235, 248];

export const METRIC_KEYS  = ["painLevel", "moodLevel", "energyLevel", "anxietyLevel", "appetiteLevel"];
export const METRIC_NAMES = { painLevel: "Pain", moodLevel: "Mood", energyLevel: "Energy", anxietyLevel: "Anxiety", appetiteLevel: "Appetite" };

export const CHART_METRICS = [
  { key: "pain",     color: "#7C6BAE", label: "Pain"     },
  { key: "mood",     color: "#C4A8C0", label: "Mood"     },
  { key: "energy",   color: "#8FAF9B", label: "Energy"   },
  { key: "anxiety",  color: "#9BAFC4", label: "Anxiety"  },
  { key: "appetite", color: "#C4A882", label: "Appetite" },
];

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Pure helpers (verbatim from generateReport.js) ────────────────────────────

export const formatApptDatePdf = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Returns 31 entries (30 days ago → today), oldest first.
// Each: { date, label, pain, mood, energy, anxiety, appetite } — null when no data.
export const buildDailyAverages = (periodCheckIns, thirtyDaysAgo) => {
  const result = [];
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr     = d.toLocaleDateString("en-CA");
    const label       = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    });
  }
  return result;
};

// ── SVG trend chart (adaptation of drawTrendChart — same geometry, inline SVG) ─

export function buildTrendChartSvg(dailyData) {
  const plotLeft = 70, plotRight = 1180, plotTop = 20, plotBottom = 310;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const toX = (i) => plotLeft + (i / 30) * plotW;
  const toY = (v) => plotBottom - ((v - 1) / 4) * plotH;
  const p   = (n) => n.toFixed(2);

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

  // X axis labels every 5 days
  for (let i = 0; i <= 30; i += 5) {
    const entry = dailyData[i];
    if (entry) {
      parts.push(`<text x="${p(toX(i))}" y="${plotBottom + 24}" text-anchor="middle" dominant-baseline="hanging" fill="#6B5F7A" font-size="14" font-family="sans-serif">${entry.label}</text>`);
    }
  }

  // Lines + dots per metric — break line at gaps, never interpolate across nulls
  for (const { key, color } of CHART_METRICS) {
    let d = "";
    let prev = false;
    for (let i = 0; i <= 30; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) { prev = false; continue; }
      const x = p(toX(i)), y = p(toY(val));
      d += prev ? `L${x} ${y} ` : `M${x} ${y} `;
      prev = true;
    }
    if (d) {
      parts.push(`<path d="${d.trim()}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    for (let i = 0; i <= 30; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) continue;
      parts.push(`<circle cx="${p(toX(i))}" cy="${p(toY(val))}" r="3" fill="${color}"/>`);
    }
  }

  // Centered legend row below plot
  const legendItemW  = 160;
  const legendStartX = (1200 - CHART_METRICS.length * legendItemW) / 2;
  const legendY      = plotBottom + 28;
  for (let i = 0; i < CHART_METRICS.length; i++) {
    const { color, label } = CHART_METRICS[i];
    const x = legendStartX + i * legendItemW;
    parts.push(`<line x1="${p(x)}" y1="${legendY}" x2="${p(x + 24)}" y2="${legendY}" stroke="${color}" stroke-width="3"/>`);
    parts.push(`<text x="${p(x + 30)}" y="${legendY}" dominant-baseline="middle" fill="#2D2540" font-size="16" font-family="sans-serif">${label}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" style="width:100%;display:block">${parts.join("")}</svg>`;
}

// ── Main computation (mirrors generateReport body — pure JS, no PDF calls) ────

export function computeReportData(checkIns, medications = [], medicationLogs = [], appointments = []) {
  const today         = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayStr         = today.toLocaleDateString("en-CA");
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");

  const periodCheckIns   = checkIns.filter((c) => c.date >= thirtyDaysAgoStr && c.date <= todayStr);
  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked = daysWithCheckIns.length;

  const dailyData = buildDailyAverages(periodCheckIns, thirtyDaysAgo);

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

  // Symptom frequency
  const symptomStats = SYMPTOM_LIST.map((symptom) => {
    const days = daysWithCheckIns.filter((date) =>
      periodCheckIns.filter((c) => c.date === date).some((c) => c.symptoms && c.symptoms.includes(symptom))
    ).length;
    return { name: symptom, days, percentage: totalDaysTracked > 0 ? Math.round((days / totalDaysTracked) * 100) : 0 };
  }).filter((s) => s.days > 0).sort((a, b) => b.days - a.days);

  // Adherence: expected-vs-logged (computed-missed) — the shared engine math.
  // missed = expected past dose with no log; today's unlogged doses are neutral
  const medStats = adherenceStats(medications, medicationLogs, thirtyDaysAgoStr, todayStr, todayStr);

  const glanceAdherenceText = medStats.totals.expected > 0
    ? `${medStats.totals.pct}% (${medStats.totals.taken} of ${medStats.totals.expected} doses)`
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

  const glanceSevereText      = topSevereCount > 0 ? `${METRIC_NAMES[topSevereKey]} severe on ${topSevereCount} days` : "None";
  const glanceMostFreqSymptom = symptomStats.length > 0 ? `${symptomStats[0].name} — ${symptomStats[0].days} days` : "None logged";

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

  // Daily rows (derived from dailyData so chart and table always agree)
  const dailyRows = dailyData.map((d) => {
    const dayCheckins    = periodCheckIns.filter((c) => c.date === d.date);
    const uniqueSymptoms = [...new Set(dayCheckins.flatMap((c) => c.symptoms || []))];
    const fmt = (v) => v !== null ? v.toFixed(1) : "—";
    return [d.label, fmt(d.pain), fmt(d.mood), fmt(d.energy), fmt(d.anxiety), fmt(d.appetite),
      uniqueSymptoms.length > 0 ? uniqueSymptoms.join(", ") : "—"];
  });

  // Adherence by day of week — same computed-missed math
  const adherenceByDay = medStats.perWeekday.map((w) => (w.pct != null ? `${w.pct}%` : null));

  // Skip reasons
  const skipReasonCounts = {};
  medicationLogs.forEach((log) => {
    if (log.skipReason) skipReasonCounts[log.skipReason] = (skipReasonCounts[log.skipReason] || 0) + 1;
  });
  const skipReasonRows = Object.entries(skipReasonCounts).sort((a, b) => b[1] - a[1]).map(([r, c]) => [r, c]);

  // Appointments
  const recentAppts = appointments
    .filter((a) => { const d = new Date(a.date); return d >= thirtyDaysAgo && d <= today; })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const upcomingAppts = appointments
    .filter((a) => a.status === "upcoming" && new Date(a.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Period strings
  const periodStart      = thirtyDaysAgo.toLocaleDateString("en-US", { month: "long",  day: "numeric", year: "numeric" });
  const periodEnd        = today.toLocaleDateString("en-US",          { month: "long",  day: "numeric", year: "numeric" });
  const periodStartShort = thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const periodEndShort   = today.toLocaleDateString("en-US",          { month: "short", day: "numeric", year: "numeric" });
  const generatedDate    = today.toLocaleDateString("en-US",          { year: "numeric", month: "long", day: "numeric" });

  // Current medication list rows — the schedule column speaks the app's human
  // sentences via describeSchedule
  const medListHasNotes = medications.some((m) => m.notes && m.notes.trim());
  const medListRows = medications.map((med) => {
    const row = [
      med.name,
      med.type || "—",
      med.dosage || "—",
      describeSchedule(med) || "—",
      med.active ? "Active" : "Inactive",
    ];
    if (medListHasNotes) {
      const n = med.notes || "";
      row.push(n.length > 40 ? n.slice(0, 40) + "..." : n || "—");
    }
    return row;
  });

  // Adherence table rows — from the shared computed-missed math. PRN meds are
  // excluded (no denominator); their doses show on the as-needed line instead
  const adherenceRows = medStats.perMed
    .filter((r) => r.expected > 0)
    .map((r) => [r.name, r.expected, r.taken, r.skipped, r.missed, `${r.pct}%`]);

  // Daily medication log rows sorted by date then scheduledTime (verbatim from web medLogBody)
  const medMap = {};
  medications.forEach((m) => { medMap[m.id] = m; });
  const medLogRows = [...medicationLogs]
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

  return {
    // Raw (for 9b tables)
    medications, medicationLogs, appointments,
    // Period
    today, thirtyDaysAgo, todayStr, thirtyDaysAgoStr,
    periodStart, periodEnd, periodStartShort, periodEndShort, generatedDate,
    // Check-in data
    periodCheckIns, totalDaysTracked, dailyData,
    // Metric averages
    avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite,
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
    medListHasNotes, medListRows, adherenceRows, medLogRows,
  };
}
