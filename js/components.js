/**
 * Components Module - UI rendering functions
 */

/**
 * Render task card with dot matrix
 */
function renderTaskCard(task, kidId, data, onToggle, onEdit) {
    const today = new Date();
    const days = Storage.getLastNDays(25);

    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;

    const completedToday = Storage.isTaskCompleted(data, kidId, task.id, today);
    const dimColor = getDimColor(task.color);

    card.innerHTML = `
        <div class="task-header">
            <div class="task-icon" style="background: ${dimColor};">
                ${task.icon}
            </div>
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.name)}</div>
                <div class="task-points">${task.points} point${task.points !== 1 ? 's' : ''}${!task.bonusOnly && task.penalty != null && task.penalty !== 1 ? ' · <span class="penalty-badge">-' + task.penalty + ' penalty</span>' : ''}${task.bonusOnly ? ' <span class="bonus-badge">⭐ Bonus</span>' : ''}</div>
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
        const createdDate = task.createdAt ? new Date(task.createdAt) : null;
        const beforeCreated = createdDate && Storage.formatDate(date) < Storage.formatDate(createdDate);

        let className = 'dot';
        if (isFuture || beforeCreated) className += ' future';
        else if (isCompleted) className += ' completed';
        else className += ' incomplete';

        const bgColor = (isFuture || beforeCreated) ? '#333' : (isCompleted ? task.color : dimColor);

        return `<div class="${className}"
                            style="background: ${bgColor};"
                            title="${date.toLocaleDateString()}${isToday ? ' (Today)' : ''}">
                        </div>`;
    }).join('')}
        </div>
    `;

    const toggleBtn = card.querySelector('.task-toggle');
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggle(task.id);
    });

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

