/**
 * Read-Only Application Module
 * Stripped down version for kids to view tasks without editing
 */

// App state
let appData = null;
let currentKid = 'olive';
let currentView = 'dashboard';

// DOM Elements
const taskList = document.getElementById('taskList');
const bottomNav = document.getElementById('bottomNav');

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
        Components.updateNavMoney(appData);

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
    const today = Components.getLocalDateString();
    const dayOfWeek = new Date().getDay();
    const currentWeek = Components.getWeekNumber(new Date());

    let html = `
        <div class="dashboard-header">
            <h2>📊 This Week's Summary</h2>
        </div>
    `;

    kids.forEach(kidId => {
        const kid = appData.kids[kidId];
        const stats = Components.calculateKidStats(appData, kidId, currentWeek);
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
                            ${Components.renderLevelBadge(stats.level)}
                            ${Components.renderStreakBadge(stats.streak)}
                        </div>
                    </div>
                    <div class="dashboard-money">${Components.formatMoney(weeklyMoney)}</div>
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
    const currentWeek = Components.getWeekNumber(today);
    const todayStr = Components.getLocalDateString();

    // Calculate stats
    const stats = Components.calculateKidStats(appData, currentKid, currentWeek);

    // Update summary bar
    document.getElementById('totalPoints').textContent = `${stats.weeklyCompleted}/${stats.weeklyTotal}`;
    document.getElementById('weeklyMoney').textContent = Components.formatMoney(Storage.calculateWeeklyMoney(appData, currentKid));

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
        const dotMatrix = Components.buildDotMatrix(kid.history, task.id, task.activeDays);

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

    // Listen for remote changes only
    FirebaseSync.onDataChange((remoteData) => {
        console.log('Remote data received');
        appData = Storage.mergeData(appData, remoteData);
        Storage.saveData(appData, false); // Save locally but don't push
        renderCurrentView();
        Components.updateNavMoney(appData);
        updateSyncIndicator('synced');
    });

    updateSyncIndicator('synced');
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

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
