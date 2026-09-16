// Correlation-insights engine — pure and test-ready:
//   computeInsights({ checkIns, medLogs = [], spoonDays = [] })
// takes the user's last-90-days data and returns voiced headline cards plus a
// teaching-state meta. No req/res, no DB. Honesty rules are hard-coded below.
//
// Families:
//   F1 — symptom ↔ metric (worsening only)
//   F2 — sleep ↔ same-day metrics (one card, strongest metric)
//   F3 — skipped doses ↔ that day's metrics (one card) — observational only:
//        bad days likely cause skipped doses, not the reverse, so never advice
//   F4 — over-budget spoon day ↔ the NEXT day (one card, energy then pain)
//   F5 — weekday pattern (one card, hardest weekday)
//
// All five daytime metrics are on a 1–5 scale where 5 = best, so "worse" always
// means a lower average. Language stays descriptive ("averages / runs / dips") —
// never "causes", never advice.

const WINDOW_DAYS = 90;
const MIN_BUCKET_DAYS = 5;        // both buckets must have this many days
const MIN_EFFECT = 0.5;           // minimum |effect| on the 1–5 scale
const MIN_EFFECT_COMPOSITE = 0.4; // F5's composite is a mean, so a gentler floor
const MAX_CARDS = 5;
const MAX_PER_FAMILY = 2;

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// the five daytime metrics (sleep is handled separately in F2)
const METRICS = [
  { key: "energy",   label: "energy" },
  { key: "pain",     label: "pain" },
  { key: "mood",     label: "mood" },
  { key: "anxiety",  label: "anxiety" },
  { key: "appetite", label: "appetite" },
];

const round1 = (x) => Math.round(x * 10) / 10;
const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// pain reads as "worse", every other metric reads as "lower"
const worseWord = (metricKey) => (metricKey === "pain" ? "worse" : "lower");

// the calendar day before a "YYYY-MM-DD" string (noon avoids TZ edge shifts)
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const prevDateStr = (dateStr) => {
  const p = new Date(dateStr + "T12:00:00");
  p.setDate(p.getDate() - 1);
  return ymd(p);
};

function f1Headline(symptom, metricKey) {
  switch (metricKey) {
    case "energy":   return `${symptom} costs you energy`;
    case "pain":     return `Pain runs harder on ${symptom} days`;
    case "mood":     return `${symptom} weighs on your mood`;
    case "anxiety":  return `Anxiety climbs with ${symptom}`;
    case "appetite": return `${symptom} dulls your appetite`;
    default:         return "";
  }
}

// ── Per-DAY aggregates ────────────────────────────────────────────────────────
// Multi-check-in days average their metrics; a day's symptom set is the union.
function buildDays(checkIns) {
  const byDate = {};
  for (const c of checkIns) {
    if (!c.date) continue;
    if (!byDate[c.date]) {
      byDate[c.date] = {
        date: c.date,
        pain: [], mood: [], energy: [], anxiety: [], appetite: [], sleep: [],
        symptoms: new Set(),
      };
    }
    const d = byDate[c.date];
    if (c.painLevel     != null) d.pain.push(c.painLevel);
    if (c.moodLevel     != null) d.mood.push(c.moodLevel);
    if (c.energyLevel   != null) d.energy.push(c.energyLevel);
    if (c.anxietyLevel  != null) d.anxiety.push(c.anxietyLevel);
    if (c.appetiteLevel != null) d.appetite.push(c.appetiteLevel);
    if (c.sleepLevel    != null) d.sleep.push(c.sleepLevel);
    if (Array.isArray(c.symptoms)) {
      for (const s of c.symptoms) if (s) d.symptoms.add(s);
    }
  }
  return Object.values(byDate).map((d) => ({
    date: d.date,
    pain:     d.pain.length     ? mean(d.pain)     : null,
    mood:     d.mood.length     ? mean(d.mood)     : null,
    energy:   d.energy.length   ? mean(d.energy)   : null,
    anxiety:  d.anxiety.length  ? mean(d.anxiety)  : null,
    appetite: d.appetite.length ? mean(d.appetite) : null,
    sleep:    d.sleep.length    ? mean(d.sleep)    : null,
    symptoms: d.symptoms,
  }));
}

