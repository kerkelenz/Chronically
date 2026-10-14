import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import SpoonCenterScreen from "../app/(tabs)/spoons";

// ── a fake API that behaves like the real one where it matters ──────────────
const mockApi = { days: {}, weekDays: [], failPut: false, calls: [], nextId: 100 };

jest.mock("../lib/api", () => {
  const dayFor = (date) => {
    if (!mockApi.days[date]) {
      mockApi.days[date] = { day: { id: mockApi.nextId++, date, budget: 12, budgetEdited: false }, entries: [] };
    }
    return mockApi.days[date];
  };
  const byId = (id) => Object.values(mockApi.days).find((d) => String(d.day.id) === String(id));
  return {
    __esModule: true,
    default: {
      get: jest.fn(async (url) => {
        mockApi.calls.push(["GET", url]);
        if (url.includes("/activities")) return { data: { activities: [] } };
        if (url.includes("/spoons/day?")) {
          const d = dayFor(decodeURIComponent(url.split("date=")[1]));
          return { data: { day: d.day, entries: d.entries, baseline: 12 } };
        }
        if (url.includes("/spoons/week")) return { data: { days: mockApi.weekDays } };
        if (url.includes("/spoons/month")) return { data: { days: [] } };
        return { data: {} };
      }),
      put: jest.fn(async (url, body) => {
        mockApi.calls.push(["PUT", url, body]);
        if (url.endsWith("/reflection")) {
          if (mockApi.failPut) throw new Error("network down");
          const d = byId(url.split("/day/")[1].split("/")[0]);
          if (body.reflection === null) Object.assign(d.day, { reflection: null, reflectionNote: null });
          else if ("reflectionNote" in body) Object.assign(d.day, body);
          else d.day.reflection = body.reflection;
          return { data: { day: { ...d.day } } };
        }
        if (url.includes("/entries/")) {
          const id = Number(url.split("/entries/")[1]);
          for (const d of Object.values(mockApi.days)) {
            const e = d.entries.find((x) => x.id === id);
            if (e) { Object.assign(e, body); return { data: { entry: { ...e } } }; }
          }
        }
        return { data: {} };
      }),
      post: jest.fn(async (url, body) => { mockApi.calls.push(["POST", url, body]); return { data: {} }; }),
      delete: jest.fn(async (url) => { mockApi.calls.push(["DELETE", url]); return { data: {} }; }),
    },
  };
});
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));
// react-native-svg is stood in by the shared setup

const TODAY = "2026-10-09"; // a Friday
const YESTERDAY = "2026-10-08";
const SHOWER = { id: 1, name: "Shower", cost: 2, completed: false, position: 0 };
const writes = () => mockApi.calls.filter(([m]) => m !== "GET");

function seed(date, day = {}, entries = [SHOWER]) {
  mockApi.days[date] = {
    day: { id: date === TODAY ? 7 : mockApi.nextId++, date, budget: 12, budgetEdited: false, ...day },
    entries: entries.map((e) => ({ ...e })),
  };
}

