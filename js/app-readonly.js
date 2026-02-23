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
    return `<span class="streak-badge">\u{1F525} ${streak}</span>`;
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
        selectedDate = new Date();
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
            selectedDate = new Date();

            // Update nav active state
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.kid === kidId);
            });

            renderCurrentView();
        }
    });

    // Day header clicks - navigate to that day's tasks
    // Uses the EXISTING dayHeaders element rendered by Components.renderDayHeaders
    document.getElementById('dayHeaders').addEventListener('click', (e) => {
        const dayLabel = e.target.closest('.day-label');
        if (!dayLabel) return;

        const dateStr = dayLabel.dataset.date;
        if (!dateStr) return;

        // Don't allow clicking future dates
        const todayStr = getLocalDateString();
        if (dateStr > todayStr) return;

        // Set selected date and re-render
        selectedDate = new Date(dateStr + 'T12:00:00');
        highlightSelectedDay();
        renderTasks();
    });

    // Reload button - force refresh the page
    document.getElementById('reloadBtn').addEventListener('click', () => {
        window.location.reload(true);
    });
}

/**
 * Highlight the selected day in the day headers
 */
function highlightSelectedDay() {
    const selectedStr = getLocalDateString(selectedDate);
    const todayStr = getLocalDateString();
    const dayHeaders = document.getElementById('dayHeaders');

    // Remove all existing highlights
    dayHeaders.querySelectorAll('.day-label').forEach(label => {
        label.classList.remove('today', 'selected-day');

        const labelDate = label.dataset.date;
        if (labelDate === todayStr) {
            // Today always gets the 'today' class
            label.classList.add('today');
        }
        if (labelDate === selectedStr && labelDate !== todayStr) {
            // Selected day (if not today) gets a 'selected-day' class
            label.classList.add('selected-day');
        }
        if (labelDate === selectedStr && labelDate === todayStr) {
            // If selected day IS today, just keep 'today'
            label.classList.add('today');
        }
    });

    // Add pointer cursor to past/today days
    dayHeaders.querySelectorAll('.day-label').forEach(label => {
        const labelDate = label.dataset.date;
        if (labelDate && labelDate <= todayStr) {
            label.style.cursor = 'pointer';
        }
    });

    // Inject selected-day style if not already present
    if (!document.getElementById('selected-day-style')) {
        const style = document.createElement('style');
        style.id = 'selected-day-style';
        style.textContent = `
            .day-label.selected-day {
                color: var(--color-yellow, #fbbf24) !important;
                font-weight: 700 !important;
                background: rgba(251, 191, 36, 0.15) !important;
                border-radius: 6px !important;
                padding: 4px 8px !important;
            }
            .day-label {
                cursor: pointer;
                transition: all 0.15s;
            }
            .day-label:active {
                transform: scale(0.92);
            }
        `;
        document.head.appendChild(style);
    }
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

        // Highlight selected day + render tasks
        highlightSelectedDay();
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
 * Render tasks for current kid on the selected date (view-only)
 */
function renderTasks() {
    const kid = appData.kids[currentKid];
    if (!kid) {
        console.error('Kid not found:', currentKid);
        taskList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">\u26a0\ufe0f</span>
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

    // Update summary bar with weekly totals
    const weeklyMoney = Storage.calculateWeeklyMoney(appData, currentKid);
    document.getElementById('weeklyMoney').textContent = formatMoney(weeklyMoney);

    // Calculate earned/possible for summary
    const currentWeek = getWeekNumber(new Date());
    const stats = calculateKidStats(appData, currentKid, currentWeek);
    document.getElementById('totalPoints').textContent = `${stats.weeklyCompleted}/${stats.weeklyTotal}`;

    // Get tasks active on the selected day
    const dayTasks = kid.tasks.filter(task => task.activeDays && task.activeDays.includes(dayOfWeek));

    if (dayTasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">${isViewingToday ? '\ud83d\udccb' : '\ud83d\ude34'}</span>
                <p>${isViewingToday ? 'No tasks for today' : 'No tasks on this day'}</p>
            </div>
        `;
        return;
    }

    // Clear task list
    taskList.innerHTML = '';

    // Add "Viewing [date]" label when looking at a past day
    if (!isViewingToday) {
        const label = document.createElement('div');
        label.style.cssText = 'text-align:center;padding:8px;font-size:0.8rem;font-weight:600;color:#fbbf24;background:rgba(251,191,36,0.08);border-radius:8px;margin-bottom:12px;';
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        label.textContent = '\ud83d\udcc5 ' + selectedDate.toLocaleDateString('en-US', options);
        taskList.appendChild(label);
    }

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
                    <div class="task-points">${task.points} points${task.bonusOnly ? ' <span class="bonus-badge">\u2b50 Bonus</span>' : ''}</div>
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
            indicator.textContent = '\u2601\ufe0f';
            indicator.title = 'Connected to cloud';
            break;
        case 'syncing':
            indicator.textContent = '\ud83d\udd04';
            indicator.title = 'Syncing...';
            break;
        case 'offline':
            indicator.textContent = '\ud83d\udcf4';
            indicator.title = 'Offline';
            break;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
