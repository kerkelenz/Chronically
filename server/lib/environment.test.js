const E = require("./environment");

const LOCAL_DB = "postgres://chronically:chronically@localhost:5433/chronically";
const REMOTE_DB = "postgres://u:p@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
const base = { JWT_SECRET: "x" };

describe("resolveStage", () => {
  test("APP_ENV wins, case-insensitively", () => {
    expect(E.resolveStage({ APP_ENV: "Staging", NODE_ENV: "production" })).toBe("staging");
  });
  test("an unknown APP_ENV is null, never a guess", () => {
    expect(E.resolveStage({ APP_ENV: "prod" })).toBeNull();
  });
  test("without APP_ENV: NODE_ENV=production is production, anything else is local", () => {
    expect(E.resolveStage({ NODE_ENV: "production" })).toBe("production");
    expect(E.resolveStage({ NODE_ENV: "development" })).toBe("local");
    expect(E.resolveStage({})).toBe("local");
  });
});

describe("isLocalDatabase", () => {
  test("localhost and the compose service names are local", () => {
    expect(E.isLocalDatabase(LOCAL_DB)).toBe(true);
    expect(E.isLocalDatabase("postgres://a:b@127.0.0.1/x")).toBe(true);
    expect(E.isLocalDatabase("postgres://a:b@postgres:5432/x")).toBe(true);
  });
  test("Supabase is remote; junk is neither", () => {
    expect(E.isLocalDatabase(REMOTE_DB)).toBe(false);
    expect(E.isLocalDatabase("not a url")).toBe(false);
    expect(E.isLocalDatabase(undefined)).toBe(false);
  });
});

describe("sslOptions", () => {
  test("remote databases get SSL, local ones don't", () => {
    expect(E.sslOptions({ DATABASE_URL: REMOTE_DB })).toEqual({ require: true, rejectUnauthorized: false });
    expect(E.sslOptions({ DATABASE_URL: LOCAL_DB })).toBe(false);
  });
  test("a CA certificate turns on verification", () => {
    expect(E.sslOptions({ DATABASE_URL: REMOTE_DB, DB_CA_CERT: "PEM" }))
      .toEqual({ require: true, rejectUnauthorized: true, ca: "PEM" });
  });
  test("DB_SSL forces either way", () => {
    expect(E.sslOptions({ DATABASE_URL: LOCAL_DB, DB_SSL: "true" })).toEqual({ require: true, rejectUnauthorized: false });
    expect(E.sslOptions({ DATABASE_URL: REMOTE_DB, DB_SSL: "false" })).toBe(false);
  });
});

describe("bootProblem", () => {
  test("a local server on the local database boots", () => {
    expect(E.bootProblem({ ...base, DATABASE_URL: LOCAL_DB })).toBeNull();
  });
  test("a local server refuses a remote database — the production one included", () => {
    expect(E.bootProblem({ ...base, NODE_ENV: "development", DATABASE_URL: REMOTE_DB })).toMatch(/remote database/);
  });
  test("…unless ALLOW_REMOTE_DB=true is set on purpose", () => {
    expect(E.bootProblem({ ...base, DATABASE_URL: REMOTE_DB, ALLOW_REMOTE_DB: "true" })).toBeNull();
  });
  test("staging and production must not point at a local database", () => {
    expect(E.bootProblem({ ...base, APP_ENV: "staging", DATABASE_URL: LOCAL_DB })).toMatch(/local database/);
    expect(E.bootProblem({ ...base, APP_ENV: "production", DATABASE_URL: REMOTE_DB, RESEND_API_KEY: "k" })).toBeNull();
  });
  test("production refuses to run without real email; staging and local may", () => {
    expect(E.bootProblem({ ...base, APP_ENV: "production", DATABASE_URL: REMOTE_DB })).toMatch(/RESEND_API_KEY/);
    expect(E.bootProblem({ ...base, APP_ENV: "staging", DATABASE_URL: REMOTE_DB })).toBeNull();
  });
  test("missing or broken essentials are named", () => {
    expect(E.bootProblem({ DATABASE_URL: LOCAL_DB })).toMatch(/JWT_SECRET/);
    expect(E.bootProblem({ ...base })).toMatch(/DATABASE_URL is not set/);
    expect(E.bootProblem({ ...base, DATABASE_URL: "nope" })).toMatch(/can't be parsed/);
    expect(E.bootProblem({ ...base, APP_ENV: "prod", DATABASE_URL: REMOTE_DB })).toMatch(/APP_ENV/);
  });
});

describe("jobsToStart", () => {
  test("off locally by default — a dev server never sends a real push", () => {
    expect(E.jobsToStart({})).toEqual({ notifications: false, weather: false });
  });
  test("on locally only when asked", () => {
    expect(E.jobsToStart({ ENABLE_JOBS: "true" })).toEqual({ notifications: true, weather: true });
  });
  test("on in staging and production, each with its own kill switch", () => {
    expect(E.jobsToStart({ APP_ENV: "staging" })).toEqual({ notifications: true, weather: true });
    expect(E.jobsToStart({ APP_ENV: "production", DISABLE_NOTIFICATION_SCHEDULER: "true" }))
      .toEqual({ notifications: false, weather: true });
    expect(E.jobsToStart({ APP_ENV: "production", DISABLE_WEATHER_BACKFILL: "true" }))
      .toEqual({ notifications: true, weather: false });
  });
});

describe("corsOrigins", () => {
  test("production keeps today's origins", () => {
    expect(E.corsOrigins({ APP_ENV: "production" })).toEqual([
      "https://mychronically.app",
      "https://www.mychronically.app",
      "https://chronically-frontend.onrender.com",
    ]);
  });
  test("staging allows only what it's given; trailing slashes and blanks are tidied", () => {
    expect(E.corsOrigins({ APP_ENV: "staging", CORS_ORIGINS: " https://staging.example/ , ,https://b.example" }))
      .toEqual(["https://staging.example", "https://b.example"]);
  });
  test("local allows the Vite dev server", () => {
    expect(E.corsOrigins({})).toContain("http://localhost:5173");
  });
  test("production never picks up localhost", () => {
    expect(E.corsOrigins({ APP_ENV: "production" }).some((o) => o.includes("localhost"))).toBe(false);
  });
});
