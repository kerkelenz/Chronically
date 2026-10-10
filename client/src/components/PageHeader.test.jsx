import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PageHeader from "./PageHeader";

// NavHamburger reads the signed-in user; the header does not care who it is
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { username: "Megan", isAdmin: false }, logout: vi.fn() }),
}));

const renderHeader = (props) =>
  render(
    <MemoryRouter>
      <PageHeader {...props} />
    </MemoryRouter>,
  );

describe("PageHeader", () => {
  it("leads with the brand mark, which links home", () => {
    renderHeader({ title: "Trends" });
    const home = screen.getByRole("link", { name: "Chronically home" });
    expect(home.getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("heading", { level: 1, name: "Trends" })).toBeTruthy();
  });

  it("drops the mark when a page opts out", () => {
    renderHeader({ leading: null });
    expect(screen.queryByRole("link", { name: "Chronically home" })).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("puts a page's own leading element where the mark would be", () => {
    renderHeader({
      title: "From Chronicle",
      leading: <button aria-label="Back to profile">‹</button>,
    });
    expect(screen.getByRole("button", { name: "Back to profile" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Chronically home" })).toBeNull();
  });

  it("shows a subtitle under the title", () => {
    renderHeader({ title: "Good morning, Megan", subtitle: "Ready to check in?" });
    const heading = screen.getByRole("heading", { name: "Good morning, Megan" });
    expect(heading.nextElementSibling.textContent).toBe("Ready to check in?");
  });

  it("places actions before the menu button, in order", () => {
    renderHeader({
      title: "Appointments",
      actions: (
        <>
          <button>My doctors</button>
          <button>Add</button>
        </>
      ),
    });
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") || b.textContent);
    expect(names).toEqual(["My doctors", "Add", "Open menu"]);
  });

  it("owns the spacing, so pages cannot drift", () => {
    const { container } = renderHeader({ title: "Medications", actions: <button>Add</button> });
    const row = container.firstElementChild;
    expect(row.className).toBe("px-6 py-4 flex justify-between items-center");
    expect(row.firstElementChild.className).toBe("flex items-center gap-2.5");
    expect(row.lastElementChild.className).toBe("flex items-center gap-3");
  });
});

describe("the menu button", () => {
  it("has a name, and says whether it is open", async () => {
    const user = userEvent.setup();
    renderHeader({ title: "Trends" });
    const menu = screen.getByRole("button", { name: "Open menu" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");

    await user.click(menu);
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close.getAttribute("aria-expanded")).toBe("true");
    // the menu itself is now on screen
    expect(within(document.body).getByRole("link", { name: /Spoon Center/ })).toBeTruthy();
  });
});
