import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import AppointmentsScreen from "../app/(tabs)/appointments";

// ── a fake API: the appointment list, and what saving sends ────────────────
const mockApi = { appointments: [], puts: [] };

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => {
      if (url === "/api/appointments") return { data: { appointments: mockApi.appointments } };
      if (url === "/api/doctors") return { data: { doctors: [] } };
      return { data: {} };
    }),
    put: jest.fn(async (url, body) => { mockApi.puts.push([url, body]); return { data: {} }; }),
    post: jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async () => ({ data: {} })),
  },
}));
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
const at = (s) => new Date(s).toISOString();

const LEE_PAST = { id: 1, doctorName: "Dr. Lee", specialty: "Rheumatology", status: "completed", date: at("2026-08-30T10:00:00"), notesAfter: "Start the anti-inflammatory." };
const LEE_NEXT = { id: 2, doctorName: "Dr. Lee", specialty: "Rheumatology", status: "upcoming", date: at("2026-10-12T10:30:00"), notesBefore: "Ask about stiffness" };
const REYES = { id: 4, doctorName: "Dr. Reyes", status: "cancelled", date: at("2026-10-20T09:00:00") };

beforeEach(() => {
  // fake only the clock; everything that schedules work stays real
  jest.useFakeTimers({
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "hrtime", "performance"],
  });
  jest.setSystemTime(NOW);
  mockApi.appointments = [LEE_PAST, LEE_NEXT, REYES];
  mockApi.puts = [];
  prepareDoctorReport.mockClear();
  router.setParams.mockClear();
  useLocalSearchParams.mockReturnValue({});
});
afterEach(() => jest.useRealTimers());

async function openWith(params) {
  useLocalSearchParams.mockReturnValue(params);
  render(<AppointmentsScreen />);
  await screen.findByRole("button", { name: "Export doctor report PDF" });
}
const cleared = () => expect(router.setParams).toHaveBeenCalledWith({ prepApptId: undefined, outcomeApptId: undefined });

describe("a tap on an appointment push", () => {
  test("the reminder opens that visit's prep sheet, and the param is cleared", async () => {
    await openWith({ prepApptId: "2" });
    expect(await screen.findByText("Prepare for this visit")).toBeTruthy();
    expect(screen.getByDisplayValue("Ask about stiffness")).toBeTruthy();
    cleared();
    expect(mockApi.puts).toEqual([]); // opening changes nothing
  });

  test("the follow-up opens the outcome sheet on an upcoming visit, without completing it", async () => {
    await openWith({ outcomeApptId: "2" });
    expect(await screen.findByText("How did it go?")).toBeTruthy();
    expect(screen.getByText("Saving marks this visit as done.")).toBeTruthy();
    cleared();
    fireEvent.press(screen.getByText("Skip"));
    expect(mockApi.puts).toEqual([]);
  });

  test("saving from it completes the visit, with the notes", async () => {
    await openWith({ outcomeApptId: "2" });
    fireEvent.changeText(await screen.findByLabelText("Visit notes"), "Stiffness is better.");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(mockApi.puts).toHaveLength(1));
    const [url, body] = mockApi.puts[0];
    expect(url).toBe("/api/appointments/2");
    expect(body.status).toBe("completed");
    expect(body.notesAfter).toBe("Stiffness is better.");
  });

  test("a deleted appointment just shows the tab", async () => {
    await openWith({ prepApptId: "999" });
    await waitFor(cleared);
    expect(screen.queryByText("Prepare for this visit")).toBeNull();
  });

  test("a cancelled appointment opens no sheet", async () => {
    await openWith({ outcomeApptId: "4" });
    await waitFor(cleared);
    expect(screen.queryByText("How did it go?")).toBeNull();
  });
});

describe("Summary for this visit", () => {
  test("since the last visit with that doctor, through today, under its own file name", async () => {
    await openWith({});
    // both Dr. Lee cards carry this name; upcoming visits are listed first
    fireEvent.press(screen.getAllByRole("button", { name: "Summary for your visit with Dr. Lee" })[0]);
    await waitFor(() => expect(prepareDoctorReport).toHaveBeenCalled());
    expect(prepareDoctorReport.mock.calls[0][0]).toEqual({
      username: "Megan",
      options: { from: "2026-08-30", to: "2026-10-09", heading: "Since your visit with Dr. Lee on Aug 30, 2026" },
      fileName: "Chronically-Visit-Summary-2026-10-09",
    });
  });

  test("cancelled visits have no summary action", async () => {
    await openWith({});
    expect(screen.queryByRole("button", { name: "Summary for your visit with Dr. Reyes" })).toBeNull();
  });
});
