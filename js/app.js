/**
 * Main Application Module
 */

// App state
let appData = null;
let currentKid = 'olive';
let currentView = 'dashboard'; // 'tasks' or 'dashboard' - start on dashboard
let editingTask = null;

// DOM Elements
const taskList = document.getElementById('taskList');
const bottomNav = document.getElementById('bottomNav');
const taskModal = document.getElementById('taskModal');
const settingsModal = document.getElementById('settingsModal');
const dayViewModal = document.getElementById('dayViewModal');
const pointsModal = document.getElementById('pointsModal');
const taskForm = document.getElementById('taskForm');
const pointsForm = document.getElementById('pointsForm');

/**
 * Initialize the app
 */
function init() {
    try {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js', { scope: '/kids/' })
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }

        // Load data
        appData = Storage.loadData();
        console.log('Data loaded:', appData);

        // Set up event listeners
        setupEventListeners();

        // Clear any default active nav items since we start on dashboard
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

        // Initial render
        Components.renderDayHeaders(document.getElementById('dayHeaders'));
        Components.updateWeekInfo();
        console.log('About to render view, currentView:', currentView);
        renderCurrentView();
        console.log('Rendered view');
        Components.updateNavMoney(appData);
        console.log('Init complete');

        // Add swipe gesture support
        setupSwipeGestures();

        // Initialize Firebase sync
        initFirebaseSync();
    } catch (error) {
        console.error('Init error:', error);
        document.getElementById('taskList').innerHTML = `
            <div style="color: red; padding: 20px;">
                <h3>Error loading app:</h3>
                <pre>${error.message}</pre>
            </div>
        `;
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Navigation
    bottomNav.addEventListener('click', handleNavClick);

    // Home button (app title)
    document.getElementById('homeBtn').addEventListener('click', () => {
        currentView = 'dashboard';
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        renderCurrentView();
    });

    // Add task button
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        openTaskModal();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);

    // Modal close buttons
    document.getElementById('modalClose').addEventListener('click', closeTaskModal);
    document.getElementById('settingsClose').addEventListener('click', closeSettingsModal);
    document.getElementById('dayViewClose').addEventListener('click', closeDayViewModal);

    // Close modals on overlay click
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) closeTaskModal();
    });
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettingsModal();
    });
    dayViewModal.addEventListener('click', (e) => {
        if (e.target === dayViewModal) closeDayViewModal();
    });

    // Task form submission
    taskForm.addEventListener('submit', handleTaskSubmit);

    // Delete task button
    document.getElementById('deleteTaskBtn').addEventListener('click', handleDeleteTask);

    // Icon picker
    document.getElementById('iconPicker').addEventListener('click', (e) => {
        if (e.target.classList.contains('icon-option')) {
            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    });

    // Color picker
    document.getElementById('colorPicker').addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option')) {
            document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    });

    // Day selector - toggle selection on click
    document.getElementById('daySelector').addEventListener('click', (e) => {
        if (e.target.classList.contains('day-btn')) {
            e.target.classList.toggle('selected');
        }
    });

    // Settings save
    document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);

    // Update app button
    document.getElementById('updateAppBtn').addEventListener('click', handleUpdateApp);

    // Handle keyboard escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTaskModal();
            closeSettingsModal();
            closeDayViewModal();
            closePointsModal();
        }
    });

    // Day headers click
    document.getElementById('dayHeaders').addEventListener('click', handleDayHeaderClick);

    // Bonus points button
    document.getElementById('bonusPointsBtn').addEventListener('click', openPointsModal);

    // Points modal close
    document.getElementById('pointsModalClose').addEventListener('click', closePointsModal);
    pointsModal.addEventListener('click', (e) => {
        if (e.target === pointsModal) closePointsModal();
    });

    // Points type selector
    document.querySelectorAll('.points-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.points-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Points form submission
    pointsForm.addEventListener('submit', handlePointsSubmit);
}

/**
 * Handle navigation click
 */
function handleNavClick(e) {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;

    const kidId = navItem.dataset.kid;

    // If clicking the already active kid, toggle to dashboard
    if (kidId === currentKid && currentView === 'tasks') {
        currentView = 'dashboard';
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    } else {
        switchToKid(kidId);
    }

    renderCurrentView();
}

/**
 * Switch to a specific kid's view
 */
