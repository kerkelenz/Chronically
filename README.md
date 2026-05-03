# Chronically

A daily health tracking app built for people living with chronic illness.

Chronically helps users log their pain and mood through a simple button-based
check-in, receive personalized encouragement based on their history, and view
their trends over time.

Built for my girlfriend, who has multiple sclerosis. ❤️

---

## Tech Stack

**Frontend**

- React (Vite)
- React Router
- Axios
- DaisyUI (Tailwind CSS)
- React Icons

**Backend**

- Node.js
- Express
- JWT Authentication
- BCrypt

**Database**

- PostgreSQL
- Sequelize ORM
- Supabase (cloud hosting)

**Security**

- Helmet
- CORS
- express-rate-limit
- Environment variables via dotenv

---

## Features (MVP)

- Daily check-in flow — log pain and mood through simple button presses
- Follow-up questions based on check-in answers
- Personalized encouragement based on historical data
- Pain and mood correlation graph
- User authentication with JWT
- Protected routes

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL database (we use Supabase)

### Installation

1. Clone the repository

```bash
git clone https://github.com/YOURUSERNAME/chronically.git
cd chronically
```

2. Install server dependencies

```bash
cd server
npm install
```

3. Install client dependencies

```bash
cd ../client
npm install
```

4. Set up environment variables

```bash
cd ../server
cp .env.example .env
```

Fill in your actual values in `.env`

5. Run the development servers

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd client
npm run dev
```

---

## Environment Variables

See `server/.env.example` for required variables:
PORT=3001
NODE_ENV=development
DATABASE_URL=your_postgres_connection_string
JWT_SECRET=your_jwt_secret_here

---

## API Endpoints

### Auth

| Method | Endpoint           | Description        | Protected |
| ------ | ------------------ | ------------------ | --------- |
| POST   | /api/auth/register | Create new account | No        |
| POST   | /api/auth/login    | Login to account   | No        |

### Check-ins (coming soon)

| Method | Endpoint          | Description            | Protected |
| ------ | ----------------- | ---------------------- | --------- |
| POST   | /api/checkins     | Create a check-in      | Yes       |
| GET    | /api/checkins     | Get all user check-ins | Yes       |
| PUT    | /api/checkins/:id | Update a check-in      | Yes       |
| DELETE | /api/checkins/:id | Delete a check-in      | Yes       |

---

## Status

🚧 Currently in development — Sprint 1 (backend) in progress.
