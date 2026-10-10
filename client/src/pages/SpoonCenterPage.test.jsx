import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SpoonCenterPage from "./SpoonCenterPage";

// ── a fake API that behaves like the real one where it matters ──────────────
const api = vi.hoisted(() => ({
  days: {},       // date -> { day, entries }
  weekDays: [],
  failPut: false,
  calls: [],
  nextId: 100,
}));

vi.mock("axios", () => {
  const dayFor = (date) => {
    if (!api.days[date]) api.days[date] = { day: { id: api.nextId++, date, budget: 12, budgetEdited: false }, entries: [] };
    return api.days[date];
  };
  const byId = (id) => Object.values(api.days).find((d) => String(d.day.id) === String(id));
  return {
    default: {
      get: vi.fn(async (url) => {
        api.calls.push(["GET", url]);
        if (url.includes("/activities")) return { data: { activities: [] } };
        if (url.includes("/spoons/day?")) {
          const d = dayFor(decodeURIComponent(url.split("date=")[1]));
          return { data: { day: d.day, entries: d.entries, baseline: 12 } };
        }
        if (url.includes("/spoons/week")) return { data: { days: api.weekDays } };
        if (url.includes("/spoons/month")) return { data: { days: [] } };
        return { data: {} };
      }),
      put: vi.fn(async (url, body) => {
        api.calls.push(["PUT", url, body]);
        if (url.endsWith("/reflection")) {
          if (api.failPut) throw new Error("network down");
          const d = byId(url.split("/day/")[1].split("/")[0]);
          // the server's own rule: null clears the note; no note key keeps it
          if (body.reflection === null) Object.assign(d.day, { reflection: null, reflectionNote: null });
          else if ("reflectionNote" in body) Object.assign(d.day, body);
          else d.day.reflection = body.reflection;
          return { data: { day: { ...d.day } } };
        }
        if (url.includes("/entries/")) {
          const id = Number(url.split("/entries/")[1]);
          for (const d of Object.values(api.days)) {
            const e = d.entries.find((x) => x.id === id);
            if (e) { Object.assign(e, body); return { data: { entry: { ...e } } }; }
          }
        }
        return { data: {} };
      }),
      post: vi.fn(async (url, body) => { api.calls.push(["POST", url, body]); return { data: {} }; }),
      delete: vi.fn(async (url) => { api.calls.push(["DELETE", url]); return { data: {} }; }),
    },
  };
});
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ token: "t", user: { id: 1, username: "Megan" }, logout: vi.fn() }) }));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));

const TODAY = "2026-10-09"; // a Friday
const YESTERDAY = "2026-10-08";
const SHOWER = { id: 1, name: "Shower", cost: 2, completed: false, position: 0 };
const writes = () => api.calls.filter(([m]) => m !== "GET");

function seed(date, day = {}, entries = [SHOWER]) {
  api.days[date] = {
    day: { id: date === TODAY ? 7 : api.nextId++, date, budget: 12, budgetEdited: false, ...day },
    entries: entries.map((e) => ({ ...e })),
  };
}

async function open(at) {
  vi.setSystemTime(new Date(at)); // local time, in the pinned zone
  const user = userEvent.setup();
  render(<MemoryRouter><SpoonCenterPage /></MemoryRouter>);
  // the page has loaded once the week strip shows this week
  await screen.findByText("Oct 4 – 10");
  return user;
}
const cell = (date) =>
  screen.getByRole("button", {
    name: new RegExp("^" + new Date(date + "T12:00:00").toLocaleDateString("en-US",
      { weekday: "long", month: "long", day: "numeric", year: "numeric" })),
  });
const pill = (name) => screen.getByRole("radio", { name });
const checked = () => screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true").map((r) => r.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); // only the clock; timers stay real
  Object.assign(api, { days: {}, weekDays: [], failPut: false, calls: [], nextId: 100 });
  try { localStorage.clear(); } catch { /* not available */ }
});
afterEach(() => vi.useRealTimers());

