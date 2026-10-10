import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library only unmounts between tests on its own when test globals are
// enabled; they are not, so imports stay explicit and this does it instead.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia. Components that respect reduced motion ask for it,
// so answer "no preference" rather than crash.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
