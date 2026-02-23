/**
 * Read-Only Application Module
 * Stripped down version for kids to view tasks without editing
 * Self-contained with all helper functions
 */

// App state
let appData = null;
let currentKid = 'oliver';
let currentView = 'dashboard';
let selectedDate = new Date(); // The date being viewed (defaults to today)

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
    ['oliver', 'miles', 'zander'].forEach(kidId => {
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
        selectedDate = new Date(); // Reset to today
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        renderCurrentView();
    });

    // Dashboard card clicks - navigate to kid tasks
    taskList.addEventListener('click', (e) => {
        const card = e.target.closest('.summary-card');
        if (card && card.dataset.kid) {
            const kidId = card.dataset.kid;
            currentKid = kidId;
            currentView = 'tasks';
            selectedDate = new Date(); // Start on today

            // Update nav active state
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.kid === kidId);
            });

            renderCurrentView();
        }
    });

    // Day navigator clicks
    document.getElementById('dayNav').addEventListener('click', (e) => {
        const dayItem = e.target.closest('.day-nav-item');
        if (!dayItem || dayItem.classList.contains('future')) return;

        const dateStr = dayItem.dataset.date;
        if (dateStr) {
            selectedDate = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
            renderDayNav();
            renderTasks();
        }
    });

    // Reload button - force refresh the page
    document.getElementById('reloadBtn').addEventListener('click', () => {
        window.location.reload(true); // Force reload from server
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
        selectedDate = new Date(); // Reset to today when switching kids

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
    const dayNav = document.getElementById('dayNav');
    const viewingLabel = document.getElementById('viewingLabel');

    if (currentView === 'dashboard') {
        // Hide kid-specific UI
        summaryBar.style.display = 'none';
        dayHeaders.style.display = 'none';
        dayNav.style.display = 'none';
        viewingLabel.style.display = 'none';

        // Render dashboard
        renderDashboard();
    } else {
        // Show kid-specific UI
        summaryBar.style.display = 'flex';
        dayHeaders.style.display = 'flex';
        dayNav.style.display = 'flex';

        // Render day nav + tasks
        renderDayNav();
        renderTasks();
    }
}

/**
 * Render dashboard with all kids
 */
function renderDashboard() {
    // Use the existing Components.renderDashboard which handles all the HTML/CSS properly
    Components.renderDashboard(appData, taskList);
}

/**
 * Render the day navigator strip showing each day of the current week
 */
function renderDayNav() {
    const dayNav = document.getElementById('dayNav');
    const viewingLabel = document.getElementById('viewingLabel');
    const today = new Date();
    const todayStr = getLocalDateString(today);
    const selectedStr = getLocalDateString(selectedDate);

    // Get current week days (Mon-Sun)
    const weekStart = Storage.getWeekStart(today);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        weekDays.push(d);
    }

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const kid = appData.kids[currentKid];

    dayNav.innerHTML = weekDays.map((date, i) => {
        const dateStr = getLocalDateString(date);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedStr;
        const isFuture = dateStr > todayStr;
        const dayNum = date.getDate();

        // Calculate completion status for this day
        let statusEmoji = '';
        if (!isFuture && kid && kid.tasks) {
            const dayOfWeek = date.getDay();
            const activeTasks = kid.tasks.filter(t => t.activeDays && t.activeDays.includes(dayOfWeek) && !t.bonusOnly);
            if (activeTasks.length > 0) {
                const completedCount = activeTasks.filter(t => Storage.isTaskCompleted(appData, currentKid, t.id, date)).length;
                if (completedCount === activeTasks.length) {
                    statusEmoji = '✅';
                } else if (completedCount > 0) {
                    statusEmoji = `${completedCount}/${activeTasks.length}`;
                } else if (dateStr < todayStr) {
                    statusEmoji = '❌';
                }
            }
        }

        const classes = ['day-nav-item'];
        if (isSelected) classes.push('active');
        if (isToday) classes.push('today');
        if (isFuture) classes.push('future');

        return `
            <button class="${classes.join(' ')}" data-date="${dateStr}">
                <span class="day-nav-label">${dayLabels[i]}</span>
                <span class="day-nav-date">${dayNum}</span>
                <span class="day-nav-status">${statusEmoji}</span>
            </button>
        `;
    }).join('');

    // Update viewing label
    const isViewingToday = selectedStr === todayStr;
    if (isViewingToday) {
        viewingLabel.style.display = 'none';
    } else {
        viewingLabel.style.display = 'block';
        viewingLabel.className = 'viewing-label is-past';
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        viewingLabel.textContent = `📅 Viewing: ${selectedDate.toLocaleDateString('en-US', options)}`;
    }
}

