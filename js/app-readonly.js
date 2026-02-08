/**
 * Read-Only Application Module
 * Stripped down version for kids to view tasks without editing
 * Self-contained with all helper functions
 */

// App state
let appData = null;
let currentKid = 'olive';
let currentView = 'dashboard';

// DOM Elements
const taskList = document.getElementById('taskList');
const bottomNav = document.getElementById('bottomNav');

// ============================================
// HELPER FUNCTIONS (self-contained)
// ============================================

/**
 * Get local date string in YYYY-MM-DD format
 */
function getLocalDateString(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get week number for a date
 */
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Format money value
 */
function formatMoney(amount) {
    return '$' + amount.toFixed(2);
}

/**
 * Calculate kid stats for current week
 */
function calculateKidStats(data, kidId, currentWeek) {
    const kid = data.kids[kidId];
    let weeklyCompleted = 0;
    let weeklyTotal = 0;
    let lifetimePoints = 0;
    let streak = 0;
    let level = 1;

    // Calculate weekly stats
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = getLocalDateString(date);
        const dayOfWeek = date.getDay();

        if (getWeekNumber(date) !== currentWeek) continue;

        kid.tasks.forEach(task => {
            if (task.activeDays.includes(dayOfWeek)) {
                weeklyTotal++;
                if (kid.history[dateStr]?.tasks?.[task.id]?.completed) {
                    weeklyCompleted++;
                }
            }
        });
    }

    // Calculate lifetime points from history
    Object.entries(kid.history || {}).forEach(([dateStr, dayData]) => {
        if (dayData.tasks) {
            Object.entries(dayData.tasks).forEach(([taskId, taskData]) => {
                if (taskData.completed) {
                    const task = kid.tasks.find(t => t.id === taskId);
                    if (task) lifetimePoints += task.points;
                }
            });
        }
    });

    // Add bonus/penalty points
    if (data.pointsLog) {
        data.pointsLog.filter(p => p.kidId === kidId).forEach(entry => {
            lifetimePoints += entry.type === 'bonus' ? entry.points : -entry.points;
        });
    }

    // Calculate level (every 50 points = 1 level)
    level = Math.floor(lifetimePoints / 50) + 1;
    if (level < 1) level = 1;

    // Calculate streak
    streak = kid.streak || 0;

    return { weeklyCompleted, weeklyTotal, lifetimePoints, level, streak };
}

/**
 * Render level badge
 */
function renderLevelBadge(level) {
    return `<span class="level-badge">Lvl ${level}</span>`;
}

/**
 * Render streak badge
 */
function renderStreakBadge(streak) {
    if (streak < 1) return '';
    return `<span class="streak-badge">🔥 ${streak}</span>`;
}

/**
 * Build dot matrix HTML for a task
 */
function buildDotMatrix(history, taskId, activeDays) {
    const days = [];
    const today = new Date();

    for (let i = 24; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date);
    }

    return days.map(date => {
        const dateStr = getLocalDateString(date);
        const dayOfWeek = date.getDay();
        const isActive = activeDays.includes(dayOfWeek);
        const isCompleted = history[dateStr]?.tasks?.[taskId]?.completed || false;
        const isFuture = date > today;
        const isToday = dateStr === getLocalDateString(today);

        if (!isActive) {
            return `<span class="dot inactive"></span>`;
        }
        if (isFuture) {
            return `<span class="dot future"></span>`;
        }
        if (isCompleted) {
            return `<span class="dot completed"></span>`;
        }
        return `<span class="dot incomplete"></span>`;
    }).join('');
}

/**
 * Update navigation money display
 */
