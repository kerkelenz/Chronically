import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppointmentsScreen from "../app/(tabs)/appointments";
import { SECTION_KEYS } from "../theme/reportOptions";

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => {
      if (url === "/api/appointments") return { data: { appointments: [] } };
      return { data: {} };
    }),
    put: jest.fn(async () => ({ data: {} })),
    post: jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async () => ({ data: {} })),
  },
}));
// the fetch → compute → print pipeline is covered by its own pure parts; here
// we only care what the screen asks it for
jest.mock("../lib/exportReport", () => ({
  prepareDoctorReport: jest.fn(async () => ({ shareUri: "file:///report.pdf" })),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, username: "Megan" } }) }));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));

const { prepareDoctorReport } = require("../lib/exportReport");

const NOW = new Date("2026-10-09T12:00:00"); // local time, in the pinned zone
const KEY = "report_prefs_v1";
const lastOptions = () => prepareDoctorReport.mock.calls.at(-1)[0].options;

beforeEach(() => {
  // fake only the clock; everything that schedules work stays real
  jest.useFakeTimers({
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "hrtime", "performance"],
  });
  jest.setSystemTime(NOW);
  prepareDoctorReport.mockClear();
});
afterEach(() => jest.useRealTimers());

async function open() {
  render(<AppointmentsScreen />);
  return screen.findByRole("button", { name: "Export doctor report PDF" });
}
const exportBtn = () => screen.getByText("Export");
const checked = (role, name) => screen.getByRole(role, { name }).props.accessibilityState.checked;

describe("doctor report: one tap", () => {
  test("nothing remembered → the default report", async () => {
    fireEvent.press(await open());
    await waitFor(() => expect(prepareDoctorReport).toHaveBeenCalled());
    expect(prepareDoctorReport.mock.calls[0][0].username).toBe("Megan");
    expect(lastOptions()).toEqual({ from: "2026-09-09", to: "2026-10-09", sections: undefined });
  });

  test("the remembered choice, and the card says what it is", async () => {
    const sections = SECTION_KEYS.filter((k) => k !== "weather" && k !== "patterns");
    await AsyncStorage.setItem(KEY, JSON.stringify({ preset: "last90", sections }));
    const btn = await open();
    expect(await screen.findByText("Last 90 days · 2 sections off")).toBeTruthy();
    fireEvent.press(btn);
    await waitFor(() => expect(prepareDoctorReport).toHaveBeenCalled());
    expect(lastOptions()).toEqual({ from: "2026-07-11", to: "2026-10-09", sections });
  });
});

describe("doctor report: Customize", () => {
  test("radio and checkbox choices reach the export, and are remembered", async () => {
    await open();
    fireEvent.press(screen.getByRole("button", { name: "Customize doctor report" }));
    expect(await screen.findByText("Customize report")).toBeTruthy();
    expect(checked("radio", "Last 30 days")).toBe(true);
    expect(screen.getAllByRole("checkbox")).toHaveLength(17);

    fireEvent.press(screen.getByRole("radio", { name: "Last 90 days" }));
    expect(checked("radio", "Last 90 days")).toBe(true);
    expect(checked("radio", "Last 30 days")).toBe(false);
    fireEvent.press(screen.getByRole("checkbox", { name: "Observed patterns" }));
    expect(checked("checkbox", "Observed patterns")).toBe(false);
    expect(screen.getByText("Jul 11 – Oct 9, 2026 · 91 days")).toBeTruthy();

    fireEvent.press(exportBtn());
    await waitFor(() => expect(prepareDoctorReport).toHaveBeenCalled());
    const sections = SECTION_KEYS.filter((k) => k !== "patterns");
    expect(lastOptions()).toEqual({ from: "2026-07-11", to: "2026-10-09", sections });
    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual({ preset: "last90", sections });
    expect(await screen.findByText("Last 90 days · 1 section off")).toBeTruthy();
  });

  test("since a date needs its date before Export works", async () => {
    await open();
    fireEvent.press(screen.getByRole("button", { name: "Customize doctor report" }));
    fireEvent.press(await screen.findByRole("radio", { name: "Since a date…" }));
    expect(screen.getByText("Choose a start date.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "From, not set" })).toBeTruthy();
    fireEvent.press(exportBtn());
    expect(prepareDoctorReport).not.toHaveBeenCalled();
  });

  test("weather and notes report disabled without the daily health log", async () => {
    await open();
    fireEvent.press(screen.getByRole("button", { name: "Customize doctor report" }));
    fireEvent.press(await screen.findByRole("checkbox", { name: "Daily health log" }));
    const weather = screen.getByRole("checkbox", { name: "Weather in daily log" });
    expect(weather.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(screen.getByRole("checkbox", { name: "Your notes" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(weather);
    expect(checked("checkbox", "Weather in daily log")).toBe(true); // unchanged
  });
});
