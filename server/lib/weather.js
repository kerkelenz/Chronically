// Weather capture against Open-Meteo (free, keyless, CORS-open).
//
// The free tier is licensed non-commercial. That is fine while weather is a
// free feature; if it ever moves behind premium it becomes a paid-plan
// question, not a technical one.
//
// Everything here except `fetchJson` / `fetchWeatherForDay` / `searchPlaces` is
// pure and unit-tested in weather.test.js — URL building, endpoint choice,
// response parsing and coordinate rounding are where the bugs hide.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// pressure_msl_mean is available as a *daily* field on both the forecast and
// archive endpoints (verified against the live API), so there is no need to
// pull hourly pressure_msl and average it ourselves.
const DAILY_FIELDS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "pressure_msl_mean",
  "relative_humidity_2m_mean",
  "precipitation_sum",
  "weather_code",
].join(",");

// The reanalysis archive lags real time by several days, so recent dates come
// from the forecast endpoint's past_days window instead. 10 days clears the lag
// comfortably and is far wider than the 7-day backfill ever reaches back.
const ARCHIVE_CUTOFF_DAYS = 10;
const MAX_PAST_DAYS = 92; // forecast endpoint's own ceiling

// Coordinates are stored at city resolution on purpose — ~1km, enough for
// weather, not enough to place anyone.
const roundCoord = (n) => Math.round(Number(n) * 100) / 100;

const dayDiff = (aStr, bStr) => {
  // noon avoids any DST edge rolling the difference to the wrong integer
  const a = new Date(`${aStr}T12:00:00Z`).getTime();
  const b = new Date(`${bStr}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
};

/** "forecast" for recent dates, "archive" for older ones. */
function pickEndpoint(dateStr, todayStr) {
  return dayDiff(dateStr, todayStr) > ARCHIVE_CUTOFF_DAYS ? "archive" : "forecast";
}

/** The exact Open-Meteo URL for one day at one place. */
function buildWeatherUrl(lat, lon, dateStr, todayStr) {
  const kind = pickEndpoint(dateStr, todayStr);
  const p = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    daily: DAILY_FIELDS,
    timezone: "auto",
  });
  if (kind === "archive") {
    p.set("start_date", dateStr);
    p.set("end_date", dateStr);
    return `${ARCHIVE_URL}?${p.toString()}`;
  }
  // past_days covers back-dated requests; forecast_days=1 keeps the payload to
  // today rather than pulling a week of future we never use
  const back = Math.min(Math.max(dayDiff(dateStr, todayStr), 0), MAX_PAST_DAYS);
  p.set("past_days", String(back));
  p.set("forecast_days", "1");
  return `${FORECAST_URL}?${p.toString()}`;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Pull one date's row out of an Open-Meteo daily response.
 * Returns null when the response has no entry for that date — a partial
 * response is not worth half a row.
 */
function parseDailyResponse(json, dateStr) {
  const d = json?.daily;
  if (!d || !Array.isArray(d.time)) return null;
  const i = d.time.indexOf(dateStr);
  if (i === -1) return null;

  const at = (key) => (Array.isArray(d[key]) ? num(d[key][i]) : null);
  const row = {
    tempMaxC: at("temperature_2m_max"),
    tempMinC: at("temperature_2m_min"),
    pressureHpa: at("pressure_msl_mean"),
    humidityPct: at("relative_humidity_2m_mean"),
    precipitationMm: at("precipitation_sum"),
    weatherCode: at("weather_code"),
  };
  // every field null means the provider had nothing for that date
  if (Object.values(row).every((v) => v === null)) return null;
  return row;
}

/** Normalise a geocoding hit into the shape the clients render. */
function normalizePlace(r) {
  return {
    name: r.name,
    admin1: r.admin1 || null,
    country: r.country || null,
    latitude: roundCoord(r.latitude),
    longitude: roundCoord(r.longitude),
  };
}

/** "Torrance, California, United States" — what gets stored as the display name. */
function placeLabel(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

// ── Network ─────────────────────────────────────────────────────────────────

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Candidate places for a typed query. Never throws on "no match". */
async function searchPlaces(query, count = 5) {
  const p = new URLSearchParams({
    name: query, count: String(count), language: "en", format: "json",
  });
  const json = await fetchJson(`${GEOCODE_URL}?${p.toString()}`);
  // a no-match response omits `results` entirely rather than returning []
  return Array.isArray(json?.results) ? json.results.map(normalizePlace) : [];
}

/** One day's weather, or null if the provider had nothing. */
async function fetchWeatherForDay(lat, lon, dateStr, todayStr = new Date().toLocaleDateString("en-CA")) {
  const json = await fetchJson(buildWeatherUrl(lat, lon, dateStr, todayStr));
  return parseDailyResponse(json, dateStr);
}

module.exports = {
  FORECAST_URL, ARCHIVE_URL, GEOCODE_URL, DAILY_FIELDS, ARCHIVE_CUTOFF_DAYS,
  roundCoord, dayDiff, pickEndpoint, buildWeatherUrl, parseDailyResponse,
  normalizePlace, placeLabel,
  searchPlaces, fetchWeatherForDay,
};
