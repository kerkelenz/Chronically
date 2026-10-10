import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";

const sentry = vi.hoisted(() => ({ setUser: vi.fn() }));
const analytics = vi.hoisted(() => ({ setAnalyticsToken: vi.fn(), trackSession: vi.fn() }));
vi.mock("@sentry/react", () => sentry);
vi.mock("../lib/analytics", () => analytics);

const DAY = 24 * 60 * 60 * 1000;
const MEGAN = { id: 7, username: "Megan", email: "megan@example.test" };

// a consumer that exposes the context, the way every page reads it. It reports
// the value from an effect: writing outside the component during render is a
// side effect React's rules forbid, test code included.
let auth;
function Probe() {
  const value = useAuth();
  useEffect(() => {
    auth = value;
  });
  return <p>{value?.user ? `signed in as ${value.user.username}` : "signed out"}</p>;
}
const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth = undefined;
});

describe("AuthProvider", () => {
  it("hands every consumer the same context, and finishes loading", () => {
    mount();
    expect(Object.keys(auth).sort()).toEqual(["loading", "login", "logout", "token", "updateUser", "user"]);
    expect(auth.loading).toBe(false);
    expect(screen.getByText("signed out")).toBeTruthy();
  });

  it("logging in reaches the page, storage, and analytics", () => {
    mount();
    act(() => auth.login(MEGAN, "tok-123"));
    expect(screen.getByText("signed in as Megan")).toBeTruthy();
    expect(auth.token).toBe("tok-123");
    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(MEGAN);
    expect(analytics.setAnalyticsToken).toHaveBeenCalledWith("tok-123");
    expect(analytics.trackSession).toHaveBeenCalledTimes(1);
  });

  it("tells crash reporting the numeric id and nothing else", () => {
    mount();
    act(() => auth.login(MEGAN, "tok-123"));
    // no email, no username: error reports must not identify a person
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 7 });
  });

  it("logging out clears the page, storage, and analytics", () => {
    mount();
    act(() => auth.login(MEGAN, "tok-123"));
    act(() => auth.logout());
    expect(screen.getByText("signed out")).toBeTruthy();
    expect(auth.token).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(analytics.setAnalyticsToken).toHaveBeenLastCalledWith(null);
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);
  });

  it("restores a recent session on load", () => {
    localStorage.setItem("token", "saved");
    localStorage.setItem("user", JSON.stringify(MEGAN));
    localStorage.setItem("lastActive", String(Date.now() - 2 * DAY));
    mount();
    expect(screen.getByText("signed in as Megan")).toBeTruthy();
    expect(auth.token).toBe("saved");
  });

  it("drops a session idle for more than fourteen days", () => {
    localStorage.setItem("token", "stale");
    localStorage.setItem("user", JSON.stringify(MEGAN));
    localStorage.setItem("lastActive", String(Date.now() - 15 * DAY));
    mount();
    expect(screen.getByText("signed out")).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
    expect(analytics.trackSession).not.toHaveBeenCalled();
  });
});

describe("useAuth outside a provider", () => {
  it("returns undefined rather than throwing", () => {
    render(<Probe />);
    expect(auth).toBeUndefined();
    expect(screen.getByText("signed out")).toBeTruthy();
  });
});
