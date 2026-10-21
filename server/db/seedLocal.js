// Test accounts for the local Docker database (npm run db:seed).
//
//   new@chronically.local      exactly what a sign-up looks like after the
//                              email is verified: welcome pending, no data.
//   settled@chronically.local  a month in: 30 check-in days, two medications,
//                              a visit coming up and one just past, welcome done,
//                              tips still on — every data-gated tip has something
//                              to point at.
//
// Both use the password "chronically". That's only acceptable because this
// script refuses to run against anything but a local database. Re-running it
// resets both accounts; nothing else in the database is touched.
require("dotenv").config();
const bcrypt = require("bcrypt");
const { isLocalDatabase, databaseHost } = require("../lib/environment");

if (!isLocalDatabase(process.env.DATABASE_URL)) {
  console.error(`\n✖ db:seed only runs against a local database, not ${databaseHost(process.env.DATABASE_URL) || "(unset)"}.\n`);
  process.exit(1);
}

const { sequelize } = require("../config/db");
const User = require("../models/User");
const CheckIn = require("../models/CheckIn");
const Medication = require("../models/Medication");
const MedicationLog = require("../models/MedicationLog");
const Appointment = require("../models/Appointment");
const SpoonDay = require("../models/SpoonDay");
const SpoonEntry = require("../models/SpoonEntry");
const Flare = require("../models/Flare");
const Doctor = require("../models/Doctor");

const PASSWORD = "chronically";
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysFrom = (n, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// deterministic, so every reset looks the same
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const level = (base) => Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 1.4)));

async function resetUser(email, fields) {
  const existing = await User.findOne({ where: { email } });
  if (existing) await existing.destroy(); // foreign keys cascade to everything they own
  return User.create({
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    isVerified: true,
    ...fields,
  });
}

async function main() {
  await sequelize.authenticate();

  await resetUser("new@chronically.local", {
    username: "New Tester",
    hasSeenWelcome: false,
    tipsSeen: null, // closing the welcome is what enrols a real account
  });

  const settled = await resetUser("settled@chronically.local", {
    username: "Settled Tester",
    hasSeenWelcome: true,
    tipsSeen: {},
    spoonBaseline: 12,
    celebratedMilestones: [3, 7, 14, 30],
    timezone: "America/Los_Angeles",
  });
  const userId = settled.id;

  for (let n = 30; n >= 1; n--) {
    const base = 3 + Math.sin(n / 5) * 0.8;
    await CheckIn.create({
      userId,
      date: ymd(daysFrom(-n)),
      painLevel: level(base),
      moodLevel: level(base + 0.3),
      energyLevel: level(base - 0.2),
      anxietyLevel: level(base),
      appetiteLevel: level(base + 0.2),
      sleepLevel: rand() < 0.1 ? null : level(base),
      symptoms: rand() < 0.4 ? ["Fatigue"] : [],
      createdAt: daysFrom(-n),
      updatedAt: daysFrom(-n),
    });
  }

  const daily = await Medication.create({
    userId, name: "Example daily", type: "pill", frequency: "daily", dosage: "10 mg",
    scheduledTimes: ["08:00", "20:00"], startDate: ymd(daysFrom(-30)), supplyCount: 40,
  });
  await Medication.create({ userId, name: "Example as-needed", type: "pill", frequency: "as_needed", dosage: "200 mg" });
  for (let n = 7; n >= 1; n--) {
    await MedicationLog.create({ userId, medicationId: daily.id, date: ymd(daysFrom(-n)), scheduledTime: "08:00", status: "taken", takenAt: daysFrom(-n, 8) });
  }

  await Doctor.create({ userId, name: "Dr. Example", nameKey: "dr. example", specialty: "Rheumatology" });
  await Appointment.create({ userId, doctorName: "Dr. Example", specialty: "Rheumatology", date: daysFrom(5, 10), status: "upcoming" });
  await Appointment.create({ userId, doctorName: "Dr. Example", specialty: "Rheumatology", date: daysFrom(-3, 14), status: "upcoming" });

  await Flare.create({ userId, startDate: ymd(daysFrom(-18)), endDate: ymd(daysFrom(-14)), note: "Example flare" });

  const day = await SpoonDay.create({ userId, date: ymd(daysFrom(-1)), budget: 12 });
  await SpoonEntry.create({ userId, spoonDayId: day.id, name: "Shower", cost: 2, completed: true, position: 0 });
  await SpoonEntry.create({ userId, spoonDayId: day.id, name: "Groceries", cost: 4, completed: false, position: 1 });

  console.log("\n✔ Local test accounts ready (password: chronically)\n");
  console.log("  new@chronically.local       fresh sign-up — welcome pending, no data");
  console.log("  settled@chronically.local   30 days in — meds, visits, a flare, spoons\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