// ── when the card is offered ────────────────────────────────────────────────
describe("the end-of-day reflection is offered", () => {
  it("not in the morning: nobody can say yet how the day went", async () => {
    seed(TODAY);
    await open("2026-10-09T09:00:00");
    await screen.findByText("Shower");
    expect(screen.queryByText("How did today actually go?")).toBeNull();
  });

  it("from 17:00 today, with three unchosen answers", async () => {
    seed(TODAY);
    await open("2026-10-09T18:00:00");
    const group = await screen.findByRole("radiogroup", { name: "How did today actually go?" });
    expect(screen.getByText("One tap is enough. Only you see this.")).toBeTruthy();
    expect(within(group).getAllByRole("radio").map((r) => r.textContent))
      .toEqual(["Lighter than planned", "About right", "Heavier than planned"]);
    expect(checked()).toEqual([]);
    expect(screen.queryByText("Add a note")).toBeNull();
  });

  it("in the morning too, once already answered", async () => {
    seed(TODAY, { reflection: "about_right" });
    await open("2026-10-09T09:00:00");
    await screen.findByRole("radiogroup");
    expect(checked()).toEqual(["About right"]);
    expect(screen.getByText("Add a note")).toBeTruthy();
  });

  it("for a past day only if something was planned", async () => {
    seed(TODAY);
    seed(YESTERDAY, {}, []);
    const user = await open("2026-10-09T18:00:00");
    await user.click(cell(YESTERDAY));
    await screen.findByText("Yesterday");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("for a past day with a plan, worded for that day", async () => {
    seed(TODAY);
    seed(YESTERDAY);
    const user = await open("2026-10-09T09:00:00");
    await user.click(cell(YESTERDAY));
    expect(await screen.findByRole("radiogroup", { name: "How did this day actually go?" })).toBeTruthy();
  });

  it("never for a future day, even with a plan, even in the evening", async () => {
    seed(TODAY);
    seed("2026-10-10");
    const user = await open("2026-10-09T20:00:00");
    await user.click(cell("2026-10-10"));
    await screen.findByText("Tomorrow");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

// ── answering ───────────────────────────────────────────────────────────────
describe("answering", () => {
  it("saves one tap as the answer alone, so an existing note survives", async () => {
    seed(TODAY);
    const user = await open("2026-10-09T20:00:00");
    await screen.findByRole("radiogroup");

    await user.click(pill("Heavier than planned"));
    await waitFor(() => expect(checked()).toEqual(["Heavier than planned"]));
    expect(writes()).toEqual([["PUT", "http://api.test/api/spoons/day/7/reflection", { reflection: "heavier" }]]);

    await user.click(pill("Heavier than planned"));
    expect(writes()).toHaveLength(1); // the same answer again sends nothing

    await user.click(pill("About right"));
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[1][2]).toEqual({ reflection: "about_right" });
  });

  it("puts the old answer back, quietly, when saving fails", async () => {
    seed(TODAY, { reflection: "lighter" });
    api.failPut = true;
    const user = await open("2026-10-09T20:00:00");
    await screen.findByRole("radiogroup");
    vi.spyOn(console, "error").mockImplementation(() => {});

    await user.click(pill("Heavier than planned"));
    const line = await screen.findByText(/Couldn.t save that/);
    expect(checked()).toEqual(["Lighter than planned"]);
    expect(line.style.color).toMatch(/#dec8da|rgb\(222, 200, 218\)/i); // never red
  });

  it("saves a note trimmed, alongside the answer", async () => {
    seed(TODAY, { reflection: "heavier" });
    const user = await open("2026-10-09T20:00:00");
    await user.click(await screen.findByText("Add a note"));

    expect(screen.getByText("A note about this day")).toBeTruthy();
    const box = screen.getByLabelText("Note (optional)");
    expect(box.getAttribute("maxlength")).toBe("280");
    await user.type(box, "  Walked too far.  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Walked too far.");
    expect(writes().at(-1)[2]).toEqual({ reflection: "heavier", reflectionNote: "Walked too far." });
    expect(screen.getByText("Edit note")).toBeTruthy();
  });

  it("stores an emptied note as nothing, not a blank", async () => {
    seed(TODAY, { reflection: "heavier", reflectionNote: "Old words." });
    const user = await open("2026-10-09T20:00:00");
    await user.click(await screen.findByText("Edit note"));
    const box = screen.getByLabelText("Note (optional)");
    expect(box.value).toBe("Old words.");
    await user.clear(box);
    await user.type(box, "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes().at(-1)[2]).toEqual({ reflection: "heavier", reflectionNote: null }));
    expect(await screen.findByText("Add a note")).toBeTruthy();
  });

  it("shows the counter only near the limit", async () => {
    seed(TODAY, { reflection: "about_right" });
    const user = await open("2026-10-09T20:00:00");
    await user.click(await screen.findByText("Add a note"));
    const box = screen.getByLabelText("Note (optional)");
    box.focus();
    await user.paste("a".repeat(239));
    expect(screen.queryByText("239/280")).toBeNull();
    await user.paste("a");
    expect(screen.getByText("240/280")).toBeTruthy();
  });

  it("asks before clearing an answer that has a note, and Keep keeps it", async () => {
    seed(TODAY, { reflection: "heavier", reflectionNote: "Something I wrote." });
    const user = await open("2026-10-09T20:00:00");
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(screen.getByText("Clear this reflection?")).toBeTruthy();
    expect(screen.getByText("Your note for this day will be removed too.")).toBeTruthy();
    expect(writes()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(writes()).toEqual([]);
    expect(screen.getByText("Something I wrote.")).toBeTruthy();
    // the dialog stays mounted through its exit animation; let it finish
    await waitFor(() => expect(screen.queryByText("Clear this reflection?")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Clear" }));
    const buttons = screen.getAllByRole("button", { name: "Clear" });
    await user.click(buttons.at(-1)); // the dialog's
    await waitFor(() => expect(writes().at(-1)[2]).toEqual({ reflection: null }));
    await waitFor(() => expect(screen.queryByText("Something I wrote.")).toBeNull());
    expect(checked()).toEqual([]);
  });

  it("clears at once when there is no note to lose", async () => {
    seed(TODAY, { reflection: "lighter" });
    const user = await open("2026-10-09T20:00:00");
    await user.click(await screen.findByRole("button", { name: "Clear" }));
    expect(screen.queryByText("Clear this reflection?")).toBeNull();
    await waitFor(() => expect(writes().at(-1)[2]).toEqual({ reflection: null }));
  });
});

// ── the week strip ──────────────────────────────────────────────────────────
describe("the week strip", () => {
  it("names every day with what was planned and how it felt", async () => {
    seed(TODAY);
    api.weekDays = [
      { date: "2026-10-04", budget: 12, spent: 6, planned: 3, completed: 3, reflection: "lighter", hasNote: false },
      { date: "2026-10-05", budget: 12, spent: 14, planned: 5, completed: 4, reflection: "heavier", hasNote: true },
      { date: "2026-10-07", budget: 12, spent: 1, planned: 1, completed: 0, reflection: null, hasNote: false },
    ];
    await open("2026-10-09T20:00:00");
    await waitFor(() => expect(cell("2026-10-04").getAttribute("aria-label"))
      .toBe("Sunday, October 4, 2026: 6 of 12 spoons used. You noted it felt lighter than planned"));
    // an unplanned day says so — never "0 of 12"
    expect(cell("2026-10-06").getAttribute("aria-label")).toBe("Tuesday, October 6, 2026: nothing planned");
    expect(cell("2026-10-07").getAttribute("aria-label")).toBe("Wednesday, October 7, 2026: 1 of 12 spoons used");
    expect(screen.getByText("Reflected")).toBeTruthy();
  });

  it("pages by week without writing anything", async () => {
    seed(TODAY);
    const user = await open("2026-10-09T20:00:00");
    expect(screen.queryByText("This week")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next week" }));
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText("Oct 18 – 24")).toBeTruthy();
    await user.click(screen.getByText("This week"));
    expect(await screen.findByText("Oct 4 – 10")).toBeTruthy();

    for (let i = 0; i < 5; i++) await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(await screen.findByText("Aug 30 – Sep 5")).toBeTruthy();
    expect(writes()).toEqual([]); // browsing must never create days
  });

  it("labels weeks that cross a month and a year", async () => {
    seed(TODAY);
    const user = await open("2026-10-09T20:00:00");
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(await screen.findByText("Sep 27 – Oct 3")).toBeTruthy();
    for (let i = 0; i < 13; i++) await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText("Dec 27, 2026 – Jan 2, 2027")).toBeTruthy();
  });

  it("follows the day stepper across a week boundary", async () => {
    seed(TODAY);
    const user = await open("2026-10-09T20:00:00");
    await user.click(screen.getByRole("button", { name: "Next day" })); // Saturday
    expect(screen.getByText("Oct 4 – 10")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next day" })); // Sunday
    expect(await screen.findByText("Oct 11 – 17")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(await screen.findByText("Oct 4 – 10")).toBeTruthy();
  });

  it("defaults to Week, switches to Month, and keeps the viewed day", async () => {
    seed(TODAY);
    seed(YESTERDAY);
    const user = await open("2026-10-09T20:00:00");
    const week = screen.getByRole("button", { name: "Week" });
    expect(week.getAttribute("aria-pressed")).toBe("true");

    await user.click(cell(YESTERDAY));
    await screen.findByText("Yesterday");
    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(await screen.findByText("October 2026")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(await screen.findByText("Oct 4 – 10")).toBeTruthy();
  });

  it("shows the right label when collapsed", async () => {
    seed(TODAY);
    const user = await open("2026-10-09T20:00:00");
    await user.click(screen.getByRole("button", { name: "Collapse calendar" }));
    expect(screen.getByText("Oct 4 – 10")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Week" })).toBeNull();
  });
});

// ── the day's plan, as assistive tech sees it ───────────────────────────────
describe("the day's plan", () => {
  it("is a list of checkboxes named by the activity", async () => {
    seed(TODAY);
    const user = await open("2026-10-09T10:00:00");
    const box = await screen.findByRole("checkbox", { name: "Shower" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    await user.click(box);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Shower" }).getAttribute("aria-checked")).toBe("true"));
    expect(writes()).toEqual([["PUT", "http://api.test/api/spoons/entries/1", { completed: true }]]);
  });

  it("names the remove button after what it removes", async () => {
    seed(TODAY);
    await open("2026-10-09T10:00:00");
    expect(await screen.findByRole("button", { name: "Remove Shower" })).toBeTruthy();
  });
});
