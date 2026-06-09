import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
];

const PURPLE = [124, 107, 174];
const DARK   = [45,  37,  64];
const GRAY   = [107, 95,  122];

export function generateReport(checkIns, username) {
  const today          = new Date();
  const thirtyDaysAgo  = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayStr         = today.toLocaleDateString("en-CA");
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");

  const periodCheckIns = checkIns.filter(
    (c) => c.date >= thirtyDaysAgoStr && c.date <= todayStr,
  );

  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked  = daysWithCheckIns.length;
  const avgPerDay = totalDaysTracked > 0
    ? (periodCheckIns.length / totalDaysTracked).toFixed(1)
    : "0";

  const avg = (arr, key, invert = false) => {
    const vals = arr.filter((c) => c[key]);
    if (vals.length === 0) return "-";
    const mean = vals.reduce((s, c) => s + c[key], 0) / vals.length;
    return (invert ? 6 - mean : mean).toFixed(1);
  };

  const avgPain     = avg(periodCheckIns, "painLevel",     false);
  const avgMood     = avg(periodCheckIns, "moodLevel",     true);
  const avgEnergy   = avg(periodCheckIns, "energyLevel",   true);
  const avgAnxiety  = avg(periodCheckIns, "anxietyLevel",  true);
  const avgAppetite = avg(periodCheckIns, "appetiteLevel", false);

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

    const dayAvg = (key, invert = false) => {
      const vals = dayCheckins.filter((c) => c[key]);
      if (vals.length === 0) return "-";
      const mean = vals.reduce((s, c) => s + c[key], 0) / vals.length;
      return (invert ? 6 - mean : mean).toFixed(1);
    };

    const uniqueSymptoms = [
      ...new Set(dayCheckins.flatMap((c) => c.symptoms || [])),
    ];

    dailyRows.push([
      label,
      dayAvg("painLevel",     false),
      dayAvg("moodLevel",     true),
      dayAvg("energyLevel",   true),
      dayAvg("anxietyLevel",  true),
      dayAvg("appetiteLevel", false),
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

  // Report header
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

  // Section: Daily Log — row height fills remaining page space
  doc.setFontSize(11);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Daily Log", margin, y);
  y += 3;

  // Header row ≈ 9mm, bottom margin 8mm
  const availableForRows = pageHeight - margin - 8 - y - 9;
  const minRowHeight = Math.max(4, availableForRows / 31);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Pain", "Mood", "Enrg", "Anx", "App", "Symptoms"]],
    body: dailyRows,
    headStyles: {
      fillColor: PURPLE, textColor: [255, 255, 255],
      fontStyle: "bold", fontSize: 9, cellPadding: 2,
    },
    bodyStyles: {
      textColor: DARK, fontSize: 8,
      cellPadding: { top: 0, bottom: 0, left: 1.5, right: 1.5 },
      minCellHeight: minRowHeight,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: "auto" },
    },
    styles: { overflow: "linebreak" },
    margin: { left: margin, right: margin, top: 14 },
    theme: "grid",
  });

  // Page headers/footers
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    if (p > 1) {
      doc.text("Chronically Health Report", margin, 7);
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
