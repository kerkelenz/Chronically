import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportOptionsModal from "./ReportOptionsModal";
import { SECTION_KEYS } from "../utils/reportOptions";

const NOW = new Date("2026-10-09T12:00:00"); // local time, in the pinned zone
const KEY = "reportPrefs.v1";
const stored = () => JSON.parse(localStorage.getItem(KEY));

function open(onExport = vi.fn()) {
  render(<ReportOptionsModal open onClose={vi.fn()} onExport={onExport} />);
  return onExport;
}
const exportBtn = () => screen.getByRole("button", { name: "Export" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("Customize report", () => {
  it("opens on the default: last 30 days, every section", () => {
    open();
    expect(screen.getByRole("radio", { name: "Last 30 days" }).checked).toBe(true);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(17);
    expect(boxes.every((b) => b.checked)).toBe(true);
    expect(screen.getByText("Sep 9 – Oct 9, 2026 · 31 days")).toBeTruthy();
  });

  it("the default exports exactly like one tap: no sections list", async () => {
    const onExport = open();
    await userEvent.click(exportBtn());
    expect(onExport).toHaveBeenCalledWith({ from: "2026-09-09", to: "2026-10-09", sections: undefined });
  });

  it("a preset and two sections off reach export, and are remembered", async () => {
    const onExport = open();
    await userEvent.click(screen.getByRole("radio", { name: "Last 90 days" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Trend chart" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Skip reasons" }));
    expect(screen.getByText("Jul 11 – Oct 9, 2026 · 91 days")).toBeTruthy();
    await userEvent.click(exportBtn());
    const sections = SECTION_KEYS.filter((k) => k !== "trend" && k !== "skipReasons");
    expect(onExport).toHaveBeenCalledWith({ from: "2026-07-11", to: "2026-10-09", sections });
    expect(stored()).toEqual({ preset: "last90", sections });
  });

  it("opens on the remembered choice", () => {
    localStorage.setItem(KEY, JSON.stringify({ preset: "last90", sections: ["dailyLog", "bogus"] }));
    open();
    expect(screen.getByRole("radio", { name: "Last 90 days" }).checked).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Daily health log" }).checked).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Trend chart" }).checked).toBe(false);
  });

  it("since a date: needs the date, exports through today, and isn't remembered", async () => {
    localStorage.setItem(KEY, JSON.stringify({ preset: "last90", sections: SECTION_KEYS }));
    const onExport = open();
    await userEvent.click(screen.getByRole("radio", { name: "Since a date…" }));
    expect(exportBtn().disabled).toBe(true);
    expect(screen.getByText("Choose a start date.")).toBeTruthy();
    const from = screen.getByLabelText("From");
    expect(from.min).toBe("2025-10-09");
    expect(from.max).toBe("2026-10-09");
    fireEvent.change(from, { target: { value: "2026-03-04" } });
    expect(screen.getByText("Mar 4 – Oct 9, 2026 · 220 days")).toBeTruthy();
    await userEvent.click(exportBtn());
    expect(onExport).toHaveBeenCalledWith({ from: "2026-03-04", to: "2026-10-09", sections: undefined });
    // the preset stays what it was; the date is never saved
    expect(stored()).toEqual({ preset: "last90", sections: SECTION_KEYS });
  });

  it("custom dates: from and to", async () => {
    const onExport = open();
    await userEvent.click(screen.getByRole("radio", { name: "Custom dates…" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-31" } });
    expect(screen.getByLabelText("To").min).toBe("2026-01-01");
    await userEvent.click(exportBtn());
    expect(onExport).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-01-31", sections: undefined });
  });

  it("no section chosen: export is disabled and says why", async () => {
    const onExport = open();
    for (const box of screen.getAllByRole("checkbox")) {
      if (box.checked && box.getAttribute("aria-disabled") !== "true") await userEvent.click(box);
    }
    // weather and notes go quiet once the daily log is off, still ticked
    expect(screen.getByText("Choose at least one section.")).toBeTruthy();
    expect(exportBtn().disabled).toBe(true);
    expect(onExport).not.toHaveBeenCalled();
  });

  it("weather and notes are disabled without the daily health log", async () => {
    open();
    await userEvent.click(screen.getByRole("checkbox", { name: "Daily health log" }));
    const weather = screen.getByRole("checkbox", { name: "Weather in daily log" });
    expect(weather.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Your notes" }).getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(weather);
    expect(weather.checked).toBe(true); // unchanged
  });

  it("reset to default", async () => {
    const onExport = open();
    await userEvent.click(screen.getByRole("radio", { name: "Last 90 days" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Averages" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByRole("radio", { name: "Last 30 days" }).checked).toBe(true);
    await userEvent.click(exportBtn());
    expect(onExport).toHaveBeenCalledWith({ from: "2026-09-09", to: "2026-10-09", sections: undefined });
  });
});
