// FIZZZIO API CLIENT

// Thin wrapper around fetch() for talking to the Flask backend.
// Centralizing this here means app.js never has to think about
// headers, credentials, or error-shape parsing more than once.

// Change this if your backend is hosted elsewhere (e.g. deployed on
// Render/Fly.io while the frontend lives on Netlify/Vercel).
export const API_BASE = window.FIZZZIO_API_BASE || 'http://localhost:5000/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include', // send/receive the session cookie
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (networkErr) {
    // fetch() itself threw — the backend is unreachable (not running,
    // wrong URL, CORS misconfigured, offline, etc.) as opposed to a
    // normal HTTP error response.
    throw new Error('Could not reach the Fizzzio server. Is the backend running?');
  }

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    // No JSON body (e.g. 204 responses) — that's fine.
  }

  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body;
}

// ---- Auth ----
export const apiRegister = (email, password, displayName) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });

export const apiLogin = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const apiLogout = () => request('/auth/logout', { method: 'POST' });

export const apiMe = () => request('/auth/me');

// ---- Activities ----
export const apiListActivities = () => request('/activities');

export const apiCreateActivity = (activity) =>
  request('/activities', {
    method: 'POST',
    body: JSON.stringify(activity),
  });

export const apiDeleteActivity = (id) =>
  request(`/activities/${id}`, { method: 'DELETE' });

// ---- Notifications ----
export const apiListNotifications = () => request('/notifications');

export const apiMarkAllNotificationsRead = () =>
  request('/notifications/read-all', { method: 'POST' });
