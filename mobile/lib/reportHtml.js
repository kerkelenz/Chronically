import { buildTrendChartSvg, formatApptDatePdf, DOW_LABELS } from "./reportData";

const FOOTER = `<div class="footer">Self-reported data recorded by the patient via Chronically (mychronically.app)</div>`;

// Build <tbody> rows from a 2D array. centerCols: 0-indexed columns that get class="center".
const trows = (rows, centerCols = []) =>
  rows.map((cells) =>
    `<tr>${cells.map((c, i) =>
      `<td${centerCols.includes(i) ? ' class="center"' : ""}>${c ?? "—"}</td>`
    ).join("")}</tr>`
  ).join("\n    ");

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Lato', Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #2D2540;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page { padding: 28px 32px; }
  .page-break { page-break-before: always; }

  .report-title {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-weight: 500;
    font-size: 14pt;
    color: #7C6BAE;
    margin-bottom: 5px;
  }
  .page-title {
    font-size: 12pt;
    font-weight: 700;
    color: #7C6BAE;
    margin-bottom: 4px;
  }
  .report-meta { font-size: 8pt; color: #6B5F7A; margin-bottom: 2px; }

  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #7C6BAE;
    margin: 14px 0 6px;
  }

  .glance {
    background: rgb(240, 235, 248);
    border-radius: 6px;
    border: 1px solid rgba(107,95,122,0.2);
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 8px 0 12px;
    overflow: hidden;
  }
  .glance-cell { padding: 10px 14px; }
  .glance-cell:nth-child(1),
  .glance-cell:nth-child(2) { border-bottom: 1px solid rgba(107,95,122,0.2); }
  .glance-cell:nth-child(odd) { border-right: 1px solid rgba(107,95,122,0.2); }
  .glance-label { font-size: 7pt; color: #6B5F7A; margin-bottom: 3px; }
  .glance-value { font-size: 10pt; font-weight: 700; color: #2D2540; }

  .chart-wrap { margin: 6px 0 10px; }
  .no-data { font-size: 8pt; color: #6B5F7A; margin: 6px 0 12px; }

  table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10px; }
  thead th {
    background: rgb(124, 107, 174);
    color: #fff;
    font-weight: 700;
    font-size: 9pt;
    padding: 4px 6px;
    border: 1px solid rgb(100, 85, 150);
  }
  tbody td { color: #2D2540; padding: 3px 6px; border: 1px solid #ddd; }
  .center { text-align: center; }
  .muted   { color: #6B5F7A; }

  .averages-table tbody td {
    font-size: 13pt;
    font-weight: 700;
    text-align: center;
    padding: 6px 4px;
  }

  .notable-table { border: none; }
  .notable-table td { border: none; }
  .notable-cell { padding: 3px 0; font-size: 8pt; }

  .dow-table tbody td {
    font-size: 11pt;
    font-weight: 700;
    text-align: center;
    padding: 5px 4px;
  }

  .footer {
    margin-top: 24px;
    font-size: 6pt;
    color: #6B5F7A;
    text-align: center;
    border-top: 1px solid rgba(107,95,122,0.2);
    padding-top: 8px;
  }
`;

// Returns a complete HTML string for the doctor report (pages 1–3).
export function buildReportHtml(data, username) {
  const {
    periodCheckIns, totalDaysTracked, dailyData,
    avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite,
    symptomStats, notableLines,
    glanceAdherenceText, glanceSevereText, glanceMostFreqSymptom,
    periodStart, periodEnd, periodStartShort, periodEndShort, generatedDate,
    medications, prnTaken,
    medListHasNotes, medListRows, adherenceRows, medLogRows,
    dailyRows, adherenceByDay, skipReasonRows, recentAppts, upcomingAppts,
  } = data;

  // ── Page 1 helpers ────────────────────────────────────────────────────────

  const daysWithAnyData = dailyData.filter(
    (d) => d.pain !== null || d.mood !== null || d.energy !== null || d.anxiety !== null || d.appetite !== null
  );
  const chartHtml = daysWithAnyData.length < 2
    ? `<p class="no-data">Not enough data to display a trend chart.</p>`
    : buildTrendChartSvg(dailyData);

  const notableRowsHtml = notableLines.length > 0
    ? notableLines.map((line) => `<tr><td class="notable-cell">${line}</td></tr>`).join("\n    ")
    : `<tr><td class="notable-cell muted">No severe days recorded in this period.</td></tr>`;

  const symptomRowsHtml = symptomStats.length > 0
    ? trows(symptomStats.map((s) => [s.name, s.days, `${s.percentage}%`]), [1, 2])
    : `<tr><td colspan="3" class="center muted">No symptoms logged in this period</td></tr>`;

  // ── Page 2 helpers ────────────────────────────────────────────────────────

  const medListHeadCols = ["Name", "Type", "Dosage", "Schedule", "Status"];
  if (medListHasNotes) medListHeadCols.push("Notes");
  const medListHeadHtml = medListHeadCols.map((h) => `<th>${h}</th>`).join("");
  const medListBodyHtml = medications.length === 0
    ? `<tr><td colspan="${medListHeadCols.length}" class="center muted">No medications tracked</td></tr>`
    : trows(medListRows);

  const adherenceBodyHtml = adherenceRows.length === 0
    ? `<tr><td colspan="6" class="center muted">No scheduled medications in this period</td></tr>`
    : trows(adherenceRows, [1, 2, 3, 4, 5]);

  const prnLineHtml = prnTaken > 0
    ? `<p class="no-data">As-needed doses taken: ${prnTaken}</p>`
    : "";

  const dowBodyHtml = `<tr>${adherenceByDay.map((p) => `<td class="center">${p ?? "—"}</td>`).join("")}</tr>`;

  const skipBodyHtml = skipReasonRows.length > 0
    ? trows(skipReasonRows, [1])
    : `<tr><td colspan="2" class="muted">No doses were skipped in this period</td></tr>`;

  const recentApptBodyHtml = recentAppts.length > 0
    ? trows(recentAppts.map((a) => [
        formatApptDatePdf(a.date), a.doctorName || "—", a.specialty || "—",
        a.reason || "—", a.notesAfter || "—",
      ]))
    : `<tr><td colspan="5" class="center muted">No appointments in this period</td></tr>`;

  const upcomingApptBodyHtml = upcomingAppts.length > 0
    ? trows(upcomingAppts.map((a) => [
        formatApptDatePdf(a.date), a.doctorName || "—", a.specialty || "—",
        a.reason || "—", a.notesBefore || "—",
      ]))
    : `<tr><td colspan="5" class="center muted">No upcoming appointments</td></tr>`;

  // ── Page 3 helpers ────────────────────────────────────────────────────────

  const dailyBodyHtml = trows(dailyRows, [1, 2, 3, 4, 5]);

  const medLogBodyHtml = medLogRows.length > 0
    ? trows(medLogRows)
    : `<tr><td colspan="7" class="center muted">No medication logs in this period</td></tr>`;

  // ── Assemble ──────────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/>
<style>${css}</style>
</head>
<body>

<!-- ═══ PAGE 1: SUMMARY ═══ -->
<div class="page">
  <div class="report-title">Chronically Health Report</div>
  <p class="report-meta">Patient: ${username}&nbsp;&nbsp;&nbsp;Generated: ${generatedDate}</p>
  <p class="report-meta">Period: ${periodStart} – ${periodEnd}</p>

  <div class="section-title">At a Glance</div>
  <div class="glance">
    <div class="glance-cell">
      <div class="glance-label">Check-ins</div>
      <div class="glance-value">${periodCheckIns.length} over ${totalDaysTracked} of 30 days</div>
    </div>
    <div class="glance-cell">
      <div class="glance-label">Medication adherence</div>
      <div class="glance-value">${glanceAdherenceText}</div>
    </div>
    <div class="glance-cell">
      <div class="glance-label">Most frequent symptom</div>
      <div class="glance-value">${glanceMostFreqSymptom}</div>
    </div>
    <div class="glance-cell">
      <div class="glance-label">Severe days</div>
      <div class="glance-value">${glanceSevereText}</div>
    </div>
  </div>

  <div class="section-title">30-Day Trend</div>
  <div class="chart-wrap">
    ${chartHtml}
  </div>

  <div class="section-title">30-Day Averages</div>
  <table class="averages-table">
    <thead>
      <tr><th>Pain</th><th>Mood</th><th>Energy</th><th>Anxiety</th><th>Appetite</th></tr>
    </thead>
    <tbody>
      <tr><td>${avgPain}</td><td>${avgMood}</td><td>${avgEnergy}</td><td>${avgAnxiety}</td><td>${avgAppetite}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Notable Events</div>
  <table class="notable-table">
    <tbody>
    ${notableRowsHtml}
    </tbody>
  </table>

  <div class="section-title">Symptom Frequency</div>
  <table>
    <thead>
      <tr>
        <th style="width:60%">Symptom</th>
        <th style="width:15%">Days</th>
        <th style="width:25%">% of days tracked</th>
      </tr>
    </thead>
    <tbody>
    ${symptomRowsHtml}
    </tbody>
  </table>

  ${FOOTER}
</div>

<!-- ═══ PAGE 2: MEDICATIONS & APPOINTMENTS ═══ -->
<div class="page page-break">
  <div class="page-title">Medications &amp; Appointments</div>
  <p class="report-meta">Patient: ${username}&nbsp;&nbsp;&nbsp;Period: ${periodStartShort} – ${periodEndShort}</p>

  <div class="section-title">Current Medications</div>
  <table>
    <thead><tr>${medListHeadHtml}</tr></thead>
    <tbody>
    ${medListBodyHtml}
    </tbody>
  </table>

  <div class="section-title">Medication Adherence (30 Days)</div>
  <table>
    <thead>
      <tr>
        <th style="width:29%">Name</th>
        <th style="width:13%">Scheduled</th>
        <th style="width:13%">Taken</th>
        <th style="width:13%">Skipped</th>
        <th style="width:13%">Missed</th>
        <th style="width:18%">Adherence %</th>
      </tr>
    </thead>
    <tbody>
    ${adherenceBodyHtml}
    </tbody>
  </table>
  ${prnLineHtml}

  <div class="section-title">Adherence by Day of Week</div>
  <table class="dow-table">
    <thead>
      <tr>${DOW_LABELS.map((d) => `<th>${d}</th>`).join("")}</tr>
    </thead>
    <tbody>
    ${dowBodyHtml}
    </tbody>
  </table>

  <div class="section-title">Most Common Skip Reasons</div>
  <table>
    <thead>
      <tr>
        <th style="width:82%">Reason</th>
        <th style="width:18%">Times</th>
      </tr>
    </thead>
    <tbody>
    ${skipBodyHtml}
    </tbody>
  </table>

  <div class="section-title">Recent Appointments (Last 30 Days)</div>
  <table>
    <thead>
      <tr>
        <th style="width:19%">Date</th>
        <th style="width:18%">Doctor</th>
        <th style="width:15%">Specialty</th>
        <th style="width:16%">Reason</th>
        <th>Notes After</th>
      </tr>
    </thead>
    <tbody>
    ${recentApptBodyHtml}
    </tbody>
  </table>

  <div class="section-title">Upcoming Appointments</div>
  <table>
    <thead>
      <tr>
        <th style="width:19%">Date</th>
        <th style="width:18%">Doctor</th>
        <th style="width:15%">Specialty</th>
        <th style="width:16%">Reason</th>
        <th>Notes Before</th>
      </tr>
    </thead>
    <tbody>
    ${upcomingApptBodyHtml}
    </tbody>
  </table>

  ${FOOTER}
</div>

<!-- ═══ PAGE 3: DAILY LOGS ═══ -->
<div class="page page-break">
  <div class="page-title">Daily Logs</div>
  <p class="report-meta">Patient: ${username}&nbsp;&nbsp;&nbsp;Period: ${periodStartShort} – ${periodEndShort}</p>

  <div class="section-title">Daily Health Log</div>
  <table>
    <thead>
      <tr>
        <th style="width:8%">Date</th>
        <th style="width:8%">Pain</th>
        <th style="width:8%">Mood</th>
        <th style="width:8%">Enrg</th>
        <th style="width:8%">Anx</th>
        <th style="width:8%">App</th>
        <th>Symptoms</th>
      </tr>
    </thead>
    <tbody>
    ${dailyBodyHtml}
    </tbody>
  </table>

  <div class="section-title">Daily Medication Log</div>
  <table>
    <thead>
      <tr>
        <th style="width:8%">Date</th>
        <th style="width:21%">Medication</th>
        <th style="width:11%">Type</th>
        <th style="width:12%">Scheduled</th>
        <th style="width:10%">Status</th>
        <th style="width:12%">Time Taken</th>
        <th>Skip Reason</th>
      </tr>
    </thead>
    <tbody>
    ${medLogBodyHtml}
    </tbody>
  </table>

  ${FOOTER}
</div>

</body>
</html>`;
}
