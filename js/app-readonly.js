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
let weekOffset = 0; // 0 = current week, -1 = last week, etc.

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

// NOTE: Weekly stats use Storage.calculateWeekPoints() which uses the correct
// completions key format (kidId_taskId_YYYY-MM-DD). Do NOT use kid.history
// as that format no longer exists in the data.

/**
 * Get week start date for a given offset from the current week
 */
function getWeekStartForOffset(offset) {
    const currentWeekStart = Storage.getWeekStart(new Date());
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + offset * 7);
    return d;
}

/**
 * Render day headers with prev/next week navigation arrows
 */
function renderWeekNavHeaders() {
    const container = document.getElementById('dayHeaders');
    const weekStart = getWeekStartForOffset(weekOffset);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        days.push(d);
    }

    const todayStr = getLocalDateString();
    const selectedStr = getLocalDateString(selectedDate);
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const canGoPrev = weekOffset > -4;
    const canGoNext = weekOffset < 0;

    container.innerHTML = `
        <button type="button" class="week-nav-btn" id="prevWeekBtn" ${canGoPrev ? '' : 'disabled'} aria-label="Previous week">&#8249;</button>
        <div class="days-container week-nav-days">
            ${days.map(date => {
                const dateStr = getLocalDateString(date);
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const isSelected = dateStr === selectedStr;
                let cls = 'day-label';
                if (isToday) cls += ' today';
                if (isSelected && !isToday) cls += ' selected-day';
                return `<div class="${cls}" data-date="${dateStr}" ${isFuture ? 'style="opacity:0.35;pointer-events:none;cursor:default;"' : ''}>
                    ${dayNames[date.getDay()]}<br>${date.getDate()}
                </div>`;
            }).join('')}
        </div>
        <button type="button" class="week-nav-btn" id="nextWeekBtn" ${canGoNext ? '' : 'disabled'} aria-label="Next week">&#8250;</button>
    `;

    // Attach prev/next click handlers
    const prevBtn = document.getElementById('prevWeekBtn');
    const nextBtn = document.getElementById('nextWeekBtn');

    if (prevBtn && canGoPrev) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            weekOffset--;
            // Select the last non-future day in the new week
            const newWeekStart = getWeekStartForOffset(weekOffset);
            const newWeekEnd = new Date(newWeekStart);
            newWeekEnd.setDate(newWeekStart.getDate() + 6);
            const todayDate = new Date(todayStr + 'T12:00:00');
            selectedDate = newWeekEnd > todayDate ? todayDate : newWeekEnd;
            renderWeekNavHeaders();
            renderTasks();
        });
    }

    if (nextBtn && canGoNext) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            weekOffset++;
            if (weekOffset === 0) {
                selectedDate = new Date(); // Back to today
            } else {
                selectedDate = getWeekStartForOffset(weekOffset);
            }
            renderWeekNavHeaders();
            renderTasks();
        });
    }
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
        renderWeekNavHeaders();
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
        weekOffset = 0;
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
            weekOffset = 0;

            // Update nav active state
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.kid === kidId);
            });

            renderCurrentView();
        }
    });

    // Day header clicks - navigate to that day's tasks
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
        renderWeekNavHeaders();
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
        weekOffset = 0;

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

        // Render week nav headers (highlights selected day) + render tasks
        renderWeekNavHeaders();
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

    // Update summary bar with weekly totals using Storage functions
    // (these use the correct completions key format)
    try {
        const weeklyMoney = Storage.calculateWeeklyMoney(appData, currentKid);
        document.getElementById('weeklyMoney').textContent = formatMoney(weeklyMoney);

        const weekPoints = Storage.calculateWeekPoints(appData, currentKid, appData.settings.weekStart);
        document.getElementById('totalPoints').textContent = `${weekPoints.earned}/${weekPoints.possible}`;
    } catch (e) {
        console.error('Error calculating stats:', e);
        document.getElementById('totalPoints').textContent = '--';
        document.getElementById('weeklyMoney').textContent = '$--';
    }

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
