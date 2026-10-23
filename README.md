# CheckD Backend

Node.js & Express REST API for the CheckD mobile application with PostgreSQL persistence and JWT authentication.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Database Migrations & Seeding](#database-migrations--seeding)
- [Running Tests](#running-tests)
- [Starting the Server](#starting-the-server)
- [Deploying Against Hosted Postgres (Neon / Supabase)](#deploying-against-hosted-postgres-neon--supabase)

---

## Prerequisites

- **Node.js**: v18.0.0 or later (v22+ recommended)
- **npm**: v9+
- **PostgreSQL**: v16+ (local or hosted)

---

## Local Setup

1. **Navigate to the backend directory**:
   ```bash
   cd checkd-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Generate a secure random string for `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Update your `.env` file with your local credentials:
   ```env
   PORT=3000
   DATABASE_URL=postgresql://arshiloffcampus@localhost:5432/checkd_db
   DATABASE_SSL=false
   JWT_SECRET=your_generated_jwt_secret_here
   ```

4. **Initialize database schema and seed**:
   ```bash
   psql -U arshiloffcampus -d checkd_db -f schema.sql
   npm run seed
   ```

---

## Environment Variables

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | Port on which the Express server listens (default: `3000`) | `3000` |
| `DATABASE_URL` | **Yes** | Postgres connection string URI | `postgresql://user:pass@localhost:5432/checkd_db` |
| `DATABASE_SSL` | Optional | Set to `true` to enable SSL (`rejectUnauthorized: false` for Neon/Supabase) | `false` (local) / `true` (hosted) |
| `JWT_SECRET` | **Yes** | Secret key for signing and verifying JWT tokens. Server exits if missing. | `64-character hex string` |

---

## Database Migrations & Seeding

- **Initialize / Update Schema**:
  ```bash
  psql "$DATABASE_URL" -f schema.sql
  ```
  `schema.sql` creates all required tables (`users`, `connections`, `nudges`, `nudge_history`, `notifications`, `cheers`, `medications`, `medication_logs`) and indexes idempotently with `IF NOT EXISTS`.

- **Seed Sample Data**:
  ```bash
  npm run seed
  ```
  Seeds the default user (`arshil@example.com` / `password123`), circle connections, sample nudges, and care cabinet items.

- **Hash Plaintext Passwords** (One-time migration script):
  ```bash
  node scripts/hash-plaintext-passwords.js
  ```
  Finds any user record whose password does not start with bcrypt hash prefix `$2` and upgrades it in place to a secure bcrypt hash.

---

## Running Tests

Automated integration tests are built using Node's native `node:test` runner and `supertest`:

```bash
npm test
```

The test suite validates:
- `GET /health` database connectivity check (returns 200 `{"status":"ok"}`)
- `POST /signup` user registration and token generation
- `POST /login` with correct password
- `POST /login` rejection with wrong password (returns 400)
- `GET /me` token protection (returns 401 when unauthenticated)

---

## Starting the Server

- **Development mode** (auto-reload via nodemon):
  ```bash
  npm run dev
  ```

- **Production mode**:
  ```bash
  npm start
  ```

- **Health check**:
  ```bash
  curl http://localhost:3000/health
  # Response: {"status":"ok"}
  ```

---

## Deploying Against Hosted Postgres (Neon / Supabase)

### 1. Provision Hosted Database

1. **Neon**:
   - Create a project on [Neon](https://neon.tech).
   - In the Dashboard, copy the connection string:
     `postgresql://<user>:<password>@<ep-identifier>.us-east-2.aws.neon.tech/neondb?sslmode=require`

2. **Supabase**:
   - Create a project on [Supabase](https://supabase.com).
   - Under **Project Settings > Database > Connection string**, copy the URI (choose Transaction pooler or Direct connection).

### 2. Apply Schema to Hosted Database

Run `schema.sql` against the hosted database:

- **Via psql CLI**:
  ```bash
  psql "<YOUR_HOSTED_DATABASE_URL>" -f schema.sql
  ```

- **Via Web SQL Console**:
  Open Neon's SQL Editor or Supabase's SQL Editor, paste the contents of `schema.sql`, and execute.

- **(Optional) Seed initial data**:
  ```bash
  DATABASE_URL="<YOUR_HOSTED_DATABASE_URL>" DATABASE_SSL=true npm run seed
  ```

### 3. Configure Hosted Environment Variables

On your hosting platform (e.g., Render, Railway, Fly.io, Heroku):

1. Set `DATABASE_URL` to your hosted connection string.
2. Set `DATABASE_SSL=true` (enables SSL with `rejectUnauthorized: false` required for managed certificates).
3. Set `JWT_SECRET` to a strong random 256-bit secret.
4. Set `PORT` (or let provider set it automatically via `process.env.PORT`).

### 4. Verify Live Deployment

Test the health check and authentication on your deployed API:
```bash
curl https://<your-backend-domain>/health
# Expected: {"status":"ok"}
```
