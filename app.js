// FIZZZIO - MAIN APPLICATION MODULE
//used github copilot to help setup the pages, and functioning the user authentication section

import { initCharts, updateCharts } from './charts.js';
import { initPosture, stopPosture } from './posture.js';
import { initRecovery } from './recovery.js';
import {
  apiRegister, apiLogin, apiLogout, apiMe,
  apiListActivities, apiCreateActivity, apiDeleteActivity,
  apiListNotifications, apiMarkAllNotificationsRead,
} from './api.js';

// Central State — now a local CACHE of what the backend holds.
// On login, we pull activities/notifications/streak from the API
// and keep them here so the existing render functions don't need
// to change. Every mutation (create/delete) round-trips to the
// backend FIRST, then updates this cache from the real response.
const state = {
  streak: 0,
  activities: [],
  notifications: [],
  currentUser: null,
};

// Auth DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const userDisplayNameEl = document.getElementById('user-display-name');
const btnLogout = document.getElementById('btn-logout');

// DOM Elements
const views = document.querySelectorAll('.app-view');
const navButtons = document.querySelectorAll('.nav-btn');
const viewTitle = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');
const streakCountEl = document.getElementById('streak-count');
const toastEl = document.getElementById('toast-message');
const toastTitleEl = document.getElementById('toast-title');
const toastBodyEl = document.getElementById('toast-body-text');
const activityForm = document.getElementById('activity-form');
const recentLogsContainer = document.getElementById('recent-logs-list');
const btnCancelLog = document.getElementById('btn-cancel-log');
const viewAllLogsBtn = document.getElementById('view-all-logs-btn');
const notificationBell = document.getElementById('notification-bell');
const allLogsListContainer = document.getElementById('all-logs-list');
const filterCategoryEl = document.getElementById('filter-category');

// Init application — gated behind auth.
document.addEventListener('DOMContentLoaded', () => {
  setupAuthForms();
  bootstrapSession();
});

// Check if a session cookie is already valid (e.g. page refresh).
// If so, skip straight to the app. If not, show the auth overlay.
async function bootstrapSession() {
  try {
    const { user } = await apiMe();
    if (user) {
      await enterApp(user);
      return;
    }
  } catch (_) {
    // Backend unreachable or no session — fall through to login screen.
  }
  showAuthOverlay();
}

function showAuthOverlay() {
  authOverlay.classList.remove('hidden');
}

function hideAuthOverlay() {
  authOverlay.classList.add('hidden');
}

function setupAuthForms() {
  showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginError.textContent = '';
  });

  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    registerError.textContent = '';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const { user } = await apiLogin(email, password);
      await enterApp(user);
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.textContent = '';
    const displayName = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    try {
      const { user } = await apiRegister(email, password, displayName);
      await enterApp(user);
    } catch (err) {
      registerError.textContent = err.message;
    }
  });

  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await apiLogout();
      } catch (_) {
        // Even if the network call fails, drop the user back to the login screen.
      }
      state.currentUser = null;
      state.activities = [];
      state.notifications = [];
      stopPosture();
      loginForm.reset();
      registerForm.reset();
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      showAuthOverlay();
    });
  }
}

// Called after a successful login or register — loads the user's
// real data from the backend, then boots the rest of the UI.
async function enterApp(user) {
  state.currentUser = user;
  state.streak = user.streak || 0;
  userDisplayNameEl.textContent = user.display_name;

  await refreshActivitiesFromServer();
  await refreshNotificationsFromServer();

  hideAuthOverlay();
  initAppUI();
}

async function refreshActivitiesFromServer() {
  const { activities } = await apiListActivities();
  state.activities = activities;
}

async function refreshNotificationsFromServer() {
  const { notifications } = await apiListNotifications();
  state.notifications = notifications;
  updateNotificationBadge();
}

function updateNotificationBadge() {
  const unreadCount = state.notifications.filter(n => !n.read).length;
  const badge = document.querySelector('.badge-red');
  if (badge) {
    badge.classList.toggle('hidden', unreadCount === 0);
  }
}

