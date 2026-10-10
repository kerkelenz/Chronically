import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AppointmentsPage from "./AppointmentsPage";
import { exportDoctorReport } from "../utils/exportReport";

// ── a fake API: the appointment list, and what saving sends ────────────────
const api = vi.hoisted(() => ({ appointments: [], puts: [] }));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async (url) => {
      if (url.endsWith("/api/appointments")) return { data: { appointments: api.appointments } };
      if (url.endsWith("/api/doctors")) return { data: { doctors: [] } };
      return { data: {} };
    }),
    put: vi.fn(async (url, body) => { api.puts.push([url, body]); return { data: {} }; }),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "t", user: { id: 1, username: "Megan" }, logout: vi.fn() }),
}));
vi.mock("../utils/exportReport", () => ({ exportDoctorReport: vi.fn(async () => {}) }));

const NOW = new Date("2026-10-09T12:00:00"); // local time, in the pinned zone
const at = (s) => new Date(s).toISOString(); // local wall time → instant

const LEE_PAST = { id: 1, doctorName: "Dr. Lee", specialty: "Rheumatology", status: "completed", date: at("2026-08-30T10:00:00"), notesAfter: "Start the anti-inflammatory." };
const LEE_NEXT = { id: 2, doctorName: "dr.  LEE", specialty: "Rheumatology", status: "upcoming", date: at("2026-10-12T10:30:00"), notesBefore: "Ask about stiffness" };
const PATEL = { id: 3, doctorName: "Dr. Patel", specialty: "Primary Care", status: "upcoming", date: at("2026-10-20T09:00:00") };
const REYES = { id: 4, doctorName: "Dr. Reyes", status: "cancelled", date: at("2026-09-20T09:00:00") };

async function open() {
  render(<MemoryRouter><AppointmentsPage /></MemoryRouter>);
  await screen.findByRole("button", { name: "Summary for your visit with Dr. Patel" });
}
const lastOptions = () => exportDoctorReport.mock.calls.at(-1)[0].options;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.appointments = [LEE_PAST, LEE_NEXT, PATEL, REYES];
  api.puts = [];
  exportDoctorReport.mockClear();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("Summary for this visit", () => {
  it("since the last visit with the same doctor, through today", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Summary for your visit with dr. LEE" }));
    expect(lastOptions()).toEqual({
      from: "2026-08-30", to: "2026-10-09", heading: "Since your visit with dr.  LEE on Aug 30, 2026",
    });
  });

  it("a doctor never seen before: the last 90 days", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Summary for your visit with Dr. Patel" }));
    expect(lastOptions()).toEqual({
      from: "2026-07-12", to: "2026-10-09", heading: "Last 90 days · for your visit with Dr. Patel",
    });
  });

  it("a completed visit ends on its own day; a cancelled one has no summary", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Summary for your visit with Dr. Lee" }));
    expect(lastOptions()).toEqual({
      from: "2026-06-02", to: "2026-08-30", heading: "Last 90 days · for your visit with Dr. Lee",
    });
    expect(screen.queryByRole("button", { name: "Summary for your visit with Dr. Reyes" })).toBeNull();
  });

  it("the plain export is unchanged: the remembered choice, no heading", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /Export PDF Report/ }));
    expect(lastOptions()).toEqual({ from: "2026-09-09", to: "2026-10-09", sections: undefined });
  });
});

describe("saving how a visit went", () => {
  it("a completed visit keeps its status and gets no 'marks as done' line", async () => {
    // On the web the outcome sheet only opens on visits already completed (a
    // push tap, which opens it on an upcoming one, is phone-only); the
    // upcoming → completed path is covered in mobile/__tests__/apptRouting.test.jsx
    api.appointments = [{ ...PATEL, status: "completed", notesAfter: null }];
    render(<MemoryRouter><AppointmentsPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "Add visit notes for Dr. Patel" }));
    expect(screen.queryByText("Saving marks this visit as done.")).toBeNull(); // already completed
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(api.puts.at(-1)[1].status).toBe("completed");
  });
});
