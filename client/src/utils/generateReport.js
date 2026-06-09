import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
];

const PURPLE    = [124, 107, 174];
const DARK      = [45,  37,  64];
const GRAY      = [107, 95,  122];
const LIGHT_BG  = [240, 235, 248];

export function generateReport(checkIns, username) {
  const today         = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayStr        = today.toLocaleDateString("en-CA");
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");

  const periodCheckIns = checkIns.filter(
    (c) => c.date >= thirtyDaysAgoStr && c.date <= todayStr,
  );

  // --- Overview stats ---
  const daysWithCheckIns = [...new Set(periodCheckIns.map((c) => c.date))];
  const totalDaysTracked  = daysWithCheckIns.length;
  const avgPerDay = totalDaysTracked > 0
    ? (periodCheckIns.length / totalDaysTracked).toFixed(1)
    : "0";

  // --- Summary averages ---
  const avg = (arr, key, invert = false) => {
    const vals = arr.filter((c) => c[key]);
    if (vals.length === 0) return "-";
    const mean = vals.reduce((s, c) => s + c[key], 0) / vals.length;
    return (invert ? 6 - mean : mean).toFixed(1);
  };

  const avgPain    = avg(periodCheckIns, "painLevel",    false);
  const avgMood    = avg(periodCheckIns, "moodLevel",    true);
  const avgEnergy  = avg(periodCheckIns, "energyLevel",  true);
  const avgAnxiety = avg(periodCheckIns, "anxietyLevel", true);
  const avgAppetite = avg(periodCheckIns, "appetiteLevel", false);

  // --- Symptom stats ---
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
  }).sort((a, b) => b.days - a.days);

  // --- Daily log (all 30 days) ---
  const dailyRows = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr    = d.toLocaleDateString("en-CA");
    const dayCheckins = periodCheckIns.filter((c) => c.date === dateStr);
    const label      = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

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
      dayAvg("painLevel",    false),
      dayAvg("moodLevel",    true),
      dayAvg("energyLevel",  true),
      dayAvg("anxietyLevel", true),
      dayAvg("appetiteLevel", false),
      uniqueSymptoms.length > 0 ? uniqueSymptoms.join(", ") : "—",
    ]);
  }

  // --- Build PDF ---
  const doc        = new jsPDF();
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 14;

  // Report header — page 1 only
  let y = 20;

  doc.setFontSize(20);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Chronically Health Report", margin, y);
  y += 9;

  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, "normal");
  doc.text(
    `Generated: ${today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin, y,
  );
  y += 5;
  doc.text(`Patient: ${username}`, margin, y);
  y += 5;
  doc.text(
    `Period: ${thirtyDaysAgo.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    margin, y,
  );
  y += 9;

  doc.setFontSize(9);
  doc.text(`Total check-ins: ${periodCheckIns.length}`, margin, y);
  doc.text(`Days with check-ins: ${totalDaysTracked} of 30`, margin + 55, y);
  doc.text(`Avg check-ins / day: ${avgPerDay}`, margin + 120, y);
  y += 10;

  // Section: Summary averages
  doc.setFontSize(12);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("30-Day Summary", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Pain", "Mood", "Energy", "Anxiety", "Appetite"]],
    body: [[avgPain, avgMood, avgEnergy, avgAnxiety, avgAppetite]],
    headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    bodyStyles: { textColor: DARK, fontSize: 13, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 36 }, 1: { cellWidth: 36 }, 2: { cellWidth: 36 },
      3: { cellWidth: 36 }, 4: { cellWidth: 38 },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 10;

  // Section: Symptom summary
  doc.setFontSize(12);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Symptom Summary", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Symptom", "Days", "% of days tracked"]],
    body: symptomStats.map((s) => [s.name, s.days, `${s.percentage}%`]),
    headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { textColor: DARK, fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 30 },
      2: { cellWidth: 52 },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 10;

  // Section: Daily log
  doc.setFontSize(12);
  doc.setTextColor(...PURPLE);
  doc.setFont(undefined, "bold");
  doc.text("Daily Log", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Pain", "Mood", "Energy", "Anxiety", "Appetite", "Symptoms"]],
    body: dailyRows,
    headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { textColor: DARK, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: "auto" },
    },
    styles: { overflow: "linebreak" },
    margin: { left: margin, right: margin, top: 15 },
    theme: "grid",
  });

  // Post-process: add mini-header and footer to every page
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont(undefined, "normal");
    if (p > 1) {
      doc.text("Chronically Health Report", margin, 8);
      doc.text(username, pageWidth - margin, 8, { align: "right" });
    }
    doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
  }

  // Save
  const dateSlug = today.toLocaleDateString("en-CA");
  doc.save(`chronically-report-${username}-${dateSlug}.pdf`);
}