// Runs once per login — wires up everything that used to run
// unconditionally on DOMContentLoaded.
let appUIInitialized = false;
function initAppUI() {
  renderRecentLogs();
  renderAllLogs();
  updateSummaryCards();
  initCharts(state.activities);
  updateNotificationBadge();

  if (appUIInitialized) return; // listeners only need to attach once
  appUIInitialized = true;

  setupNavigation();
  setupActivityForm();
  initRecovery(showToast);

  notificationBell.addEventListener('click', toggleNotificationsList);

  if (viewAllLogsBtn) {
    viewAllLogsBtn.addEventListener('click', () => switchView('log'));
  }

  if (filterCategoryEl) {
    filterCategoryEl.addEventListener('change', (e) => {
      renderAllLogs(e.target.value);
    });
  }

  if (allLogsListContainer) {
    allLogsListContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.btn-delete-log');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'));
        deleteLog(id);
      }
    });
  }

  showToast('Fizzzio is Live! ⚡', 'Ready to log some movement? Let the zzzession begin!');
}

// View Routing Controller
function setupNavigation() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchView(target);
    });
  });
}

export function switchView(targetViewId) {
  // Update sidebar active buttons
  navButtons.forEach(b => {
    if (b.getAttribute('data-target') === targetViewId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Fade out current active view
  const currentView = document.querySelector('.app-view.active');
  if (currentView) {
    currentView.style.opacity = '0';
    currentView.style.transform = 'translateY(-10px)';
    
    // Stop camera processes if leaving posture guide
    if (currentView.id === 'posture-view') {
      stopPosture();
    }
    
    setTimeout(() => {
      currentView.classList.remove('active');
      currentView.style.display = 'none';
      
      // Load target view
      activateView(targetViewId);
    }, 200);
  } else {
    activateView(targetViewId);
  }
}

function activateView(viewId) {
  const targetView = document.getElementById(`${viewId}-view`);
  if (!targetView) return;

  // Set titles
  let title = 'Buzzboard';
  let subtitle = 'Buzz-analytics & fizzzical activities tracker';
  
  switch(viewId) {
    case 'dashboard':
      title = 'Buzzboard';
      subtitle = 'Buzz-analytics & fizzzical activities tracker';
      break;
    case 'log':
      title = 'Logzz';
      subtitle = 'Drop a logzz — any movement counts. Zzzip it in!';
      break;
    case 'posture':
      title = 'Posture AI Guide';
      subtitle = 'Interactive real-time skeletal alignment assessment';
      // Initialize posture webcam system
      initPosture(showToast);
      break;
    case 'recovery':
      title = 'Recovery Map';
      subtitle = 'Interactive skeletal muscle stretching & rehab planner';
      break;
  }

  viewTitle.textContent = title;
  viewSubtitle.textContent = subtitle;

  targetView.style.display = targetView.classList.contains('app-view') && viewId === 'dashboard' ? 'grid' : 'block';
  if (viewId === 'posture' || viewId === 'recovery') {
    targetView.style.display = 'grid'; // Grid layouts for special pages
  }
  
  // Trigger animations
  setTimeout(() => {
    targetView.classList.add('active');
    targetView.style.opacity = '1';
    targetView.style.transform = 'translateY(0)';
  }, 50);

  // If returning to dashboard, refresh charts to pick up any new logs
  if (viewId === 'dashboard') {
    updateCharts(state.activities);
  }
}



// Toast Alert System
export function showToast(title, bodyText) {
  toastTitleEl.textContent = title;
  toastBodyEl.textContent = bodyText;
  
  toastEl.classList.remove('hidden');
  
  // Clear any existing timers
  if (window.toastTimer) clearTimeout(window.toastTimer);
  
  window.toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      toastEl.classList.add('hidden');
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';
    }, 300);
  }, 4000);
}

// Notifications Popup
async function toggleNotificationsList() {
  const unreadCount = state.notifications.filter(n => !n.read).length;
  if (unreadCount > 0) {
    try {
      await apiMarkAllNotificationsRead();
      state.notifications.forEach(n => n.read = 1);
      document.querySelector('.badge-red').classList.add('hidden');
      showToast('Buzzz Read ✅', `Reviewed ${unreadCount} alert(s). Zzzone clear!`);
    } catch (err) {
      showToast('Oops', `Could not update notifications: ${err.message}`);
    }
  } else {
    showToast('Zzzone Clear 🫧', 'No new alerts — you are all caught up!');
  }
}

