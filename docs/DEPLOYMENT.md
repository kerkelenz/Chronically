# Deployment

Three stages. Code moves left to right and never skips one.

| Stage      | Branch    | API                                        | Web                                         | Database                 |
| ---------- | --------- | ------------------------------------------ | ------------------------------------------- | ------------------------ |
| local      | any       | `localhost:3001`                           | `localhost:5173`                            | Docker Postgres 17       |
| staging    | `develop` | `chronically-api-staging.onrender.com`     | `chronically-web-staging.onrender.com`      | Supabase `chronically-staging` |
| production | `main`    | `chronically-v1i8.onrender.com`            | `mychronically.app`                         | Supabase `chronically`   |

The flow:

1. Work on a feature branch. Run it locally against Docker.
2. Merge into `develop`. CI runs; when it's green, Render deploys staging.
3. Test on staging: web, plus a `preview` phone build.
4. Merge `develop` into `main`. CI runs; when it's green, Render deploys production.

Hotfix: branch from `main`, merge to `main`, then merge `main` back into `develop`.

## What protects production

- **A local server can't reach a remote database.** `APP_ENV=local` with a
  Supabase `DATABASE_URL` refuses to boot (`server/lib/environment.js`).
  `ALLOW_REMOTE_DB=true` overrides it, and should be rare and deliberate.
- **Local never sends pushes.** The reminder and weather jobs are off locally
  unless `ENABLE_JOBS=true`.
- **Local never sends email.** Without `RESEND_API_KEY`, emails print to the
  terminal, links included. Production refuses to boot without the key.
- **Schema changes are migrations.** They run on staging first, and CI checks
  that they match the models.
- **Each stage only accepts its own web origin** (CORS), and staging has its
  own `JWT_SECRET`, so a token from one stage is useless on another.

## Local setup (once)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Copy the env templates:
   ```
   copy server\.env.example server\.env
   copy client\.env.example client\.env
   copy mobile\.env.example mobile\.env      (then put in your LAN address)
   ```
3. Start the database, migrate, and seed the test accounts:
   ```
   cd server
   npm run db:reset
   npm run dev
   ```

Test accounts (password `chronically`; they only ever exist locally):

- `new@chronically.local`: a fresh sign-up, welcome pending, no data.
- `settled@chronically.local`: 30 days in, with meds, visits, a flare and spoons.

| Command                                | Does                                                  |
| -------------------------------------- | ----------------------------------------------------- |
| `npm run db:up` / `db:down`            | Start / stop the Docker database (data kept)          |
| `npm run db:reset`                     | Wipe it, migrate, seed. A clean slate in seconds      |
| `npm run db:seed`                      | Reset just the two test accounts                      |
| `npm run db:migrate`                   | Apply pending migrations (also happens on every boot) |
| `npm run db:migrate:status`            | Applied vs pending                                    |
| `npm run db:migrate:down`              | Undo the latest migration (local only)                |
| `npm run db:migration -- <name>`       | New migration file                                    |
| `npm run db:check`                     | Do the migrations match the models?                   |

## Changing the schema

1. Change the model in `server/models/`.
2. `npm run db:migration -- add-user-nickname`, then fill in `up` and `down`.
3. `npm run db:migrate`, then `npm run db:check`. CI runs the same check and
   fails if they disagree.

Migrations run automatically at boot, under a lock, before the server
accepts requests. Write them to be safe on a live table:

- Add new columns as nullable, or with a default.
- Never rename or drop a column in the same release that stops using it.
  Ship the code first, then drop the column in a later release.

`server/migrations/sql/20261021000000-baseline.sql` is the schema as it was
when migrations were adopted. It was checked column-by-column, index-by-index
against production. Never edit it.

## Phone builds

| EAS profile   | Talks to   | Use                                      |
| ------------- | ---------- | ---------------------------------------- |
| `development` | `mobile/.env` (your local server) | day-to-day work         |
| `preview`     | staging    | `eas build --profile preview`: test before release |
| `production`  | production | store builds                             |

A `preview` build shares the production bundle ID, so it replaces the store
app on a test device. A separate `com.chronically.chronicallymobile.staging`
variant would let them sit side by side. That needs its own Firebase/APNs push
credentials, so it isn't set up yet.

---

## One-time setup checklist

Do these in order. Nothing here is in the code; it's all dashboards.

### 1. Production: set its stage before anything merges

On the existing production API service in Render, add:

- `APP_ENV=production` (**required**: without it the new server code treats
  itself as local and refuses to boot against Supabase)
- Remove `DB_SYNC_ALTER` if it's set. It no longer does anything.

The first production deploy applies two migrations:

- The baseline. It sees the existing tables and changes nothing.
- A cleanup of the duplicate unique indexes that `sync({ alter: true })` piled
  up: about 950 copies on `Users` and `PushTokens`. It keeps exactly one of
  each and runs in a single transaction.

Staging runs both first, on a copy of the same schema.

### 2. Staging database

1. In Supabase, create a project named `chronically-staging`. Use the same
   region (us-east-2), on the free tier.
2. Copy its **session pooler** connection string (port 5432).
3. Staging starts empty. The baseline migration creates every table on first
   boot. Never copy production data into staging: it's real people's health
   data.

### 3. Staging services on Render

1. Render → **New → Blueprint** → this repo. It reads `render.yaml`.
2. Check the preview lists only the two `-staging` services, then apply.
3. When asked, paste the staging `DATABASE_URL`. `RESEND_API_KEY` and
   `SENTRY_DSN` are optional for staging.
4. If Render gave either service a different URL than the ones in
   `render.yaml` (it adds a suffix when a name is taken), update
   `FRONTEND_URL`, `CORS_ORIGINS`, `VITE_API_URL` there, and
   `EXPO_PUBLIC_API_URL` in `mobile/eas.json`.

### 4. Production services: match staging's shape

In the Render dashboard, on the existing production services:

- **API:** branch `main`, root dir `server`, build `npm ci`, start `npm start`,
  health check `/api/test`, auto-deploy **after CI checks pass**.
- **Web:** branch `main`, root dir `client`, build `npm ci && npm run build`,
  publish dir `dist`.

### 5. GitHub

1. Create the `develop` branch from `main` and push it.
2. Branch protection on `main` and `develop`: require a pull request, and
   require the CI checks (`server tests`, `migrations`, `web build and lint`,
   `mobile install and lint`, `paired files`) to pass.

### 6. Your machine

Your current `server/.env` points at production. Replace it with the local
template (step 2 of local setup), and keep the production values only in
Render. `mobile/.env` currently points at production too.
