// Which stage this server is running as, and what that stage is allowed to do.
//
// Pure — reads only the env object it's given. Three stages:
//   local       a developer's machine, against the Docker Postgres
//   staging     the `develop` branch on Render, against the staging Supabase
//   production  the `main` branch on Render, against the production Supabase
//
// The rules that matter:
//   - a local server refuses to boot against a remote database unless told
//     to explicitly (ALLOW_REMOTE_DB=true) — local code must never quietly
//     touch real users' data again;
//   - the background jobs (push reminders, weather) are off locally unless
//     ENABLE_JOBS=true, so a dev server can't send a real notification;
//   - SSL is on for any remote database and off for a local one.

const STAGES = ["local", "staging", "production"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"]);

/** APP_ENV wins; otherwise NODE_ENV=production means production, and anything else is local. */
function resolveStage(env) {
  const explicit = (env.APP_ENV || "").trim().toLowerCase();
  if (explicit) return STAGES.includes(explicit) ? explicit : null;
  return env.NODE_ENV === "production" ? "production" : "local";
}

/** The database host, or null when the URL can't be parsed. */
function databaseHost(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalDatabase(url) {
  const host = databaseHost(url);
  return host !== null && LOCAL_HOSTS.has(host);
}

/**
 * Sequelize dialectOptions.ssl for this connection. DB_SSL=true|false forces
 * it; otherwise remote databases get SSL and local ones don't. DB_CA_CERT
 * turns on full certificate verification.
 */
function sslOptions(env) {
  const forced = env.DB_SSL === "true" ? true : env.DB_SSL === "false" ? false : null;
  const useSsl = forced !== null ? forced : !isLocalDatabase(env.DATABASE_URL);
  if (!useSsl) return false;
  return env.DB_CA_CERT
    ? { require: true, rejectUnauthorized: true, ca: env.DB_CA_CERT }
    : { require: true, rejectUnauthorized: false };
}

/** A reason to refuse to boot, or null when it's safe to. */
function bootProblem(env) {
  const stage = resolveStage(env);
  if (stage === null) return `APP_ENV must be one of ${STAGES.join(", ")}`;
  if (!env.DATABASE_URL) return "DATABASE_URL is not set";
  if (databaseHost(env.DATABASE_URL) === null) return "DATABASE_URL can't be parsed";
  if (!env.JWT_SECRET) return "JWT_SECRET is not set";
  if (stage === "local" && !isLocalDatabase(env.DATABASE_URL) && env.ALLOW_REMOTE_DB !== "true") {
    return `a local server is pointed at a remote database (${databaseHost(env.DATABASE_URL)}). ` +
      "Use the Docker database (npm run db:up), or set ALLOW_REMOTE_DB=true if you really mean it";
  }
  if (stage !== "local" && isLocalDatabase(env.DATABASE_URL)) {
    return `APP_ENV=${stage} but DATABASE_URL points at a local database`;
  }
  // without a key, email falls back to the console — never acceptable for real users
  if (stage === "production" && !env.RESEND_API_KEY) return "RESEND_API_KEY is not set";
  return null;
}

/** Which in-process jobs to start. Each keeps its own DISABLE_* kill switch. */
function jobsToStart(env) {
  const stage = resolveStage(env);
  const allowed = stage !== "local" || env.ENABLE_JOBS === "true";
  return {
    notifications: allowed && env.DISABLE_NOTIFICATION_SCHEDULER !== "true",
    weather: allowed && env.DISABLE_WEATHER_BACKFILL !== "true",
  };
}

const BASE_ORIGINS = {
  local: ["http://localhost:5173", "http://127.0.0.1:5173"],
  staging: [],
  production: [
    "https://mychronically.app",
    "https://www.mychronically.app",
    "https://chronically-frontend.onrender.com",
  ],
};

/** CORS origins: this stage's defaults plus any in CORS_ORIGINS (comma-separated). */
function corsOrigins(env) {
  const stage = resolveStage(env) || "local";
  const extra = (env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return [...new Set([...BASE_ORIGINS[stage], ...extra])];
}

module.exports = { STAGES, resolveStage, databaseHost, isLocalDatabase, sslOptions, bootProblem, jobsToStart, corsOrigins };
