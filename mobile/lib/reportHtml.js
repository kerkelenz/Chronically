import { buildTrendChartSvg } from "./reportData";

// Returns a complete HTML string for the doctor report.
// 9b extends this function by appending page 2 / page 3 sections before </body>.
export function buildReportHtml(data, username) {
  const {
    periodCheckIns, totalDaysTracked, dailyData,
    avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite,
    symptomStats, notableLines,
    glanceAdherenceText, glanceSevereText, glanceMostFreqSymptom,
    periodStart, periodEnd, generatedDate,
  } = data;

  const daysWithAnyData = dailyData.filter(
    (d) => d.pain !== null || d.mood !== null || d.energy !== null || d.anxiety !== null || d.appetite !== null
  );
  const chartHtml = daysWithAnyData.length < 2
    ? `<p class="no-data">Not enough data to display a trend chart.</p>`
    : buildTrendChartSvg(dailyData);

  const notableRowsHtml = notableLines.length > 0
    ? notableLines.map((line) => `<tr><td class="notable-cell">${line}</td></tr>`).join("")
    : `<tr><td class="notable-cell muted">No severe days recorded in this period.</td></tr>`;

  const symptomRowsHtml = symptomStats.length > 0
    ? symptomStats.map((s) => `
        <tr>
          <td>${s.name}</td>
          <td class="center">${s.days}</td>
          <td class="center">${s.percentage}%</td>
        </tr>`).join("")
    : `<tr><td colspan="3" class="center muted">No symptoms logged in this period</td></tr>`;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Lato', Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #2D2540;
      padding: 28px 32px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-title {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-weight: 500;
      font-size: 14pt;
      color: #7C6BAE;
      margin-bottom: 5px;
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
    .glance-cell:nth-child(odd)  { border-right: 1px solid rgba(107,95,122,0.2); }
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

    .footer {
      margin-top: 24px;
      font-size: 6pt;
      color: #6B5F7A;
      text-align: center;
      border-top: 1px solid rgba(107,95,122,0.2);
      padding-top: 8px;
    }
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/>
<style>${css}</style>
</head>
<body>

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
    <tr>
      <th>Pain</th><th>Mood</th><th>Energy</th><th>Anxiety</th><th>Appetite</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${avgPain}</td><td>${avgMood}</td><td>${avgEnergy}</td><td>${avgAnxiety}</td><td>${avgAppetite}</td>
    </tr>
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

<div class="footer">Self-reported data recorded by the patient via Chronically (mychronically.app)</div>

</body>
</html>`;
}
