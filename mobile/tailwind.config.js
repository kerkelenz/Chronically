/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#7C6BAE",
        primaryDark: "#5C4E8A",
        primaryLight: "#9B8EC4",
        secondary: "#C4A8C0",
        energy: "#8FAF9B",
        anxiety: "#9BAFC4",
        appetite: "#C4A882",
        success: "#A9D8B4",
        error: "#B07088",
        "frosted-sm": "rgba(255,255,255,0.15)",
        "frosted-md": "rgba(255,255,255,0.18)",
        "frosted-lg": "rgba(255,255,255,0.25)",
        "frosted-border": "rgba(255,255,255,0.3)",
      },
    },
  },
  plugins: [],
};
