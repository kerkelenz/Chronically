// dotenv has to be first so all the environment variables are loaded before anything else runs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { connectDB, sequelize } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const checkInRoutes = require("./routes/checkInRoutes");
const authenticateToken = require("./middleware/auth");
const userRoutes = require("./routes/userRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const spoonRoutes = require("./routes/spoonRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const accountDeletionRoutes = require("./routes/accountDeletionRoutes");
const rateLimit = require("express-rate-limit");

// importing the models here so Sequelize knows about them before we call sync
// if we don't import them they won't get created in the database
require("./models/User");
require("./models/CheckIn");
require("./models/Medication");
require("./models/MedicationLog");
require("./models/Appointment");
require("./models/SpoonActivity");
require("./models/SpoonDay");
require("./models/SpoonEntry");

// creating the express app - everything gets attached to this
const app = express();

// Render sits behind a proxy, so the real client IP arrives in X-Forwarded-For
// without this, express-rate-limit either errors or lumps every user under the proxy's IP
app.set("trust proxy", 1);

// wrapping everything in an async function so we can use await for the database connection
// we want to make sure the database is ready before the server starts accepting requests
const startServer = async () => {
  // without a JWT secret every login would fail at runtime - better to refuse to boot
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set - refusing to start");
    process.exit(1);
  }

  await connectDB();

  // sync tells Sequelize to look at our models and make sure the database tables match
  // alter: true updates existing tables if we've made changes to our models - handy in
  // development, but running DDL on every production boot risks data loss and slow deploys.
  // for a production deploy that changes the schema, set DB_SYNC_ALTER=true once, then remove it
  const alterSchema =
    process.env.NODE_ENV !== "production" ||
    process.env.DB_SYNC_ALTER === "true";
  await sequelize.sync(alterSchema ? { alter: true } : {});
  console.log(`Database synced${alterSchema ? " (alter)" : ""}`);

  // helmet automatically sets a bunch of security headers on every response
  app.use(helmet());
  // cors allows our React frontend on render to talk to this backend
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "https://mychronically.app",
        "https://www.mychronically.app",
        "https://chronically-frontend.onrender.com",
      ],
      credentials: true,
    }),
  );
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
  app.use("/api/spoons", spoonRoutes);
  app.use("/api/feedback", emailLimiter, feedbackRoutes);
  app.use("/api/account-deletion", emailLimiter, accountDeletionRoutes);

  // anything that falls through the routes above is a 404 - return JSON instead of Express's HTML page
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

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
};

startServer();