// ── F1: symptom ↔ metric (worsening only) ─────────────────────────────────────
function familyF1(days) {
  const symptomDayCount = {};
  for (const d of days) {
    for (const s of d.symptoms) symptomDayCount[s] = (symptomDayCount[s] || 0) + 1;
  }

  const candidates = [];
  for (const [symptom, count] of Object.entries(symptomDayCount)) {
    if (count < MIN_BUCKET_DAYS) continue;
    for (const { key, label } of METRICS) {
      const sym = [];
      const non = [];
      for (const d of days) {
        const v = d[key];
        if (v == null) continue;
        if (d.symptoms.has(symptom)) sym.push(v);
        else non.push(v);
      }
      if (sym.length < MIN_BUCKET_DAYS || non.length < MIN_BUCKET_DAYS) continue;
      const effect = mean(non) - mean(sym); // >0 → worse (lower) on symptom days
      if (effect < MIN_EFFECT) continue;    // worsening only; better is suppressed
      const X = round1(effect).toFixed(1);
      candidates.push({
        id: `f1-${slug(symptom)}-${key}`,
        family: "symptom",
        headline: f1Headline(symptom, key),
        body: `On days with ${symptom}, your ${label} averages ${X} ${worseWord(key)} than days without.`,
        evidence: `Across ${sym.length} days with ${symptom}`,
        effect,
      });
    }
  }
  return candidates;
}

// ── F2: sleep ↔ same-day metrics (one card, strongest metric) ─────────────────
function familyF2(days) {
  const low = days.filter((d) => d.sleep != null && d.sleep <= 2);
  const high = days.filter((d) => d.sleep != null && d.sleep >= 4);
  if (low.length < MIN_BUCKET_DAYS || high.length < MIN_BUCKET_DAYS) return [];

  let best = null;
  for (const { key, label } of METRICS) {
    const lowVals = low.map((d) => d[key]).filter((v) => v != null);
    const highVals = high.map((d) => d[key]).filter((v) => v != null);
    if (lowVals.length < MIN_BUCKET_DAYS || highVals.length < MIN_BUCKET_DAYS) continue;
    const effect = mean(highVals) - mean(lowVals); // >0 → worse after rough nights
    if (effect < MIN_EFFECT) continue;
    if (!best || effect > best.effect) {
      const X = round1(effect).toFixed(1);
      best = {
        id: `f2-${key}`,
        family: "sleep",
        headline: "Sleep sets the day",
        body: `After nights you rated 2 or below, ${label} averages ${X} ${worseWord(key)} than after well-slept nights.`,
        evidence: `Comparing ${low.length} rough nights with ${high.length} well-slept ones`,
        effect,
      };
    }
  }
  return best ? [best] : [];
}

// ── F5: weekday pattern (one card, hardest weekday) ───────────────────────────
function familyF5(days) {
  const composites = days
    .map((d) => {
      const vals = [d.pain, d.mood, d.energy, d.anxiety, d.appetite].filter((v) => v != null);
      return vals.length ? { date: d.date, comp: mean(vals) } : null;
    })
    .filter(Boolean);
  if (composites.length === 0) return [];

  const overall = mean(composites.map((c) => c.comp));
  const byWeekday = {};
  for (const c of composites) {
    const wd = new Date(c.date + "T12:00:00").getDay();
    (byWeekday[wd] = byWeekday[wd] || []).push(c.comp);
  }

  let best = null;
  for (const [wd, arr] of Object.entries(byWeekday)) {
    if (arr.length < 6) continue; // require ≥6 occurrences of that weekday
    const dip = overall - mean(arr); // >0 → harder (lower) on this weekday
    if (dip < MIN_EFFECT_COMPOSITE) continue;
    if (!best || dip > best.effect) {
      const name = WEEKDAYS[Number(wd)];
      const X = round1(dip).toFixed(1);
      best = {
        id: `f5-${name.toLowerCase()}`,
        family: "weekday",
        headline: `${name}s hit hardest`,
        body: `Your overall averages dip ${X} below your norm on ${name}s.`,
        evidence: `Across ${arr.length} ${name}s`,
        effect: dip,
      };
    }
  }
  return best ? [best] : [];
}

