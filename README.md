# Chronically

A daily health tracking app built for people living with chronic illness.

Chronically helps users log their pain, mood, energy, anxiety, and appetite through a simple step-by-step check-in, track symptoms over time, and spot patterns in their health data.

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

- **Daily check-in** — rate your pain, mood, energy, anxiety, and appetite through a simple step-by-step flow, no typing required. Check in every 4 hours to track how you feel throughout the day
- **Symptom tagging** — flag specific symptoms like fatigue, brain fog, pain flare, numbness, and more with a single tap
- **Trend tracking** — see how all five metrics correlate over time on a single graph, switchable between day, week, and month views
- **Pattern awareness** — stat cards show your 14-day averages, most common symptoms, and check-in counts
- **Doctor report** — export a one-page 30-day PDF report with averages, symptom breakdown, and a daily log — designed to bring to appointments
- **Full data control** — edit or delete check-ins, with all of today's entries visible at a glance
- **Secure accounts** — your health data stays private and belongs only to you

---

## Features

### Check-in

- 8-step check-in flow: Pain → Mood → Energy → Anxiety → Appetite → Symptoms → Review → Celebrate
- All interactions are button taps — no typing required
- Check in every 4 hours, multiple times per day
- 12 rotating affirmation messages on the celebration screen, written for chronic illness users
- Edit any of today's check-ins, delete only the most recent

### Tracking

- Pain, mood, energy, anxiety, and appetite on a 1-5 scale
- Symptom tags: Fatigue, Brain fog, Pain flare, Numbness, Spasticity, Vision issues, Heat sensitivity, Balance issues
- Visual bar ratings in history (color coded — green to red for worse metrics, red to green for better)
- Symptom emoji icons in history entries
- Correlation graph with Day / Week / Month tabs
- Y-axis labels: Good / Mid / Bad for easy reading
- 3×2 stat card grid showing 14-day averages with check-in counts:
  - Pain | Mood
  - Energy | Anxiety
  - Appetite | Common Symptoms
- Common symptoms card shows top symptoms with day count over last 14 days

### Doctor Report (PDF Export)

- One-page 30-day report generated in the browser via jsPDF
- Includes:
  - Patient name, date range, total check-ins, days tracked, avg check-ins per day
  - 5-metric summary averages
  - Full symptom breakdown — all 8 symptoms with day count and % of days tracked
  - Daily log table — one row per day, averaged across all check-ins that day
- Download from the Export Report button in the dashboard header
- File named `chronically-report-[username]-[date].pdf`

### Auth & Security

- User registration with email verification
- Login blocked until email is verified
- Forgot/reset password via email (1-hour token link)
- Email verification on email address changes
- JWT authentication (30-day expiry)
- 14-day inactivity timeout
- BCrypt password hashing (10 salt rounds)
- Protected routes — dashboard and profile require login
- Rate limiting on auth routes

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
- React Icons
- Recharts
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

---

## Project Structure

```
chronically/
├── client/                 (React frontend)
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── CheckInModal.jsx
│       │   └── ProtectedRoute.jsx
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
│       │   ├── DashboardPage.jsx
│       │   └── ProfilePage.jsx
│       └── utils/
├── server/                 (Express backend)
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── checkInController.js
│   │   └── userController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   └── CheckIn.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── checkInRoutes.js
│   │   └── userRoutes.js
│   └── server.js
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
git clone https://github.com/kerkelenz/chronically.git
cd chronically
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

| Method | Endpoint                  | Description               | Auth Required |
| ------ | ------------------------- | ------------------------- | ------------- |
| POST   | /api/auth/register        | Create new account        | No            |
| POST   | /api/auth/login           | Login to account          | No            |
| POST   | /api/auth/forgot-password | Send password reset email | No            |
| POST   | /api/auth/reset-password  | Reset password with token | No            |
| GET    | /api/auth/verify-email    | Verify email address      | No            |

### Check-ins

| Method | Endpoint          | Description            | Auth Required |
| ------ | ----------------- | ---------------------- | ------------- |
| POST   | /api/checkins     | Create a check-in      | Yes           |
| GET    | /api/checkins     | Get all user check-ins | Yes           |
| PUT    | /api/checkins/:id | Update a check-in      | Yes           |
| DELETE | /api/checkins/:id | Delete a check-in      | Yes           |

### Users

| Method | Endpoint           | Description    | Auth Required |
| ------ | ------------------ | -------------- | ------------- |
| PUT    | /api/users/profile | Update profile | Yes           |

---

## Database Schema

### Users

| Field               | Type    | Notes                                    |
| ------------------- | ------- | ---------------------------------------- |
| id                  | INTEGER | Primary key, auto increment              |
| username            | STRING  | Required, unique, 3-30 chars             |
| email               | STRING  | Required, unique, valid email            |
| password            | STRING  | Required, hashed with BCrypt (10 rounds) |
| isVerified          | BOOLEAN | Email verification status                |
| verificationToken   | STRING  | Email verification token                 |
| pendingEmail        | STRING  | New email awaiting verification          |
| resetPasswordToken  | STRING  | Password reset token                     |
| resetPasswordExpiry | DATE    | Password reset token expiry              |
| lastActive          | DATE    | For 14-day inactivity timeout            |
| createdAt           | DATE    | Auto-generated                           |
| updatedAt           | DATE    | Auto-generated                           |

### CheckIns

| Field         | Type     | Notes                                       |
| ------------- | -------- | ------------------------------------------- |
| id            | INTEGER  | Primary key, auto increment                 |
| userId        | INTEGER  | Foreign key → Users.id                      |
| painLevel     | INTEGER  | Required, 1-5 (1=very light, 5=very severe) |
| moodLevel     | INTEGER  | Required, 1-5 (1=great, 5=very low)         |
| energyLevel   | INTEGER  | Optional, 1-5 (1=full, 5=exhausted)         |
| anxietyLevel  | INTEGER  | Optional, 1-5 (1=calm, 5=severe)            |
| appetiteLevel | INTEGER  | Optional, 1-5 (1=none, 5=great)             |
| symptoms      | JSON     | Optional, array of symptom strings          |
| followUpData  | JSON     | Optional                                    |
| date          | DATEONLY | Required, sent from frontend as local date  |
| createdAt     | DATE     | Auto-generated                              |
| updatedAt     | DATE     | Auto-generated                              |

---

## Known Issues

- The free tier of Render spins down after inactivity — the first request may take up to 60 seconds while the server wakes up
- Graph requires at least 2 check-ins to show a meaningful line

---

## What's Next

- Streak and milestone celebrations
- Medication tracker
- Push notifications for check-in reminders
- Custom avatar upload
- Opt-in AI-generated personalized insights
- iOS app via React Native

---

## License

MIT