function updateNavMoney(data) {
    ['olive', 'miles', 'zander'].forEach(kidId => {
        const el = document.getElementById(`${kidId}Money`);
        if (el && data.kids[kidId]) {
            el.textContent = formatMoney(Storage.calculateWeeklyMoney(data, kidId));
        }
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// MAIN APP LOGIC
// ============================================

/**
 * Initialize the app
 */
function init() {
    try {
        // Load data
        appData = Storage.loadData();
        console.log('Read-only view loaded');

        // Set up event listeners
        setupEventListeners();

        // Clear any default active nav items since we start on dashboard
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

        // Initial render
        Components.renderDayHeaders(document.getElementById('dayHeaders'));
        Components.updateWeekInfo();
        renderCurrentView();
        updateNavMoney(appData);

        // Initialize Firebase sync (read-only listener)
        initFirebaseSync();
    } catch (error) {
        console.error('Init error:', error);
        taskList.innerHTML = `
            <div style="color: red; padding: 20px;">
                <h3>Error loading app:</h3>
                <pre>${error.message}</pre>
            </div>
        `;
    }
}

/**
 * Set up event listeners (minimal - view only)
 */
function setupEventListeners() {
    // Navigation only
    bottomNav.addEventListener('click', handleNavClick);

    // Home button (app title)
    document.getElementById('homeBtn').addEventListener('click', () => {
        currentView = 'dashboard';
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        renderCurrentView();
    });
}

/**
 * Handle navigation clicks
 */
function handleNavClick(e) {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;

    const kidId = navItem.dataset.kid;
    if (kidId) {
        currentKid = kidId;
        currentView = 'tasks';

        // Update active state
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');

        renderCurrentView();
    }
}

/**
 * Render the current view
 */
function renderCurrentView() {
    const summaryBar = document.getElementById('summaryBar');
    const dayHeaders = document.getElementById('dayHeaders');

    if (currentView === 'dashboard') {
        // Hide kid-specific UI
        summaryBar.style.display = 'none';
        dayHeaders.style.display = 'none';

        // Render dashboard
        renderDashboard();
    } else {
        // Show kid-specific UI
        summaryBar.style.display = 'flex';
        dayHeaders.style.display = 'flex';

        // Render tasks
        renderTasks();
    }
}

/**
 * Render dashboard with all kids
 */
function renderDashboard() {
    const kids = ['olive', 'miles', 'zander'];
    const today = getLocalDateString();
    const dayOfWeek = new Date().getDay();
    const currentWeek = getWeekNumber(new Date());

    let html = `
        <div class="dashboard-header">
            <h2>📊 This Week's Summary</h2>
        </div>
    `;

    kids.forEach(kidId => {
        const kid = appData.kids[kidId];
        const stats = calculateKidStats(appData, kidId, currentWeek);
        const weeklyMoney = Storage.calculateWeeklyMoney(appData, kidId);

        // Get today's completion status
        const todaysTasks = kid.tasks.filter(t => t.activeDays.includes(dayOfWeek));
        const completedToday = todaysTasks.filter(t =>
            kid.history[today]?.tasks?.[t.id]?.completed
        ).length;
        const totalToday = todaysTasks.length;

        html += `
            <div class="dashboard-card" data-kid="${kidId}">
                <div class="dashboard-card-header">
                    <img src="${kid.avatar}" alt="${kid.name}" class="dashboard-avatar">
                    <div class="dashboard-info">
                        <h3>${kid.name}</h3>
                        <div class="dashboard-badges">
                            ${renderLevelBadge(stats.level)}
                            ${renderStreakBadge(stats.streak)}
                        </div>
                    </div>
                    <div class="dashboard-money">${formatMoney(weeklyMoney)}</div>
                </div>
                <div class="dashboard-card-stats">
                    <div class="stat">
                        <span class="stat-value">${completedToday}/${totalToday}</span>
                        <span class="stat-label">Today</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${stats.weeklyCompleted}/${stats.weeklyTotal}</span>
                        <span class="stat-label">This Week</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${stats.lifetimePoints}</span>
                        <span class="stat-label">Total Points</span>
                    </div>
                </div>
                <div class="dashboard-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.weeklyTotal > 0 ? (stats.weeklyCompleted / stats.weeklyTotal * 100) : 0}%"></div>
                    </div>
                </div>
            </div>
        `;
    });

    taskList.innerHTML = html;
}

/**
 * Render tasks for current kid (view-only)
 */
function renderTasks() {
    const kid = appData.kids[currentKid];
    if (!kid) return;

    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentWeek = getWeekNumber(today);
    const todayStr = getLocalDateString();

    // Calculate stats
    const stats = calculateKidStats(appData, currentKid, currentWeek);

    // Update summary bar
    document.getElementById('totalPoints').textContent = `${stats.weeklyCompleted}/${stats.weeklyTotal}`;
    document.getElementById('weeklyMoney').textContent = formatMoney(Storage.calculateWeeklyMoney(appData, currentKid));

    // Get today's tasks
    const todaysTasks = kid.tasks.filter(task => task.activeDays.includes(dayOfWeek));

    if (todaysTasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>No tasks for today</p>
            </div>
        `;
        return;
    }

    let html = '';
    todaysTasks.forEach(task => {
        const isCompleted = kid.history[todayStr]?.tasks?.[task.id]?.completed || false;
        const dotMatrix = buildDotMatrix(kid.history, task.id, task.activeDays);

        html += `
            <div class="task-card ${isCompleted ? 'completed' : ''}">
                <div class="task-main">
                    <span class="task-icon">${task.icon}</span>
                    <div class="task-info">
                        <span class="task-name">${escapeHtml(task.name)}</span>
                        <span class="task-points">${task.points} pts</span>
                    </div>
                    <div class="task-status">
                        ${isCompleted ? '✓' : '○'}
                    </div>
                </div>
                <div class="dot-matrix">${dotMatrix}</div>
            </div>
        `;
    });

    taskList.innerHTML = html;
}

/**
 * Initialize Firebase sync (read-only)
 */
function initFirebaseSync() {
    if (typeof FirebaseSync === 'undefined') {
        console.log('Firebase not available');
        return;
    }

    // Initialize Firebase with callback for remote changes
    const initialized = FirebaseSync.init((remoteData) => {
        console.log('Remote data received');
        appData = Storage.mergeData(appData, remoteData);
        Storage.saveData(appData, false); // Save locally but don't push
        renderCurrentView();
        updateNavMoney(appData);
        updateSyncIndicator('synced');
    });

    if (initialized) {
        updateSyncIndicator('synced');
    } else {
        updateSyncIndicator('offline');
    }
}

/**
 * Update sync indicator
 */
function updateSyncIndicator(status) {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;

    switch (status) {
        case 'synced':
            indicator.textContent = '☁️';
            indicator.title = 'Connected to cloud';
            break;
        case 'syncing':
            indicator.textContent = '🔄';
            indicator.title = 'Syncing...';
            break;
        case 'offline':
            indicator.textContent = '📴';
            indicator.title = 'Offline';
            break;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
