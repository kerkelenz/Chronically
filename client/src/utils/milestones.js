export const MILESTONES = [3, 7, 14, 30, 60, 90, 100, 180, 365];

export const MILESTONE_COPY = {
  3:   "Three days of checking in — a lovely start.",
  7:   "Seven days logged. You're really showing up for yourself.",
  14:  "Fourteen days of check-ins. Wonderful consistency.",
  30:  "Thirty days tracked — a real picture is taking shape.",
  60:  "Sixty days of looking after yourself. Look how far you've come.",
  90:  "Ninety days logged. That's remarkable care.",
  100: "One hundred days tracked. An incredible milestone.",
  180: "One hundred eighty days — half a year of showing up.",
  365: "A full year of check-ins. Extraordinary.",
};

export const totalCheckInDays = (checkIns) =>
  new Set(checkIns.map((c) => c.date)).size;

export const achievedMilestones = (total) =>
  MILESTONES.filter((m) => total >= m);
