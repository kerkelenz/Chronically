// Mocks every screen test needs. Each is the library's own published mock where
// one exists, so tests exercise the same contract the app does.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default);

// SVG draws natively (budget rings, background blobs, health icons). Every
// element it exports renders as a plain view, whichever ones a screen uses.
// The stub creates no element of its own: NativeWind rewrites createElement
// into a call jest.mock factories are not allowed to reach.
jest.mock("react-native-svg", () => {
  const Stub = ({ children }) => children ?? null;
  return new Proxy({ __esModule: true }, { get: (t, k) => (k in t ? t[k] : Stub) });
});

// the native date picker has no JS fallback to render
jest.mock("@react-native-community/datetimepicker", () => () => null);

// expo-router needs a running navigator. Screens only use these few hooks, so
// stand them in; tests read the calls off router to see where a press went.
jest.mock("expo-router", () => {
  const React = require("react");
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    // a focus effect runs like a mount effect when there is no navigator
    useFocusEffect: (cb) => React.useEffect(cb, [cb]),
    Link: ({ children }) => children,
    Stack: { Screen: () => null },
  };
});
