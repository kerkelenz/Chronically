// Formatting for the one quiet weather line shown on a check-in card.
//
// Paired file — must stay byte-identical with its twin:
//   mobile/theme/weatherFormat.js  <->  client/src/utils/weatherFormat.js
//
// Storage is always metric (°C, hPa); only the display converts. Units follow
// the device locale, because showing an American "1008 hPa" or a British
// "75°F" both read as someone else's app.

// The holdouts still on Fahrenheit for everyday temperature.
const FAHRENHEIT_REGIONS = ["US", "LR", "MM", "BS", "BZ", "KY", "PW", "FM", "MH"];

/** Best-effort region code from a BCP-47 locale, or null. */
function regionOf(locale) {
  if (!locale || typeof locale !== "string") return null;
  try {
    const r = new Intl.Locale(locale).region;
    if (r) return r.toUpperCase();
  } catch {
    // older runtimes without Intl.Locale fall through to the manual parse
  }
  const parts = locale.replace(/_/g, "-").split("-");
  const guess = parts.find((p) => /^[A-Za-z]{2}$/.test(p) && p === p.toUpperCase());
  return guess ? guess.toUpperCase() : null;
}

export function usesFahrenheit(locale) {
  return FAHRENHEIT_REGIONS.includes(regionOf(locale));
}

const cToF = (c) => (c * 9) / 5 + 32;
// 1 hPa = 0.02953 inHg
const hPaToInHg = (h) => h * 0.0295299830714;

/** "18°–24°C" / "64°–75°F", or null when the day has no temperatures. */
export function formatTempRange(minC, maxC, locale) {
  const hasMin = typeof minC === "number" && Number.isFinite(minC);
  const hasMax = typeof maxC === "number" && Number.isFinite(maxC);
  if (!hasMin && !hasMax) return null;

  const f = usesFahrenheit(locale);
  const unit = f ? "F" : "C";
  const conv = (c) => Math.round(f ? cToF(c) : c);

  if (hasMin && hasMax) return `${conv(minC)}°–${conv(maxC)}°${unit}`;
  return `${conv(hasMin ? minC : maxC)}°${unit}`;
}

/** "1008 hPa" / "29.77 inHg", or null when the day has no pressure. */
export function formatPressure(hPa, locale) {
  if (typeof hPa !== "number" || !Number.isFinite(hPa)) return null;
  return usesFahrenheit(locale)
    ? `${hPaToInHg(hPa).toFixed(2)} inHg`
    : `${Math.round(hPa)} hPa`;
}

/**
 * The whole line: "18°–24°C · 1008 hPa".
 * Returns null when there is nothing worth saying — the caller renders nothing
 * rather than an empty row.
 */
export function formatWeatherLine(weather, locale) {
  if (!weather) return null;
  const parts = [
    formatTempRange(weather.tempMinC, weather.tempMaxC, locale),
    formatPressure(weather.pressureHpa, locale),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The device locale, or undefined to let Intl decide. */
export function deviceLocale() {
  try {
    if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}
