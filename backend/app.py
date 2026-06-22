"""
Fizzzio Backend API
====================
A small Flask + SQLite backend that gives the Fizzzio frontend real,
persistent, multi-user storage for activity logs and notifications.

Run locally:
    pip install -r requirements.txt
    python app.py

The server starts on http://localhost:5000 by default.
"""

import os
import sqlite3
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# On Render (or similar platforms with an attached persistent disk),
# set FIZZZIO_DB_PATH to a path on that disk, e.g. /data/fizzzio.db —
# otherwise the database is wiped on every redeploy. Defaults to a
# local file next to this script for local development.
DB_PATH = os.environ.get("FIZZZIO_DB_PATH", os.path.join(BASE_DIR, "fizzzio.db"))

app = Flask(__name__)
# In production, set FIZZZIO_SECRET_KEY as a real environment variable.
app.config["SECRET_KEY"] = os.environ.get("FIZZZIO_SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_HTTPONLY"] = True

# When the frontend is served from a *different* origin than the API
# (e.g. Netlify frontend + Render backend), the browser only sends
# cookies back on cross-site requests if the cookie is marked
# SameSite=None AND Secure. SameSite=None without Secure is rejected
# by browsers outright, so the two settings are tied to the same flag.
IS_CROSS_SITE_HTTPS = os.environ.get("FIZZZIO_HTTPS", "0") == "1"
app.config["SESSION_COOKIE_SAMESITE"] = "None" if IS_CROSS_SITE_HTTPS else "Lax"
app.config["SESSION_COOKIE_SECURE"] = IS_CROSS_SITE_HTTPS

# Comma-separated list of allowed frontend origins for CORS.
# Example: "https://fizzzio.netlify.app,http://localhost:8080"
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("FIZZZIO_ALLOWED_ORIGINS", "http://localhost:8080").split(",")
    if o.strip()
]


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    """Open (or reuse) a SQLite connection for this request context."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create tables if they don't already exist. Safe to call every boot."""
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT UNIQUE NOT NULL,
            display_name  TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            streak        INTEGER NOT NULL DEFAULT 0,
            last_log_date TEXT,
            created_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activities (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            name        TEXT NOT NULL,
            category    TEXT NOT NULL,
            duration    INTEGER NOT NULL,
            intensity   INTEGER NOT NULL,
            calories    INTEGER NOT NULL,
            notes       TEXT,
            date        TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            title       TEXT NOT NULL,
            body        TEXT NOT NULL,
            read        INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_activities_user ON activities (user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
        """
    )
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# CORS (handled manually — no flask-cors dependency required)
# ---------------------------------------------------------------------------

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response


@app.route("/api/<path:_unused>", methods=["OPTIONS"])
def cors_preflight(_unused):
    return ("", 204)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return jsonify(error="Not authenticated"), 401
        return view_func(*args, **kwargs)
    return wrapped


def current_user_row():
    db = get_db()
    return db.execute(
        "SELECT id, email, display_name, streak, last_log_date FROM users WHERE id = ?",
        (session["user_id"],),
    ).fetchone()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    display_name = (data.get("display_name") or "").strip() or email.split("@")[0]

    if not email or "@" not in email:
        return jsonify(error="A valid email is required"), 400
    if len(password) < 6:
        return jsonify(error="Password must be at least 6 characters"), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify(error="An account with that email already exists"), 409

    password_hash = generate_password_hash(password)
    cur = db.execute(
        "INSERT INTO users (email, display_name, password_hash, streak, created_at) "
        "VALUES (?, ?, ?, 0, ?)",
        (email, display_name, password_hash, now_iso()),
    )
    user_id = cur.lastrowid

    # Seed a friendly welcome notification, matching the app's voice.
    db.execute(
        "INSERT INTO notifications (user_id, title, body, read, created_at) VALUES (?, ?, ?, 0, ?)",
        (user_id, "Welcome to Fizzzio", "Log your movement and test your alignment in the Posture Guide.", now_iso()),
    )
    db.commit()

    session["user_id"] = user_id
    return jsonify(user={"id": user_id, "email": email, "display_name": display_name, "streak": 0}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    user = db.execute(
        "SELECT id, email, display_name, password_hash, streak FROM users WHERE email = ?",
        (email,),
    ).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(error="Invalid email or password"), 401

    session["user_id"] = user["id"]
    return jsonify(user={
        "id": user["id"], "email": user["email"],
        "display_name": user["display_name"], "streak": user["streak"],
    })


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/auth/me")
def me():
    if "user_id" not in session:
        return jsonify(user=None)
    row = current_user_row()
    if not row:
        session.clear()
        return jsonify(user=None)
    return jsonify(user=dict(row))


# ---------------------------------------------------------------------------
# Activity routes
# ---------------------------------------------------------------------------

def _bump_streak(db, user_id):
    """Increment the user's day-streak if today is a new day vs. last_log_date."""
    today = datetime.now(timezone.utc).date()
    row = db.execute("SELECT streak, last_log_date FROM users WHERE id = ?", (user_id,)).fetchone()
    last_date = row["last_log_date"]
    streak = row["streak"]

    if last_date is None:
        streak = 1
    else:
        last = datetime.fromisoformat(last_date).date()
        if last == today:
            pass  # already logged today, streak unchanged
        elif last == today - timedelta(days=1):
            streak += 1
        else:
            streak = 1  # streak broken, restart

    db.execute(
        "UPDATE users SET streak = ?, last_log_date = ? WHERE id = ?",
        (streak, today.isoformat(), user_id),
    )
    return streak


@app.get("/api/activities")
@login_required
def list_activities():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM activities WHERE user_id = ? ORDER BY date DESC, id DESC",
        (session["user_id"],),
    ).fetchall()
    return jsonify(activities=[dict(r) for r in rows])


@app.post("/api/activities")
@login_required
def create_activity():
    data = request.get_json(silent=True) or {}
    required = ["name", "category", "duration", "intensity", "calories", "date"]
    if not all(k in data for k in required):
        return jsonify(error=f"Missing one of required fields: {required}"), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO activities (user_id, name, category, duration, intensity, calories, notes, date, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            session["user_id"], data["name"], data["category"], int(data["duration"]),
            int(data["intensity"]), int(data["calories"]), data.get("notes", ""),
            data["date"], now_iso(),
        ),
    )
    new_streak = _bump_streak(db, session["user_id"])
    db.commit()

    row = db.execute("SELECT * FROM activities WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(activity=dict(row), streak=new_streak), 201


@app.delete("/api/activities/<int:activity_id>")
@login_required
def delete_activity(activity_id):
    db = get_db()
    row = db.execute(
        "SELECT id FROM activities WHERE id = ? AND user_id = ?",
        (activity_id, session["user_id"]),
    ).fetchone()
    if not row:
        return jsonify(error="Activity not found"), 404

    db.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    db.commit()
    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# Notification routes
# ---------------------------------------------------------------------------

@app.get("/api/notifications")
@login_required
def list_notifications():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC",
        (session["user_id"],),
    ).fetchall()
    return jsonify(notifications=[dict(r) for r in rows])


@app.post("/api/notifications/read-all")
@login_required
def mark_all_read():
    db = get_db()
    db.execute("UPDATE notifications SET read = 1 WHERE user_id = ?", (session["user_id"],))
    db.commit()
    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# Health check (handy for uptime monitors / deploy platforms)
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify(status="ok", service="fizzzio-backend")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

# Run at import time so this works whether the app is started with
# `python app.py` (local dev) or `gunicorn app:app` (production) — the
# latter never executes the __main__ block below.
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print(f"Fizzzio backend running → http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
