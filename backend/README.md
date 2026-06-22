# Fizzzio Backend

A small Flask + SQLite API that gives the Fizzzio frontend real, persistent,
multi-user storage. Replaces the old in-memory `state` object in `app.js`,
which reset on every page refresh.

## What it does

- **Auth**: email/password registration and login, hashed passwords
  (`werkzeug.security`), session-cookie based auth (no JWT needed for
  this scale).
- **Activities**: CRUD for logged workouts — create, list, delete —
  scoped per-user.
- **Streaks**: calculated server-side. Logging on a new consecutive day
  increments the streak; missing a day resets it to 1.
- **Notifications**: per-user list + mark-all-read.
- **CORS**: handled manually (no `flask-cors` dependency) via an
  `after_request` hook, restricted to an explicit allow-list of origins.

## Running locally

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The server starts on `http://localhost:5000`. A `fizzzio.db` SQLite file
is created automatically on first run — no separate database setup step.

By default it only allows requests from `http://localhost:8080` (where
`python server.py` serves the frontend from the project root). To allow
other origins, set:

```bash
export FIZZZIO_ALLOWED_ORIGINS="http://localhost:8080,https://your-frontend.netlify.app"
```

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `FIZZZIO_SECRET_KEY` | Signs session cookies. **Set a real random value in production.** | random per-boot |
| `FIZZZIO_ALLOWED_ORIGINS` | Comma-separated list of frontend origins allowed via CORS | `http://localhost:8080` |
| `FIZZZIO_HTTPS` | Set to `1` when served over HTTPS, so session cookies get `Secure` flag | `0` |
| `PORT` | Port to listen on | `5000` |
| `FLASK_DEBUG` | `1` for the auto-reloading dev server, `0` for production-style | `1` |

## API reference

All endpoints are prefixed with `/api`. All except `/auth/register`,
`/auth/login`, and `/health` require a valid session cookie.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{email, password, display_name}` | Creates account, logs in, seeds a welcome notification |
| POST | `/auth/login` | `{email, password}` | Starts a session |
| POST | `/auth/logout` | — | Clears the session |
| GET  | `/auth/me` | — | Returns current user or `{user: null}` |
| GET  | `/activities` | — | List the logged-in user's activities |
| POST | `/activities` | `{name, category, duration, intensity, calories, date, notes?}` | Creates an activity, returns updated streak |
| DELETE | `/activities/<id>` | — | Deletes if owned by the current user |
| GET  | `/notifications` | — | List notifications |
| POST | `/notifications/read-all` | — | Marks all as read |
| GET  | `/health` | — | Simple uptime check |

## Database schema

Three tables, defined in `init_db()` inside `app.py`:

- **users** — id, email (unique), display_name, password_hash, streak, last_log_date, created_at
- **activities** — id, user_id (FK), name, category, duration, intensity, calories, notes, date, created_at
- **notifications** — id, user_id (FK), title, body, read, created_at

`ON DELETE CASCADE` is set on both foreign keys, so deleting a user
(not currently exposed via the API, but handy if you add an admin tool
later) cleans up their activities and notifications automatically.

## Why SQLite, not Postgres/MySQL?

This app's scale doesn't need a managed database server. SQLite is a
single file, needs zero setup, and Python's standard library talks to
it natively — no extra dependency. If you outgrow it (heavy concurrent
writes, need for a separately-scaled DB tier), swapping `sqlite3` calls
for `psycopg2`/an ORM is a contained change, since all DB access goes
through `get_db()`.

## Why session cookies, not JWT?

For a single first-party frontend talking to its own backend, cookie
sessions are simpler: the browser handles storage and expiry, there's
no token-refresh logic to write, and Flask's session signing already
protects against tampering. JWT earns its complexity when you have
multiple independent API consumers (mobile app + web + third-party
integrations) that can't share cookies — not the case here.

## Deploying

This Flask app is stateless aside from the SQLite file, so it runs
well on small PaaS platforms with persistent disk: Render, Fly.io,
Railway, or a small VPS. Keep in mind:

- The bundled dev server (`app.run(...)`) is fine for local use but
  not for production — put `gunicorn` (or similar) in front of it for
  real traffic: `gunicorn -w 2 -b 0.0.0.0:5000 app:app`.
- SQLite's file needs to live on **persistent** disk. Most container
  platforms wipe the filesystem on redeploy unless you attach a volume.
- Set `FIZZZIO_SECRET_KEY` and `FIZZZIO_HTTPS=1` as real environment
  variables once you're not running on localhost.
