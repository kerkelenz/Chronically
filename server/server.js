// dotenv has to be first so all the environment variables are loaded before anything else runs
require("dotenv").config();

// Sentry, errors-only and env-gated — a silent no-op when SENTRY_DSN is absent,
// so local dev needs nothing. Initialised as early as possible so it can wrap
// everything that follows. tracesSampleRate 0 = no performance data, errors only.
const Sentry = require("@sentry/node");
const { resolveStage, bootProblem, jobsToStart, corsOrigins } = require("./lib/environment");
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  environment: resolveStage(process.env) || "unknown",
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { connectDB, sequelize } = require("./config/db");
const { migrateUp } = require("./db/migrator");
const authRoutes = require("./routes/authRoutes");
const checkInRoutes = require("./routes/checkInRoutes");
const authenticateToken = require("./middleware/auth");
const userRoutes = require("./routes/userRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const flareRoutes = require("./routes/flareRoutes");
const spoonRoutes = require("./routes/spoonRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const accountDeletionRoutes = require("./routes/accountDeletionRoutes");
const eventRoutes = require("./routes/eventRoutes");
const insightRoutes = require("./routes/insightRoutes");
const trendRoutes = require("./routes/trendRoutes");
const pushRoutes = require("./routes/pushRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const adminAnnouncementRoutes = require("./routes/adminAnnouncementRoutes");
const { startNotificationScheduler } = require("./jobs/notificationScheduler");
const { startWeatherBackfill } = require("./jobs/weatherCapture");
const rateLimit = require("express-rate-limit");

// every model registered up front, so associations are all in place before
// the first request (the schema itself comes from migrations, never sync)
require("./models/User");
require("./models/CheckIn");
require("./models/Medication");
require("./models/MedicationLog");
require("./models/MedicationChange");
require("./models/Appointment");
require("./models/Doctor");
require("./models/Flare");
require("./models/SpoonActivity");
require("./models/SpoonDay");
require("./models/SpoonEntry");
require("./models/Event");
require("./models/PushToken");
require("./models/NotificationLog");
require("./models/Announcement");
require("./models/AnnouncementRead");
require("./models/WeatherDay");

// creating the express app - everything gets attached to this
const app = express();

// Render sits behind a proxy, so the real client IP arrives in X-Forwarded-For
// without this, express-rate-limit either errors or lumps every user under the proxy's IP
app.set("trust proxy", 1);

// wrapping everything in an async function so we can use await for the database connection
// we want to make sure the database is ready before the server starts accepting requests
const startServer = async () => {
  // refuse to boot rather than run half-configured — and never let a local
  // server touch a remote database by accident (see lib/environment.js)
  const problem = bootProblem(process.env);
  if (problem) {
    console.error(`Refusing to start: ${problem}`);
    process.exit(1);
  }
  const stage = resolveStage(process.env);
  console.log(`Stage: ${stage}`);

  await connectDB();

  // the schema only ever changes through migrations (server/migrations), applied
  // here on every boot — so staging runs each one before production does
  const applied = await migrateUp(sequelize, { logger: undefined });
  console.log(applied.length ? `Migrations applied: ${applied.join(", ")}` : "Schema up to date");

  // helmet automatically sets a bunch of security headers on every response
  app.use(helmet());
  // each stage only accepts its own web front end (plus CORS_ORIGINS)
  app.use(cors({ origin: corsOrigins(process.env), credentials: true }));
  // this lets us read JSON from the request body - without it req.body would be undefined
  // the limit is raised from the 100kb default so avatar data-URLs (up to ~400kb) fit
  app.use(express.json({ limit: "500kb" }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // max 20 requests per 15 minutes
    message: { error: "Too many attempts, please try again later" },
  });

  app.use("/api/auth", authLimiter);

  // feedback and account-deletion both send an email per request, so they get a
  // much stricter limit - nobody legitimately needs more than a few of these an hour
  const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { error: "Too many requests, please try again later" },
  });

  // all auth routes live under /api/auth
  // so /register becomes /api/auth/register and /login becomes /api/auth/login
  app.use("/api/auth", authRoutes);

  app.use("/api/checkins", checkInRoutes);

  // simple test route to confirm the server is running
  app.get("/api/test", (req, res) => {
    res.json({ message: "Chronically backend is working!" });
  });

  // this is just a test route to make sure the middleware is working correctly
  // authenticateToken sits between the route path and the handler function
  // it runs first, and only calls next() if the token is valid
  // req.user is available here because authenticateToken attached it after verifying the token
  app.get("/api/protected", authenticateToken, (req, res) => {
    res.json({ message: `Hello ${req.user.username}, you are authenticated!` });
  });

  app.use("/api/users", userRoutes);
  app.use("/api/medications", medicationRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/doctors", doctorRoutes);
  app.use("/api/flares", flareRoutes);
  app.use("/api/spoons", spoonRoutes);
  app.use("/api/insights", insightRoutes);
  app.use("/api/trends", trendRoutes);
  app.use("/api/push", pushRoutes);
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/admin/announcements", adminAnnouncementRoutes);
  app.use("/api/feedback", emailLimiter, feedbackRoutes);
  app.use("/api/account-deletion", emailLimiter, accountDeletionRoutes);

  const eventLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 120, // batched clients send a handful per hour; this only stops abuse
    message: { error: "Too many requests, please try again later" },
  });
  app.use("/api/events", eventLimiter, eventRoutes);

  // anything that falls through the routes above is a 404 - return JSON instead of Express's HTML page
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // capture unhandled 500s in Sentry before our own handler turns them into
  // JSON — no-op without a DSN
  Sentry.setupExpressErrorHandler(app);

  // final safety net so malformed JSON, oversized bodies, and anything a route
  // forgot to catch come back as JSON errors instead of HTML stack traces
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON in request body" });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large" });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Server error" });
  });

  // use the PORT from .env if it exists, otherwise default to 3001
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Both of these ride on this process, so they only tick while the web service
  // is awake — fine on an always-on instance, not on one that sleeps. They're
  // off on a local machine unless ENABLE_JOBS=true (a dev server must never
  // send a real push), and each keeps its own DISABLE_* kill switch.
  const jobs = jobsToStart(process.env);
  if (jobs.notifications) startNotificationScheduler();
  if (jobs.weather) startWeatherBackfill();
  console.log(`Jobs: notifications ${jobs.notifications ? "on" : "off"}, weather ${jobs.weather ? "on" : "off"}`);
};

startServer();
