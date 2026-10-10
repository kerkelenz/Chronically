import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vitest reads this block; Vite ignores it. Tests run through the same
  // plugins as the app, so JSX and import.meta.env behave exactly as built.
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    // styles do not change behaviour, and loading them only slows the run
    css: false,
    // TZ pinned so a laptop and a UTC CI runner see the same dates. A negative
    // offset is the harder case: it is where date-only strings slip a day.
    env: { VITE_API_URL: "http://api.test", TZ: "America/Los_Angeles" },
    include: ["src/**/*.test.{js,jsx}"],
  },
});
