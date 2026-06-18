# Chronically

A daily health tracking app built for people living with chronic illness.

Chronically helps users log their pain, mood, energy, anxiety, and appetite through a simple step-by-step check-in, track symptoms, medications, and appointments over time, and spot patterns in their health data — all wrapped in a calm lavender interface designed to be gentle on a bad day.

Built for my girlfriend, who has multiple sclerosis. 💙

**Live app:** [mychronically.app](https://mychronically.app)

---

## Screenshots

![Landing Page](screenshots/landing.png)
![Dashboard](screenshots/dashboard.png)
![Check-in Flow](screenshots/checkin.png)
![Profile Page](screenshots/profile.png)
![Doctor Report](screenshots/report.png)

---

## What It Does

Chronically is designed for people who deal with chronic illness every day. On a bad pain day, the last thing you want is a complicated app. Chronically keeps it simple:

- **Daily check-in** — rate your pain, mood, energy, anxiety, and appetite through a step-by-step flow, no typing required. Check in every 4 hours to track how you feel throughout the day
- **Symptom tagging** — flag specific symptoms like fatigue, brain fog, pain flare, dizziness, and more with a single tap
- **Encouraging feedback** — the app responds to how you're feeling with contextual messages at every step, acknowledging hard days and celebrating good ones, with no pressure or guilt
- **Trend tracking** — see how all five metrics correlate over time on a single graph, plus medication adherence trends, switchable between day, week, and month views
- **Medication tracking** — log medications, track each dose as taken or skipped, and see today's full schedule at a glance
- **Appointment tracking** — keep upcoming doctor appointments on a calendar, with a reminder on the dashboard
- **Doctor report** — export a clinical multi-page PDF covering metrics, symptoms, medications, and appointments, designed to bring to appointments
- **Milestone celebrations** — gentle, no-pressure acknowledgement of the days you've checked in, with earned achievement badges on your profile
- **Personal touches** — upload a profile photo, edit your details, and keep full control over your data
- **Secure accounts** — your health data stays private and belongs only to you

---

## Features

### Check-in

- 8-step check-in flow: Pain → Mood → Energy → Anxiety → Appetite → Symptoms → Review → Celebrate
- All interactions are button taps — no typing required
- Severity-first button order (worst option on the left, medical scale convention)
- Check in every 4 hours, multiple times per day
- Contextual toast messages respond to each selection — encouraging on hard readings, celebrating good ones
- Combined check-in toast on the review step based on the overall pattern
- Rotating affirmation messages on the celebration screen, written for chronic illness users
- Edit any of today's check-ins, delete only the most recent
- Fresh accounts show only the check-in prompt until the first check-in is logged

### Tracking

- Pain, mood, energy, anxiety, and appetite on a 1–5 wellness scale (5 = best for all metrics)
- 16 symptom tags — Fatigue, Brain fog, Pain flare, Numbness, Spasticity, Vision issues, Heat sensitivity, Balance issues, Dizziness, Headache, Muscle weakness, Joint pain, Shortness of breath, Nausea, Sleep disturbance, Bladder urgency — each with a `healthicons-react` SVG icon for consistent rendering across devices
- Visual bar ratings in history with green = better color coding
- 5 circular progress dials showing 14-day averages, scaling up with screen width
- Common symptoms card shows the top 3 symptoms with day count (3+ occurrence threshold)
- Correlation graph on the Trends page with Day / Week / Month tabs, Good / Mid / Bad axis labels, and a custom legend
- Medication adherence charts on the Trends page — per-medication adherence bars and a daily adherence trend line

### Milestone Celebrations

- Gentle, **no-pressure** by design: celebrations are tied to your cumulative days of checking in — a number that only ever grows
- Full-screen confetti moment when you reach a milestone (3, 7, 14, 30, 60, 90, 100, 180, 365 days)
- Earned achievement badges live on the Profile page
- No streaks, no countdowns, nothing that can ever be lost or broken

### Medication Tracker

- Add medications with name, type (pill / injection / infusion / supplement), dosage, frequency, scheduled times, and notes — all with `healthicons-react` icons
- Frequencies: daily, twice daily, three/four times daily, every other day, weekly, biweekly, monthly, every X weeks, as needed
- Today's full dose timeline lives on the Medications page
- Visual dose states: Upcoming / Past-due / Taken / Skipped / Missed
- Take and Skip buttons with a skip-reason dropdown (Forgot, Felt sick, Side effects, Ran out, Doctor advised, Already took it, Too painful to take)
- Undo button on taken and skipped entries for accidental logs
- Active/inactive toggle — inactive medications shown with reduced opacity

### Appointment Tracker

- Track doctor appointments with specialty, date, location, reason, and pre/post-visit notes
- Custom month-grid calendar with status-colored indicators (upcoming / completed / cancelled)
- Upcoming-appointment reminder card on the dashboard (next 7 days, including same-day), hidden when there are none

### Doctor Report (PDF Export)

- Clinical multi-page 30-day report generated in the browser via jsPDF + jspdf-autotable
- Includes:
  - Patient info, date range, total check-ins, days tracked, and an at-a-glance summary
  - A 30-day trend chart of all five metrics
  - 5-metric summary averages and notable events
  - Full symptom breakdown — all 16 symptoms, day-based (% of days tracked)
  - Current medications, adherence summary, adherence by day of week, and most common skip reasons
  - Recent and upcoming appointments
  - Daily health log and daily medication log
- Exported from the **Doctor Report** section on the Medications page (and a contextual button on the dashboard when an appointment is coming up)
- File named `chronically-report-[username]-[date].pdf`

### Profile & Avatar

- Custom avatar upload with an interactive crop/zoom, stored on the account so it persists across devices and logins
- Falls back to initials when no photo is set; shown on the profile and the dashboard greeting
- Edit username and email (an email change triggers re-verification)
- Earned milestone achievement badges
- Log out, and delete account with a confirmation modal (cascades all data)

### Navigation

- Bottom tab bar on mobile, hamburger menu on desktop (Dashboard / Trends / Medications / Profile)
- Active page highlighted in primary purple

### Design

- Calming lavender gradient with frosted-glass cards throughout the app
- Playfair Display headings + Lato body
- All icons via `healthicons-react` for consistent cross-device rendering (no emoji)

### Auth & Security

- User registration with email verification
- Login blocked until email is verified
- Forgot/reset password via email (1-hour token link, invalidated after use)
- Email verification on email address changes
- JWT authentication (30-day expiry)
- 14-day inactivity timeout
- BCrypt password hashing (10 salt rounds)
- Protected routes — all app pages require login
- Rate limiting on auth routes
- Delete account with confirmation modal (cascades all data)

### Email

- All transactional emails sent from `noreply@mychronically.app`
- Branded purple HTML templates via Resend
- Verification, password reset, and email change flows

---

## Tech Stack

**Frontend**

- React (Vite)
- React Router
- Axios
- DaisyUI (Tailwind CSS)
- React Icons + healthicons-react
- Recharts
- react-circular-progressbar
- react-easy-crop (avatar cropping)
- canvas-confetti (milestone celebrations)
- jsPDF + jspdf-autotable (PDF export)
- Google Fonts (Playfair Display + Lato)

**Backend**

- Node.js
- Express
- JWT (jsonwebtoken)
- BCrypt
- Resend (transactional email)

**Database**

- PostgreSQL
- Sequelize ORM
- Supabase (cloud hosting)

**Security**

- Helmet
- CORS
- express-rate-limit
- DotEnv

**Deployment**

- Render (frontend + backend)
- Supabase (PostgreSQL)
- Cloudflare DNS
- Custom domain: mychronically.app

**Mobile (in development)**

- React Native (Expo) iOS app on the `mobile` branch — reuses this backend and its API; push notifications will land with it

---

## Project Structure

```
chronically/
├── client/                 (React web frontend)
│   └── src/
│       ├── components/
│       │   ├── Avatar.jsx
│       │   ├── CheckInModal.jsx
│       │   ├── MilestoneBadges.jsx
│       │   ├── MilestoneCelebration.jsx
│       │   ├── Navigation.jsx
│       │   ├── ProtectedRoute.jsx
│       │   └── SymptomIcon.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── hooks/
│       │   └── useAuth.js
│       ├── pages/
│       │   ├── LandingPage.jsx
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── ForgotPasswordPage.jsx
│       │   ├── ResetPasswordPage.jsx
│       │   ├── VerifyEmailPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── TrendsPage.jsx
│       │   ├── MedicationsPage.jsx
│       │   ├── AppointmentsPage.jsx
│       │   └── ProfilePage.jsx
│       └── utils/
│           ├── generateReport.js   (jsPDF doctor report)
│           ├── exportReport.js     (fetches data + triggers the report)
│           ├── medicationHelpers.js
│           └── milestones.js       (cumulative-day milestone logic)
├── server/                 (Express backend)
│   ├── config/db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── checkInController.js
│   │   ├── userController.js
│   │   ├── medicationController.js
│   │   └── appointmentController.js
│   ├── middleware/auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── CheckIn.js
│   │   ├── Medication.js
│   │   ├── MedicationLog.js
│   │   └── Appointment.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── checkInRoutes.js
│   │   ├── userRoutes.js
│   │   ├── medicationRoutes.js
│   │   └── appointmentRoutes.js
│   └── server.js
├── mobile/                 (React Native / Expo iOS app — in development on the `mobile` branch)
├── .gitignore
└── README.md
```

---

## Installation

### Prerequisites

- Node.js v18+
- PostgreSQL database (we use Supabase)
- Resend account (for transactional email)

### 1. Clone the repository

```bash
git clone https://github.com/kerkelenz/Chronically.git
cd Chronically
```

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Install client dependencies

```bash
cd ../client
npm install
```

### 4. Set up environment variables

```bash
cd ../server
cp .env.example .env
```

Open `server/.env` and fill in your values:

```
PORT=3001
NODE_ENV=development
DATABASE_URL=your_postgres_connection_string
JWT_SECRET=your_jwt_secret_here
RESEND_API_KEY=your_resend_api_key
```

For the client create `client/.env`:

```
VITE_API_URL=http://localhost:3001
```

### 5. Set up the database

Create a PostgreSQL database (Supabase free tier). Add your connection string to `server/.env`. Sequelize will automatically create the tables when the server starts.

### 6. Run the application

In one terminal run the backend:

```bash
cd server
npm run dev
```

In another terminal run the frontend:

```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

### Server (`server/.env`)

| Variable         | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `PORT`           | Port the server runs on (default 3001)                    |
| `NODE_ENV`       | Environment (development or production)                   |
| `DATABASE_URL`   | PostgreSQL connection string                              |
| `JWT_SECRET`     | Secret key for signing JWT tokens (32+ random characters) |
| `RESEND_API_KEY` | API key for Resend transactional email                    |

### Client (`client/.env`)

| Variable       | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `VITE_API_URL` | Backend API URL (localhost for dev, Render URL for production) |

---

## API Endpoints

### Auth

| Method | Endpoint                       | Description               | Auth Required |
| ------ | ------------------------------ | ------------------------- | ------------- |
| POST   | /api/auth/register             | Create new account        | No            |
| POST   | /api/auth/login                | Login to account          | No            |
| POST   | /api/auth/forgot-password      | Send password reset email | No            |
| POST   | /api/auth/reset-password       | Reset password with token | No            |
| POST   | /api/auth/validate-reset-token | Validate reset token      | No            |
| POST   | /api/auth/verify-email         | Verify email address      | No            |

### Check-ins

| Method | Endpoint          | Description            | Auth Required |
| ------ | ----------------- | ---------------------- | ------------- |
| POST   | /api/checkins     | Create a check-in      | Yes           |
| GET    | /api/checkins     | Get all user check-ins | Yes           |
| PUT    | /api/checkins/:id | Update a check-in      | Yes           |
| DELETE | /api/checkins/:id | Delete a check-in      | Yes           |

### Users

| Method | Endpoint              | Description                     | Auth Required |
| ------ | --------------------- | ------------------------------- | ------------- |
| PUT    | /api/users/profile    | Update profile (username/email) | Yes           |
| PUT    | /api/users/avatar     | Upload or replace avatar        | Yes           |
| DELETE | /api/users/avatar     | Remove avatar                   | Yes           |
| PUT    | /api/users/milestones | Update celebrated milestones    | Yes           |
| DELETE | /api/users/account    | Delete account (cascades data)  | Yes           |

### Medications

| Method | Endpoint                  | Description               | Auth Required |
| ------ | ------------------------- | ------------------------- | ------------- |
| GET    | /api/medications          | Get all medications       | Yes           |
| POST   | /api/medications          | Create medication         | Yes           |
| PUT    | /api/medications/:id      | Update medication         | Yes           |
| DELETE | /api/medications/:id      | Delete medication         | Yes           |
| GET    | /api/medications/logs     | Get logs for a date range | Yes           |
| POST   | /api/medications/logs     | Create log entry          | Yes           |
| PUT    | /api/medications/logs/:id | Update log entry          | Yes           |
| DELETE | /api/medications/logs/:id | Delete log entry (undo)   | Yes           |

### Appointments

| Method | Endpoint              | Description          | Auth Required |
| ------ | --------------------- | -------------------- | ------------- |
| GET    | /api/appointments     | Get all appointments | Yes           |
| POST   | /api/appointments     | Create appointment   | Yes           |
| PUT    | /api/appointments/:id | Update appointment   | Yes           |
| DELETE | /api/appointments/:id | Delete appointment   | Yes           |

---

## Database Schema

### Users

| Field                | Type    | Notes                                        |
| -------------------- | ------- | -------------------------------------------- |
| id                   | INTEGER | Primary key, auto increment                  |
| username             | STRING  | Required, unique, 3-30 chars                 |
| email                | STRING  | Required, unique, valid email                |
| password             | STRING  | Required, hashed with BCrypt (10 rounds)     |
| avatar               | TEXT    | Base64 profile photo, nullable               |
| celebratedMilestones | JSON    | Cumulative-day milestones already celebrated |
| isVerified           | BOOLEAN | Email verification status                    |
| verificationToken    | STRING  | Email verification token                     |
| pendingEmail         | STRING  | New email awaiting verification              |
| resetPasswordToken   | STRING  | Password reset token                         |
| resetPasswordExpiry  | DATE    | Password reset token expiry                  |
| lastActive           | DATE    | For 14-day inactivity timeout                |
| createdAt            | DATE    | Auto-generated                               |
| updatedAt            | DATE    | Auto-generated                               |

### CheckIns

| Field         | Type     | Notes                                       |
| ------------- | -------- | ------------------------------------------- |
| id            | INTEGER  | Primary key, auto increment                 |
| userId        | INTEGER  | Foreign key → Users.id                      |
| painLevel     | INTEGER  | Required, 1-5 (5=very light, 1=very severe) |
| moodLevel     | INTEGER  | Required, 1-5 (5=great, 1=very low)         |
| energyLevel   | INTEGER  | Optional, 1-5 (5=full, 1=exhausted)         |
| anxietyLevel  | INTEGER  | Optional, 1-5 (5=calm, 1=severe)            |
| appetiteLevel | INTEGER  | Optional, 1-5 (5=great, 1=none)             |
| symptoms      | JSON     | Optional, array of symptom strings          |
| followUpData  | JSON     | Optional                                    |
| date          | DATEONLY | Required, sent from frontend as local date  |
| createdAt     | DATE     | Auto-generated                              |
| updatedAt     | DATE     | Auto-generated                              |

All five metrics use the 5=best, 1=worst convention.

### Medications

| Field          | Type    | Notes                                                                     |
| -------------- | ------- | ------------------------------------------------------------------------- |
| id             | INTEGER | Primary key, auto increment                                               |
| userId         | INTEGER | Foreign key → Users.id                                                    |
| name           | STRING  | Required                                                                  |
| type           | ENUM    | pill / injection / infusion / supplement                                  |
| dosage         | STRING  | Optional, e.g. "20mg"                                                     |
| frequency      | ENUM    | daily / twice_daily / three_times_daily / four_times_daily /              |
|                |         | every_other_day / weekly / biweekly / monthly / every_x_weeks / as_needed |
| frequencyWeeks | INTEGER | Only used when frequency = every_x_weeks                                  |
| scheduledTimes | JSON    | Array of "HH:MM" strings                                                  |
| notes          | TEXT    | Optional                                                                  |
| active         | BOOLEAN | Default true                                                              |
| createdAt      | DATE    | Auto-generated                                                            |
| updatedAt      | DATE    | Auto-generated                                                            |

### MedicationLogs

| Field         | Type     | Notes                        |
| ------------- | -------- | ---------------------------- |
| id            | INTEGER  | Primary key, auto increment  |
| userId        | INTEGER  | Foreign key → Users.id       |
| medicationId  | INTEGER  | Foreign key → Medications.id |
| date          | DATEONLY | Date of the dose             |
| scheduledTime | STRING   | "HH:MM" scheduled time       |
| takenAt       | DATE     | Actual timestamp when logged |
| status        | ENUM     | taken / skipped / missed     |
| skipReason    | STRING   | Optional reason for skipping |
| createdAt     | DATE     | Auto-generated               |
| updatedAt     | DATE     | Auto-generated               |

### Appointments

| Field        | Type    | Notes                            |
| ------------ | ------- | -------------------------------- |
| id           | INTEGER | Primary key, auto increment      |
| userId       | INTEGER | Foreign key → Users.id           |
| doctorName   | STRING  | Required                         |
| specialty    | STRING  | Optional                         |
| date         | DATE    | Appointment date/time            |
| location     | STRING  | Optional                         |
| reason       | TEXT    | Optional                         |
| notesBefore  | TEXT    | Pre-visit notes                  |
| notesAfter   | TEXT    | Post-visit notes                 |
| followUpDate | DATE    | Optional                         |
| status       | ENUM    | upcoming / completed / cancelled |
| createdAt    | DATE    | Auto-generated                   |
| updatedAt    | DATE    | Auto-generated                   |

---

## Known Issues

- The free tier of Render spins down after inactivity — the first request may take up to 60 seconds while the server wakes up
- The trends graph requires at least 2 check-ins to show a meaningful line

---

## What's Next

- Native iOS app via React Native / Expo (in development)
- Push notifications for check-in and medication reminders (landing with the native app)
- Opt-in AI-generated personalized insights

---

## License

MIT
