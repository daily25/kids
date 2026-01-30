/**
 * Components Module - UI rendering functions
 */

/**
 * Render task card with dot matrix
 */
function renderTaskCard(task, kidId, data, onToggle, onEdit) {
    const today = new Date();
    const days = Storage.getLastNDays(28); // Show last 4 weeks

    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;

    // Check if completed today
    const completedToday = Storage.isTaskCompleted(data, kidId, task.id, today);

    // Get dim color for incomplete dots
    const dimColor = getDimColor(task.color);

    card.innerHTML = `
        <div class="task-header">
            <div class="task-icon" style="background: ${dimColor};">
                ${task.icon}
            </div>
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.name)}</div>
                <div class="task-points">${task.points} points</div>
            </div>
            <button class="task-toggle ${completedToday ? 'completed' : ''}" 
                    style="${completedToday ? `border-color: ${task.color}; background: ${dimColor};` : ''}"
                    data-task-id="${task.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="${completedToday ? task.color : 'transparent'}" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </button>
        </div>
        <div class="dot-matrix" data-task-id="${task.id}">
            ${days.map(date => {
        const isCompleted = Storage.isTaskCompleted(data, kidId, task.id, date);
        const isFuture = date > today;
        const isToday = Storage.formatDate(date) === Storage.formatDate(today);

        let className = 'dot';
        if (isFuture) className += ' future';
        else if (isCompleted) className += ' completed';
        else className += ' incomplete';

        const bgColor = isFuture ? '#333' : (isCompleted ? task.color : dimColor);

        return `<div class="${className}" 
                            style="background: ${bgColor};"
                            title="${date.toLocaleDateString()}${isToday ? ' (Today)' : ''}">
                        </div>`;
    }).join('')}
        </div>
    `;

    // Toggle button click
    const toggleBtn = card.querySelector('.task-toggle');
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggle(task.id);
    });

    // Card click for edit
    card.addEventListener('click', () => {
        onEdit(task);
    });

    return card;
}

/**
 * Render day headers (Mon-Sun week)
 */
function renderDayHeaders(container) {
    const weekStart = Storage.getWeekStart(new Date());
    const days = getWeekDatesLocal(weekStart);
    const today = new Date();
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    container.innerHTML = `
        <span class="day-spacer"></span>
        <div class="days-container">
            ${days.map(date => {
        const isToday = Storage.formatDate(date) === Storage.formatDate(today);
        const dateStr = Storage.formatDate(date);
        return `<div class="day-label ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    ${dayNames[date.getDay()]}<br>${date.getDate()}
                </div>`;
    }).join('')}
        </div>
    `;
}

/**
 * Get dates for a week starting from the given date (Mon-Sun)
 */
