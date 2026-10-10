import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";

vi.mock("axios", () => ({ default: { post: vi.fn(async () => ({ data: {} })), get: vi.fn() } }));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: null, login: vi.fn() }) }));

// render a page at its route, with a stand-in for wherever its links lead
function renderAt(path, element) {
  let where = null;
  function Where() {
    where = useLocation().pathname;
    return null;
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path={path.split("?")[0]} element={element} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { where: () => where };
}

describe("the front door is reachable by keyboard", () => {
  // These links were <span onClick>, which a keyboard cannot reach at all.
  it.each([
    ["/login", "Sign up", "/register", <LoginPage key="l" />],
    ["/login", "Forgot your password?", "/forgot-password", <LoginPage key="l" />],
    ["/register", "Log in", "/login", <RegisterPage key="r" />],
    ["/forgot-password", "Log in", "/login", <ForgotPasswordPage key="f" />],
  ])("%s: tab to “%s”, press Enter, arrive at %s", async (path, linkName, target, page) => {
    const user = userEvent.setup();
    const nav = renderAt(path, page);
    const link = screen.getByRole("link", { name: linkName });

    // tab through the page until the link has focus, as a keyboard user would
    for (let i = 0; i < 20 && document.activeElement !== link; i++) await user.tab();
    expect(document.activeElement).toBe(link);

    await user.keyboard("{Enter}");
    expect(nav.where()).toBe(target);
  });
});

describe("every field announces its name", () => {
  it.each([
    ["/login", <LoginPage key="l" />, ["Email", "Password"]],
    ["/register", <RegisterPage key="r" />, ["Username", "Email", "Password"]],
    ["/forgot-password", <ForgotPasswordPage key="f" />, ["Email"]],
    ["/reset-password?token=t", <ResetPasswordPage key="p" />, ["New password", "Confirm new password"]],
  ])("%s", async (path, page, names) => {
    renderAt(path, page);
    for (const name of names) {
      // resolves the accessible name the way assistive tech does; awaited
      // because the reset page checks its link with the server first
      expect(await screen.findByLabelText(name)).toBeTruthy();
    }
    // and nothing on the page is a field without one
    const fields = document.querySelectorAll("input:not([type=hidden]):not([aria-hidden=true]), select, textarea");
    expect(fields.length).toBe(names.length);
  });
});
