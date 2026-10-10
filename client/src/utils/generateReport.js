import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatTime, describeSchedule, adherenceStats, resolvePattern, describeChange, describeChangeDate,
} from "./medicationHelpers";
// ?inline gives a data URI, so the PDF stays synchronous — no image to await
import logoMark from "../assets/logo-mark.png?inline";
import { formatWeatherLine } from "./weatherFormat";
import { localToday } from "./flareHelpers";
import {
  resolveReportOptions, rangeTitles, eachDay, chartLabelStep, flaresInRange, flareSummaryLine,
  flareReportLine, medChangesInRange, helpedRows, helpedReportLine, truncationNote,
} from "./reportOptions";

const PURPLE        = [124, 107, 174];
const DARK          = [45,  37,  64];
const GRAY          = [107, 95,  122];
const LAVENDER_FILL = [240, 235, 248];

const METRIC_KEYS  = ["painLevel", "moodLevel", "energyLevel", "anxietyLevel", "appetiteLevel", "sleepLevel"];
const METRIC_NAMES = { painLevel: "Pain", moodLevel: "Mood", energyLevel: "Energy", anxietyLevel: "Anxiety", appetiteLevel: "Appetite", sleepLevel: "Sleep" };

const formatApptDatePdf = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const sectionTitle = (doc, text, y, margin) => {
  doc.setFontSize(11);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text(text, margin, y);
};

// A calendar date at local noon, the safe hour to format one from
const atLocalNoon = (ymd) => {
  const [yr, mo, dy] = ymd.split("-").map(Number);
  return new Date(yr, mo - 1, dy, 12, 0, 0, 0);
};

// One entry per day of the range, oldest first.
// Each entry: { date, label, pain, mood, energy, anxiety, appetite } — null when no data that day.
const buildDailyAverages = (periodCheckIns, range) => {
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

const CHART_METRICS = [
  { key: "pain",     color: "#7C6BAE", label: "Pain"     },
  { key: "mood",     color: "#C4A8C0", label: "Mood"     },
  { key: "energy",   color: "#8FAF9B", label: "Energy"   },
  { key: "anxiety",  color: "#9BAFC4", label: "Anxiety"  },
  { key: "appetite", color: "#C4A882", label: "Appetite" },
  { key: "sleep",    color: "#9AD0C8", label: "Sleep"    },
];

// Draws a 1200×360 trend chart on an off-screen canvas and returns a PNG data URL.
const drawTrendChart = (dailyData) => {
  const canvas = document.createElement("canvas");
  canvas.width  = 1200;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");

  const plotLeft   = 70;
  const plotRight  = 1180;
  const plotTop    = 20;
  const plotBottom = 310;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 1200, 360);

  const n   = dailyData.length;
  const toX = (i) => plotLeft + (i / Math.max(1, n - 1)) * plotW;
  const toY = (v) => plotBottom - ((v - 1) / 4) * plotH;

  // A metric nobody answered in this period gets no line and no legend entry.
  // Sleep has always been optional and pain now is too, and a legend swatch
  // with nothing drawn beside it reads as a flatline rather than an absence.
  const activeMetrics = CHART_METRICS.filter(
    (m) => dailyData.some((d) => d[m.key] != null),
  );

  // Gridlines at 1, 3, 5
  ctx.strokeStyle = "#EEEAF5";
  ctx.lineWidth = 1;
  [1, 3, 5].forEach((v) => {
    const yp = toY(v);
    ctx.beginPath();
    ctx.moveTo(plotLeft, yp);
    ctx.lineTo(plotRight, yp);
    ctx.stroke();
  });

  // Y axis labels
  ctx.fillStyle = "#6B5F7A";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Bad",  plotLeft - 8, toY(1));
  ctx.fillText("Mid",  plotLeft - 8, toY(3));
  ctx.fillText("Good", plotLeft - 8, toY(5));

  // X axis labels: about seven of them, whatever the range (every 5th of 31 days)
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < n; i += chartLabelStep(n)) {
    if (dailyData[i]) ctx.fillText(dailyData[i].label, toX(i), plotBottom + 8);
  }

  // Lines + dots per metric (break line at gaps — never interpolate)
  activeMetrics.forEach(({ key, color }) => {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.lineJoin    = "round";
    ctx.lineCap     = "round";

    let prevHadValue = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) { prevHadValue = false; continue; }
      if (!prevHadValue) ctx.moveTo(toX(i), toY(val));
      else               ctx.lineTo(toX(i), toY(val));
      prevHadValue = true;
    }
    ctx.stroke();

    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) continue;
      ctx.beginPath();
      ctx.arc(toX(i), toY(val), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Centered legend row below plot
  const legendItemW  = 160;
  const legendStartX = (1200 - activeMetrics.length * legendItemW) / 2;
  const legendY      = plotBottom + 28;
  ctx.textBaseline = "middle";
  ctx.font         = "16px sans-serif";
  ctx.textAlign    = "left";
  activeMetrics.forEach(({ color, label }, i) => {
    const x = legendStartX + i * legendItemW;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(x, legendY);
    ctx.lineTo(x + 24, legendY);
    ctx.stroke();
    ctx.fillStyle = "#2D2540";
    ctx.fillText(label, x + 30, legendY);
  });

  return canvas.toDataURL("image/png");
};

