// Which API this build talks to. Each EAS profile sets it (eas.json):
//   development  → mobile/.env (your local server, by LAN address)
//   preview      → staging
//   production   → production
// A development build with no EXPO_PUBLIC_API_URL falls back to a local
// server, never to production — local work must not touch real users' data.
const PRODUCTION_API = "https://chronically-v1i8.onrender.com";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? "http://localhost:3001" : PRODUCTION_API);
