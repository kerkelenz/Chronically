import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
  "Dizziness", "Headache", "Muscle weakness", "Joint pain",
  "Shortness of breath", "Nausea", "Sleep disturbance", "Bladder urgency",
];

const PURPLE        = [124, 107, 174];
const DARK          = [45,  37,  64];
const GRAY          = [107, 95,  122];
const LAVENDER_FILL = [240, 235, 248];

const FREQUENCY_LABELS = {
  daily:             "Daily",
  twice_daily:       "Twice daily",
  three_times_daily: "Three times daily",
  four_times_daily:  "Four times daily",
  every_other_day:   "Every other day",
  weekly:            "Weekly",
  biweekly:          "Biweekly",
  monthly:           "Monthly",
  every_x_weeks:     "Every X weeks",
  as_needed:         "As needed",
};

const METRIC_KEYS  = ["painLevel", "moodLevel", "energyLevel", "anxietyLevel", "appetiteLevel"];
const METRIC_NAMES = { painLevel: "Pain", moodLevel: "Mood", energyLevel: "Energy", anxietyLevel: "Anxiety", appetiteLevel: "Appetite" };

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatApptDatePdf = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const countScheduledDoses = (med, startDateStr, endDateStr) => {
  if (med.frequency === "as_needed") return null;
  const timesPerDay = (med.scheduledTimes || []).length || 1;
  let count = 0;
  const cur = new Date(startDateStr + "T12:00:00");
  const end = new Date(endDateStr + "T12:00:00");
  const ref = new Date(med.createdAt);
  while (cur <= end) {
    const freq = med.frequency;
    let due = false;
    const diff = Math.round((cur - ref) / 86400000);
    if (["daily", "twice_daily", "three_times_daily", "four_times_daily"].includes(freq)) due = true;
    else if (freq === "every_other_day") due = diff % 2 === 0;
    else if (freq === "weekly")          due = cur.getDay() === ref.getDay();
    else if (freq === "biweekly")        due = diff % 14 === 0;
    else if (freq === "monthly")         due = cur.getDate() === ref.getDate();
    else if (freq === "every_x_weeks")   due = diff % ((med.frequencyWeeks || 1) * 7) === 0;
    if (due) count += timesPerDay;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const sectionTitle = (doc, text, y, margin) => {
  doc.setFontSize(11);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text(text, margin, y);
};

// Returns 31 entries (30 days ago → today), oldest first.
// Each entry: { date, label, pain, mood, energy, anxiety, appetite } — null when no data that day.
const buildDailyAverages = (periodCheckIns, thirtyDaysAgo) => {
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

const CHART_METRICS = [
  { key: "pain",     color: "#7C6BAE", label: "Pain"     },
  { key: "mood",     color: "#C4A8C0", label: "Mood"     },
  { key: "energy",   color: "#8FAF9B", label: "Energy"   },
  { key: "anxiety",  color: "#9BAFC4", label: "Anxiety"  },
  { key: "appetite", color: "#C4A882", label: "Appetite" },
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

  const toX = (i) => plotLeft + (i / 30) * plotW;
  const toY = (v) => plotBottom - ((v - 1) / 4) * plotH;

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

  // X axis labels every 5 days
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 30; i += 5) {
    if (dailyData[i]) ctx.fillText(dailyData[i].label, toX(i), plotBottom + 8);
  }

  // Lines + dots per metric (break line at gaps — never interpolate)
  CHART_METRICS.forEach(({ key, color }) => {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.lineJoin    = "round";
    ctx.lineCap     = "round";

    let prevHadValue = false;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) { prevHadValue = false; continue; }
      if (!prevHadValue) ctx.moveTo(toX(i), toY(val));
      else               ctx.lineTo(toX(i), toY(val));
      prevHadValue = true;
    }
    ctx.stroke();

    ctx.fillStyle = color;
    for (let i = 0; i <= 30; i++) {
      const val = dailyData[i]?.[key];
      if (val == null) continue;
      ctx.beginPath();
      ctx.arc(toX(i), toY(val), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Centered legend row below plot
  const legendItemW  = 160;
  const legendStartX = (1200 - CHART_METRICS.length * legendItemW) / 2;
  const legendY      = plotBottom + 28;
  ctx.textBaseline = "middle";
  ctx.font         = "16px sans-serif";
  ctx.textAlign    = "left";
  CHART_METRICS.forEach(({ color, label }, i) => {
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

export function generateReport(checkIns, username, medications = [], medicationLogs = [], appointments = []) {
  const today         = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayStr         = today.toLocaleDateString("en-CA");
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");

  const periodCheckIns   = checkIns.filter((c) => c.date >= thirtyDaysAgoStr && c.date <= todayStr);
  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked = daysWithCheckIns.length;

  // Daily averages — shared source of truth for chart and daily log table
  const dailyData = buildDailyAverages(periodCheckIns, thirtyDaysAgo);

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

  // Symptom frequency
  const symptomStats = SYMPTOM_LIST.map((symptom) => {
    const days = daysWithCheckIns.filter((date) =>
      periodCheckIns.filter((c) => c.date === date).some((c) => c.symptoms && c.symptoms.includes(symptom)),
    ).length;
    return { name: symptom, days, percentage: totalDaysTracked > 0 ? Math.round((days / totalDaysTracked) * 100) : 0 };
  }).filter((s) => s.days > 0).sort((a, b) => b.days - a.days);

  // Medication computations (shared between glance box and page 2)
  const logsByMed = {};
  medicationLogs.forEach((log) => {
    const id = log.medicationId;
    if (!logsByMed[id]) logsByMed[id] = { taken: 0, skipped: 0 };
    if (log.status === "taken")   logsByMed[id].taken++;
    if (log.status === "skipped") logsByMed[id].skipped++;
  });

  const medsWithActivity = medications.filter((med) => {
    const scheduled = countScheduledDoses(med, thirtyDaysAgoStr, todayStr);
    return (scheduled !== null && scheduled > 0) || logsByMed[med.id];
  });

  let glanceTotalScheduled = 0;
  let glanceTotalTaken = 0;
  medsWithActivity.forEach((med) => {
    if (med.frequency === "as_needed") return;
    const scheduled = countScheduledDoses(med, thirtyDaysAgoStr, todayStr) || 0;
    const logs = logsByMed[med.id] || { taken: 0, skipped: 0 };
    glanceTotalScheduled += scheduled;
    glanceTotalTaken += logs.taken;
  });

  const glanceAdherenceText = glanceTotalScheduled > 0
    ? `${Math.round((glanceTotalTaken / glanceTotalScheduled) * 100)}% (${glanceTotalTaken} of ${glanceTotalScheduled} doses)`
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

  const glanceSevereText      = topSevereCount > 0 ? `${METRIC_NAMES[topSevereKey]} severe on ${topSevereCount} days` : "None";
  const glanceMostFreqSymptom = symptomStats.length > 0 ? `${symptomStats[0].name} — ${symptomStats[0].days} days` : "None logged";

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
    notableLines.push(`${METRIC_NAMES[k]} was severe (avg ≤ 2) on ${days.length} ${suffix}: ${dateLabels.join(", ")}${extra}`);
  });

  // Daily rows for page 3 (derived from dailyData so chart and table always agree)
  const dailyRows = dailyData.map((d) => {
    const dayCheckins    = periodCheckIns.filter((c) => c.date === d.date);
    const uniqueSymptoms = [...new Set(dayCheckins.flatMap((c) => c.symptoms || []))];
    const fmt = (v) => v !== null ? v.toFixed(1) : "—";
    return [d.label, fmt(d.pain), fmt(d.mood), fmt(d.energy), fmt(d.anxiety), fmt(d.appetite),
      uniqueSymptoms.length > 0 ? uniqueSymptoms.join(", ") : "—"];
  });

  // ─── BUILD PDF ──────────────────────────────────────────────────────────────
  const doc        = new jsPDF({ orientation: "portrait" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 10;
  const gap        = 4;
  const colW       = (pageWidth - 2 * margin) / 2;

  // ─── PAGE 1: SUMMARY ────────────────────────────────────────────────────────
  let y = 15;

  // Header
  doc.setFontSize(14);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Chronically Health Report", margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text(
    `Patient: ${username}     Generated: ${today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin, y,
  );
  y += 4;
  doc.text(
    `Period: ${thirtyDaysAgo.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    margin, y,
  );
  y += gap + 2;

  // ── At a Glance box ──
  const boxH  = 30;
  const lPad  = 5;
  const row1Y = y + 5;
  const row2Y = y + 17;

  doc.setFillColor(...LAVENDER_FILL);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, boxH, 3, 3, "F");

  // Subtle dividers
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.2);
  doc.line(margin + 4,    y + boxH / 2, margin + pageWidth - 2 * margin - 4, y + boxH / 2);
  doc.line(margin + colW, y + 4,        margin + colW,                        y + boxH - 4);

  // Labels (7pt gray)
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text("Check-ins",             margin + lPad,        row1Y);
  doc.text("Medication adherence",  margin + colW + lPad, row1Y);
  doc.text("Most frequent symptom", margin + lPad,        row2Y);
  doc.text("Severe days",           margin + colW + lPad, row2Y);

  // Values (10pt dark bold)
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.setFont(undefined, "bold");
  const maxValW = colW - lPad - 4;
  doc.text(doc.splitTextToSize(`${periodCheckIns.length} over ${totalDaysTracked} of 30 days`, maxValW), margin + lPad,        row1Y + 5);
  doc.text(doc.splitTextToSize(glanceAdherenceText,   maxValW), margin + colW + lPad, row1Y + 5);
  doc.text(doc.splitTextToSize(glanceMostFreqSymptom, maxValW), margin + lPad,        row2Y + 5);
  doc.text(doc.splitTextToSize(glanceSevereText,      maxValW), margin + colW + lPad, row2Y + 5);

  y += boxH + gap;

  // ── 30-Day Trend chart ──
  sectionTitle(doc, "30-Day Trend", y, margin);
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

  // ── 30-Day Averages ──
  sectionTitle(doc, "30-Day Averages", y, margin);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Pain", "Mood", "Energy", "Anxiety", "Appetite"]],
    body: [[avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite]],
    headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center", cellPadding: 2 },
    bodyStyles: { textColor: DARK, fontSize: 13, fontStyle: "bold", halign: "center", cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 38 }, 2: { cellWidth: 38 }, 3: { cellWidth: 38 }, 4: { cellWidth: 38 } },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + gap;

  // ── Notable Events ──
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

  // ── Symptom Frequency ──
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

  // ─── PAGE 2: MEDICATIONS + APPOINTMENTS ────────────────────────────────────
  doc.addPage();
  let y2 = 15;

  doc.setFontSize(12);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Medications & Appointments", margin, y2);
  y2 += 5;
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text(
    `Patient: ${username}     Period: ${thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    margin, y2,
  );
  y2 += gap + 2;

  // Current Medications
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
    const hasNotes       = medications.some((med) => med.notes && med.notes.trim());
    const medListHead    = ["Name", "Type", "Dosage", "Frequency", "Scheduled Times", "Status"];
    if (hasNotes) medListHead.push("Notes");
    const medListColStyles = hasNotes
      ? { 0: { cellWidth: 38 }, 1: { cellWidth: 18 }, 2: { cellWidth: 20 }, 3: { cellWidth: 30 }, 4: { cellWidth: 38 }, 5: { cellWidth: 18 }, 6: { cellWidth: 28 } }
      : { 0: { cellWidth: 45 }, 1: { cellWidth: 20 }, 2: { cellWidth: 25 }, 3: { cellWidth: 35 }, 4: { cellWidth: 45 }, 5: { cellWidth: 20 } };
    const medListBody = medications.map((med) => {
      const times = med.frequency === "as_needed"
        ? "As needed"
        : (med.scheduledTimes || []).map(formatTime).join(", ") || "—";
      const row = [med.name, med.type || "—", med.dosage || "—", FREQUENCY_LABELS[med.frequency] || med.frequency, times, med.active ? "Active" : "Inactive"];
      if (hasNotes) { const n = med.notes || ""; row.push(n.length > 40 ? n.slice(0, 40) + "..." : n || "—"); }
      return row;
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

  // Medication Adherence
  sectionTitle(doc, "Medication Adherence (30 Days)", y2, margin);
  y2 += 3;
  const adherenceBody = medsWithActivity.length === 0
    ? [["No medication logs in this period", "", "", "", "", ""]]
    : medsWithActivity.map((med) => {
        const logs = logsByMed[med.id] || { taken: 0, skipped: 0 };
        if (med.frequency === "as_needed") return [med.name, "N/A", logs.taken, "N/A", "N/A", "N/A"];
        const scheduled = countScheduledDoses(med, thirtyDaysAgoStr, todayStr) || 0;
        const missed    = Math.max(0, scheduled - logs.taken - logs.skipped);
        const adherence = scheduled > 0 ? `${Math.round((logs.taken / scheduled) * 100)}%` : "N/A";
        return [med.name, scheduled, logs.taken, logs.skipped, missed, adherence];
      });
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

  // Adherence by Day of Week
  const DOW_LABELS    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const adherenceByDay = DOW_LABELS.map((_, di) => {
    const logsForDay = medicationLogs.filter((log) => new Date(log.date + "T12:00:00").getDay() === di);
    const taken = logsForDay.filter((l) => l.status === "taken").length;
    return logsForDay.length > 0 ? `${Math.round((taken / logsForDay.length) * 100)}%` : null;
  });
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

  // Skip Reasons
  const skipReasonCounts = {};
  medicationLogs.forEach((log) => {
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

  // Recent Appointments
  const recentAppts = appointments
    .filter((a) => { const d = new Date(a.date); return d >= thirtyDaysAgo && d <= today; })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  sectionTitle(doc, "Recent Appointments (Last 30 Days)", y2, margin);
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

  // ─── PAGE 3: DAILY LOGS ─────────────────────────────────────────────────────
  doc.addPage();
  let y3 = 15;

  doc.setFontSize(12);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Daily Logs", margin, y3);
  y3 += 5;
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text(
    `Patient: ${username}     Period: ${thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    margin, y3,
  );
  y3 += gap + 2;

  // Daily Health Log
  sectionTitle(doc, "Daily Health Log", y3, margin);
  y3 += 3;
  autoTable(doc, {
    startY: y3,
    head: [["Date", "Pain", "Mood", "Enrg", "Anx", "App", "Symptoms"]],
    body: dailyRows,
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
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 14, halign: "center" }, 2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 14, halign: "center" }, 6: { cellWidth: "auto" },
    },
    styles: { overflow: "linebreak" },
    margin: { left: margin, right: margin, top: 14 },
    theme: "grid",
  });
  y3 = doc.lastAutoTable.finalY + gap;

  // Daily Medication Log
  sectionTitle(doc, "Daily Medication Log", y3, margin);
  y3 += 3;

  let medLogBody;
  if (medicationLogs.length === 0) {
    medLogBody = [["No medication logs in this period", "", "", "", "", "", ""]];
  } else {
    const medMap = {};
    medications.forEach((m) => { medMap[m.id] = m; });
    medLogBody = [...medicationLogs]
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

  const isEmptyLog = medicationLogs.length === 0;
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

  // ─── HEADERS + FOOTERS ON EVERY PAGE ────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Running header on pages 2+
    if (p > 1) {
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.setFont(undefined, "normal");
      const pageLabel = p === 2 ? "Medications & Appointments" : p === 3 ? "Daily Logs" : "Continued";
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
