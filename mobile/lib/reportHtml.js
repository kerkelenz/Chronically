import { buildTrendChartSvg, formatApptDatePdf, DOW_LABELS } from "./reportData";

const FOOTER = `<div class="footer">Self-reported data recorded by the patient via Chronically (mychronically.app)</div>`;

// Free-text the patient typed (notes, names) lands in an HTML document — escape
// it so a stray < or & can't break the report.
const esc = (s) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

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

  .report-title {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-weight: 500;
    font-size: 14pt;
    color: #7C6BAE;
    margin-bottom: 5px;
  }
  .report-meta { font-size: 8pt; color: #6B5F7A; margin-bottom: 2px; }

  /* Brand lockup: the C-and-sprig mark on a purple tile, as the app's own
     header shows it. The artwork is white, so on paper it needs the tile —
     without it the mark would print as nothing. */
  .report-head { display: flex; align-items: center; gap: 10px; }
  .brand-mark {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 8px;
    background: rgb(124, 107, 174);
    text-align: center;
    line-height: 34px;
  }
  .brand-mark img { width: 23px; height: 23px; vertical-align: middle; }

  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #7C6BAE;
    margin: 14px 0 6px;
    /* a heading never strands alone at the bottom of a page */
    page-break-after: avoid;
  }

  .glance {
    background: rgb(240, 235, 248);
    border-radius: 6px;
    border: 1px solid rgba(107,95,122,0.2);
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 8px 0 12px;
    overflow: hidden;
    /* small atomic block — keep the whole 2×2 together */
    page-break-inside: avoid;
  }
  .glance-cell { padding: 10px 14px; }
  .glance-cell:nth-child(1),
  .glance-cell:nth-child(2) { border-bottom: 1px solid rgba(107,95,122,0.2); }
  .glance-cell:nth-child(odd) { border-right: 1px solid rgba(107,95,122,0.2); }
  /* a full-width cell closes the block, so it draws its own top rule rather
     than relying on the 2-up cells above it */
  .glance-cell.full {
    grid-column: 1 / -1;
    border-right: none;
    border-top: 1px solid rgba(107,95,122,0.2);
  }
  .glance-label { font-size: 7pt; color: #6B5F7A; margin-bottom: 3px; }
  .glance-value { font-size: 10pt; font-weight: 700; color: #2D2540; }

  .chart-wrap { margin: 6px 0 10px; }
  .no-data { font-size: 8pt; color: #6B5F7A; margin: 6px 0 12px; }

  /* tables split across pages, with the header row repeating and no row torn */
  table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
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

  /* small atomic strip — keep the averages row on one page */
  .averages-table { page-break-inside: avoid; }
  .averages-table tbody td {
    font-size: 13pt;
    font-weight: 700;
    text-align: center;
    padding: 6px 4px;
  }

  .notable-table { border: none; }
  .notable-table td { border: none; }
  .notable-cell { padding: 3px 0; font-size: 8pt; }

  /* Observed Patterns — borderless cards, one per row so none is torn */
  .framing { font-size: 7.5pt; font-style: italic; color: #6B5F7A; margin-bottom: 6px; }
  .patterns-table { border: none; }
  .patterns-table td { border: none; }
  .pattern-cell { padding: 4px 0 6px; }
  .pattern-headline { font-size: 9pt; font-weight: 700; color: #2D2540; }
  .pattern-body { font-size: 8pt; color: #2D2540; margin-top: 1px; }
  .pattern-evidence { font-size: 7pt; color: #6B5F7A; margin-top: 1px; }

  /* medication notes sit under their row, full width, so nothing is truncated */
  .note-row td {
    font-size: 7.5pt;
    font-style: italic;
    color: #6B5F7A;
    border-top: none;
    padding: 2px 6px 4px 10px;
  }
  /* each medication and its note stay together across a page break */
  tbody.med-group { page-break-inside: avoid; }

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

// Returns a complete HTML string for the doctor report — one continuous
// document (summary → medications & appointments → daily logs) that the print
// engine paginates naturally, rather than fixed chapters on hard page breaks.
export function buildReportHtml(data, username, insights = null, logoUri = null) {
  const {
    periodCheckIns, totalDaysTracked, dailyData,
    avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite, avgSleep,
    symptomStats, notableLines,
    glanceAdherenceText, glanceSevereText, glanceMostFreqSymptom,
    periodStart, periodEnd, generatedDate,
    medications, prnTaken,
    medListRows, medListNotes, adherenceRows, medLogRows,
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

  const MED_COLS = ["Name", "Type", "Dosage", "Schedule", "Status"];
  const medListHeadHtml = MED_COLS.map((h) => `<th>${h}</th>`).join("");
  // one <tbody> per medication so its note can't be orphaned onto the next page
  const medListBodyHtml = medications.length === 0
    ? `<tbody><tr><td colspan="${MED_COLS.length}" class="center muted">No medications tracked</td></tr></tbody>`
    : medListRows.map((cells, i) => {
        const row = `<tr>${cells.map((c) => `<td>${c ?? "—"}</td>`).join("")}</tr>`;
        const note = medListNotes[i];
        const noteRow = note
          ? `<tr class="note-row"><td colspan="${MED_COLS.length}">${esc(note)}</td></tr>`
          : "";
        return `<tbody class="med-group">${row}${noteRow}</tbody>`;
      }).join("\n    ");

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

  // Sleep joins the averages row and At a Glance only when the period has data
  const hasSleep = avgSleep !== "-";

  // Observed Patterns is a bonus section: no insights (API down, or too few
  // days for a pattern to clear the thresholds) simply means no section.
  const patternCards = insights?.cards || [];
  const patternsHtml = patternCards.length === 0 ? "" : `
  <div class="section-title">Observed Patterns</div>
  <p class="framing">Associations in this patient's self-reported data over the last 90 days. Correlational only — not causal, and not clinically validated.</p>
  <table class="patterns-table">
    <tbody>
    ${patternCards.map((c) => `<tr><td class="pattern-cell">
        <div class="pattern-headline">${esc(c.headline)}</div>
        <div class="pattern-body">${esc(c.body)}</div>
        <div class="pattern-evidence">${esc(c.evidence)}</div>
      </td></tr>`).join("\n    ")}
    </tbody>
  </table>
`;

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
  <div class="report-head">
    ${logoUri ? `<div class="brand-mark"><img src="${logoUri}" alt=""/></div>` : ""}
    <div>
      <div class="report-title">Chronically Health Report</div>
      <p class="report-meta">Patient: ${esc(username)}&nbsp;&nbsp;&nbsp;Generated: ${generatedDate}</p>
      <p class="report-meta">Period: ${periodStart} – ${periodEnd}</p>
    </div>
  </div>

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
    ${hasSleep ? `<div class="glance-cell full">
      <div class="glance-label">Average sleep quality</div>
      <div class="glance-value">${avgSleep} / 5</div>
    </div>` : ""}
  </div>

  <div class="section-title">30-Day Trend</div>
  <div class="chart-wrap">
    ${chartHtml}
  </div>

  <div class="section-title">30-Day Averages</div>
  <table class="averages-table">
    <thead>
      <tr><th>Pain</th><th>Mood</th><th>Energy</th><th>Anxiety</th><th>Appetite</th>${hasSleep ? "<th>Sleep</th>" : ""}</tr>
    </thead>
    <tbody>
      <tr><td>${avgPain}</td><td>${avgMood}</td><td>${avgEnergy}</td><td>${avgAnxiety}</td><td>${avgAppetite}</td>${hasSleep ? `<td>${avgSleep}</td>` : ""}</tr>
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
${patternsHtml}
  <!-- ═══ MEDICATIONS & APPOINTMENTS ═══ -->
  <div class="section-title">Medications &amp; Appointments</div>

  <div class="section-title">Current Medications</div>
  <table>
    <thead><tr>${medListHeadHtml}</tr></thead>
    ${medListBodyHtml}
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

  <!-- ═══ DAILY LOGS ═══ -->
  <div class="section-title">Daily Logs</div>

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