function renderBankActivityItem(item, kid) {
    const dateObj = new Date(item.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const baseAmount = item.originalAmount != null ? item.originalAmount : (item.amount || 0);
    let title = kid.name;
    let meta = dateStr;
    let amountText = `$${baseAmount.toFixed(2)}`;
    let amountClass = '';

    if (item.type === 'payout') {
        title += item.note ? ' - ' + escapeHtml(item.note) : '';
        meta = `Payout - ${dateStr}`;
        amountText = `-$${item.amount.toFixed(2)}`;
    } else if (item.type === 'cash') {
        title += item.note ? ' - ' + escapeHtml(item.note) : '';
        meta = `Cash added - ${dateStr}`;
        amountText = `+$${item.amount.toFixed(2)}`;
        amountClass = 'positive';
    } else {
        title += item.note ? ' - ' + escapeHtml(item.note) : '';
        meta = item.currentBalance > 0
            ? `Loan - ${dateStr} - due $${item.currentBalance.toFixed(2)}`
            : `Loan - ${dateStr} - cleared`;
        amountText = `+$${baseAmount.toFixed(2)}`;
        amountClass = 'warning';
    }

    return `
        <div class="withdrawal-item">
            <img src="${kid.avatar}" alt="${kid.name}" class="withdrawal-avatar">
            <div class="withdrawal-info">
                <div class="withdrawal-name">${title}</div>
                <div class="withdrawal-date">${meta}</div>
            </div>
            <div class="withdrawal-amount ${amountClass}">${amountText}</div>
        </div>
    `;
}

/**
 * Render dashboard view (without leaderboard, with recent adjustments)
 */
function renderDashboard(data, container) {
    const leaderboard = Storage.getLeaderboard(data);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    fourDaysAgo.setHours(0, 0, 0, 0);

    const allAdjustments = Storage.getPointsAdjustments(data, null, 50);
    const recentAdjustments = allAdjustments.filter(adj => {
        const adjDate = new Date(adj.date);
        return adjDate >= fourDaysAgo;
    });

    let adjustmentsHtml = '';
    if (recentAdjustments.length > 0) {
        adjustmentsHtml = `
            <div class="dashboard-adjustments">
                <h3>Recent Point Adjustments</h3>
                <div class="adjustments-list">
                    ${recentAdjustments.map(adj => {
            const kid = data.kids[adj.kidId];
            const dateObj = new Date(adj.date);
            const dateStr = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const sign = adj.type === 'bonus' ? '+' : '-';
            return `
                            <div class="adjustment-item">
                                <img src="${kid.avatar}" alt="${kid.name}" class="adjustment-avatar">
                                <div class="adjustment-info">
                                    <div class="adjustment-reason">${escapeHtml(adj.reason)}</div>
                                    <div class="adjustment-meta">${kid.name} - ${dateStr}</div>
                                </div>
                                <div class="adjustment-amount ${adj.type}">${sign}${adj.amount}</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    const kids = ['oliver', 'miles', 'zander'];
    const recentBankActivity = [
        ...Storage.getWithdrawals(data, null, 5).map(item => ({
            ...item,
            type: 'payout'
        })),
        ...Storage.getCashDeposits(data, null, 5).map(item => ({
            ...item,
            type: 'cash'
        })),
        ...Storage.getLoans(data, null, 5, true).map(item => ({
            ...item,
            type: 'loan'
        }))
    ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6);

    let bankActivityHtml = '';
    if (recentBankActivity.length > 0) {
        bankActivityHtml = `
            <div class="withdrawal-history">
                <h4>Recent Bank Activity</h4>
                ${recentBankActivity.map(item => renderBankActivityItem(item, data.kids[item.kidId])).join('')}
            </div>
        `;
    }

    const bankSectionHtml = `
        <div class="bank-section">
            <h3 class="bank-title">Bank</h3>
            <div class="bank-grid">
                ${kids.map(kidId => {
        const kid = data.kids[kidId];
        const totalBanked = Storage.getTotalBanked(data, kidId);
        const totalWithdrawn = Storage.getTotalWithdrawn(data, kidId);
        const totalCashAdded = Storage.getTotalCashAdded(data, kidId);
        const outstandingLoan = Storage.getOutstandingLoanTotal(data, kidId);
        const lastWeekMoney = Storage.getLastWeekEarnings(data, kidId);
        return `
                        <div class="bank-card">
                            <img src="${kid.avatar}" alt="${kid.name}" class="bank-avatar">
                            <div class="bank-name">${kid.name}</div>
                            <div class="bank-balance">$${totalBanked.toFixed(2)}</div>
                            <div class="bank-detail ${outstandingLoan > 0 ? 'bank-detail-negative' : 'bank-detail-positive'}">${outstandingLoan > 0 ? `Loan due $${outstandingLoan.toFixed(2)}` : 'Loan clear'}</div>
                            <div class="bank-detail">Last wk $${lastWeekMoney.toFixed(2)}</div>
                            <div class="bank-detail">Cash in $${totalCashAdded.toFixed(2)}</div>
                            <div class="bank-detail">Paid out $${totalWithdrawn.toFixed(2)}</div>
                        </div>
                    `;
    }).join('')}
            </div>
            ${bankActivityHtml}
        </div>
    `;

    container.innerHTML = `
        <div class="dashboard">
            <div class="dashboard-summary">
                <h3>This Week's Summary</h3>
                <div class="summary-cards">
                    ${leaderboard.map(kid => {
        const weeklyBonus = Storage.getWeeklyBonusPoints(data, kid.id);
        const bonusClass = weeklyBonus > 0 ? 'positive' : (weeklyBonus < 0 ? 'negative' : 'zero');
        return `
                        <div class="summary-card" data-kid="${kid.id}">
                            <img src="${kid.avatar}" alt="${kid.name}" class="summary-avatar">
                            <div class="summary-name">${kid.name}</div>
                            <div class="summary-money">$${kid.money.toFixed(2)}</div>
                            <div class="summary-max">of $${kid.maxMoney}</div>
                            <div class="summary-weekly-bonus ${bonusClass}">${weeklyBonus}</div>
                        </div>
                    `;
    }).join('')}
                </div>
            </div>

            ${bankSectionHtml}

            ${adjustmentsHtml}
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
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

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
    const kids = ['oliver', 'miles', 'zander'];
    kids.forEach(kidId => {
        const money = Storage.calculateWeeklyMoney(data, kidId);
        const el = document.getElementById(`${kidId}Money`);
        if (el) {
            el.textContent = `$${money.toFixed(0)}`;
        }
    });
}

/**
 * Update summary bar - shows weekly points
 */
function updateSummaryBar(data, kidId) {
    const weekStart = data.settings.weekStart || Storage.getWeekStart(new Date()).toISOString();
    const points = Storage.calculateWeekPoints(data, kidId, weekStart);
    const bonusPoints = Storage.getWeeklyBonusPoints(data, kidId);
    const money = Storage.calculateWeeklyMoney(data, kidId);

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

    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
    }, 2500);
}