async function open(at) {
  jest.setSystemTime(new Date(at)); // local time, in the pinned zone
  render(<SpoonCenterScreen />);
  await screen.findByText("Oct 4 – 10");
}
const fullDate = (date) => new Date(date + "T12:00:00").toLocaleDateString("en-US",
  { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const cell = (date) => screen.getByLabelText(new RegExp("^" + fullDate(date)));
const pill = (name) => screen.getByRole("radio", { name });
const checked = () => screen.getAllByRole("radio")
  .filter((r) => r.props.accessibilityState?.checked)
  .map((r) => within(r).getByText(/./).props.children);
const press = (el) => fireEvent.press(el);

beforeEach(() => {
  // only the clock: faking timers too would stall animations and waitFor
  jest.useFakeTimers({
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "hrtime", "performance"],
  });
  Object.assign(mockApi, { days: {}, weekDays: [], failPut: false, calls: [], nextId: 100 });
});
afterEach(() => jest.useRealTimers());

// ── when the card is offered ────────────────────────────────────────────────
describe("the end-of-day reflection is offered", () => {
  it("not in the morning", async () => {
    seed(TODAY);
    await open("2026-10-09T09:00:00");
    // the entry reads "Shower · 2": the cost is a nested Text
    await screen.findByText(/^Shower/);
    expect(screen.queryByText("How did today actually go?")).toBeNull();
  });

  it("from 17:00 today, with three unchosen answers", async () => {
    seed(TODAY);
    await open("2026-10-09T18:00:00");
    await screen.findByText("How did today actually go?");
    expect(screen.getByText("One tap is enough. Only you see this.")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(checked()).toEqual([]);
    expect(screen.queryByText("Add a note")).toBeNull();
  });

  it("in the morning too, once already answered", async () => {
    seed(TODAY, { reflection: "about_right" });
    await open("2026-10-09T09:00:00");
    await screen.findByText("How did today actually go?");
    expect(checked()).toEqual(["About right"]);
    expect(screen.getByText("Add a note")).toBeTruthy();
  });

  it("for a past day only if something was planned", async () => {
    seed(TODAY);
    seed(YESTERDAY, {}, []);
    await open("2026-10-09T18:00:00");
    press(cell(YESTERDAY));
    await screen.findByText("Yesterday");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("for a past day with a plan, worded for that day", async () => {
    seed(TODAY);
    seed(YESTERDAY);
    await open("2026-10-09T09:00:00");
    press(cell(YESTERDAY));
    expect(await screen.findByText("How did this day actually go?")).toBeTruthy();
  });

  it("never for a future day", async () => {
    seed(TODAY);
    seed("2026-10-10");
    await open("2026-10-09T20:00:00");
    press(cell("2026-10-10"));
    await screen.findByText("Tomorrow");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});

// ── answering ───────────────────────────────────────────────────────────────
describe("answering", () => {
  it("saves one tap as the answer alone, so an existing note survives", async () => {
    seed(TODAY);
    await open("2026-10-09T20:00:00");
    await screen.findByText("How did today actually go?");

    press(pill("Heavier than planned"));
    await waitFor(() => expect(checked()).toEqual(["Heavier than planned"]));
    expect(writes()).toEqual([["PUT", "/api/spoons/day/7/reflection", { reflection: "heavier" }]]);

    press(pill("Heavier than planned"));
    expect(writes()).toHaveLength(1);

    press(pill("About right"));
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[1][2]).toEqual({ reflection: "about_right" });
  });

  it("puts the old answer back, quietly, when saving fails", async () => {
    seed(TODAY, { reflection: "lighter" });
    mockApi.failPut = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    await open("2026-10-09T20:00:00");
    await screen.findByText("How did today actually go?");

    press(pill("Heavier than planned"));
    const line = await screen.findByText(/Couldn.t save that/);
    expect(checked()).toEqual(["Lighter than planned"]);
    const color = [].concat(line.props.style).filter(Boolean).map((s) => s.color).filter(Boolean).pop();
    expect(color).toBe("#DEC8DA"); // never red
  });

  it("saves a note trimmed, alongside the answer", async () => {
    seed(TODAY, { reflection: "heavier" });
    await open("2026-10-09T20:00:00");
    press(await screen.findByText("Add a note"));

    expect(await screen.findByText("A note about this day")).toBeTruthy();
    const box = screen.getByLabelText("Note (optional)");
    expect(box.props.maxLength).toBe(280);
    fireEvent.changeText(box, "  Walked too far.  ");
    press(screen.getByText("Save"));

    await screen.findByText("Walked too far.");
    expect(writes().at(-1)[2]).toEqual({ reflection: "heavier", reflectionNote: "Walked too far." });
    expect(screen.getByText("Edit note")).toBeTruthy();
  });

  it("stores an emptied note as nothing, not a blank", async () => {
    seed(TODAY, { reflection: "heavier", reflectionNote: "Old words." });
    await open("2026-10-09T20:00:00");
    press(await screen.findByText("Edit note"));
    const box = await screen.findByLabelText("Note (optional)");
    expect(box.props.value).toBe("Old words.");
    fireEvent.changeText(box, "   ");
    press(screen.getByText("Save"));
    await waitFor(() => expect(writes().at(-1)[2]).toEqual({ reflection: "heavier", reflectionNote: null }));
  });

  it("shows the counter only near the limit", async () => {
    seed(TODAY, { reflection: "about_right" });
    await open("2026-10-09T20:00:00");
    press(await screen.findByText("Add a note"));
    const box = await screen.findByLabelText("Note (optional)");
    fireEvent.changeText(box, "a".repeat(239));
    expect(screen.queryByText("239/280")).toBeNull();
    fireEvent.changeText(box, "a".repeat(240));
    expect(screen.getByText("240/280")).toBeTruthy();
  });

  it("asks before clearing an answer that has a note, and Keep keeps it", async () => {
    seed(TODAY, { reflection: "heavier", reflectionNote: "Something I wrote." });
    await open("2026-10-09T20:00:00");
    press(await screen.findByText("Clear"));

    expect(await screen.findByText("Clear this reflection?")).toBeTruthy();
    expect(screen.getByText("Your note for this day will be removed too.")).toBeTruthy();
    expect(writes()).toEqual([]);
    press(screen.getByText("Keep"));
    expect(writes()).toEqual([]);
    await waitFor(() => expect(screen.queryByText("Clear this reflection?")).toBeNull());
    expect(screen.getByText("Something I wrote.")).toBeTruthy();

    press(screen.getByText("Clear"));
    await screen.findByText("Clear this reflection?");
    const clears = screen.getAllByText("Clear");
    press(clears[clears.length - 1]); // the dialog's
    await waitFor(() => expect(writes().at(-1)[2]).toEqual({ reflection: null }));
    await waitFor(() => expect(screen.queryByText("Something I wrote.")).toBeNull());
  });

  it("clears at once when there is no note to lose", async () => {
    seed(TODAY, { reflection: "lighter" });
    await open("2026-10-09T20:00:00");
    press(await screen.findByText("Clear"));
    expect(screen.queryByText("Clear this reflection?")).toBeNull();
    await waitFor(() => expect(writes().at(-1)[2]).toEqual({ reflection: null }));
  });
});

// ── the week strip ──────────────────────────────────────────────────────────
describe("the week strip", () => {
  it("names every day with what was planned and how it felt", async () => {
    seed(TODAY);
    mockApi.weekDays = [
      { date: "2026-10-04", budget: 12, spent: 6, planned: 3, completed: 3, reflection: "lighter", hasNote: false },
      { date: "2026-10-07", budget: 12, spent: 1, planned: 1, completed: 0, reflection: null, hasNote: false },
    ];
    await open("2026-10-09T20:00:00");
    await waitFor(() => expect(cell("2026-10-04").props.accessibilityLabel)
      .toBe("Sunday, October 4, 2026: 6 of 12 spoons used. You noted it felt lighter than planned"));
    expect(cell("2026-10-06").props.accessibilityLabel).toBe("Tuesday, October 6, 2026: nothing planned");
    expect(cell("2026-10-07").props.accessibilityLabel).toBe("Wednesday, October 7, 2026: 1 of 12 spoons used");
  });

  it("pages by week without writing anything", async () => {
    seed(TODAY);
    await open("2026-10-09T20:00:00");
    expect(screen.queryByText("This week")).toBeNull();
    press(screen.getByLabelText("Next week"));
    press(screen.getByLabelText("Next week"));
    expect(await screen.findByText("Oct 18 – 24")).toBeTruthy();
    press(screen.getByText("This week"));
    expect(await screen.findByText("Oct 4 – 10")).toBeTruthy();
    for (let i = 0; i < 5; i++) press(screen.getByLabelText("Previous week"));
    expect(await screen.findByText("Aug 30 – Sep 5")).toBeTruthy();
    expect(writes()).toEqual([]);
  });

  it("labels weeks that cross a month and a year", async () => {
    seed(TODAY);
    await open("2026-10-09T20:00:00");
    press(screen.getByLabelText("Previous week"));
    expect(await screen.findByText("Sep 27 – Oct 3")).toBeTruthy();
    for (let i = 0; i < 13; i++) press(screen.getByLabelText("Next week"));
    expect(await screen.findByText("Dec 27, 2026 – Jan 2, 2027")).toBeTruthy();
  });

  it("follows the day stepper across a week boundary", async () => {
    seed(TODAY);
    await open("2026-10-09T20:00:00");
    press(screen.getByLabelText("Next day"));
    press(screen.getByLabelText("Next day"));
    expect(await screen.findByText("Oct 11 – 17")).toBeTruthy();
  });

  it("defaults to Week, switches to Month, and keeps the viewed day", async () => {
    seed(TODAY);
    seed(YESTERDAY);
    await open("2026-10-09T20:00:00");
    expect(screen.getByRole("button", { name: "Week" }).props.accessibilityState.selected).toBe(true);
    press(cell(YESTERDAY));
    await screen.findByText("Yesterday");
    press(screen.getByRole("button", { name: "Month" }));
    expect(await screen.findByText("October 2026")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
  });
});

// ── the day's plan, as TalkBack and VoiceOver hear it ───────────────────────
describe("the day's plan", () => {
  it("is a list of checkboxes named by the activity", async () => {
    seed(TODAY);
    await open("2026-10-09T10:00:00");
    const box = await screen.findByRole("checkbox", { name: "Shower" });
    expect(box.props.accessibilityState.checked).toBe(false);
    press(box);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Shower" }).props.accessibilityState.checked).toBe(true));
    expect(writes()).toEqual([["PUT", "/api/spoons/entries/1", { completed: true }]]);
  });

  it("names the remove button after what it removes", async () => {
    seed(TODAY);
    await open("2026-10-09T10:00:00");
    expect(await screen.findByLabelText("Remove Shower")).toBeTruthy();
  });
});