/**
 * Render tasks for current kid on the selected date (view-only)
 */
function renderTasks() {
    console.log('renderTasks called, currentKid:', currentKid, 'selectedDate:', getLocalDateString(selectedDate));

    const kid = appData.kids[currentKid];
    if (!kid) {
        console.error('Kid not found:', currentKid);
        taskList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Could not load data for ${currentKid}</p>
            </div>
        `;
        return;
    }

    // Ensure kid has required properties
    if (!kid.tasks) kid.tasks = [];

    const viewDate = selectedDate;
    const dayOfWeek = viewDate.getDay();
    const todayStr = getLocalDateString();
    const viewDateStr = getLocalDateString(viewDate);
    const isViewingToday = viewDateStr === todayStr;

    // Update summary bar
    document.getElementById('totalPoints').textContent = `${Storage.calculateWeekPoints(appData, currentKid, appData.settings.weekStart).earned}/${Storage.calculateWeekPoints(appData, currentKid, appData.settings.weekStart).possible}`;
    document.getElementById('weeklyMoney').textContent = formatMoney(Storage.calculateWeeklyMoney(appData, currentKid));

    // Get tasks active on the selected day
    const dayTasks = kid.tasks.filter(task => task.activeDays && task.activeDays.includes(dayOfWeek));

    if (dayTasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">${isViewingToday ? '📋' : '😴'}</span>
                <p>${isViewingToday ? 'No tasks for today' : 'No tasks on this day'}</p>
            </div>
        `;
        return;
    }

    // Clear task list
    taskList.innerHTML = '';

    // Render each task with the selected date's completion status
    dayTasks.forEach(task => {
        const isCompleted = Storage.isTaskCompleted(appData, currentKid, task.id, viewDate);
        const dimColor = Components.getDimColor(task.color);

        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;

        card.innerHTML = `
            <div class="task-header">
                <div class="task-icon" style="background: ${dimColor};">
                    ${task.icon}
                </div>
                <div class="task-info">
                    <div class="task-name">${escapeHtml(task.name)}</div>
                    <div class="task-points">${task.points} points${task.bonusOnly ? ' <span class="bonus-badge">⭐ Bonus</span>' : ''}</div>
                </div>
                <div class="task-toggle ${isCompleted ? 'completed' : ''}" 
                        style="${isCompleted ? `border-color: ${task.color}; background: ${dimColor};` : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="${isCompleted ? task.color : 'transparent'}" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `;

        taskList.appendChild(card);
    });
}

/**
 * Initialize Firebase sync (read-only)
 */
function initFirebaseSync() {
    if (typeof FirebaseSync === 'undefined') {
        console.log('FirebaseSync not available');
        updateSyncIndicator('offline');
        return;
    }

    // Initialize with callback for remote changes
    const success = FirebaseSync.init((remoteData) => {
        console.log('Remote data received, updating local');

        // Update local data with remote data (migrate old keys)
        appData = Storage.migrateData(remoteData);
        Storage.saveDataLocal(appData); // Save locally without triggering sync back

        // Refresh the UI
        renderCurrentView();
        updateNavMoney(appData);
        updateSyncIndicator('synced');
    });

    updateSyncIndicator(success ? 'synced' : 'offline');

    // If connected, load data from cloud
    if (success) {
        FirebaseSync.loadFromCloud().then((cloudData) => {
            if (cloudData && cloudData._lastUpdated) {
                console.log('Cloud data found, syncing');
                appData = Storage.migrateData(cloudData);
                Storage.saveDataLocal(appData);
                renderCurrentView();
                updateNavMoney(appData);
            }
        });
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