// ── F3: skipped doses ↔ that day's metrics (one card) ─────────────────────────
// Uses explicitly LOGGED skips only (no schedule math, which lives client-side).
// Bucket A = days with ≥1 skipped log; Bucket B = days with ≥1 taken and 0 skips.
function familyF3(days, medLogs) {
  if (!medLogs || medLogs.length === 0) return [];
  const skippedAny = new Set();
  const takenAny = new Set();
  for (const l of medLogs) {
    if (!l.date) continue;
    if (l.status === "skipped") skippedAny.add(l.date);
    else if (l.status === "taken") takenAny.add(l.date);
  }
  const dayByDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const aDates = [...skippedAny];
  const bDates = [...takenAny].filter((dt) => !skippedAny.has(dt));

  let best = null;
  for (const { key, label } of METRICS) {
    const a = aDates.map((dt) => dayByDate[dt]?.[key]).filter((v) => v != null);
    const b = bDates.map((dt) => dayByDate[dt]?.[key]).filter((v) => v != null);
    if (a.length < MIN_BUCKET_DAYS || b.length < MIN_BUCKET_DAYS) continue;
    const effect = mean(b) - mean(a); // >0 → worse on skipped-dose days
    if (effect < MIN_EFFECT) continue;
    if (!best || effect > best.effect) {
      const X = round1(effect).toFixed(1);
      best = {
        id: `f3-${key}`,
        family: "adherence",
        headline: "Skipped doses land on harder days",
        body: `On days you skipped a dose, your ${label} averages ${X} ${worseWord(key)} than on days everything was logged.`,
        evidence: `Across ${a.length} days with a skipped dose`,
        effect,
      };
    }
  }
  return best ? [best] : [];
}

// ── F4: over-budget spoon day ↔ the NEXT day (one card) ───────────────────────
// spoonDays: [{ date, budget, spent, entries }]. Over budget = spent > budget on
// a day that actually has entries. We compare TODAY's metrics split by the
// PREVIOUS day's budget state — energy first, then pain.
function familyF4(days, spoonDays) {
  if (!spoonDays || spoonDays.length === 0) return [];
  const spoonByDate = {};
  for (const s of spoonDays) if (s.date) spoonByDate[s.date] = s;

  const budgetState = (dateStr) => {
    const s = spoonByDate[dateStr];
    if (!s || !(s.entries > 0)) return null; // must exist and have entries
    return s.spent > s.budget ? "over" : "within";
  };

  const dayByDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const aDates = []; // today, where YESTERDAY was over budget
  const bDates = []; // today, where YESTERDAY was within budget
  for (const d of days) {
    const st = budgetState(prevDateStr(d.date));
    if (st === "over") aDates.push(d.date);
    else if (st === "within") bDates.push(d.date);
  }

  for (const key of ["energy", "pain"]) {
    const a = aDates.map((dt) => dayByDate[dt]?.[key]).filter((v) => v != null);
    const b = bDates.map((dt) => dayByDate[dt]?.[key]).filter((v) => v != null);
    if (a.length < MIN_BUCKET_DAYS || b.length < MIN_BUCKET_DAYS) continue;
    const effect = mean(b) - mean(a); // >0 → worse the day after over-budget
    if (effect < MIN_EFFECT) continue;
    const X = round1(effect).toFixed(1);
    return [{
      id: `f4-${key}`,
      family: "spoons",
      headline: "Overspending spoons echoes into tomorrow",
      body: `The day after you go over your spoon budget, your ${key} averages ${X} ${worseWord(key)}.`,
      evidence: `Across ${a.length} days after going over budget`,
      effect,
    }];
  }
  return [];
}

// ── Public entry point ────────────────────────────────────────────────────────
function computeInsights({ checkIns, medLogs = [], spoonDays = [] } = {}) {
  const days = buildDays(checkIns || []);
  const dayCount = days.length;

  const byEffect = (a, b) => Math.abs(b.effect) - Math.abs(a.effect);
  const f1 = familyF1(days).sort(byEffect).slice(0, MAX_PER_FAMILY);
  const f2 = familyF2(days).slice(0, MAX_PER_FAMILY);
  const f3 = familyF3(days, medLogs).slice(0, MAX_PER_FAMILY);
  const f4 = familyF4(days, spoonDays).slice(0, MAX_PER_FAMILY);
  const f5 = familyF5(days).slice(0, MAX_PER_FAMILY);

  const cards = [...f1, ...f2, ...f3, ...f4, ...f5]
    .sort(byEffect)
    .slice(0, MAX_CARDS)
    .map((c) => ({ ...c, effect: round1(c.effect) }));

  const hasSleep = days.some((d) => d.sleep != null);

  const meta = { days: dayCount };
  if (dayCount < 14) {
    meta.message = `Insights unlock as patterns emerge — about ${14 - dayCount} more check-in days to go.`;
  } else if (cards.length === 0) {
    meta.message = "No strong patterns yet — that can be good news. Keep logging; subtler patterns need more days.";
  } else {
    meta.message = null;
  }
  // sleep never answered but other patterns exist → nudge, don't block
  if (!hasSleep && cards.length > 0) meta.sleepHint = true;

  return { cards, meta };
}

module.exports = { computeInsights, WINDOW_DAYS };
