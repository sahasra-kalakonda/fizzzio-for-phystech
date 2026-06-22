# Fizzzio
#### Video Demo:  <https://www.youtube.com/watch?v=dgn19WHoI4M>
#### Description:

Fizzzio is a fitness account for your movement life ~ it tracks every workout, stretch, and casual movement against a personal streak and weekly goals. It's a full-stack app with a vanilla JavaScript frontend and a Flask/SQLite backend, built around **Fizz Coach**, a real-time AI posture guide that watches a user's squat depth, hip alignment, and core stability through a webcam and tells them what to fix in the moment.

The motivation: physical therapy runs $100–$200 a session, and a full course can cost thousands. Most fitness apps log reps and calories but stay silent on whether someone is moving safely. Fizzzio closes that gap with a laptop webcam, and does so honestly ~ the posture feature runs on real, on-device pose detection and real joint-angle math, not a canned animation.

The app is a single-page application with four views shown and hidden inside one `index.html`: **Buzzboard** (dashboard), **Logzz** (activity logging), **Posture AI Guide** (Fizz Coach), and **Recovery Map** (stretching). All four sit behind a shared auth overlay, so history, streaks, and notifications persist to a real per-user database rather than browser memory.

## Project Structure and What Each File Does

**`index.html`** holds the entire frontend in one page: an auth overlay, four `<section class="app-view">` blocks shown/hidden by `app.js`, and the inline SVG body diagrams used by the Recovery Map. **`style.css`** styles all of it.

**`app.js`** is the main module and glue code: a small `state` object (current user, cached activities, notifications, streak), the auth forms, session check on load, view navigation, the logs list/table with filtering, the activity form, the notification bell, and the calls that initialize `charts.js`, `posture.js`, and `recovery.js` as their views become active.

**`api.js`** is a thin `fetch()` wrapper every other module uses to talk to the backend: one function per endpoint, sending the session cookie automatically and throwing a clear error if the backend is unreachable.

**`charts.js`** is a custom canvas chart engine for the Buzzboard: the 7-day line chart and discipline-balance radar chart are drawn onto `<canvas>` with hand-written Bézier curve math and device-pixel-ratio scaling.

**`posture.js`** implements Fizz Coach. Its primary mode loads Google's MediaPipe Pose Landmarker (BlazePose) and runs it in-browser via WebAssembly, returning 33 real body landmarks per frame from the webcam with no backend involvement. A `getAngle()` helper recomputes joint angles each frame with `atan2` trigonometry (the same approach used in clinical biomechanics) driving metrics like knee flexion and hip-torso tilt. If the camera is denied or the model fails to load, it falls back to a sine-wave mock skeleton so the feature degrades gracefully instead of breaking.

**`recovery.js`** holds a `muscleDatabase` of strain causes and matching stretches (hold times, form tips), plus the logic that loads a protocol when a user clicks a region on the SVG body map.

**`server.py`** is a small local-dev static file server that serves the frontend on `localhost:8080` and maps `.js` to `application/javascript`, since some systems don't recognize ES module imports otherwise.

**`render.yaml`** is a Render Blueprint for the backend: it installs dependencies, starts the app with `gunicorn`, and sets the environment variables needed for secure cross-origin cookies once the frontend is live on Netlify.

**`backend/app.py`** is the entire backend: it creates the SQLite schema on first run (`users`, `activities`, `notifications`, cascading foreign keys), hashes passwords, issues signed session cookies, checks them via a `login_required` decorator, calculates streaks server-side, and handles CORS manually with an explicit allow-list. **`backend/requirements.txt`** pins `Flask`, `Werkzeug`, and `gunicorn`. **`backend/README.md`** documents the API reference, schema, and environment variables in detail.

## Design Choices Worth Explaining

SQLite over a managed database fit the project's scale: it's a single file with zero setup, and since every query goes through one `get_db()` helper, swapping it later would be contained rather than a rewrite. Fizzzio has exactly one frontend talking to its own backend, so the browser already handles storage and expiry, and Flask's signing prevents tampering without needing token-refresh logic.

The most deliberate choice is in `posture.js`: the original sine-wave mock skeleton wasn't discarded, but kept as an explicit simulation fallback. Real, on-device MediaPipe detection is the primary mode, since that's what the feature is actually for, but webcam permissions get denied and CDNs occasionally fail. Falling back to simulation then degrades the demo instead of breaking it, while keeping that fallback clearly separate from real measurement in the code.

Finally, manual CORS with an explicit `FIZZZIO_ALLOWED_ORIGINS` allow-list, paired with `SameSite=None; Secure` cookies, reflects the same reasoning: the Netlify frontend and Render backend live on different origins, so the session cookie crosses origins on every request.