/**
 * Builds and downloads the doctor report PDF.
 *
 * `options = { from, to, sections, heading }`:
 *   - `from` / `to`: "YYYY-MM-DD", inclusive, the patient's local dates. Missing
 *     means the default range (today − 30 … today); see resolveReportOptions
 *     for the clamps. Never throws over a bad range.
 *   - `sections`: keys from REPORT_SECTIONS; undefined means all of them.
 *   - `heading`: an optional subtitle printed under the title.
 *
 * Two more fields belong to the exporter (exportReport.js), because the
 * positional arguments have no slot for them:
 *   - `flares`: the array GET /api/flares returned for the range.
 *   - `medHistory`: `{ [medicationId]: entries[] }` from GET /api/medications/:id/history.
 * `undefined` means "not fetched", and that section is left out. It never means
 * "none" — a report must not tell a doctor there were no flares or no changes
 * when nobody looked.
 *
 * `options = {}` prints the same report as before options existed.
 */
export function generateReport(checkIns, username, medications = [], medicationLogs = [], appointments = [], insights = null, weatherDays = [], options = {}) {
  const today    = new Date();
  const todayStr = localToday();
  const range    = resolveReportOptions(options, todayStr);
  const has      = (key) => range.sections.has(key);
  const titles   = rangeTitles(range);
  const fromDate = atLocalNoon(range.from);
  const toDate   = atLocalNoon(range.to);

  const periodCheckIns   = checkIns.filter((c) => c.date >= range.from && c.date <= range.to);
  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked = daysWithCheckIns.length;

  // Callers may pass logs from a wider window; everything below counts only the range
  const periodLogs = medicationLogs.filter((l) => l.date >= range.from && l.date <= range.to);

  // Daily averages — shared source of truth for chart and daily log table
  const dailyData = buildDailyAverages(periodCheckIns, range);

  // Metric averages
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
  // Declared here because the daily log table below is built from it too.
  const hasPain  = avgPain !== "-";
  const hasSleep = avgSleep !== "-";

  // An omitted metric should read as "never asked", not as a gap in the data a
  // doctor has to guess at. Only worth saying when something was recorded at
  // all — on an empty period every average is blank and nothing is singled out.
  const untracked = [...(hasPain ? [] : ["pain"]), ...(hasSleep ? [] : ["sleep"])];
  const untrackedNote = untracked.length === 0 || periodCheckIns.length === 0
    ? ""
    : `${untracked.join(" and ").replace(/^./, (ch) => ch.toUpperCase())} ` +
      `${untracked.length > 1 ? "were" : "was"} not recorded in this period, so ` +
      `${untracked.length > 1 ? "they are" : "it is"} omitted above rather than shown as a zero.`;

  // Symptom frequency — counted over what the patient actually logged, not a
  // fixed list of names. The fixed list predated the catalog and silently
  // dropped every mental symptom, most of the physical ones and anything the
  // patient typed themselves: their symptoms appeared in the daily log while
  // this table said "none". Ties break by name so the ordering is stable, and
  // At a Glance reads the top row.
  const loggedSymptoms = [...new Set(periodCheckIns.flatMap((c) => c.symptoms || []))];
  const symptomStats = loggedSymptoms.map((symptom) => {
    const days = daysWithCheckIns.filter((date) =>
      periodCheckIns.filter((c) => c.date === date).some((c) => c.symptoms && c.symptoms.includes(symptom)),
    ).length;
    return { name: symptom, days, percentage: totalDaysTracked > 0 ? Math.round((days / totalDaysTracked) * 100) : 0 };
  }).filter((s) => s.days > 0).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));

  // Adherence: expected-vs-logged (computed-missed) — the shared engine math.
  // missed = expected past dose with no log; today's unlogged doses are neutral
  const medStats = adherenceStats(medications, periodLogs, range.from, range.to, todayStr);

  const glanceAdherenceText = medStats.totals.expected > 0
    ? `${medStats.totals.pct}% (${medStats.totals.taken} of ${medStats.totals.expected} ${medStats.totals.expected === 1 ? "dose" : "doses"})`
    : "No medications tracked";

  // Severe day computations (daily average ≤ 2, since 5=best)
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
      (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
    const extra  = days.length > 8 ? ` +${days.length - 8} more` : "";
    const suffix = days.length === 1 ? "day" : "days";
    // "≤" is not in jsPDF's WinAnsi font and printed as `"d`; the phone's HTML
    // report keeps the symbol
    notableLines.push(`${METRIC_NAMES[k]} was severe (avg <= 2) on ${days.length} ${suffix}: ${dateLabels.join(", ")}${extra}`);
  });

  // Weather joins the daily table only when the period actually has some —
  // an all-"—" column is noise on a page a doctor has to scan. The patient can
  // also leave it out.
  const weatherByDate = Object.fromEntries((weatherDays || []).map((w) => [w.date, w]));
  const hasWeather = has("weather") && dailyData.some((d) => formatWeatherLine(weatherByDate[d.date]));

  // Daily rows for page 3 (derived from dailyData so chart and table always agree)
  const dailyRows = dailyData.map((d) => {
    const dayCheckins    = periodCheckIns.filter((c) => c.date === d.date);
    const uniqueSymptoms = [...new Set(dayCheckins.flatMap((c) => c.symptoms || []))];
    const fmt = (v) => v !== null ? v.toFixed(1) : "—";
    const row = [d.label, ...(hasPain ? [fmt(d.pain)] : []),
      fmt(d.mood), fmt(d.energy), fmt(d.anxiety), fmt(d.appetite),
      uniqueSymptoms.length > 0 ? uniqueSymptoms.join(", ") : "—"];
    if (hasWeather) row.push(formatWeatherLine(weatherByDate[d.date]) || "—");
    return row;
  });


  // Notes for one day, in the order they were written. A single note prints as
  // itself; several are prefixed with their times so a clinician can tell them
  // apart. No "Note:" label and no quotes — the italic grey row marks it.
  // Mirrored verbatim in mobile/lib/reportData.js.
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
    has("notes") ? dayNoteText(periodCheckIns.filter((c) => c.date === d.date)) : "");

  // The three optional datasets. Each is left out when there is nothing to
  // show — "no flares" would read to a doctor as a clinical fact we don't have.
  const flareList = options.flares === undefined ? [] : flaresInRange(options.flares, range.from, range.to);
  const medChangeRows = medChangesInRange(options.medHistory, medications, range.from, range.to);
  const helpedList = helpedRows(medications, periodLogs, range.from, range.to,
    (m) => resolvePattern(m).kind === "as_needed");
  const showFlares     = has("flares") && flareList.length > 0;
  const showMedChanges = has("medChanges") && medChangeRows.length > 0;
  const showHelped     = has("helped") && helpedList.length > 0;

  const fmtLong  = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ─── BUILD PDF ──────────────────────────────────────────────────────────────
  const doc        = new jsPDF({ orientation: "portrait" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 10;
  const gap        = 4;
  const colW       = (pageWidth - 2 * margin) / 2;

  // Has anything been drawn below the header on the current page? A chapter
  // only starts a new page when it has, so a report of daily logs alone opens
  // on page 1 rather than after a blank one.
  let pageUsed = false;

  // ─── PAGE 1: SUMMARY ────────────────────────────────────────────────────────
  let y = 15;

  // Header — the C-and-sprig mark on a purple tile, the lockup the app's own
  // header uses. The mark artwork is white, so on paper it needs the tile
  // behind it; without the tile it would print as nothing.
  const MARK = 13;
  doc.setFillColor(...PURPLE);
  doc.roundedRect(margin, 11.5, MARK, MARK, 2.5, 2.5, "F");
  doc.addImage(logoMark, "PNG", margin + 2.2, 13.7, MARK - 4.4, MARK - 4.4, "brandmark", "FAST");
  const headX = margin + MARK + 4;

  doc.setFontSize(14);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Chronically Health Report", headX, y);
  y += 6;

  if (range.heading) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "italic");
    doc.text(range.heading, headX, y);
    y += 4.5;
  }

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text(
    `Patient: ${username}     Generated: ${today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    headX, y,
  );
  y += 4;
  doc.text(`Period: ${fmtLong(fromDate)} – ${fmtLong(toDate)}`, headX, y);

  const fetchNote = truncationNote(checkIns, range.from, todayStr);
  if (fetchNote) {
    y += 4;
    doc.setFontSize(8);
    doc.text(fetchNote, headX, y, { maxWidth: pageWidth - headX - margin });
  }
  y += gap + 2;

  // ── At a Glance box ── (sleep takes a full-width third row when tracked)
  if (has("glance")) {
    const boxH  = hasSleep ? 42 : 30;
    const lPad  = 5;
    const row1Y = y + 5;
    const row2Y = y + 17;
    const row3Y = y + 29;
    const div1Y = y + 15;
    const div2Y = y + 27;

    doc.setFillColor(...LAVENDER_FILL);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, boxH, 3, 3, "F");

    // Subtle dividers — the column rule stops where the full-width row starts
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.2);
    doc.line(margin + 4,    div1Y, margin + pageWidth - 2 * margin - 4, div1Y);
    if (hasSleep) doc.line(margin + 4, div2Y, margin + pageWidth - 2 * margin - 4, div2Y);
    doc.line(margin + colW, y + 4,  margin + colW, hasSleep ? div2Y : y + boxH - 4);

    // Labels (7pt gray)
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    doc.text("Check-ins",             margin + lPad,        row1Y);
    doc.text("Medication adherence",  margin + colW + lPad, row1Y);
    doc.text("Most frequent symptom", margin + lPad,        row2Y);
    doc.text("Severe days",           margin + colW + lPad, row2Y);
    if (hasSleep) doc.text("Average sleep quality", margin + lPad, row3Y);

    // Values (10pt dark bold)
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont(undefined, "bold");
    const maxValW = colW - lPad - 4;
    doc.text(doc.splitTextToSize(`${periodCheckIns.length} over ${totalDaysTracked} of ${titles.glanceDays} days`, maxValW), margin + lPad,        row1Y + 5);
    doc.text(doc.splitTextToSize(glanceAdherenceText,   maxValW), margin + colW + lPad, row1Y + 5);
    doc.text(doc.splitTextToSize(glanceMostFreqSymptom, maxValW), margin + lPad,        row2Y + 5);
    doc.text(doc.splitTextToSize(glanceSevereText,      maxValW), margin + colW + lPad, row2Y + 5);
    if (hasSleep) doc.text(`${avgSleep} / 5`, margin + lPad, row3Y + 5);

    y += boxH + gap;
    pageUsed = true;
  }

  // ── Trend chart ──
  if (has("trend")) {
    sectionTitle(doc, titles.trend, y, margin);
    y += 4;

    const daysWithAnyData = dailyData.filter(
      (d) => d.pain !== null || d.mood !== null || d.energy !== null || d.anxiety !== null || d.appetite !== null,
    );
    if (daysWithAnyData.length < 2) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "normal");
      doc.text("Not enough data to display a trend chart.", margin, y + 4);
      y += 12;
    } else {
      const dataUrl      = drawTrendChart(dailyData);
      const contentWidth = pageWidth - 2 * margin;
      const chartH       = contentWidth * (330 / 1200);
      doc.addImage(dataUrl, "PNG", margin, y, contentWidth, chartH);
      y += chartH + gap;
    }
    pageUsed = true;
  }

  // ── Averages ── (Sleep column only when the period has sleep data)
  if (has("averages")) {
    sectionTitle(doc, titles.averages, y, margin);
    y += 3;
    const avgHead = [...(hasPain ? ["Pain"] : []), "Mood", "Energy", "Anxiety", "Appetite"];
    const avgBody = [...(hasPain ? [avgPain] : []), avgMood, avgEnergy, avgAnxiety, avgAppetite];
    if (hasSleep) { avgHead.push("Sleep"); avgBody.push(avgSleep); }
    const avgColW = avgHead.length > 5 ? 31 : avgHead.length === 5 ? 38 : 46;
    const avgColStyles = {};
    avgHead.forEach((_, i) => { avgColStyles[i] = { cellWidth: avgColW }; });
    autoTable(doc, {
      startY: y,
      head: [avgHead],
      body: [avgBody],
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center", cellPadding: 2 },
      bodyStyles: { textColor: DARK, fontSize: 13, fontStyle: "bold", halign: "center", cellPadding: 2 },
      columnStyles: avgColStyles,
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = doc.lastAutoTable.finalY + gap;

    if (untrackedNote) {
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "normal");
      const noteLines = doc.splitTextToSize(untrackedNote, pageWidth - 2 * margin);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 3.5 + gap - 1;
    }
    pageUsed = true;
  }

  // ── Notable Events ──
  if (has("notable")) {
    sectionTitle(doc, "Notable Events", y, margin);
    y += 3;
    autoTable(doc, {
      startY: y,
      body: notableLines.length > 0
        ? notableLines.map((line) => [line])
        : [["No severe days recorded in this period."]],
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 } },
      columnStyles: { 0: { cellWidth: pageWidth - 2 * margin } },
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin },
      theme: "plain",
    });
    y = doc.lastAutoTable.finalY + gap;
    pageUsed = true;
  }

  // ── Flares ── (only when the patient logged any that touch the range)
  if (showFlares) {
    if (y > pageHeight - 45) { doc.addPage(); y = 15; }
    sectionTitle(doc, "Flares", y, margin);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont(undefined, "normal");
    doc.text(flareSummaryLine(flareList), margin, y);
    y += 2;
    const noteStyles = { fontSize: 7.5, fontStyle: "italic", textColor: GRAY, cellPadding: { top: 0, bottom: 1.5, left: 5, right: 2 } };
    autoTable(doc, {
      startY: y,
      // each flare, with its note on the row beneath it when "Your notes" is on
      body: flareList.flatMap((f) => {
        const note = has("notes") && typeof f.note === "string" ? f.note.trim() : "";
        const row = [flareReportLine(f, todayStr)];
        return note ? [row, [{ content: note, styles: noteStyles }]] : [row];
      }),
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 } },
      columnStyles: { 0: { cellWidth: pageWidth - 2 * margin } },
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "plain",
    });
    y = doc.lastAutoTable.finalY + gap;
    pageUsed = true;
  }

  // ── Symptom Frequency ──
  if (has("symptoms")) {
    sectionTitle(doc, "Symptom Frequency", y, margin);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Symptom", "Days", "% of days tracked"]],
      body: symptomStats.length > 0
        ? symptomStats.map((s) => [s.name, s.days, `${s.percentage}%`])
        : [["No symptoms logged in this period", "", ""]],
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
      bodyStyles: { textColor: DARK, fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 25 }, 2: { cellWidth: 75 } },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = doc.lastAutoTable.finalY + gap;
    pageUsed = true;
  }

  // ── Observed Patterns ── (bonus section: absent insights simply mean no
  // section — an export must never depend on it)
  const patternCards = has("patterns") ? insights?.cards || [] : [];
  if (patternCards.length > 0) {
    // don't strand the heading at the foot of the page
    if (y > pageHeight - 45) { doc.addPage(); y = 15; }
    sectionTitle(doc, "Observed Patterns", y, margin);
    y += 4;
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "italic");
    doc.text(
      "Associations in this patient's self-reported data over the last 90 days. Correlational only — not causal, and not clinically validated.",
      margin, y, { maxWidth: pageWidth - 2 * margin },
    );
    doc.setFont(undefined, "normal");
    y += 6;
    autoTable(doc, {
      startY: y,
      // autoTable measures the three lines (and pages the card as a unit); we
      // redraw them by hand so headline, body and evidence each get their own
      // weight and colour
      body: patternCards.map((c) => [`${c.headline}\n${c.body}\n${c.evidence}`]),
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: { top: 1.5, bottom: 3, left: 2, right: 2 } },
      willDrawCell: (d) => { if (d.section === "body") d.cell.text = []; },
      didDrawCell: (d) => {
        if (d.section !== "body") return;
        const card     = patternCards[d.row.index];
        if (!card) return;
        const x        = d.cell.x + 2;
        const bodyWrap = doc.splitTextToSize(card.body, d.cell.width - 4);
        let   ty       = d.cell.y + 4.5;
        doc.setTextColor(...DARK);
        doc.setFont(undefined, "bold");
        doc.setFontSize(9);
        doc.text(card.headline, x, ty);
        ty += 4;
        doc.setFont(undefined, "normal");
        doc.setFontSize(8);
        doc.text(bodyWrap, x, ty);
        ty += 3.4 * bodyWrap.length;
        doc.setTextColor(...GRAY);
        doc.setFontSize(7);
        doc.text(card.evidence, x, ty);
      },
      columnStyles: { 0: { cellWidth: pageWidth - 2 * margin, minCellHeight: 15 } },
      // a card is never split across pages: the redraw above draws a whole card
      // per row, and a split row has no card behind it
      rowPageBreak: "avoid",
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "plain",
    });
    y = doc.lastAutoTable.finalY + gap;
    pageUsed = true;
  }

  // A chapter: a new page with its title and the patient/period line, unless
  // nothing has been drawn yet — then it continues under the page-1 header,
  // which already carries that line. Returns where its first section goes.
  const startChapter = (title) => {
    let cy = y;
    if (pageUsed) {
      doc.addPage();
      cy = 15;
    }
    doc.setFontSize(12);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text(title, margin, cy);
    if (pageUsed) {
      cy += 5;
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "normal");
      doc.text(`Patient: ${username}     Period: ${fmtShort(fromDate)} – ${fmtShort(toDate)}`, margin, cy);
    }
    pageUsed = true;
    return cy + gap + 2;
  };

  // ─── MEDICATIONS + APPOINTMENTS ────────────────────────────────────────────
  // chapters track their real page numbers, since the summary can now run long
  const medsChapter = has("medications") || has("adherence") || has("skipReasons") ||
    has("appointments") || showMedChanges || showHelped;
  let medsPage = null;
  if (medsChapter) {
    const startPage = doc.internal.getNumberOfPages();
    let y2 = startChapter("Medications & Appointments");
    medsPage = doc.internal.getNumberOfPages();
    if (medsPage === startPage && medsPage === 1) medsPage = null; // stayed on page 1

    // Current Medications
    if (has("medications")) {
      sectionTitle(doc, "Current Medications", y2, margin);
      y2 += 3;

      if (medications.length === 0) {
        autoTable(doc, {
          startY: y2,
          body: [["No medications tracked"]],
          bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2, halign: "center" },
          margin: { left: margin, right: margin, top: 14 },
          theme: "grid",
        });
      } else {
        const medListHead = ["Name", "Type", "Dosage", "Schedule", "Status"];
        const medListColStyles = { 0: { cellWidth: 45 }, 1: { cellWidth: 20 }, 2: { cellWidth: 25 }, 3: { cellWidth: 70 }, 4: { cellWidth: 20 } };
        // the schedule column speaks the app's human sentences via describeSchedule.
        // Notes follow on their own full-width row rather than being truncated into
        // a cramped sixth column — dosing instructions are what a prescriber reads.
        const medListBody = [];
        medications.forEach((med) => {
          medListBody.push([med.name, med.type || "—", med.dosage || "—", describeSchedule(med) || "—", med.active ? "Active" : "Inactive"]);
          const note = (med.notes || "").trim();
          if (note) {
            medListBody.push([{
              content: note,
              colSpan: 5,
              styles: { fontSize: 7.5, fontStyle: "italic", textColor: GRAY, cellPadding: { top: 1, bottom: 1.5, left: 5, right: 2 } },
            }]);
          }
        });
        autoTable(doc, {
          startY: y2, head: [medListHead], body: medListBody,
          headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
          bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
          columnStyles: medListColStyles, styles: { overflow: "linebreak" },
          margin: { left: margin, right: margin, top: 14 }, theme: "grid",
        });
      }
      y2 = doc.lastAutoTable.finalY + gap;
    }

    // Medication Changes — what the patient recorded changing, in the range
    if (showMedChanges) {
      if (y2 > pageHeight - 45) { doc.addPage(); y2 = 15; }
      sectionTitle(doc, "Medication Changes", y2, margin);
      y2 += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "italic");
      doc.text(
        "Changes the patient recorded in Chronically. \"Added\" is when a medication was added to the app.",
        margin, y2, { maxWidth: pageWidth - 2 * margin },
      );
      doc.setFont(undefined, "normal");
      y2 += 3;
      autoTable(doc, {
        startY: y2,
        head: [["Date", "Medication", "Change"]],
        // describeChange's "→" is not in jsPDF's WinAnsi font and would print as
        // "!'", so the PDF spells it "->"; the wording is otherwise the app's own
        body: medChangeRows.map((r) => [
          describeChangeDate(r.changedAt), r.medName, describeChange(r.entry).join("\n").replace(/→/g, "->"),
        ]),
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
        bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 50 }, 2: { cellWidth: "auto" } },
        styles: { overflow: "linebreak" },
        margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;
    }

    if (has("adherence")) {
      // Medication Adherence
      sectionTitle(doc, titles.adherence, y2, margin);
      y2 += 3;
      // From the shared computed-missed math. PRN meds are excluded (no
      // denominator); their doses show on the as-needed line instead
      const adherencePerMed = medStats.perMed.filter((r) => r.expected > 0);
      const adherenceBody = adherencePerMed.length === 0
        ? [["No scheduled medications in this period", "", "", "", "", ""]]
        : adherencePerMed.map((r) => [r.name, r.expected, r.taken, r.skipped, r.missed, `${r.pct}%`]);
      autoTable(doc, {
        startY: y2,
        head: [["Name", "Scheduled", "Taken", "Skipped", "Missed", "Adherence %"]],
        body: adherenceBody,
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
        bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 55 }, 1: { cellWidth: 25, halign: "center" }, 2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 25, halign: "center" }, 4: { cellWidth: 25, halign: "center" }, 5: { cellWidth: 35, halign: "center" },
        },
        margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;

      // As-needed doses — reported separately, never in the percentage
      if (medStats.prnTaken > 0) {
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.setFont(undefined, "normal");
        doc.text(`As-needed doses taken: ${medStats.prnTaken}`, margin, y2);
        y2 += gap + 1;
      }

      // Adherence by Day of Week — same computed-missed math
      const DOW_LABELS    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const adherenceByDay = medStats.perWeekday.map((w) => (w.pct != null ? `${w.pct}%` : null));
      sectionTitle(doc, "Adherence by Day of Week", y2, margin);
      y2 += 3;
      autoTable(doc, {
        startY: y2, head: [DOW_LABELS], body: [adherenceByDay.map((p) => p ?? "—")],
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2, halign: "center" },
        bodyStyles: { textColor: DARK, fontSize: 11, fontStyle: "bold", halign: "center", cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 27 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 }, 3: { cellWidth: 27 }, 4: { cellWidth: 27 }, 5: { cellWidth: 28 }, 6: { cellWidth: 27 } },
        margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;
    }

    // As-needed Ratings — the patient's own "did it help?", as counts
    if (showHelped) {
      if (y2 > pageHeight - 45) { doc.addPage(); y2 = 15; }
      sectionTitle(doc, "As-needed Ratings", y2, margin);
      y2 += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "italic");
      doc.text(
        "The patient's own note, after taking an as-needed dose, of whether it helped.",
        margin, y2, { maxWidth: pageWidth - 2 * margin },
      );
      doc.setFont(undefined, "normal");
      y2 += 3;
      autoTable(doc, {
        startY: y2,
        head: [["Medication", "Taken", "Ratings"]],
        body: helpedList.map((r) => [r.name, r.taken, helpedReportLine(r.counts)]),
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
        bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 25, halign: "center" }, 2: { cellWidth: "auto" } },
        styles: { overflow: "linebreak" },
        margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;
    }

    // Skip Reasons
    if (has("skipReasons")) {
      const skipReasonCounts = {};
      periodLogs.forEach((log) => {
        if (log.skipReason) skipReasonCounts[log.skipReason] = (skipReasonCounts[log.skipReason] || 0) + 1;
      });
      const skipReasonRows = Object.entries(skipReasonCounts).sort((a, b) => b[1] - a[1]).map(([r, c]) => [r, c]);
      sectionTitle(doc, "Most Common Skip Reasons", y2, margin);
      y2 += 3;
      autoTable(doc, {
        startY: y2,
        head: [["Reason", "Times"]],
        body: skipReasonRows.length > 0 ? skipReasonRows : [["No doses were skipped in this period", ""]],
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
        bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 155 }, 1: { cellWidth: 35, halign: "center" } },
        margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;
    }

    if (has("appointments")) {
      // Recent Appointments — by the local date they fell on, and already past
      const recentAppts = appointments
        .filter((a) => {
          const d = new Date(a.date);
          const day = d.toLocaleDateString("en-CA");
          return day >= range.from && day <= range.to && d <= today;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      sectionTitle(doc, titles.recentAppts, y2, margin);
      y2 += 3;
      autoTable(doc, {
        startY: y2,
        head: [["Date", "Doctor", "Specialty", "Reason", "Notes After"]],
        body: recentAppts.length > 0
          ? recentAppts.map((a) => [formatApptDatePdf(a.date), a.doctorName || "—", a.specialty || "—", a.reason || "—", a.notesAfter || "—"])
          : [["No appointments in this period", "", "", "", ""]],
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
        bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 35 }, 2: { cellWidth: 28 }, 3: { cellWidth: 30 }, 4: { cellWidth: "auto" } },
        styles: { overflow: "linebreak" }, margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;

      // Upcoming Appointments
      const upcomingAppts = appointments
        .filter((a) => a.status === "upcoming" && new Date(a.date) >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      sectionTitle(doc, "Upcoming Appointments", y2, margin);
      y2 += 3;
      autoTable(doc, {
        startY: y2,
        head: [["Date", "Doctor", "Specialty", "Reason", "Notes Before"]],
        body: upcomingAppts.length > 0
          ? upcomingAppts.map((a) => [formatApptDatePdf(a.date), a.doctorName || "—", a.specialty || "—", a.reason || "—", a.notesBefore || "—"])
          : [["No upcoming appointments", "", "", "", ""]],
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
        bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 35 }, 2: { cellWidth: 28 }, 3: { cellWidth: 30 }, 4: { cellWidth: "auto" } },
        styles: { overflow: "linebreak" }, margin: { left: margin, right: margin, top: 14 }, theme: "grid",
      });
      y2 = doc.lastAutoTable.finalY + gap;
    }
    y = y2;
  }

  // ─── DAILY LOGS ────────────────────────────────────────────────────────────
  let logsPage = null;
  if (has("dailyLog") || has("medLog")) {
    const startPage = doc.internal.getNumberOfPages();
    let y3 = startChapter("Daily Logs");
    logsPage = doc.internal.getNumberOfPages();
    if (logsPage === startPage && logsPage === 1) logsPage = null; // stayed on page 1

    // Daily Health Log
    if (has("dailyLog")) {
      sectionTitle(doc, "Daily Health Log", y3, margin);
      y3 += 3;
      // Columns are assembled rather than written out: pain drops when nobody
      // answered it, weather appears only when the period has some. autoTable keys
      // columnStyles by index, so the widths have to be derived from the same list
      // — a hardcoded index map would misalign the moment a column disappears.
      const dailyHead = ["Date", ...(hasPain ? ["Pain"] : []),
        "Mood", "Enrg", "Anx", "App", "Symptoms", ...(hasWeather ? ["Weather"] : [])];
      const metricW = hasWeather ? 12 : 14;
      const dailyColStyles = {};
      dailyHead.forEach((h, i) => {
        if (i === 0)               dailyColStyles[i] = { cellWidth: 14 };
        // only one column may be "auto", so Symptoms keeps it and takes up whatever
        // the other columns leave — including the width a dropped Pain frees
        else if (h === "Symptoms") dailyColStyles[i] = { cellWidth: "auto" };
        else if (h === "Weather")  dailyColStyles[i] = { cellWidth: 34 };
        else                       dailyColStyles[i] = { cellWidth: metricW, halign: "center" };
      });

      autoTable(doc, {
        startY: y3,
        head: [dailyHead],
        // each day row, with its note on a full-width row beneath it. colSpan uses
        // dailyHead.length so the span stays right when Pain or Weather drop out.
        body: dailyRows.flatMap((row, i) => {
          const note = dailyNotes[i];
          if (!note) return [row];
          return [row, [{
            content: note,
            colSpan: dailyHead.length,
            styles: { fontSize: 7.5, fontStyle: "italic", textColor: GRAY, cellPadding: { top: 1, bottom: 1.5, left: 5, right: 2 } },
          }]];
        }),
        headStyles: {
          fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        },
        bodyStyles: {
          textColor: DARK, fontSize: 8,
          cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 },
          minCellHeight: 5,
          valign: "middle",
        },
        columnStyles: dailyColStyles,
        styles: { overflow: "linebreak" },
        margin: { left: margin, right: margin, top: 14 },
        theme: "grid",
      });
      y3 = doc.lastAutoTable.finalY + gap;
    }

    // Daily Medication Log
    if (has("medLog")) {
      sectionTitle(doc, "Daily Medication Log", y3, margin);
      y3 += 3;

      let medLogBody;
      if (periodLogs.length === 0) {
        medLogBody = [["No medication logs in this period", "", "", "", "", "", ""]];
      } else {
        const medMap = {};
        medications.forEach((m) => { medMap[m.id] = m; });
        medLogBody = [...periodLogs]
          .sort((a, b) => a.date.localeCompare(b.date) || (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99"))
          .map((log) => {
            const med       = medMap[log.medicationId];
            const d         = new Date(log.date + "T12:00:00");
            const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const timeTaken = log.takenAt ? new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
            return [
              dateLabel, med?.name ?? "Unknown", med?.type ?? "—",
              log.scheduledTime ? formatTime(log.scheduledTime) : "As needed",
              log.status.charAt(0).toUpperCase() + log.status.slice(1),
              timeTaken, log.skipReason || "—",
            ];
          });
      }

      const isEmptyLog = periodLogs.length === 0;
      autoTable(doc, {
        startY: y3,
        head: [["Date", "Medication", "Type", "Scheduled", "Status", "Time Taken", "Skip Reason"]],
        body: medLogBody,
        headStyles: {
          fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        },
        bodyStyles: {
          textColor: DARK, fontSize: 8,
          cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 },
          valign: "middle",
        },
        columnStyles: {
          0: { cellWidth: 14 }, 1: { cellWidth: 40 }, 2: { cellWidth: 20 },
          3: { cellWidth: 22 }, 4: { cellWidth: 18 }, 5: { cellWidth: 22 }, 6: { cellWidth: "auto" },
        },
        styles: { overflow: "linebreak" },
        margin: { left: margin, right: margin, top: 14 },
        theme: "grid",
        didParseCell: isEmptyLog ? (data) => {
          if (data.section === "body" && data.column.index === 0) {
            data.cell.colSpan = 7;
            data.cell.styles.halign = "center";
          }
        } : undefined,
      });
    }
  }

  // ─── HEADERS + FOOTERS ON EVERY PAGE ────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Running header on pages 2+
    if (p > 1) {
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "normal");
      const pageLabel = p === medsPage ? "Medications & Appointments" : p === logsPage ? "Daily Logs" : "Continued";
      doc.text(`Chronically Health Report — ${pageLabel}`, margin, 7);
      doc.text(username, pageWidth - margin, 7, { align: "right" });
    }

    // Footer: disclaimer + page number
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    doc.text(
      "Self-reported data recorded by the patient via Chronically (mychronically.app)",
      pageWidth / 2, pageHeight - 7, { align: "center" },
    );
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 3, { align: "center" });
  }

  const dateSlug = today.toLocaleDateString("en-CA");
  doc.save(`chronically-report-${username}-${dateSlug}.pdf`);
}
