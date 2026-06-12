import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
  "Dizziness", "Headache", "Muscle weakness", "Joint pain",
  "Shortness of breath", "Nausea", "Sleep disturbance", "Bladder urgency",
];

const PURPLE = [124, 107, 174];
const DARK   = [45,  37,  64];
const GRAY   = [107, 95,  122];

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

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
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
    if (["daily", "twice_daily", "three_times_daily", "four_times_daily"].includes(freq)) {
      due = true;
    } else if (freq === "every_other_day") {
      due = diff % 2 === 0;
    } else if (freq === "weekly") {
      due = cur.getDay() === ref.getDay();
    } else if (freq === "biweekly") {
      due = diff % 14 === 0;
    } else if (freq === "monthly") {
      due = cur.getDate() === ref.getDate();
    } else if (freq === "every_x_weeks") {
      due = diff % ((med.frequencyWeeks || 1) * 7) === 0;
    }
    if (due) count += timesPerDay;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export function generateReport(checkIns, username, medications = [], medicationLogs = [], appointments = []) {
  const today         = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayStr        = today.toLocaleDateString("en-CA");
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");

  const periodCheckIns = checkIns.filter(
    (c) => c.date >= thirtyDaysAgoStr && c.date <= todayStr,
  );

  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked  = daysWithCheckIns.length;
  const avgPerDay = totalDaysTracked > 0
    ? (periodCheckIns.length / totalDaysTracked).toFixed(1)
    : "0";

  const avg = (arr, key) => {
    const vals = arr.filter((c) => c[key]);
    if (vals.length === 0) return "-";
    return (vals.reduce((s, c) => s + c[key], 0) / vals.length).toFixed(1);
  };

  const avgPain     = avg(periodCheckIns, "painLevel");
  const avgMood     = avg(periodCheckIns, "moodLevel");
  const avgEnergy   = avg(periodCheckIns, "energyLevel");
  const avgAnxiety  = avg(periodCheckIns, "anxietyLevel");
  const avgAppetite = avg(periodCheckIns, "appetiteLevel");

  const symptomStats = SYMPTOM_LIST.map((symptom) => {
    const days = daysWithCheckIns.filter((date) =>
      periodCheckIns
        .filter((c) => c.date === date)
        .some((c) => c.symptoms && c.symptoms.includes(symptom)),
    ).length;
    return {
      name: symptom,
      days,
      percentage: totalDaysTracked > 0
        ? Math.round((days / totalDaysTracked) * 100)
        : 0,
    };
  })
    .filter((s) => s.days > 0)
    .sort((a, b) => b.days - a.days);

  const dailyRows = [];
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr     = d.toLocaleDateString("en-CA");
    const dayCheckins = periodCheckIns.filter((c) => c.date === dateStr);
    const label       = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (dayCheckins.length === 0) {
      dailyRows.push([label, "—", "—", "—", "—", "—", "—"]);
      continue;
    }

    const dayAvg = (key) => {
      const vals = dayCheckins.filter((c) => c[key]);
      if (vals.length === 0) return "-";
      return (vals.reduce((s, c) => s + c[key], 0) / vals.length).toFixed(1);
    };

    const uniqueSymptoms = [
      ...new Set(dayCheckins.flatMap((c) => c.symptoms || [])),
    ];

    dailyRows.push([
      label,
      dayAvg("painLevel"),
      dayAvg("moodLevel"),
      dayAvg("energyLevel"),
      dayAvg("anxietyLevel"),
      dayAvg("appetiteLevel"),
      uniqueSymptoms.length > 0 ? uniqueSymptoms.join(", ") : "—",
    ]);
  }

  // --- Build PDF ---
  const doc        = new jsPDF({ orientation: "portrait" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 10;
  const gap        = 4;

  let y = 15;

  // Page 1 header
  doc.setFontSize(14);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Chronically Health Report", margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text(
    `Generated: ${today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}   Patient: ${username}   Period: ${thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    margin, y,
  );
  y += 5;
  doc.text(
    `Total check-ins: ${periodCheckIns.length}   Days with check-ins: ${totalDaysTracked} of 30   Avg check-ins / day: ${avgPerDay}`,
    margin, y,
  );
  y += gap + 2;

  // Section: 30-Day Summary
  doc.setFontSize(11);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("30-Day Summary", margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Pain", "Mood", "Energy", "Anxiety", "Appetite"]],
    body: [[avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite]],
    headStyles: {
      fillColor: PURPLE, textColor: [255, 255, 255],
      fontStyle: "bold", fontSize: 9, halign: "center", cellPadding: 2,
    },
    bodyStyles: {
      textColor: DARK, fontSize: 13, fontStyle: "bold",
      halign: "center", cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 38 }, 1: { cellWidth: 38 }, 2: { cellWidth: 38 },
      3: { cellWidth: 38 }, 4: { cellWidth: 38 },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + gap;

  // Section: Symptom Summary
  if (symptomStats.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Symptom Summary", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Symptom", "Days", "% of days tracked"]],
      body: symptomStats.map((s) => [s.name, s.days, `${s.percentage}%`]),
      headStyles: {
        fillColor: PURPLE, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 9, cellPadding: 2,
      },
      bodyStyles: { textColor: DARK, fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 25 },
        2: { cellWidth: 75 },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = doc.lastAutoTable.finalY + gap;
  }

  // Section: Daily Log
  doc.setFontSize(11);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Daily Log", margin, y);
  y += 3;

  const availableForRows = pageHeight - margin - 8 - y - 9;
  const minRowHeight = Math.max(4, availableForRows / 31);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Pain", "Mood", "Enrg", "Anx", "App", "Symptoms"]],
    body: dailyRows,
    headStyles: {
      fillColor: PURPLE, textColor: [255, 255, 255],
      fontStyle: "bold", fontSize: 9,
      cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
    },
    bodyStyles: {
      textColor: DARK, fontSize: 8,
      cellPadding: { top: 0, bottom: 0, left: 1.5, right: 1.5 },
      minCellHeight: minRowHeight,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: "auto" },
    },
    styles: { overflow: "linebreak" },
    margin: { left: margin, right: margin, top: 14 },
    theme: "grid",
  });

  // --- Page 2: Medications ---
  if (medications.length > 0) {
    doc.addPage();
    let y2 = 15;

    // Page 2 header
    doc.setFontSize(14);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Chronically Health Report — Medications", margin, y2);
    y2 += 6;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    doc.text(
      `Patient: ${username}   Period: ${thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      margin, y2,
    );
    y2 += gap + 2;

    // Section 1: Current medications list
    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Current Medications", margin, y2);
    y2 += 3;

    const hasNotes = medications.some((med) => med.notes && med.notes.trim());
    const medListBody = medications.map((med) => {
      const times = med.frequency === "as_needed"
        ? "As needed"
        : (med.scheduledTimes || []).map(formatTime).join(", ") || "—";
      const row = [
        med.name,
        med.type || "—",
        med.dosage || "—",
        FREQUENCY_LABELS[med.frequency] || med.frequency,
        times,
        med.active ? "Active" : "Inactive",
      ];
      if (hasNotes) {
        const n = med.notes || "";
        row.push(n.length > 40 ? n.slice(0, 40) + "..." : n || "—");
      }
      return row;
    });

    const medListHead = ["Name", "Type", "Dosage", "Frequency", "Scheduled Times", "Status"];
    if (hasNotes) medListHead.push("Notes");

    const medListColStyles = hasNotes
      ? {
          0: { cellWidth: 38 },
          1: { cellWidth: 18 },
          2: { cellWidth: 20 },
          3: { cellWidth: 30 },
          4: { cellWidth: 38 },
          5: { cellWidth: 18 },
          6: { cellWidth: 28 },
        }
      : {
          0: { cellWidth: 45 },
          1: { cellWidth: 20 },
          2: { cellWidth: 25 },
          3: { cellWidth: 35 },
          4: { cellWidth: 45 },
          5: { cellWidth: 20 },
        };

    autoTable(doc, {
      startY: y2,
      head: [medListHead],
      body: medListBody,
      headStyles: {
        fillColor: PURPLE, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 9, cellPadding: 2,
      },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: medListColStyles,
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    y2 = doc.lastAutoTable.finalY + gap;

    // Section 2: Adherence summary
    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Medication Adherence (30 Days)", margin, y2);
    y2 += 3;

    // Build log counts per medication
    const logsByMed = {};
    medicationLogs.forEach((log) => {
      const id = log.medicationId;
      if (!logsByMed[id]) logsByMed[id] = { taken: 0, skipped: 0 };
      if (log.status === "taken")   logsByMed[id].taken++;
      if (log.status === "skipped") logsByMed[id].skipped++;
    });

    // All medications that either have scheduled doses or have logs in the period
    const medsWithActivity = medications.filter((med) => {
      const scheduled = countScheduledDoses(med, thirtyDaysAgoStr, todayStr);
      return (scheduled !== null && scheduled > 0) || logsByMed[med.id];
    });

    let adherenceBody;
    if (medsWithActivity.length === 0) {
      adherenceBody = [["No medication logs in this period", "", "", "", "", ""]];
    } else {
      adherenceBody = medsWithActivity.map((med) => {
        const logs = logsByMed[med.id] || { taken: 0, skipped: 0 };
        if (med.frequency === "as_needed") {
          return [med.name, "N/A", logs.taken, "N/A", "N/A", "N/A"];
        }
        const scheduled = countScheduledDoses(med, thirtyDaysAgoStr, todayStr) || 0;
        const taken   = logs.taken;
        const skipped = logs.skipped;
        const missed  = Math.max(0, scheduled - taken - skipped);
        const adherence = scheduled > 0 ? `${Math.round((taken / scheduled) * 100)}%` : "N/A";
        return [med.name, scheduled, taken, skipped, missed, adherence];
      });
    }

    autoTable(doc, {
      startY: y2,
      head: [["Name", "Scheduled", "Taken", "Skipped", "Missed", "Adherence %"]],
      body: adherenceBody,
      headStyles: {
        fillColor: PURPLE, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 9, cellPadding: 2,
      },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 25, halign: "center" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 25, halign: "center" },
        5: { cellWidth: 35, halign: "center" },
      },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    y2 = doc.lastAutoTable.finalY + gap;

    // Section 3: Adherence by day of week
    const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const adherenceByDay = DOW_LABELS.map((day, dayIndex) => {
      const logsForDay = medicationLogs.filter(
        (log) => new Date(log.date + "T12:00:00").getDay() === dayIndex,
      );
      const taken = logsForDay.filter((l) => l.status === "taken").length;
      const pct = logsForDay.length > 0
        ? `${Math.round((taken / logsForDay.length) * 100)}%`
        : null;
      return pct;
    });

    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Adherence by Day of Week", margin, y2);
    y2 += 3;

    autoTable(doc, {
      startY: y2,
      head: [DOW_LABELS],
      body: [adherenceByDay.map((p) => p ?? "—")],
      headStyles: {
        fillColor: PURPLE, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 9, cellPadding: 2, halign: "center",
      },
      bodyStyles: {
        textColor: DARK, fontSize: 11, fontStyle: "bold",
        halign: "center", cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 27 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 },
        3: { cellWidth: 27 }, 4: { cellWidth: 27 }, 5: { cellWidth: 28 },
        6: { cellWidth: 27 },
      },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    y2 = doc.lastAutoTable.finalY + gap;

    // Section 4: Most common skip reasons
    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Most Common Skip Reasons", margin, y2);
    y2 += 3;

    const skipReasonCounts = {};
    medicationLogs.forEach((log) => {
      if (log.skipReason) {
        skipReasonCounts[log.skipReason] = (skipReasonCounts[log.skipReason] || 0) + 1;
      }
    });
    const skipReasonRows = Object.entries(skipReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => [reason, count]);

    autoTable(doc, {
      startY: y2,
      head: [["Reason", "Times"]],
      body: skipReasonRows.length > 0 ? skipReasonRows : [["No doses were skipped in this period", ""]],
      headStyles: {
        fillColor: PURPLE, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 9, cellPadding: 2,
      },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 155 },
        1: { cellWidth: 35, halign: "center" },
      },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    y2 = doc.lastAutoTable.finalY + gap;

    // Section 5: Recent Appointments (last 30 days)
    const recentAppts = appointments
      .filter((a) => { const d = new Date(a.date); return d >= thirtyDaysAgo && d <= today; })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Recent Appointments (Last 30 Days)", margin, y2);
    y2 += 3;

    const formatApptDatePdf = (dateStr) => {
      if (!dateStr) return "—";
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    autoTable(doc, {
      startY: y2,
      head: [["Date", "Doctor", "Specialty", "Reason", "Notes After"]],
      body: recentAppts.length > 0
        ? recentAppts.map((a) => [
            formatApptDatePdf(a.date),
            a.doctorName || "—",
            a.specialty  || "—",
            a.reason     || "—",
            a.notesAfter || "—",
          ])
        : [["No appointments in this period", "", "", "", ""]],
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 36 }, 1: { cellWidth: 35 }, 2: { cellWidth: 28 },
        3: { cellWidth: 30 }, 4: { cellWidth: "auto" },
      },
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    y2 = doc.lastAutoTable.finalY + gap;

    // Section 6: Upcoming Appointments
    const upcomingAppts = appointments
      .filter((a) => a.status === "upcoming" && new Date(a.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Upcoming Appointments", margin, y2);
    y2 += 3;

    autoTable(doc, {
      startY: y2,
      head: [["Date", "Doctor", "Specialty", "Reason", "Notes Before"]],
      body: upcomingAppts.length > 0
        ? upcomingAppts.map((a) => [
            formatApptDatePdf(a.date),
            a.doctorName   || "—",
            a.specialty    || "—",
            a.reason       || "—",
            a.notesBefore  || "—",
          ])
        : [["No upcoming appointments", "", "", "", ""]],
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 36 }, 1: { cellWidth: 35 }, 2: { cellWidth: 28 },
        3: { cellWidth: 30 }, 4: { cellWidth: "auto" },
      },
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    y2 = doc.lastAutoTable.finalY + gap;

    // Section 7: Daily medication log
    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Daily Medication Log", margin, y2);
    y2 += 3;

    let medLogBody;
    if (medicationLogs.length === 0) {
      medLogBody = [["No medication logs in this period", "", "", "", "", "", ""]];
    } else {
      const medMap = {};
      medications.forEach((m) => { medMap[m.id] = m; });

      medLogBody = [...medicationLogs]
        .sort((a, b) =>
          a.date.localeCompare(b.date) ||
          (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99"),
        )
        .map((log) => {
          const med = medMap[log.medicationId];
          const d = new Date(log.date + "T12:00:00");
          const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const statusLabel = log.status.charAt(0).toUpperCase() + log.status.slice(1);
          const timeTaken = log.takenAt
            ? new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "—";
          return [
            dateLabel,
            med?.name ?? "Unknown",
            med?.type ?? "—",
            log.scheduledTime ? formatTime(log.scheduledTime) : "As needed",
            statusLabel,
            timeTaken,
            log.skipReason || "—",
          ];
        });
    }

    const isEmptyLog = medicationLogs.length === 0;
    autoTable(doc, {
      startY: y2,
      head: [["Date", "Medication", "Type", "Scheduled", "Status", "Time Taken", "Skip Reason"]],
      body: medLogBody,
      headStyles: {
        fillColor: PURPLE, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 9,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      bodyStyles: {
        textColor: DARK, fontSize: 8,
        cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 },
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 22 },
        6: { cellWidth: "auto" },
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

  // Appointments-only page 2 (when no medications)
  if (medications.length === 0 && appointments.length > 0) {
    const recentAppts2 = appointments
      .filter((a) => { const d = new Date(a.date); return d >= thirtyDaysAgo && d <= today; })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const upcomingAppts2 = appointments
      .filter((a) => a.status === "upcoming" && new Date(a.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    doc.addPage();
    let yA = 15;

    doc.setFontSize(14);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Chronically Health Report — Appointments", margin, yA);
    yA += 6;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    doc.text(`Patient: ${username}`, margin, yA);
    yA += gap + 2;

    const fmtAppt = (dateStr) => {
      if (!dateStr) return "—";
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Recent Appointments (Last 30 Days)", margin, yA);
    yA += 3;
    autoTable(doc, {
      startY: yA,
      head: [["Date", "Doctor", "Specialty", "Reason", "Notes After"]],
      body: recentAppts2.length > 0
        ? recentAppts2.map((a) => [fmtAppt(a.date), a.doctorName || "—", a.specialty || "—", a.reason || "—", a.notesAfter || "—"])
        : [["No appointments in this period", "", "", "", ""]],
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 35 }, 2: { cellWidth: 28 }, 3: { cellWidth: 30 }, 4: { cellWidth: "auto" } },
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
    yA = doc.lastAutoTable.finalY + gap;

    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.setFont(undefined, "bold");
    doc.text("Upcoming Appointments", margin, yA);
    yA += 3;
    autoTable(doc, {
      startY: yA,
      head: [["Date", "Doctor", "Specialty", "Reason", "Notes Before"]],
      body: upcomingAppts2.length > 0
        ? upcomingAppts2.map((a) => [fmtAppt(a.date), a.doctorName || "—", a.specialty || "—", a.reason || "—", a.notesBefore || "—"])
        : [["No upcoming appointments", "", "", "", ""]],
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, cellPadding: 2 },
      bodyStyles: { textColor: DARK, fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 35 }, 2: { cellWidth: 28 }, 3: { cellWidth: 30 }, 4: { cellWidth: "auto" } },
      styles: { overflow: "linebreak" },
      margin: { left: margin, right: margin, top: 14 },
      theme: "grid",
    });
  }

  // Page headers/footers
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    if (p > 1) {
      const headerText = medications.length > 0
        ? "Chronically Health Report — Medications"
        : "Chronically Health Report";
      doc.text(headerText, margin, 7);
      doc.text(username, pageWidth - margin, 7, { align: "right" });
    }
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: "center" },
    );
  }

  const dateSlug = today.toLocaleDateString("en-CA");
  doc.save(`chronically-report-${username}-${dateSlug}.pdf`);
}
