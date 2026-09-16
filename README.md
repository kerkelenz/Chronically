# Chronically

A calm, private health-tracking app for people living with chronic illness — track symptoms, energy, medications, and appointments, and walk into doctor visits prepared.

Chronically turns the daily reality of managing a chronic condition into something gentle: quick check-ins, honest tracking, and clear reports, with no ads, no third-party trackers, and no judgment. It ships as a web app, an iOS/Android mobile app, and a shared REST API — all in this monorepo.

**Live:** [mychronically.app](https://mychronically.app) · [iOS App Store](https://apps.apple.com/app/id0000000000) · Android

---

## Features

- **Daily check-ins** — log pain, mood, energy, anxiety, appetite and symptoms in under a minute; sleep is asked once a day and is always skippable. Multiple check-ins per day are supported, because a body can change by lunchtime. Gentle streaks encourage showing up without guilting rest days.
- **A symptom catalog that adapts to you** — 60+ icon-backed symptoms, searchable, with your own recent symptoms surfaced first and anything you type added permanently. Remove suggestions you don't want; history is never rewritten.
- **Insights** — plain-spoken correlations drawn from your own data ("Brain fog costs you energy", "Sleep sets the day"), with minimum sample sizes, effect thresholds, and visible day counts. Nothing is claimed as causal, and weak patterns stay quiet.
- **Spoon Center** — plan the day around available energy using spoon theory, with pinnable routines, a copy-yesterday shortcut, and a 7-day history view.
- **Medications** — a Today checklist (grouped by time of day, plus an as-needed lane) and a Medicine Cabinet with human-readable schedules, 7-day adherence dots, six scheduling patterns, and nine dosage forms including patches, topicals, gummies and drops. Missed doses are _computed_, never written, so history stays honest.
- **Appointments** — a lightweight visit lifecycle: prep notes, mark-completed prompts, outcome capture, and follow-up chaining.
- **Doctor reports** — export a PDF summary of metrics, symptoms, medications, adherence and observed patterns to bring to a visit.
- **Trends** — six metrics over time with press-and-hold value inspection on mobile, plus medication adherence breakdowns.
- **Private by design** — first-party usage events only (no third-party analytics, no ad SDKs, no data sold), data stays on the project's own servers, and full account + data deletion is available in-app.

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
- Medication scheduling logic is shared as a **byte-identical** helper between web (`client/src/utils/medicationHelpers.js`) and mobile (`mobile/theme/medications.js`) so both platforms compute schedules and adherence identically. The same discipline applies to the symptom catalog and metric label maps — paired files are diffed, not trusted.
- The **insights engine** (`server/lib/insights.js`) is a pure function computed server-side, so correlation logic exists exactly once and is unit-testable without a database.

### Tech stack

| Layer  | Stack                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| API    | Node.js, Express, Sequelize, PostgreSQL, JWT (`jsonwebtoken`), `bcrypt`, `helmet`, `express-rate-limit`, Resend (transactional email) |
| Web    | React, Vite, React Router, Tailwind CSS, Axios, Recharts                                                                              |
| Mobile | Expo (SDK 54), React Native, Expo Router, `expo-secure-store`, `react-native-svg`, `expo-web-browser`, `healthicons-react-native`     |
| Shared | Sentry (errors only, no PII beyond a numeric user id) on all three deployables                                                        |

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
  lib/             Insights engine (pure, unit-tested)
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
- **Status:** actively developed and live on web, iOS and Android.

## License

All rights reserved © 2026 Kevin Erkelenz. The source is public for reference and
portfolio purposes only; no rights to copy, modify, distribute, or use it are
granted without prior written permission. See [`LICENSE`](LICENSE) for the full terms.