// Activity Logging Logic
function setupActivityForm() {
  // Slider interaction
  const durationInput = document.getElementById('act-duration');
  const durationVal = document.getElementById('duration-val');
  durationInput.addEventListener('input', (e) => {
    durationVal.textContent = `${e.target.value} mins`;
  });

  const intensityInput = document.getElementById('act-intensity');
  const intensityVal = document.getElementById('intensity-val');
  intensityInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    let desc = 'Moderate';
    if (val <= 3) desc = 'Light / Active rest';
    else if (val <= 5) desc = 'Moderate Effort';
    else if (val <= 7) desc = 'Vigorous Workout';
    else if (val <= 9) desc = 'Hard / High Intensity';
    else desc = 'Maximum / Peak Effort';
    
    intensityVal.textContent = `${val} (${desc})`;
    
    // Auto-estimate calories based on category + duration + intensity
    estimateCalories();
  });

  const categoryInput = document.getElementById('act-category');
  categoryInput.addEventListener('change', estimateCalories);
  durationInput.addEventListener('change', estimateCalories);

  function estimateCalories() {
    const duration = parseInt(durationInput.value);
    const intensity = parseInt(intensityInput.value);
    const category = categoryInput.value;
    
    let baseKcalPerMin = 4; // recreation
    if (category === 'cardio') baseKcalPerMin = 10;
    else if (category === 'fitness') baseKcalPerMin = 7;
    else if (category === 'flexibility') baseKcalPerMin = 4.5;
    
    // Scale with intensity
    const intensityMultiplier = 0.5 + (intensity / 10) * 1.2;
    const estimated = Math.round(duration * baseKcalPerMin * intensityMultiplier);
    document.getElementById('act-calories').value = estimated;
  }

  // Pre-fill date fields
  const dateInput = document.getElementById('act-date');
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.value = now.toISOString().slice(0, 16);

  // Form submit
  activityForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('act-name').value;
    const category = document.getElementById('act-category').value;
    const duration = parseInt(document.getElementById('act-duration').value);
    const intensity = parseInt(document.getElementById('act-intensity').value);
    const calories = parseInt(document.getElementById('act-calories').value);
    const date = document.getElementById('act-date').value;
    const notes = document.getElementById('act-notes').value;

    const submitBtn = activityForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const { activity, streak } = await apiCreateActivity({
        name, category, duration, intensity, calories, date, notes,
      });

      // Prepend the server-confirmed record (has the real DB id).
      state.activities.unshift(activity);
      state.streak = streak;

      // Re-render
      renderRecentLogs();
      renderAllLogs(filterCategoryEl.value);
      updateSummaryCards();

      // Show Toast and Route back
      showToast('Logzzed! 🔥', `"${name}" is in the books. +${calories} kcal zzzeamed!`);
      activityForm.reset();

      // Set default sliders and dates again
      durationVal.textContent = '30 mins';
      intensityVal.textContent = '5 (Moderate)';
      const nowReset = new Date();
      nowReset.setMinutes(nowReset.getMinutes() - nowReset.getTimezoneOffset());
      dateInput.value = nowReset.toISOString().slice(0, 16);

      // Route back to dashboard
      setTimeout(() => {
        switchView('dashboard');
      }, 800);
    } catch (err) {
      showToast('Logzz Failed', err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  if (btnCancelLog) {
    btnCancelLog.addEventListener('click', () => {
      activityForm.reset();
      durationVal.textContent = '30 mins';
      intensityVal.textContent = '5 (Moderate)';
      showToast('Zzzeroed Out 🧹', 'Form cleared. Fresh start!');
    });
  }
}

// Render Recent logs in dashboard
function renderRecentLogs() {
  recentLogsContainer.innerHTML = '';
  // Show up to 5 items
  const displayItems = state.activities.slice(0, 5);
  
  displayItems.forEach(item => {
    const dateObj = new Date(item.date);
    const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const itemEl = document.createElement('div');
    itemEl.className = 'log-item';
    
    let emoji = '🏃';
    if (item.category === 'cardio') emoji = '🚴';
    else if (item.category === 'flexibility') emoji = '🧘';
    else if (item.category === 'recreation') emoji = '🌱';
    else if (item.category === 'fitness') emoji = '💪';

    itemEl.innerHTML = `
      <div class="log-item-left">
        <div class="log-badge-icon badge-${item.category}">${emoji}</div>
        <div class="log-info">
          <span class="log-name">${item.name}</span>
          <span class="log-date">${dateFormatted} • ${timeFormatted}</span>
        </div>
      </div>
      <div class="log-item-right">
        <span class="log-dur">${item.duration} mins</span>
        <span class="log-cal">${item.calories} kcal</span>
      </div>
    `;

    recentLogsContainer.appendChild(itemEl);
  });
}

// Update Dashboard Widgets stats
function updateSummaryCards() {
  streakCountEl.textContent = state.streak;
  
  // Calculate stats from today's activities
  const today = new Date().toISOString().split('T')[0];
  const todayActivities = state.activities.filter(a => a.date.startsWith(today));
  
  const todayCount = todayActivities.length;
  document.getElementById('stat-activities-count').textContent = todayCount;

  // Calculate totals for active mins & energy in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentActivities = state.activities.filter(a => new Date(a.date) >= sevenDaysAgo);
  
  const totalMins = recentActivities.reduce((acc, curr) => acc + curr.duration, 0);
  const totalKcal = recentActivities.reduce((acc, curr) => acc + curr.calories, 0);
  
  document.getElementById('stat-active-time').textContent = totalMins;
  
  // Format calories with commas
  document.getElementById('stat-energy').textContent = totalKcal.toLocaleString();
  
  // Calculate Category Balance index
  // Ideal: at least some representation in all categories, or high uniformity
  const categoryCounts = { fitness: 0, cardio: 0, flexibility: 0, recreation: 0 };
  state.activities.forEach(a => {
    if (categoryCounts[a.category] !== undefined) {
      categoryCounts[a.category] += 1;
    }
  });

  const categoriesPresent = Object.values(categoryCounts).filter(c => c > 0).length;
  // Score: 25% per present category
  let balanceScore = categoriesPresent * 25;
  if (balanceScore === 0) balanceScore = 50; // default baseline
  
  document.getElementById('stat-balance').textContent = balanceScore;
}

// Render All activities in Log History page
function renderAllLogs(filter = 'all') {
  if (!allLogsListContainer) return;
  allLogsListContainer.innerHTML = '';

  const filtered = state.activities.filter(item => {
    if (filter === 'all') return true;
    return item.category === filter;
  });

  if (filtered.length === 0) {
    allLogsListContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 40px 20px; font-size: 13px;">
        No logged activities in this category yet.
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const dateObj = new Date(item.date);
    const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    let emoji = '🏃';
    if (item.category === 'cardio') emoji = '🚴';
    else if (item.category === 'flexibility') emoji = '🧘';
    else if (item.category === 'recreation') emoji = '🌱';
    else if (item.category === 'fitness') emoji = '💪';

    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    itemEl.innerHTML = `
      <div class="history-item-top">
        <div class="history-item-left">
          <div class="log-badge-icon badge-${item.category}">${emoji}</div>
          <div class="history-item-info">
            <span class="history-item-name">${item.name}</span>
            <span class="history-item-date">${dateFormatted} • ${timeFormatted}</span>
          </div>
        </div>
        <div class="history-item-right">
          <div class="history-item-stats">
            <span class="history-item-dur">${item.duration} mins</span>
            <span class="history-item-cal">${item.calories} kcal</span>
          </div>
          <button class="btn-delete-log" data-id="${item.id}" title="Delete Log">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="history-item-meta">
        <span class="meta-tag meta-category badge-${item.category}">${item.category.toUpperCase()}</span>
        <span class="meta-tag meta-intensity">Effort: ${item.intensity}/10</span>
      </div>
      ${item.notes ? `<p class="history-item-notes">"${item.notes}"</p>` : ''}
    `;
    allLogsListContainer.appendChild(itemEl);
  });
}

// Delete Log function
async function deleteLog(id) {
  const item = state.activities.find(a => a.id === id);
  if (!item) return;

  try {
    await apiDeleteActivity(id);

    state.activities = state.activities.filter(a => a.id !== id);

    renderRecentLogs();
    renderAllLogs(filterCategoryEl.value);
    updateSummaryCards();
    updateCharts(state.activities);

    showToast('Zzzapped! 💥', `"${item.name}" has been zzzapped from your logs.`);
  } catch (err) {
    showToast('Delete Failed', err.message);
  }
}
