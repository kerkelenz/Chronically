export const TYPE_ICONS = {
  pill:        "💊",
  injection:   "💉",
  infusion:    "🩺",
  supplement:  "🌿",
};

export const FREQUENCY_LABELS = {
  daily:              "Daily",
  twice_daily:        "Twice daily",
  three_times_daily:  "Three times daily",
  four_times_daily:   "Four times daily",
  every_other_day:    "Every other day",
  weekly:             "Weekly",
  biweekly:           "Biweekly",
  monthly:            "Monthly",
  every_x_weeks:      "Every X weeks",
  as_needed:          "As needed",
};

export const FREQUENCY_TIME_COUNTS = {
  daily:              1,
  twice_daily:        2,
  three_times_daily:  3,
  four_times_daily:   4,
  every_other_day:    1,
  weekly:             1,
  biweekly:           1,
  monthly:            1,
  every_x_weeks:      1,
  as_needed:          0,
};

export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function isMedicationDueToday(medication, today) {
  const { frequency, frequencyWeeks, createdAt } = medication;

  // Compare whole calendar days in LOCAL time. Collapsing both dates to local
  // midnight strips time-of-day/timezone so interval meds land on the correct
  // weekday (their creation day), instead of drifting a day off.
  const c = new Date(createdAt);
  const startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
  const [ty, tm, td] = today.split("-").map(Number);
  const nowDay = new Date(ty, tm - 1, td);
  const daysDiff = Math.round((nowDay - startDay) / (1000 * 60 * 60 * 24));

  switch (frequency) {
    case "daily":
    case "twice_daily":
    case "three_times_daily":
    case "four_times_daily":
      return true;
    case "every_other_day":
      return daysDiff >= 0 && daysDiff % 2 === 0;
    case "weekly":
      return daysDiff >= 0 && daysDiff % 7 === 0;
    case "biweekly":
      return daysDiff >= 0 && daysDiff % 14 === 0;
    case "monthly":
      return nowDay.getDate() === startDay.getDate();
    case "every_x_weeks":
      return frequencyWeeks > 0 && daysDiff >= 0 && daysDiff % (frequencyWeeks * 7) === 0;
    case "as_needed":
      return false;
    default:
      return false;
  }
}
