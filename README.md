# Chronically

A calm, private health-tracking app for people living with chronic illness — track symptoms, energy, medications, and appointments, and walk into doctor visits prepared.

Chronically turns the daily reality of managing a chronic condition into something gentle: quick check-ins, honest tracking, and clear reports, with no ads, no third-party trackers, and no judgment. It ships as a web app, an iOS/Android mobile app, and a shared REST API — all in this monorepo.

**Live:** [mychronically.app](https://mychronically.app)

---

## Features

- **Daily check-ins** — log energy, pain, mood, anxiety, and appetite in under a minute, plus symptoms and notes. Gentle streaks encourage showing up without guilting rest days.
- **Spoon Center** — plan the day around available energy using spoon theory, with pinnable routines, a copy-yesterday shortcut, and a 7-day history view.
- **Medications** — a Today checklist (grouped morning/afternoon/evening, plus an as-needed lane) and a Medicine Cabinet with human-readable schedules, 7-day adherence dots, and five scheduling patterns (daily, specific weekdays, every N days, monthly, as-needed).
- **Appointments** — a lightweight visit lifecycle: prep notes, mark-completed prompts, outcome capture, and follow-up chaining.
- **Doctor reports** — export a shareable PDF summary of recent metrics, symptoms, and medication adherence to bring to a visit.
- **Trends** — see how symptoms, medications, mood, and energy move together over time.
- **Private by design** — first-party usage events only (no third-party analytics), data stays on the project's own servers, and full account + data deletion is available in-app.

---

## Architecture

A single monorepo with three deployables sharing one backend and database:

```
chronically/
├── server/   Express + Sequelize REST API (PostgreSQL)
├── client/   React + Vite web app  ->  mychronically.app
└── mobile/   Expo / React Native app (iOS + Android)
```

- **server** exposes a JSON REST API with JWT auth; `client` and `mobile` are independent front ends that both consume it.
- Medication scheduling logic is shared as a byte-identical helper between web (`client/src/utils/medicationHelpers.js`) and mobile (`mobile/theme/medications.js`) so both platforms compute schedules and adherence identically.

### Tech stack

| Layer  | Stack                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| API    | Node.js, Express, Sequelize, PostgreSQL, JWT (`jsonwebtoken`), `bcrypt`, `helmet`, `express-rate-limit`, Resend (transactional email) |
| Web    | React, Vite, React Router, Tailwind CSS, Axios, Recharts                                                                              |
| Mobile | Expo (SDK 54), React Native, Expo Router, `expo-secure-store`, `react-native-svg`                                                     |

---

## Getting started

### Prerequisites

- Node.js 18+ and npm
- A PostgreSQL database (local, or a hosted one such as Supabase)
- For mobile: the [Expo](https://docs.expo.dev/get-started/set-up-your-environment/) toolchain (and Xcode / Android Studio for native builds)

### 1. Backend — `server/`

```bash
cd server
npm install
cp .env.example .env   # then fill in the values below
npm run dev            # starts on PORT (default 5000) with nodemon
```

`.env`:

| Variable         | Purpose                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string                                                       |
| `JWT_SECRET`     | Secret for signing auth tokens (required — the server won't boot without it)       |
| `PORT`           | API port (default `5000`)                                                          |
| `NODE_ENV`       | `development` locally; `production` in deployment                                  |
| `FRONTEND_URL`   | Web app origin, for CORS                                                           |
| `RESEND_API_KEY` | Resend key for verification / password-reset email                                 |
| `DB_CA_CERT`     | _(optional)_ PEM CA cert for full DB TLS verification                              |
| `DB_SYNC_ALTER`  | _(optional)_ set `true` for one boot to apply schema changes via Sequelize `alter` |

> Schema note: in production the server runs a plain `sequelize.sync()` (creates missing tables only). Applying column/enum changes requires booting once with `DB_SYNC_ALTER=true`, then removing it.

### 2. Web — `client/`

```bash
cd client
npm install
echo "VITE_API_URL=http://localhost:5000" > .env   # point at your API
npm run dev            # Vite dev server
npm run build          # production build -> dist/
```

### 3. Mobile — `mobile/`

```bash
cd mobile
npm install
# set EXPO_PUBLIC_API_URL to your API base URL (e.g. in .env or app config)
npx expo start         # then press i (iOS), a (Android), or scan with Expo Go
```

The mobile app reads its API base URL from `EXPO_PUBLIC_API_URL`.

---

## Project structure

```
server/
  models/          Sequelize models (User, CheckIn, Medication, MedicationLog,
                   Appointment, SpoonActivity, SpoonDay, SpoonEntry, Event)
  controllers/     Route handlers
  routes/          Express routers
  middleware/      Auth, etc.
  config/          DB connection
client/
  src/
    pages/         Route-level screens (Dashboard, Medications, Appointments, ...)
    components/    Reusable UI (icons, wordmark, modals, charts)
    utils/         Report generation, medication schedule helpers
    context/       Auth context
mobile/
  app/             Expo Router routes (tabs + auth stack)
  components/      Shared RN components
  theme/           Design tokens + medication schedule helpers
  lib/             API client, analytics
```

---

## Notes

- **Privacy:** Chronically collects only first-party usage events (feature usage, app opens) stored on its own database, never shared or sold, and deleted with the user's account. It is a personal wellness journal — not a medical device — and does not provide medical advice or diagnosis.
- **Deployment:** the API and web app deploy independently; the database is hosted PostgreSQL. Mobile builds are produced with EAS.
- **Status:** actively developed. Web is live; mobile is in pre-release.

## License

See `LICENSE` if present; otherwise all rights reserved (c) 2026 Kevin Erkelenz.
