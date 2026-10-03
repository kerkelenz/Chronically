const {
  roundCoord, dayDiff, pickEndpoint, buildWeatherUrl, parseDailyResponse,
  normalizePlace, placeLabel, ARCHIVE_CUTOFF_DAYS,
} = require("./weather");

describe("roundCoord", () => {
  test("rounds to 2 decimals so stored coordinates stay city-grained", () => {
    expect(roundCoord(33.846655)).toBe(33.85);
    expect(roundCoord(-118.341515)).toBe(-118.34);
    expect(roundCoord(0)).toBe(0);
  });

  test("a rounded coordinate is at most ~1.1km from the original", () => {
    // 0.005 deg of latitude is ~555m; the worst case is half a step in each axis
    const lat = 51.507351;
    expect(Math.abs(roundCoord(lat) - lat)).toBeLessThanOrEqual(0.005);
  });
});

describe("dayDiff", () => {
  test("counts whole days between dates", () => {
    expect(dayDiff("2026-10-01", "2026-10-03")).toBe(2);
    expect(dayDiff("2026-10-03", "2026-10-03")).toBe(0);
    expect(dayDiff("2026-10-05", "2026-10-03")).toBe(-2);
  });

  test("is unaffected by a DST boundary", () => {
    // US DST ends 2026-11-01
    expect(dayDiff("2026-10-31", "2026-11-02")).toBe(2);
  });

  test("spans month and year ends", () => {
    expect(dayDiff("2026-12-30", "2027-01-02")).toBe(3);
  });
});

