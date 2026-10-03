// The display formatter is a paired client file, but it is pure and worth
// testing, and this is where the project keeps its unit tests. Kept in sync
// with client/src/utils/weatherFormat.js <-> mobile/theme/weatherFormat.js.
const fs = require("fs");
const path = require("path");

// the paired file is an ES module; load it by transpiling the exports away
const SRC = path.join(__dirname, "../../client/src/utils/weatherFormat.js");
const code = fs.readFileSync(SRC, "utf8").replace(/^export /gm, "");
const sandbox = { Intl, module: { exports: {} } };
// eslint-disable-next-line no-new-func
const load = new Function(
  "Intl",
  `${code}; return { usesFahrenheit, formatTempRange, formatPressure, formatWeatherLine };`,
);
const { usesFahrenheit, formatTempRange, formatPressure, formatWeatherLine } = load(sandbox.Intl);

describe("paired file integrity", () => {
  test("client and mobile copies are byte-identical", () => {
    const a = fs.readFileSync(SRC);
    const b = fs.readFileSync(path.join(__dirname, "../../mobile/theme/weatherFormat.js"));
    expect(a.equals(b)).toBe(true);
  });
});

describe("usesFahrenheit", () => {
  test("US locales get Fahrenheit", () => {
    expect(usesFahrenheit("en-US")).toBe(true);
    expect(usesFahrenheit("es-US")).toBe(true);
  });
  test("everywhere else gets Celsius", () => {
    expect(usesFahrenheit("en-GB")).toBe(false);
    expect(usesFahrenheit("de-DE")).toBe(false);
    expect(usesFahrenheit("ja-JP")).toBe(false);
  });
  test("a bare language or junk falls back to Celsius", () => {
    expect(usesFahrenheit("en")).toBe(false);
    expect(usesFahrenheit("")).toBe(false);
    expect(usesFahrenheit(null)).toBe(false);
    expect(usesFahrenheit(undefined)).toBe(false);
  });
});

describe("formatTempRange", () => {
  test("metric locale", () => {
    expect(formatTempRange(17.6, 28.9, "en-GB")).toBe("18°–29°C");
  });
  test("US locale converts", () => {
    // 17.6C = 63.7F, 28.9C = 84.0F
    expect(formatTempRange(17.6, 28.9, "en-US")).toBe("64°–84°F");
  });
  test("one-sided days still render", () => {
    expect(formatTempRange(null, 21, "en-GB")).toBe("21°C");
    expect(formatTempRange(12, null, "en-GB")).toBe("12°C");
  });
  test("no data yields null, never an empty string", () => {
    expect(formatTempRange(null, null, "en-GB")).toBeNull();
    expect(formatTempRange(undefined, undefined, "en-US")).toBeNull();
  });
  test("freezing and negative temperatures read correctly", () => {
    expect(formatTempRange(-5, 0, "en-GB")).toBe("-5°–0°C");
    expect(formatTempRange(-5, 0, "en-US")).toBe("23°–32°F");
  });
});

describe("formatPressure", () => {
  test("metric locale shows whole hPa", () => {
    expect(formatPressure(1009.4, "en-GB")).toBe("1009 hPa");
  });
  test("US locale shows inHg to 2dp", () => {
    expect(formatPressure(1009.4, "en-US")).toBe("29.81 inHg");
  });
  test("missing pressure yields null", () => {
    expect(formatPressure(null, "en-GB")).toBeNull();
    expect(formatPressure(undefined, "en-US")).toBeNull();
  });
});

describe("formatWeatherLine", () => {
  const day = { tempMinC: 17.6, tempMaxC: 28.9, pressureHpa: 1009.4 };

  test("joins both halves with a middot", () => {
    expect(formatWeatherLine(day, "en-GB")).toBe("18°–29°C · 1009 hPa");
    expect(formatWeatherLine(day, "en-US")).toBe("64°–84°F · 29.81 inHg");
  });
  test("renders whichever half exists", () => {
    expect(formatWeatherLine({ ...day, pressureHpa: null }, "en-GB")).toBe("18°–29°C");
    expect(formatWeatherLine({ tempMinC: null, tempMaxC: null, pressureHpa: 1009.4 }, "en-GB"))
      .toBe("1009 hPa");
  });
  test("an empty day yields null so the caller renders nothing at all", () => {
    expect(formatWeatherLine(null, "en-GB")).toBeNull();
    expect(formatWeatherLine({ tempMinC: null, tempMaxC: null, pressureHpa: null }, "en-GB"))
      .toBeNull();
  });
});
