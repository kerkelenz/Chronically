# Chronically

A health-tracking app for people living with chronic illness. Live on web
(mychronically.app), iOS and Android. Solo developer. Real users — treat `main`
accordingly.

The product's whole proposition is **honest tracking without pressure**. Most
rules below exist to protect that, not out of style preference.

## Layout

```
client/   React + Vite web app
server/   Express + Sequelize + PostgreSQL (Supabase), hosted on Render
mobile/   Expo SDK 54 + expo-router (iOS + Android)
```

| Task                | Command                                      |
| ------------------- | -------------------------------------------- |
| Web dev / build     | `cd client && npm run dev` / `npm run build` |
| Server dev          | `cd server && npm run dev`                   |
| Server tests        | `cd server && npm test`                      |
| Mobile dev          | `cd mobile && npx expo start`                |
| Mobile health check | `cd mobile && npx expo-doctor`               |

Schema changes apply via `sequelize.sync({ alter: true })` on a local server
boot against the real database. There are no migration files.

## Workflow

- **Never commit or push.** Implement, verify, then report: files changed (path
  - one-line purpose), verification results, and anything that didn't land.
    The developer tests on web + Android + iOS and commits himself.
- Verification means observable outcomes, not "it builds". Say plainly when
  something is untested or couldn't be checked.
- Changes land on **both platforms** unless the task is explicitly one-platform.
  Web and mobile are expected to behave and read identically.

## Invariants — breaking these is a bug, not a style choice

- **Paired files are byte-identical.** Diff them; don't trust that they match.
  - `mobile/theme/medications.js` ↔ `client/src/utils/medicationHelpers.js`
  - `mobile/theme/symptomCatalog.js` ↔ `client/src/utils/symptomCatalog.js`
  - `mobile/theme/metrics.js` METRIC_LABELS ↔ `client/src/utils/metricLabels.js`
- **Missed medication doses are computed at read time, never written as rows.**
  A `MedicationLog` row only ever means "taken" or "skipped".
- **All six metrics use a 5 = best scale**, pain and anxiety included. Never
  label a value with a generic magnitude scale — pain 1 is "Very Severe", not
  "Very Low". Use `METRIC_LABELS`.
- **Sleep is asked once per day**, on the first check-in only, always skippable,
  stored nullable. Null means not asked or skipped: never a fake zero, never
  included in an average.
- **Pure server logic lives in `server/lib/` and is unit-tested** —
  `insights.js`, `medSchedule.js`, `spoonCalendar.js`. Keep new computation
  there, keep it pure, add tests.
- **Insights honesty constants are load-bearing**: 90-day window, both buckets
  ≥5 days, effect ≥0.5 (0.4 for the composite), ≤5 cards, ≤2 per family, sample
  counts always shown, worsening correlations only. Never causal language,
  never advice. Loosening a threshold to surface more cards is never the fix.
- **The server is the source of truth.** Never trust a client-supplied flag.
  Admin endpoints re-read `isAdmin` from the database and fail closed.
- **Notifications must not double-send.** The unique constraint on
  `NotificationLog` is what guarantees it; `DeviceNotRegistered` receipts delete
  the token.
- **Two separate report generators exist** (`mobile/lib/reportHtml.js` and
  `client/src/utils/generateReport.js`). Report changes land in both.

## UI kits — use them, don't bypass them

- Mobile: `FormSheet` / `SheetHeader` / `SheetFooter`, `ConfirmDialog`, `BottomSheet`
- Web: `FormModal` / `ModalFooter` / `ConfirmDialog`

Fix spacing, behaviour or layout **in the kit**, never as a per-screen override.
If one screen needs an exception, that's a signal the kit is wrong.

## Brand

- Lavender gradient `#7C6BAE` → `#9B8EC4` → `#C4A8C0`
- Frosted cards `rgba(52,38,86,0.98)` with `rgba(255,255,255,0.18)` borders
- Playfair Display for headings, Lato for body
- Primary action: white pill, `#7C6BAE` bold text
- **Never red.** Destructive actions use plum `#5A3A60` on a white pill
- Respect reduce-motion (confetti, floating petals already do)

## Tone

Warm, brief, never salesy, never guilt-driven. No streak-shaming, no pressure
language, no apologising empty states — explain what's coming instead. Gentle
emoji sparingly; hearts only on the hardest days (💜 on worst-tier toasts only).

Honesty over polish: no fake data, no placeholder numbers, no overclaimed
insights, no causal language about correlations.

**Chronicle** is the mascot — a lavender bud companion, rendered via the inline
`ChronicleMark` component on both platforms. He appears in the welcome overview,
the insights empty state, milestone celebrations, announcement cards and the
From Chronicle history, and deliberately nowhere else. He speaks as a companion
who notices things, never as a product announcing features.

## Constraints

- **Public repo.** No secrets in files, ever. `server/scripts/seedDemo.js` is
  gitignored and holds demo credentials — never commit it or suggest doing so.
- **The demo account is App Review's account.** It is seeded to 89 distinct
  check-in days so a reviewer's first check-in triggers the 90-day milestone,
  with correlations engineered so all five insight families appear. Never create
  a check-in on it.
- Core tracking is free forever. Premium (planned) sells understanding —
  insights, weather — never access to a user's own data or exports.
- Accessibility is specced, not assumed: real labels, real hit targets.