function switchToKid(kidId) {
    currentKid = kidId;
    currentView = 'tasks';

    // Clear active from all nav items first
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        item.blur(); // Clear mobile focus state
    });

    // Add active to the correct nav item
    const activeNav = document.querySelector(`.nav-item[data-kid="${kidId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
}

/**
 * Render current view (tasks or dashboard)
 */
function renderCurrentView() {
    if (currentView === 'dashboard') {
        renderDashboardView();
    } else {
        renderTaskList();
    }

    // Update summary bar
    if (currentView === 'tasks') {
        Components.updateSummaryBar(appData, currentKid);
        document.getElementById('summaryBar').style.display = 'flex';
        document.getElementById('dayHeaders').style.display = 'flex';
    } else {
        document.getElementById('summaryBar').style.display = 'none';
        document.getElementById('dayHeaders').style.display = 'none';
    }
}

/**
 * Render dashboard view
 */
function renderDashboardView() {
    Components.renderDashboard(appData, taskList);

    // Add click handlers for leaderboard items
    taskList.querySelectorAll('.leaderboard-item, .summary-card').forEach(item => {
        item.addEventListener('click', () => {
            switchToKid(item.dataset.kid);
            renderCurrentView();
        });
    });
}

/**
 * Render task list for current kid
 */
function renderTaskList() {
    const kid = appData.kids[currentKid];
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

    taskList.innerHTML = '';

    // Filter tasks to only show ones active today
    const activeTasks = kid.tasks.filter(task => {
        const activeDays = task.activeDays || [0, 1, 2, 3, 4, 5, 6]; // Default all days
        const isActive = activeDays.includes(todayDayOfWeek);
        return isActive;
    });

    if (activeTasks.length === 0) {
        const emptyState = Components.renderEmptyState();
        taskList.appendChild(emptyState);

        // Add listener to empty state button
        document.getElementById('emptyAddTask')?.addEventListener('click', openTaskModal);
        return;
    }

    activeTasks.forEach(task => {
        const card = Components.renderTaskCard(
            task,
            currentKid,
            appData,
            handleToggleTask,
            openEditTaskModal
        );
        taskList.appendChild(card);
    });
}

/**
 * Handle task toggle
 */
function handleToggleTask(taskId) {
    const today = new Date();

    // Check if it was already a perfect day before toggle
    const wasPerfect = Storage.isPerfectDay(appData, currentKid, today);

    Storage.toggleTaskCompletion(appData, currentKid, taskId, today);

    // Check if now a perfect day after toggle
    const isPerfect = Storage.isPerfectDay(appData, currentKid, today);

    // Celebrate if we just achieved perfect day!
    if (!wasPerfect && isPerfect) {
        const streak = Storage.getCurrentStreak(appData, currentKid);
        if (streak >= 7) {
            Components.showCelebration('streak', `🔥 ${streak} Day Streak! Week Warrior!`);
        } else if (streak >= 3) {
            Components.showCelebration('streak', `🔥 ${streak} Day Streak!`);
        } else {
            Components.showCelebration('perfect', 'Perfect Day! 🎉');
        }
    }

    // Re-render
    renderCurrentView();
    Components.updateNavMoney(appData);
}

/**
 * Open task modal for new task
 */
function openTaskModal() {
    editingTask = null;
    document.getElementById('modalTitle').textContent = 'Add Task';
    document.getElementById('taskId').value = '';
    document.getElementById('taskName').value = '';
    document.getElementById('taskPoints').value = '1';
    document.getElementById('deleteTaskBtn').style.display = 'none';
    document.getElementById('kidSelectorGroup').style.display = 'block';

    // Reset selections
    document.querySelectorAll('.icon-option').forEach((opt, i) => {
        opt.classList.toggle('selected', i === 0);
    });
    document.querySelectorAll('.color-option').forEach((opt, i) => {
        opt.classList.toggle('selected', i === 0);
    });

    // Reset day selector - all days selected by default
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.add('selected');
    });

    // Reset kid checkboxes - check all by default
    document.querySelectorAll('#kidSelector input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });

    taskModal.classList.add('active');
    document.getElementById('taskName').focus();
}

/**
 * Open task modal for editing
 */
function openEditTaskModal(task) {
    editingTask = task;
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskPoints').value = task.points;
    document.getElementById('deleteTaskBtn').style.display = 'block';
    document.getElementById('kidSelectorGroup').style.display = 'none'; // Hide kid selector when editing

    // Select correct icon
    document.querySelectorAll('.icon-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === task.icon);
    });

    // Select correct color
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === task.color);
    });

    // Set active days - default to all days if not set
    const activeDays = task.activeDays || [0, 1, 2, 3, 4, 5, 6];
    document.querySelectorAll('.day-btn').forEach(btn => {
        const day = parseInt(btn.dataset.day);
        btn.classList.toggle('selected', activeDays.includes(day));
    });

    taskModal.classList.add('active');
}

/**
 * Close task modal
 */
function closeTaskModal() {
    taskModal.classList.remove('active');
    editingTask = null;
}

/**
 * Handle task form submission
 */
function handleTaskSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('taskName').value.trim();
    const points = parseInt(document.getElementById('taskPoints').value) || 1;
    const icon = document.querySelector('.icon-option.selected')?.dataset.icon || '📝';
    const color = document.querySelector('.color-option.selected')?.dataset.color || '#4ade80';

    // Get selected active days
    const activeDays = Array.from(document.querySelectorAll('.day-btn.selected'))
        .map(btn => parseInt(btn.dataset.day));

    if (!name) return;

    if (activeDays.length === 0) {
        alert('Please select at least one day');
        return;
    }

    if (editingTask) {
        // Update existing task for current kid only
        Storage.updateTask(appData, currentKid, editingTask.id, {
            name, points, icon, color, activeDays
        });
    } else {
        // Add new task to selected kids
        const selectedKids = Array.from(document.querySelectorAll('#kidSelector input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        if (selectedKids.length === 0) {
            alert('Please select at least one child');
            return;
        }

        selectedKids.forEach(kidId => {
            Storage.addTask(appData, kidId, {
                name, points, icon, color, activeDays
            });
        });
    }

    closeTaskModal();
    renderCurrentView();
    Components.updateNavMoney(appData);
}

/**
 * Handle delete task - deletes from ALL kids who have this task
 */
function handleDeleteTask() {
    if (!editingTask) return;

    if (confirm(`Delete "${editingTask.name}" for ALL children? This cannot be undone.`)) {
        const taskName = editingTask.name;

        // Delete from all kids who have a task with this name
        ['olive', 'miles', 'zander'].forEach(kidId => {
            const kid = appData.kids[kidId];
            const matchingTask = kid.tasks.find(t => t.name === taskName);
            if (matchingTask) {
                Storage.deleteTask(appData, kidId, matchingTask.id);
            }
        });

        closeTaskModal();
        renderCurrentView();
        Components.updateNavMoney(appData);
    }
}

/**
 * Open settings modal
 */
function openSettingsModal() {
    // Populate current values
    document.getElementById('oliveAllowance').value = appData.settings.allowances.olive;
    document.getElementById('milesAllowance').value = appData.settings.allowances.miles;
    document.getElementById('zanderAllowance').value = appData.settings.allowances.zander;

    settingsModal.classList.add('active');
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

/**
 * Handle save settings
 */
function handleSaveSettings() {
    appData.settings.allowances.olive = parseInt(document.getElementById('oliveAllowance').value) || 50;
    appData.settings.allowances.miles = parseInt(document.getElementById('milesAllowance').value) || 30;
    appData.settings.allowances.zander = parseInt(document.getElementById('zanderAllowance').value) || 20;

    Storage.saveData(appData);
    closeSettingsModal();
    renderCurrentView();
    Components.updateNavMoney(appData);
}

/**
 * Handle new week
 */
function handleNewWeek() {
    if (confirm('Start a new week? Current week progress will be saved in history.')) {
        Storage.startNewWeek(appData);
        closeSettingsModal();
        renderCurrentView();
        Components.updateNavMoney(appData);
        Components.updateWeekInfo();
    }
}

/**
 * Handle update app - force refresh service worker and reload
 */
async function handleUpdateApp() {
    const btn = document.getElementById('updateAppBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Updating...';
    btn.disabled = true;

    try {
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
            }
        }

        // Reload the page to get fresh files
        btn.textContent = '✓ Updated! Reloading...';
        setTimeout(() => {
            window.location.reload(true);
        }, 500);
    } catch (error) {
        console.error('Update failed:', error);
        btn.textContent = '❌ Update failed';
        btn.disabled = false;
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }
}

/**
 * Handle export data - download all data as JSON file
 */
function handleExportData() {
    try {
        const dataStr = JSON.stringify(appData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        // Create download link
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;

        // Create filename with date
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        link.download = `kids-tasks-backup-${dateStr}.json`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('✅ Data exported successfully!');
    } catch (error) {
        console.error('Export failed:', error);
        alert('❌ Export failed: ' + error.message);
    }
}

/**
 * Handle import data - restore from JSON file
 */
function handleImportData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
        try {
            const importedData = JSON.parse(event.target.result);

            // Validate the data structure
            if (!importedData.kids || !importedData.settings) {
                throw new Error('Invalid backup file - missing required data');
            }

            // Confirm before overwriting
            if (confirm('⚠️ This will replace ALL current data with the backup. Are you sure?')) {
                // Save the imported data
                Storage.saveData(importedData);
                appData = importedData;

                // Refresh the app
                renderCurrentView();
                Components.updateNavMoney(appData);
                closeSettingsModal();

                alert('✅ Data imported successfully!');
            }
        } catch (error) {
            console.error('Import failed:', error);
            alert('❌ Import failed: ' + error.message);
        }
    };

    reader.onerror = function () {
        alert('❌ Could not read the file');
    };

    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    e.target.value = '';
}

/**
 * Check if we should show the Monday backup reminder
 */
function checkBackupReminder() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday

    // Only show on Mondays
    if (dayOfWeek !== 1) return;

    // Check if we've already shown the reminder this week
    const lastReminderKey = 'lastBackupReminder';
    const lastReminder = localStorage.getItem(lastReminderKey);
    const todayStr = Storage.formatDate(today);

    // If we've already reminded today or this week (same week start)
    if (lastReminder) {
        const lastReminderDate = new Date(lastReminder);
        const weekStart = Storage.getWeekStart(today);
        const lastWeekStart = Storage.getWeekStart(lastReminderDate);

        // If the reminder was shown this week, don't show again
        if (weekStart.getTime() === lastWeekStart.getTime()) {
            return;
        }
    }

    // Show the backup reminder after a short delay
    setTimeout(() => {
        showBackupReminder();
        // Mark that we showed the reminder
        localStorage.setItem(lastReminderKey, todayStr);
    }, 1500);
}

/**
 * Show the backup reminder banner
 */
function showBackupReminder() {
    // Create reminder overlay
    const reminder = document.createElement('div');
    reminder.className = 'backup-reminder-overlay';
    reminder.innerHTML = `
        <div class="backup-reminder">
            <div class="backup-reminder-icon">📦</div>
            <div class="backup-reminder-content">
                <div class="backup-reminder-title">Weekly Backup Reminder</div>
                <div class="backup-reminder-text">It's Monday! Consider backing up your data to keep it safe.</div>
            </div>
            <div class="backup-reminder-actions">
                <button class="btn btn-primary" id="backupNowBtn">Backup Now</button>
                <button class="btn-text" id="backupLaterBtn">Later</button>
            </div>
        </div>
    `;

    document.body.appendChild(reminder);

    // Animate in
    setTimeout(() => reminder.classList.add('active'), 10);

    // Handle Backup Now button
    document.getElementById('backupNowBtn').addEventListener('click', () => {
        reminder.classList.remove('active');
        setTimeout(() => reminder.remove(), 300);
        handleExportData();
    });

    // Handle Later button
    document.getElementById('backupLaterBtn').addEventListener('click', () => {
        reminder.classList.remove('active');
        setTimeout(() => reminder.remove(), 300);
    });
}

/**
 * Initialize Firebase sync
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

        // Update local storage with remote data
        appData = remoteData;
        Storage.saveDataLocal(appData); // Save locally without triggering sync back

        // Refresh the UI
        renderCurrentView();
        Components.updateNavMoney(appData);

        // Show a subtle notification
        showSyncNotification('Data synced from cloud');
    });

    updateSyncIndicator(success ? 'connected' : 'offline');

    // If connected, do an initial sync to push local data
    if (success) {
        // Load from cloud first to check if there's existing data
        FirebaseSync.loadFromCloud().then((cloudData) => {
            if (cloudData && cloudData._lastUpdated) {
                // Cloud has data - merge or use cloud data
                console.log('Cloud data found, syncing');
                appData = cloudData;
                Storage.saveDataLocal(appData);
                renderCurrentView();
                Components.updateNavMoney(appData);
            } else {
                // No cloud data - push local data
                console.log('No cloud data, pushing local');
                FirebaseSync.syncToCloud(appData);
            }
        });
    }
}

/**
 * Update the sync status indicator
 */
function updateSyncIndicator(status) {
    let indicator = document.querySelector('.sync-indicator');

    if (!indicator) {
        // Create the indicator
        indicator = document.createElement('div');
        indicator.className = 'sync-indicator';
        document.querySelector('.app-header').appendChild(indicator);
    }

    indicator.className = 'sync-indicator ' + status;
    indicator.title = status === 'connected' ? 'Cloud sync active' : 'Offline mode';
    indicator.innerHTML = status === 'connected' ? '☁️' : '📴';
}

/**
 * Show a brief sync notification
 */
function showSyncNotification(message) {
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('active'), 10);

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Setup swipe gestures for navigation
 */
function setupSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;

    const kids = ['olive', 'miles', 'zander'];

    taskList.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    taskList.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const diff = touchStartX - touchEndX;
        const threshold = 50; // Lower threshold for better mobile response

        if (Math.abs(diff) < threshold) return;

        // If on dashboard, swipe left goes to first kid
        if (currentView === 'dashboard') {
            if (diff > 0) {
                switchToKid(kids[0]);
                renderCurrentView();
                Components.updateNavMoney(appData);
            }
            return;
        }

        const currentIndex = kids.indexOf(currentKid);

        if (diff > 0 && currentIndex < kids.length - 1) {
            // Swipe left - next kid
            switchToKid(kids[currentIndex + 1]);
            renderCurrentView();
            Components.updateNavMoney(appData);
        } else if (diff < 0 && currentIndex > 0) {
            // Swipe right - previous kid
            switchToKid(kids[currentIndex - 1]);
            renderCurrentView();
            Components.updateNavMoney(appData);
        } else if (diff < 0 && currentIndex === 0) {
            // Swipe right from first kid - go to dashboard
            currentView = 'dashboard';
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            renderCurrentView();
            Components.updateNavMoney(appData);
        }
    }
}

/**
 * Handle day header click - open day view modal
 */
function handleDayHeaderClick(e) {
    const dayLabel = e.target.closest('.day-label');
    if (!dayLabel) return;

    const dateStr = dayLabel.dataset.date;
    if (!dateStr) return;

    openDayViewModal(new Date(dateStr));
}

/**
 * Open day view modal for a specific date
 */
function openDayViewModal(date) {
    const dateStr = Storage.formatDate(date);
    const today = new Date();
    const isToday = Storage.formatDate(today) === dateStr;

    // Set title
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const title = isToday ? "Today's Tasks" : date.toLocaleDateString('en-US', options);
    document.getElementById('dayViewTitle').textContent = title;

    // Get tasks for this date
    // If viewing a specific kid's tasks, only show that kid
    // If on dashboard, show all kids
    const content = document.getElementById('dayViewContent');
    const kids = currentView === 'tasks' ? [currentKid] : ['olive', 'miles', 'zander'];

    let html = `
        <div class="day-view-summary">
            <div class="day-view-date">${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
    `;

    kids.forEach(kidId => {
        const kid = appData.kids[kidId];

        // Filter tasks active on this day
        const dayOfWeek = date.getDay();
        const activeTasks = kid.tasks.filter(task => {
            const activeDays = task.activeDays || [0, 1, 2, 3, 4, 5, 6];
            return activeDays.includes(dayOfWeek);
        });

        if (activeTasks.length === 0) return;

        const points = Storage.calculateDayPoints(appData, kidId, date);

        html += `
            <div class="day-kid-section">
                <div class="day-kid-header">
                    <img src="${kid.avatar}" alt="${kid.name}" class="day-kid-avatar">
                    <span class="day-kid-name">${kid.name}</span>
                    <span class="day-kid-points">${points.earned}/${points.possible} pts</span>
                </div>
                <div class="day-task-list">
        `;

        activeTasks.forEach(task => {
            const isCompleted = Storage.isTaskCompleted(appData, kidId, task.id, date);
            const dimColor = Components.getDimColor(task.color);

            html += `
                <div class="day-task-item" data-kid="${kidId}" data-task="${task.id}" data-date="${dateStr}">
                    <div class="day-task-icon" style="background: ${dimColor};">${task.icon}</div>
                    <div class="day-task-info">
                        <div class="day-task-name">${task.name}</div>
                        <div class="day-task-points">${task.points} points</div>
                    </div>
                    <div class="day-task-status ${isCompleted ? 'completed' : 'incomplete'}">
                        ${isCompleted ? '✓' : '✗'}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    content.innerHTML = html;

    // Add click handlers for toggling tasks
    content.querySelectorAll('.day-task-item').forEach(item => {
        item.addEventListener('click', () => {
            const kidId = item.dataset.kid;
            const taskId = item.dataset.task;
            const taskDate = new Date(item.dataset.date);

            Storage.toggleTaskCompletion(appData, kidId, taskId, taskDate);

            // Refresh the modal
            openDayViewModal(taskDate);

            // Refresh main view
            renderCurrentView();
            Components.updateNavMoney(appData);
        });
    });

    dayViewModal.classList.add('active');
}

/**
 * Close day view modal
 */
function closeDayViewModal() {
    dayViewModal.classList.remove('active');
}

/**
 * Open points modal
 */
function openPointsModal() {
    // Reset form
    document.getElementById('pointsAmount').value = '1';
    document.getElementById('pointsReason').value = '';

    // Reset type buttons
    document.querySelectorAll('.points-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'bonus');
    });

    // Reset kid selection to current kid or first
    const currentKidRadio = document.querySelector(`input[name="pointsKid"][value="${currentKid}"]`);
    if (currentKidRadio) {
        currentKidRadio.checked = true;
    } else {
        document.querySelector('input[name="pointsKid"]').checked = true;
    }

    // Render recent adjustments log
    renderPointsLog();

    pointsModal.classList.add('active');
    document.getElementById('pointsReason').focus();
}

