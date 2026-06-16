export const MILESTONES = [3, 7, 14, 30, 60, 90, 100];
const SAVE_CADENCE = 2;
const MAX_SAVES = 3;

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("en-CA");
}

export function computeStreakState(checkIns) {
  const dateSet = new Set((checkIns || []).map((c) => c.date));
  if (dateSet.size === 0) {
    return { currentStreak: 0, longestStreak: 0, saveBalance: 0, savedDates: [], earnCounter: 0 };
  }

  const today = new Date().toLocaleDateString("en-CA");
  const start = [...dateSet].sort()[0];

  let currentStreak = 0, longestStreak = 0, saveBalance = 0, earnCounter = 0;
  const savedDates = [];

  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (dateSet.has(d)) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      earnCounter += 1;
      if (earnCounter >= SAVE_CADENCE) {
        earnCounter = 0;
        saveBalance = Math.min(MAX_SAVES, saveBalance + 1);
      }
    } else {
      if (d === today) continue;
      if (saveBalance > 0) {
        saveBalance -= 1;
        savedDates.push(d);
      } else {
        currentStreak = 0;
        earnCounter = 0;
      }
    }
  }

  return { currentStreak, longestStreak, saveBalance, savedDates, earnCounter };
}

export function achievedMilestones(longestStreak) {
  return MILESTONES.filter((m) => longestStreak >= m);
}

export function checkInsToNextSave(checkIns) {
  const { saveBalance, earnCounter } = computeStreakState(checkIns);
  if (saveBalance === MAX_SAVES) return null;
  return SAVE_CADENCE - earnCounter;
}
