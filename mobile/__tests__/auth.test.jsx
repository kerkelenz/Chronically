import { render, screen, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import LoginScreen from "../app/(auth)/login";
import RegisterScreen from "../app/(auth)/register";
import ForgotPasswordScreen from "../app/(auth)/forgot-password";

jest.mock("../lib/api", () => ({ __esModule: true, default: { post: jest.fn(async () => ({ data: {} })) } }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ login: jest.fn(), register: jest.fn() }) }));
jest.mock("../lib/openLink", () => ({ openLink: jest.fn() }));
// decoration with animation or images; not what these tests are about
jest.mock("../components/FloatingPetals", () => () => null);
jest.mock("../components/BrandWordmark", () => () => null);

beforeEach(() => jest.clearAllMocks());

describe("every field announces its name", () => {
  it.each([
    ["login", ["Email", "Password"], LoginScreen],
    ["register", ["Username", "Email", "Password", "Confirm password"], RegisterScreen],
    ["forgot password", ["Email"], ForgotPasswordScreen],
  ])("%s", (_, names, Screen) => {
    render(<Screen />);
    for (const name of names) {
      // the label TalkBack and VoiceOver read, not the placeholder
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
  });
});

describe("text links are announced as links, are big enough to hit, and go somewhere", () => {
  it.each([
    ["login", "Forgot password?", "push", "/(auth)/forgot-password", LoginScreen],
    ["login", "Create account", "push", "/(auth)/register", LoginScreen],
    ["register", "Already have an account? Sign in", "replace", "/(auth)/login", RegisterScreen],
    ["forgot password", "Back to Sign In", "back", undefined, ForgotPasswordScreen],
  ])("%s: “%s”", (_, text, method, target, Screen) => {
    render(<Screen />);
    // the role makes TalkBack/VoiceOver say "link"; without it, just the words
    const link = screen.getByRole("link", { name: text });
    // 14px text is about 20pt tall: the slop has to make up the rest of 44pt
    const slop = link.props.hitSlop || {};
    expect(20 + (slop.top || 0) + (slop.bottom || 0)).toBeGreaterThanOrEqual(44);

    fireEvent.press(link);
    if (target) expect(router[method]).toHaveBeenCalledWith(target);
    else expect(router[method]).toHaveBeenCalled();
  });
});