describe("pickEndpoint", () => {
  const today = "2026-10-03";

  test("today and recent dates use the forecast endpoint", () => {
    expect(pickEndpoint("2026-10-03", today)).toBe("forecast");
    expect(pickEndpoint("2026-09-28", today)).toBe("forecast");
  });

  test("the whole 7-day backfill window stays on forecast", () => {
    for (let i = 0; i <= 7; i++) {
      const d = new Date("2026-10-03T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      expect(pickEndpoint(d.toISOString().slice(0, 10), today)).toBe("forecast");
    }
  });

  test("dates past the archive lag use the archive endpoint", () => {
    expect(pickEndpoint("2026-09-20", today)).toBe("archive");
  });

  test("the cutoff itself is still forecast, one day past it is archive", () => {
    const d = new Date("2026-10-03T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - ARCHIVE_CUTOFF_DAYS);
    expect(pickEndpoint(d.toISOString().slice(0, 10), today)).toBe("forecast");
    d.setUTCDate(d.getUTCDate() - 1);
    expect(pickEndpoint(d.toISOString().slice(0, 10), today)).toBe("archive");
  });
});

describe("buildWeatherUrl", () => {
  const today = "2026-10-03";

  test("recent dates hit the forecast host with past_days", () => {
    const url = buildWeatherUrl(33.84665, -118.341515, "2026-10-01", today);
    expect(url).toContain("https://api.open-meteo.com/v1/forecast");
    expect(url).toContain("past_days=2");
    expect(url).toContain("forecast_days=1");
    expect(url).not.toContain("start_date");
  });

  test("old dates hit the archive host with an explicit range", () => {
    const url = buildWeatherUrl(33.84665, -118.341515, "2026-09-01", today);
    expect(url).toContain("https://archive-api.open-meteo.com/v1/archive");
    expect(url).toContain("start_date=2026-09-01");
    expect(url).toContain("end_date=2026-09-01");
    expect(url).not.toContain("past_days");
  });

  test("coordinates are rounded in the request, not just in storage", () => {
    const url = buildWeatherUrl(33.846655, -118.341515, today, today);
    expect(url).toContain("latitude=33.85");
    expect(url).toContain("longitude=-118.34");
  });

  test("asks for daily mean pressure, not hourly", () => {
    const url = buildWeatherUrl(1, 1, today, today);
    expect(decodeURIComponent(url)).toContain("pressure_msl_mean");
    expect(url).not.toContain("hourly");
  });

  test("a future date clamps past_days to 0 rather than going negative", () => {
    const url = buildWeatherUrl(1, 1, "2026-10-05", today);
    expect(url).toContain("past_days=0");
  });
});

describe("parseDailyResponse", () => {
  const sample = {
    daily: {
      time: ["2026-09-30", "2026-10-01", "2026-10-02"],
      temperature_2m_max: [28.7, 24.4, 28.9],
      temperature_2m_min: [17.5, 19.4, 17.6],
      pressure_msl_mean: [1008.6, 1010.3, 1010.1],
      relative_humidity_2m_mean: [81, 88, 78],
      precipitation_sum: [0, 0, 0.2],
      weather_code: [45, 3, 3],
    },
  };

  test("picks the row matching the requested date", () => {
    expect(parseDailyResponse(sample, "2026-10-01")).toEqual({
      tempMaxC: 24.4, tempMinC: 19.4, pressureHpa: 1010.3,
      humidityPct: 88, precipitationMm: 0, weatherCode: 3,
    });
  });

  test("returns null when the date isn't in the response", () => {
    expect(parseDailyResponse(sample, "2026-08-01")).toBeNull();
  });

  test("returns null for a malformed or empty payload", () => {
    expect(parseDailyResponse(null, "2026-10-01")).toBeNull();
    expect(parseDailyResponse({}, "2026-10-01")).toBeNull();
    expect(parseDailyResponse({ daily: {} }, "2026-10-01")).toBeNull();
  });

  test("an all-null day yields null rather than a row of nulls", () => {
    const blank = {
      daily: {
        time: ["2026-10-01"],
        temperature_2m_max: [null], temperature_2m_min: [null],
        pressure_msl_mean: [null], relative_humidity_2m_mean: [null],
        precipitation_sum: [null], weather_code: [null],
      },
    };
    expect(parseDailyResponse(blank, "2026-10-01")).toBeNull();
  });

  test("a partially-null day keeps the fields it has", () => {
    const partial = {
      daily: {
        time: ["2026-10-01"],
        temperature_2m_max: [21.0], temperature_2m_min: [null],
        pressure_msl_mean: [1011.2], relative_humidity_2m_mean: [null],
        precipitation_sum: [null], weather_code: [null],
      },
    };
    expect(parseDailyResponse(partial, "2026-10-01")).toEqual({
      tempMaxC: 21.0, tempMinC: null, pressureHpa: 1011.2,
      humidityPct: null, precipitationMm: null, weatherCode: null,
    });
  });

  test("non-numeric junk is treated as missing", () => {
    const junk = {
      daily: {
        time: ["2026-10-01"],
        temperature_2m_max: ["warm"], temperature_2m_min: [NaN],
        pressure_msl_mean: [1011.2], relative_humidity_2m_mean: [undefined],
        precipitation_sum: [null], weather_code: [null],
      },
    };
    expect(parseDailyResponse(junk, "2026-10-01")).toEqual({
      tempMaxC: null, tempMinC: null, pressureHpa: 1011.2,
      humidityPct: null, precipitationMm: null, weatherCode: null,
    });
  });
});

describe("place helpers", () => {
  test("normalizePlace keeps only what the picker needs, rounded", () => {
    expect(normalizePlace({
      id: 5403022, name: "Torrance", latitude: 33.83585, longitude: -118.34063,
      admin1: "California", country: "United States", population: 143592,
    })).toEqual({
      name: "Torrance", admin1: "California", country: "United States",
      latitude: 33.84, longitude: -118.34,
    });
  });

  test("missing admin1/country become null rather than undefined", () => {
    const p = normalizePlace({ name: "Somewhere", latitude: 1, longitude: 2 });
    expect(p.admin1).toBeNull();
    expect(p.country).toBeNull();
  });

  test("placeLabel joins what's present and skips what isn't", () => {
    expect(placeLabel({ name: "Torrance", admin1: "California", country: "United States" }))
      .toBe("Torrance, California, United States");
    expect(placeLabel({ name: "Singapore", admin1: null, country: "Singapore" }))
      .toBe("Singapore, Singapore");
    expect(placeLabel({ name: "Nowhere", admin1: null, country: null })).toBe("Nowhere");
  });
});