/**
 * Close points modal
 */
function closePointsModal() {
    pointsModal.classList.remove('active');
}

/**
 * Handle points form submission
 */
function handlePointsSubmit(e) {
    e.preventDefault();

    const kidId = document.querySelector('input[name="pointsKid"]:checked')?.value;
    const amount = parseInt(document.getElementById('pointsAmount').value) || 1;
    const reason = document.getElementById('pointsReason').value.trim();
    const type = document.querySelector('.points-type-btn.active')?.dataset.type || 'bonus';

    if (!kidId || !reason) {
        alert('Please select a child and enter a reason');
        return;
    }

    Storage.addPointsAdjustment(appData, kidId, amount, reason, type);

    // Clear form
    document.getElementById('pointsReason').value = '';
    document.getElementById('pointsAmount').value = '1';

    // Switch to the kid who received the points so user sees the update
    if (currentKid !== kidId) {
        switchToKid(kidId);
    }

    // Close modal and update displays
    closePointsModal();
    renderCurrentView();
    Components.updateNavMoney(appData);
}

/**
 * Render points adjustment log
 */
function renderPointsLog() {
    const logList = document.getElementById('pointsLogList');
    const adjustments = Storage.getPointsAdjustments(appData, null, 10);

    if (adjustments.length === 0) {
        logList.innerHTML = '<div class="points-log-empty">No point adjustments yet</div>';
        return;
    }

    logList.innerHTML = adjustments.map(adj => {
        const kid = appData.kids[adj.kidId];
        const dateObj = new Date(adj.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const sign = adj.type === 'bonus' ? '+' : '-';

        return `
            <div class="points-log-item" data-adj-id="${adj.id}">
                <img src="${kid.avatar}" alt="${kid.name}" class="points-log-avatar">
                <div class="points-log-info">
                    <div class="points-log-reason">${escapeHtml(adj.reason)}</div>
                    <div class="points-log-date">${kid.name} • ${dateStr}</div>
                </div>
                <div class="points-log-amount ${adj.type}">${sign}${adj.amount}</div>
                <button class="points-log-delete" data-adj-id="${adj.id}" title="Delete">×</button>
            </div>
        `;
    }).join('');

    // Add delete handlers
    logList.querySelectorAll('.points-log-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const adjId = btn.dataset.adjId;
            Storage.deletePointsAdjustment(appData, adjId);
            renderPointsLog();
            renderCurrentView();
            Components.updateNavMoney(appData);
        });
    });
}

/**
 * Escape HTML helper
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