function getWeekDatesLocal(startDate) {
    const dates = [];
    const start = new Date(startDate);
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * Render empty state
 */
function renderEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No tasks yet for this child.<br>Add some tasks to get started!</div>
        <button class="btn btn-primary" id="emptyAddTask">Add First Task</button>
    `;
    return div;
}

/**
 * Render leaderboard/dashboard view
 */
function renderDashboard(data, container) {
    const leaderboard = Storage.getLeaderboard(data);
    const weekNum = Storage.getWeekNumber(new Date());

    container.innerHTML = `
        <div class="dashboard">
            <div class="dashboard-header">
                <h2 class="dashboard-title">🏆 Week ${weekNum} Leaderboard</h2>
            </div>
            
            <div class="leaderboard">
                ${leaderboard.map((kid, index) => `
                    <div class="leaderboard-item ${index === 0 ? 'leader' : ''}" data-kid="${kid.id}">
                        <div class="leaderboard-rank">${index === 0 ? '👑' : index + 1}</div>
                        <img src="${kid.avatar}" alt="${kid.name}" class="leaderboard-avatar">
                        <div class="leaderboard-info">
                            <div class="leaderboard-name">${kid.name}</div>
                            <div class="leaderboard-stats">
                                <span class="stat-money">$${kid.money.toFixed(2)}</span>
                                <span class="stat-level">⭐ Lv.${kid.level.level}</span>
                                ${kid.streak > 0 ? `<span class="stat-streak">🔥${kid.streak}</span>` : ''}
                            </div>
                            <div class="leaderboard-stats-secondary">
                                <span class="stat-points">${kid.earnedPoints}/${kid.possiblePoints} pts</span>
                            </div>
                            <div class="leaderboard-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${kid.percentage}%; background: ${getProgressColor(kid.percentage)};"></div>
                                </div>
                                <span class="progress-text">${kid.percentage}%</span>
                            </div>
                        </div>
                        <div class="leaderboard-badges">
                            ${kid.badges.slice(0, 3).map(badge =>
        `<span class="badge-mini" title="${badge.name}: ${badge.count}">${badge.icon}</span>`
    ).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="dashboard-summary">
                <h3>📊 This Week's Summary</h3>
                <div class="summary-cards">
                    ${leaderboard.map(kid => `
                        <div class="summary-card" data-kid="${kid.id}">
                            <img src="${kid.avatar}" alt="${kid.name}" class="summary-avatar">
                            <div class="summary-name">${kid.name}</div>
                            <div class="summary-money">$${kid.money.toFixed(2)}</div>
                            <div class="summary-max">of $${kid.maxMoney}</div>
                            ${kid.badges.length > 0 ? `
                                <div class="summary-badges">
                                    ${kid.badges.map(b => `<span title="${b.name}: ${b.count}x">${b.icon}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Get color based on percentage
 */
function getProgressColor(percentage) {
    if (percentage >= 80) return '#4ade80';
    if (percentage >= 50) return '#fbbf24';
    return '#f87171';
}

/**
 * Get dimmed version of a color
 */
function getDimColor(color) {
    // Convert hex to RGB, then darken
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Darken by 70%
    const factor = 0.3;
    const dr = Math.round(r * factor);
    const dg = Math.round(g * factor);
    const db = Math.round(b * factor);

    return `rgb(${dr}, ${dg}, ${db})`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update navigation money displays
 */
function updateNavMoney(data) {
    const kids = ['olive', 'miles', 'zander'];
    kids.forEach(kidId => {
        const money = Storage.calculateWeeklyMoney(data, kidId);
        const el = document.getElementById(`${kidId}Money`);
        if (el) {
            el.textContent = `$${money.toFixed(0)}`;
        }
    });
}

/**
 * Update summary bar - shows WEEKLY points (bonus adds to both earned AND possible)
 */
function updateSummaryBar(data, kidId) {
    const weekStart = data.settings.weekStart || Storage.getWeekStart(new Date()).toISOString();
    const points = Storage.calculateWeekPoints(data, kidId, weekStart);
    const bonusPoints = Storage.getWeeklyBonusPoints(data, kidId);
    const money = Storage.calculateWeeklyMoney(data, kidId);

    // Bonus points add to BOTH earned AND possible
    const totalEarned = points.earned + bonusPoints;
    const totalPossible = points.possible + bonusPoints;

    document.getElementById('totalPoints').textContent = `${totalEarned}/${totalPossible}`;
    document.getElementById('weeklyMoney').textContent = `$${money.toFixed(2)}`;
}

/**
 * Update week info display
 */
function updateWeekInfo() {
    const weekNum = Storage.getWeekNumber(new Date());
    const el = document.getElementById('weekInfo');
    if (el) {
        el.textContent = `Week ${weekNum}`;
    }
}

// Export functions
window.Components = {
    renderTaskCard,
    renderDayHeaders,
    renderEmptyState,
    renderDashboard,
    updateNavMoney,
    updateSummaryBar,
    updateWeekInfo,
    getDimColor,
    getProgressColor,
    showCelebration
};

/**
 * Show celebration animation
 */
function showCelebration(type = 'perfect', message = 'Perfect Day!') {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';

    const emojis = {
        perfect: '🎉',
        streak: '🔥',
        levelup: '⭐',
        badge: '🏆'
    };

    overlay.innerHTML = `
        <div class="celebration-content">
            <div class="celebration-emoji">${emojis[type] || '🎉'}</div>
            <div class="celebration-text">${message}</div>
        </div>
        <div class="confetti-container"></div>
    `;

    document.body.appendChild(overlay);

    // Create confetti
    const confettiContainer = overlay.querySelector('.confetti-container');
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confettiContainer.appendChild(confetti);
    }

    // Auto-remove after 3 seconds
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
    }, 2500);
}


