/**
 * Storage Module - Data persistence using LocalStorage
 */

const STORAGE_KEY = 'kidsTasksData';
const DAILY_LOAN_INTEREST_RATE = 0.10;

// Default data structure
const defaultData = {
    settings: {
        soundsEnabled: true,  // Toggle for task completion sounds
        taskSounds: {},       // Format: { 'taskId': 'base64_encoded_audio' }
        allowances: {
            oliver: 50,
            miles: 30,
            zander: 20
        },
        weekStart: null // Will be set on first load
    },
    kids: {
        oliver: { name: 'Oliver', avatar: 'assets/oliver.png', tasks: [], badges: [] },
        miles: { name: 'Miles', avatar: 'assets/miles.png', tasks: [], badges: [] },
        zander: { name: 'Zander', avatar: 'assets/zander.png', tasks: [], badges: [] }
    },
    completions: {}, // Format: { 'kidId_taskId_YYYY-MM-DD': true }
    badges: {}, // Format: { 'kidId_badgeType_date': true }
    withdrawals: [], // Format: [{ id, kidId, amount, note, date }]
    cashDeposits: [], // Format: [{ id, kidId, amount, note, date }]
    loans: [], // Format: [{ id, kidId, originalAmount, outstandingAmount, note, date, lastInterestDate, dailyInterestRate, status, payments[] }]
    weeklyReviews: {} // Format: { 'YYYY-MM-DD': { weekStart, savedAt, kids: [...] } }
};

// Badge definitions
const BADGE_TYPES = {
    PERFECT_DAY: {
        id: 'perfect_day',
        name: 'Perfect Day',
        icon: '⭐',
        description: 'Completed all tasks in a day'
    },
    STREAK_3: {
        id: 'streak_3',
        name: '3-Day Streak',
        icon: '🔥',
        description: '3 perfect days in a row'
    },
    STREAK_7: {
        id: 'streak_7',
        name: 'Week Warrior',
        icon: '🏆',
        description: '7 perfect days in a row'
    },
    EARLY_BIRD: {
        id: 'early_bird',
        name: 'Early Bird',
        icon: '🌅',
        description: 'All tasks done before noon'
    },
    PERFECT_WEEK: {
        id: 'perfect_week',
        name: 'Perfect Week',
        icon: '👑',
        description: 'All tasks completed for the entire week'
    },
    POINT_COLLECTOR: {
        id: 'point_collector',
        name: 'Point Collector',
        icon: '💎',
        description: 'Earned 100 lifetime points'
    }
};

// Level thresholds - 25 levels for ~244 days travel (10 tasks/day = ~2400 max points)
const LEVEL_THRESHOLDS = [
    { level: 1, points: 0, title: 'Rookie' },
    { level: 2, points: 20, title: 'Starter' },
    { level: 3, points: 50, title: 'Helper' },
    { level: 4, points: 90, title: 'Go-Getter' },
    { level: 5, points: 140, title: 'Rising Star' },
    { level: 6, points: 200, title: 'Task Tackler' },
    { level: 7, points: 280, title: 'Champion' },
    { level: 8, points: 370, title: 'Super Star' },
    { level: 9, points: 480, title: 'Achiever' },
    { level: 10, points: 600, title: 'Hero' },
    { level: 11, points: 740, title: 'Warrior' },
    { level: 12, points: 900, title: 'Legend' },
    { level: 13, points: 1080, title: 'Superstar' },
    { level: 14, points: 1280, title: 'Master' },
    { level: 15, points: 1500, title: 'Grand Master' },
    { level: 16, points: 1700, title: 'Elite' },
    { level: 17, points: 1850, title: 'Champion Elite' },
    { level: 18, points: 2000, title: 'Task Titan' },
    { level: 19, points: 2100, title: 'Mega Star' },
    { level: 20, points: 2200, title: 'Ultra Champion' },
    { level: 21, points: 2280, title: 'Task Wizard' },
    { level: 22, points: 2340, title: 'Supreme Master' },
    { level: 23, points: 2380, title: 'Task Legend' },
    { level: 24, points: 2410, title: 'Ultimate Hero' },
    { level: 25, points: 2440, title: 'Task God' }
];
/**
 * Migrate data from old 'olive' key to 'oliver'
 * Applied to both localStorage and Firebase data
 */
function migrateData(data) {
    if (data.kids && data.kids.olive && !data.kids.oliver) {
        data.kids.oliver = data.kids.olive;
        data.kids.oliver.avatar = 'assets/oliver.png';
        delete data.kids.olive;
    }
    if (data.settings && data.settings.allowances && 'olive' in data.settings.allowances) {
        data.settings.allowances.oliver = data.settings.allowances.olive;
        delete data.settings.allowances.olive;
    }
    if (data.completions) {
        for (const key of Object.keys(data.completions)) {
            if (key.startsWith('olive_')) {
                data.completions['oliver' + key.slice(5)] = data.completions[key];
                delete data.completions[key];
            }
        }
    }
    if (data.badges) {
        for (const key of Object.keys(data.badges)) {
            if (key.startsWith('olive_')) {
                data.badges['oliver' + key.slice(5)] = data.badges[key];
                delete data.badges[key];
            }
        }
    }
    if (data.pointAdjustments) {
        data.pointAdjustments.forEach(adj => {
            if (adj.kidId === 'olive') adj.kidId = 'oliver';
        });
    }
    if (data.withdrawals) {
        data.withdrawals.forEach(withdrawal => {
            if (withdrawal.kidId === 'olive') withdrawal.kidId = 'oliver';
        });
    }
    if (data.cashDeposits) {
        data.cashDeposits.forEach(deposit => {
            if (deposit.kidId === 'olive') deposit.kidId = 'oliver';
        });
    }
    if (data.loans) {
        data.loans.forEach(loan => {
            if (loan.kidId === 'olive') loan.kidId = 'oliver';
            if (loan.payments && !Array.isArray(loan.payments)) {
                loan.payments = Object.values(loan.payments);
            }
        });
    }
    return data;
}

/**
 * Load data from LocalStorage
 */
function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = migrateData(JSON.parse(stored));
            // Merge with defaults to ensure all properties exist
            const merged = mergeDeep(defaultData, data);
            saveData(merged);
            return merged;
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }

    // Initialize with default data
    const data = JSON.parse(JSON.stringify(defaultData));
    data.settings.weekStart = getWeekStart(new Date()).toISOString();
    saveData(data);
    return data;
}

/**
 * Save data to LocalStorage and sync to cloud
 */
function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // Sync to Firebase if available
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isConnected()) {
            FirebaseSync.syncToCloud(data);
        }
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

/**
 * Save data to LocalStorage only (no cloud sync)
 * Used when receiving data from cloud to prevent sync loops
 */
function saveDataLocal(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving data locally:', e);
    }
}

/**
 * Deep merge objects
 */
function mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Get the start of the week (Monday)
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get week number of the year
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Format date as YYYY-MM-DD (using local time, not UTC)
 */
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function roundMoney(amount) {
    return Math.round((Number(amount) || 0) * 100) / 100;
}

function getDateAtStartOfDay(date) {
    let normalizedDate = date;

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        normalizedDate = `${date}T00:00:00`;
    }

    const d = new Date(normalizedDate);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getDaysBetweenDates(fromDate, toDate) {
    const start = getDateAtStartOfDay(fromDate);
    const end = getDateAtStartOfDay(toDate);
    const diffMs = end.getTime() - start.getTime();

    if (diffMs <= 0) {
        return 0;
    }

    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function getLoanBaseAmount(loan) {
    if (loan.outstandingAmount != null) return roundMoney(loan.outstandingAmount);
    if (loan.originalAmount != null) return roundMoney(loan.originalAmount);
    if (loan.amount != null) return roundMoney(loan.amount);
    return 0;
}

function calculateLoanCurrentBalance(loan, asOfDate = new Date()) {
    if (!loan || loan.status === 'paid') {
        return 0;
    }

    let balance = getLoanBaseAmount(loan);
    const lastInterestDate = loan.lastInterestDate || formatDate(new Date(loan.date || new Date()));
    const daysToAccrue = getDaysBetweenDates(lastInterestDate, asOfDate);
    const dailyRate = loan.dailyInterestRate != null ? loan.dailyInterestRate : DAILY_LOAN_INTEREST_RATE;

    for (let i = 0; i < daysToAccrue; i++) {
        balance = roundMoney(balance * (1 + dailyRate));
    }

    return balance;
}

function applyLoanInterest(loan, asOfDate = new Date()) {
    if (!loan || loan.status === 'paid') {
        return false;
    }

    const asOfDateStr = formatDate(asOfDate);
    const updatedBalance = calculateLoanCurrentBalance(loan, asOfDate);

    if (updatedBalance === getLoanBaseAmount(loan) && loan.lastInterestDate === asOfDateStr) {
        return false;
    }

    loan.outstandingAmount = updatedBalance;
    loan.lastInterestDate = asOfDateStr;
    return true;
}

/**
 * Get dates for the current week (Mon-Sun)
 */
function getWeekDates(startDate) {
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
 * Get last N days including today
 */
function getLastNDays(n) {
    const dates = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d);
    }
    return dates;
}

/**
 * Task CRUD Operations
 */
function addTask(data, kidId, task) {
    const newTask = {
        id: 'task_' + Date.now(),
        name: task.name,
        points: parseInt(task.points) || 10,
        penalty: parseInt(task.penalty) || 1,
        icon: task.icon || '📝',
        color: task.color || '#4ade80',
        activeDays: task.activeDays || [0, 1, 2, 3, 4, 5, 6], // Default to all days
        bonusOnly: !!task.bonusOnly, // Bonus-only: no penalty if missed
        createdAt: new Date().toISOString()
    };
    data.kids[kidId].tasks.push(newTask);
    saveData(data);
    return newTask;
}

function updateTask(data, kidId, taskId, updates) {
    const tasks = data.kids[kidId].tasks;
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        saveData(data);
    }
}

function deleteTask(data, kidId, taskId) {
    data.kids[kidId].tasks = data.kids[kidId].tasks.filter(t => t.id !== taskId);
    // Clean up completions for this task
    Object.keys(data.completions).forEach(key => {
        if (key.includes(taskId)) {
            delete data.completions[key];
        }
    });
    saveData(data);
}

/**
 * Completion Operations
 */
function getCompletionKey(kidId, taskId, date) {
    return `${kidId}_${taskId}_${formatDate(date)}`;
}

function isTaskCompleted(data, kidId, taskId, date) {
    if (!data.completions) return false;
    const key = getCompletionKey(kidId, taskId, date);
    return !!data.completions[key];
}

function toggleTaskCompletion(data, kidId, taskId, date) {
    const key = getCompletionKey(kidId, taskId, date);
    if (data.completions[key]) {
        delete data.completions[key];
    } else {
        data.completions[key] = {
            timestamp: new Date().toISOString()
        };
    }

    // Check for badges after toggling
    checkAndAwardBadges(data, kidId, date);

    saveData(data);
    return !!data.completions[key];
}

// Function to safely check if a task is active on a date
function isTaskActiveOnDate(task, date) {
    const day = date.getDay();
    const activeDays = task.activeDays || [0, 1, 2, 3, 4, 5, 6];
    return activeDays.includes(day);
}

// Function to check if all ACTIVE non-bonus tasks for a date are completed
function isPerfectDay(data, kidId, date) {
    const tasks = data.kids[kidId].tasks;
    if (tasks.length === 0) return false;

    // Exclude bonus-only tasks from perfect day check
    const activeTasks = tasks.filter(task => isTaskActiveOnDate(task, date) && !task.bonusOnly);
    if (activeTasks.length === 0) return false;

    return activeTasks.every(task => isTaskCompleted(data, kidId, task.id, date));
}

/**
 * Calculate level from lifetime points
 */
function calculateLevel(points) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (points >= LEVEL_THRESHOLDS[i].points) {
            return LEVEL_THRESHOLDS[i];
        }
    }
    return LEVEL_THRESHOLDS[0];
}

/**
 * Get progress percentage to next level
 */
function getLevelProgress(points) {
    const current = calculateLevel(points);
    const nextIndex = LEVEL_THRESHOLDS.findIndex(l => l.level === current.level) + 1;

    if (nextIndex >= LEVEL_THRESHOLDS.length) return 100; // Max level

    const next = LEVEL_THRESHOLDS[nextIndex];
    const progress = ((points - current.points) / (next.points - current.points)) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * Calculate lifetime points for a kid
 */
function getLifetimePoints(data, kidId) {
    let total = 0;
    const tasks = data.kids[kidId].tasks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    // Sum points from all completions, and count past completions per task for penalty calc
    const pastCompletions = {};
    Object.keys(data.completions).forEach(key => {
        if (key.startsWith(kidId + '_')) {
            const parts = key.split('_');
            const dateStr = parts[parts.length - 1];
            const taskId = parts.slice(1, -1).join('_');
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                total += task.points;
                if (dateStr < todayStr) {
                    pastCompletions[taskId] = (pastCompletions[taskId] || 0) + 1;
                }
            }
        }
    });

    // Calculate penalties using date math instead of day-by-day iteration
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    tasks.forEach(task => {
        // Skip penalty calculation for bonus-only tasks
        if (task.bonusOnly) return;

        if (task.createdAt) {
            const createdDate = new Date(task.createdAt);
            createdDate.setHours(0, 0, 0, 0);
            if (createdDate > yesterday) return; // Created today, no penalties yet

            const taskActiveDays = task.activeDays || [0, 1, 2, 3, 4, 5, 6];
            const activeDayCount = countActiveDaysInRange(createdDate, yesterday, taskActiveDays);
            const completedCount = pastCompletions[task.id] || 0;
            total -= Math.max(0, activeDayCount - completedCount);
        }
    });

    // Add bonus points, subtract penalties
    if (data.pointAdjustments) {
        data.pointAdjustments.forEach(adj => {
            if (adj.kidId === kidId) {
                total += (adj.type === 'bonus' ? adj.amount : -adj.amount);
            }
        });
    }

    return Math.max(0, total);
}

/**
 * Count how many days in a date range fall on the given active days of week.
 * Both startDate and endDate are inclusive.
 */
function countActiveDaysInRange(startDate, endDate, activeDays) {
    const totalDays = Math.round((endDate - startDate) / 86400000) + 1;
    if (totalDays <= 0) return 0;

    const fullWeeks = Math.floor(totalDays / 7);
    const remainder = totalDays % 7;
    const startDow = startDate.getDay();

    let count = fullWeeks * activeDays.length;
    for (let i = 0; i < remainder; i++) {
        if (activeDays.includes((startDow + i) % 7)) count++;
    }
    return count;
}


/**
 * Badge Operations
 */
function checkAndAwardBadges(data, kidId, date) {
    const dateStr = formatDate(date);
    const tasks = data.kids[kidId].tasks;

    if (tasks.length === 0) return;

    // Check Perfect Day using isPerfectDay
    const allCompletedToday = isPerfectDay(data, kidId, date);

    const perfectDayKey = `${kidId}_perfect_day_${dateStr}`;
    if (allCompletedToday) {
        data.badges[perfectDayKey] = {
            awarded: new Date().toISOString(),
            type: BADGE_TYPES.PERFECT_DAY
        };
    } else {
        delete data.badges[perfectDayKey];
    }

    // Check Point Collector badge (100 lifetime points)
    const lifetimePoints = getLifetimePoints(data, kidId);
    const pointCollectorKey = `${kidId}_point_collector`;
    if (lifetimePoints >= 100 && !data.badges[pointCollectorKey]) {
        data.badges[pointCollectorKey] = {
            awarded: new Date().toISOString(),
            type: BADGE_TYPES.POINT_COLLECTOR
        };
    }

    // Check streaks
    checkStreakBadges(data, kidId, date);
}

function checkStreakBadges(data, kidId, date) {
    let streak = 0;
    const today = new Date(date);
    const tasks = data.kids[kidId].tasks;

    if (tasks.length === 0) return;

    // Count consecutive perfect days backwards
    for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);

        if (isPerfectDay(data, kidId, checkDate)) {
            streak++;
        } else {
            // Check if there were ANY active tasks on this day. 
            // If it was a rest day (no active tasks), maybe maintain streak?
            // For now, let's keep it simple: streak breaks if not perfect.
            break;
        }
    }

    const dateStr = formatDate(date);

    // Award streak badges
    if (streak >= 3) {
        data.badges[`${kidId}_streak_3_${dateStr}`] = {
            awarded: new Date().toISOString(),
            type: BADGE_TYPES.STREAK_3,
            streak: streak
        };
    }

    if (streak >= 7) {
        data.badges[`${kidId}_streak_7_${dateStr}`] = {
            awarded: new Date().toISOString(),
            type: BADGE_TYPES.STREAK_7,
            streak: streak
        };
    }
}

function getKidBadges(data, kidId) {
    const badges = [];
    const badgeCounts = {};

    Object.keys(data.badges).forEach(key => {
        if (key.startsWith(kidId + '_')) {
            const badge = data.badges[key];
            const typeId = badge.type.id;
            badgeCounts[typeId] = (badgeCounts[typeId] || 0) + 1;
        }
    });

    Object.keys(BADGE_TYPES).forEach(key => {
        const type = BADGE_TYPES[key];
        if (badgeCounts[type.id]) {
            badges.push({
                ...type,
                count: badgeCounts[type.id]
            });
        }
    });

    return badges;
}

function getCurrentStreak(data, kidId) {
    let streak = 0;
    const today = new Date();

    // Check up to 365 days back
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);

        // If today is incomplete, don't count it yet (don't break streak from yesterday)
        if (i === 0 && !isPerfectDay(data, kidId, checkDate)) {
            continue;
        }

        if (isPerfectDay(data, kidId, checkDate)) {
            streak++;
        } else {
            // Once we hit a non-perfect day (that isn't today), streak ends
            if (i > 0) break;
        }
    }
    return streak;
}



/**
 * Points & Money Calculations
 */
function calculateDayPoints(data, kidId, date) {
    const tasks = data.kids[kidId].tasks;
    const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 6 = Saturday
    const checkDate = new Date(date);
    const today = new Date();

    // Check if this date is in the past (day is over)
    const isPastDay = formatDate(checkDate) < formatDate(today);

    let earned = 0;
    let possible = 0;

    tasks.forEach(task => {
        // Check if task is active on this day
        // Support both new activeDays array and legacy weekdaysOnly
        let isActiveToday = true;
        if (task.activeDays) {
            isActiveToday = task.activeDays.includes(dayOfWeek);
        } else if (task.weekdaysOnly) {
            // Legacy support: weekdaysOnly means Mon-Fri (1-5)
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            isActiveToday = !isWeekend;
        }

        if (!isActiveToday) {
            return;
        }

        if (task.bonusOnly) {
            // Bonus-only: only add to possible/earned if completed, no penalty
            if (isTaskCompleted(data, kidId, task.id, date)) {
                earned += task.points;
                possible += task.points;
            }
        } else {
            possible += task.points;
            if (isTaskCompleted(data, kidId, task.id, date)) {
                earned += task.points;
            } else if (isPastDay) {
                // Penalty for incomplete task from past days (configurable per task, default 1)
                earned -= (task.penalty != null ? task.penalty : 1);
            }
        }
    });

    return { earned, possible };
}

function calculateWeekPoints(data, kidId, weekStart) {
    const dates = getWeekDates(new Date(weekStart));
    const today = new Date();
    let earned = 0;
    let possible = 0;

    dates.forEach(date => {
        const dayPoints = calculateDayPoints(data, kidId, date);
        // Possible counts ALL 7 days of the week
        possible += dayPoints.possible;
        // Earned only counts days up to and including today
        if (date <= today) {
            earned += dayPoints.earned;
        }
    });

    return { earned, possible };
}

function calculateWeeklyMoney(data, kidId) {
    const weekStart = data.settings.weekStart || getWeekStart(new Date()).toISOString();
    const points = calculateWeekPoints(data, kidId, weekStart);
    const bonusPoints = getWeeklyBonusPoints(data, kidId);
    const maxAllowance = data.settings.allowances[kidId] || 0;

    // Bonus points add to BOTH earned AND possible
    const totalEarned = points.earned + bonusPoints;
    const totalPossible = points.possible + bonusPoints;

    if (totalPossible <= 0) {
        return 0;
    }

    // Calculate percentage with bonus in both
    const percentage = Math.max(0, Math.min(1, totalEarned / totalPossible));
    return Math.round(maxAllowance * percentage * 100) / 100;
}

/**
 * Get the start of the previous week (Monday before current week start)
 */
function getLastWeekStart(data) {
    const currentWeekStart = new Date(data.settings.weekStart || getWeekStart(new Date()).toISOString());
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    return lastWeekStart;
}

/**
 * Get bonus points earned during the previous week
 */
function getLastWeekBonusPoints(data, kidId) {
    const lastWeekStart = getLastWeekStart(data);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);

    const adjustments = data.pointAdjustments || [];
    let bonus = 0;

    adjustments.forEach(adj => {
        if (adj.kidId !== kidId) return;
        const adjDate = new Date(adj.date);
        if (adjDate >= lastWeekStart && adjDate < lastWeekEnd) {
            if (adj.type === 'bonus') {
                bonus += adj.amount;
            } else {
                bonus -= adj.amount;
            }
        }
    });

    return bonus;
}

/**
 * Calculate money earned for the previous week
 */
function calculateLastWeekMoney(data, kidId) {
    const lastWeekStart = getLastWeekStart(data);
    const points = calculateWeekPoints(data, kidId, lastWeekStart.toISOString());
    const bonusPoints = getLastWeekBonusPoints(data, kidId);
    const maxAllowance = data.settings.allowances[kidId] || 0;

    const totalEarned = points.earned + bonusPoints;
    const totalPossible = points.possible + bonusPoints;

    if (totalPossible <= 0) {
        return 0;
    }

    const percentage = Math.max(0, Math.min(1, totalEarned / totalPossible));
    return Math.round(maxAllowance * percentage * 100) / 100;
}

/**
 * Get kid's total banked money (stored in kid data)
 */
function getTotalBanked(data, kidId) {
    return roundMoney(data.kids[kidId]?.bankedMoney || 0);
}

/**
 * Bank this week's money (add to total and reset week)
 */
function bankWeeklyEarnings(data, kidId) {
    const currentEarnings = calculateWeeklyMoney(data, kidId);
    if (!data.kids[kidId].bankedMoney) {
        data.kids[kidId].bankedMoney = 0;
    }
    data.kids[kidId].bankedMoney = roundMoney(data.kids[kidId].bankedMoney + currentEarnings);
    return data.kids[kidId].bankedMoney;
}

/**
 * Leaderboard
 */
function getLeaderboard(data) {
    const kids = ['oliver', 'miles', 'zander'];

    return kids.map(kidId => {
        const kid = data.kids[kidId];
        const money = calculateWeeklyMoney(data, kidId);
        const maxMoney = data.settings.allowances[kidId];
        const weekStart = data.settings.weekStart || getWeekStart(new Date()).toISOString();
        const points = calculateWeekPoints(data, kidId, weekStart);
        const bonusPoints = getWeeklyBonusPoints(data, kidId);
        const streak = getCurrentStreak(data, kidId);
        const badges = getKidBadges(data, kidId);
        const lifetimePoints = getLifetimePoints(data, kidId);

        // Bonus points add to BOTH earned AND possible
        const totalEarned = points.earned + bonusPoints;
        const totalPossible = points.possible + bonusPoints;

        return {
            id: kidId,
            name: kid.name,
            avatar: kid.avatar,
            money,
            maxMoney,
            earnedPoints: totalEarned,
            possiblePoints: totalPossible,
            bonusPoints: bonusPoints,
            percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 100,
            streak,
            badges,
            badgeCount: badges.reduce((sum, b) => sum + b.count, 0),
            lifetimePoints,
            level: calculateLevel(lifetimePoints),
            levelProgress: getLevelProgress(lifetimePoints)
        };
    }).sort((a, b) => b.percentage - a.percentage);
}

/**
 * Week Management
 */
function startNewWeek(data) {
    const currentWeekStart = formatDate(getWeekStart(new Date()));
    const previousWeekStart = data.settings.weekStart
        ? formatDate(new Date(data.settings.weekStart))
        : null;

    // Idempotency check: if we already banked this exact week transition, skip banking
    // This prevents double-banking when two devices both trigger startNewWeek
    if (data.settings.lastBankedWeekStart === previousWeekStart &&
        previousWeekStart !== null &&
        formatDate(new Date(data.settings.weekStart)) === currentWeekStart) {
        console.log('Week already banked, skipping duplicate bank operation');
        return;
    }

    // Save weekly review BEFORE banking (so weekStart still points to the reviewed week)
    saveWeeklyReviewSnapshot(data);

    // Record which week we're banking so we can detect duplicates
    data.settings.lastBankedWeekStart = previousWeekStart;

    // Save each kid's current week earnings as "last week" before banking
    const kids = ['oliver', 'miles', 'zander'];
    kids.forEach(kidId => {
        const earnings = calculateWeeklyMoney(data, kidId);
        data.kids[kidId].lastWeekEarnings = earnings;
        bankWeeklyEarnings(data, kidId);
        repayLoansFromBankBalance(data, kidId);
    });

    // Set the new week start
    data.settings.weekStart = getWeekStart(new Date()).toISOString();
    // Note: We keep historical completions for the dot matrix
    saveData(data);
}

/**
 * Save a snapshot of the weekly review to persistent storage.
 * Called before banking so the data reflects the actual week being reviewed.
 */
function saveWeeklyReviewSnapshot(data) {
    const review = generateWeeklyReview(data);
    const weekStart = data.settings.weekStart
        ? formatDate(new Date(data.settings.weekStart))
        : formatDate(getWeekStart(new Date()));

    // Initialize weeklyReviews if needed
    if (!data.weeklyReviews) {
        data.weeklyReviews = {};
    }

    // Store the review keyed by week start date
    data.weeklyReviews[weekStart] = {
        weekStart: weekStart,
        savedAt: new Date().toISOString(),
        kids: review.map(kid => ({
            kidId: kid.kidId,
            name: kid.name,
            avatar: kid.avatar,
            money: kid.money,
            maxAllowance: kid.maxAllowance,
            earnedPoints: kid.earnedPoints,
            possiblePoints: kid.possiblePoints,
            percentage: kid.percentage,
            missedTasks: kid.missedTasks.map(t => ({
                name: t.task.name,
                icon: t.task.icon,
                points: t.task.points,
                activeDays: t.activeDays,
                completedDays: t.completedDays,
                missedDays: t.missedDays,
                moneyImpact: t.moneyImpact
            })),
            perfectTasks: kid.perfectTasks.map(t => ({
                name: t.task.name,
                icon: t.task.icon,
                points: t.task.points,
                activeDays: t.activeDays,
                completedDays: t.completedDays
            }))
        }))
    };

    console.log('Weekly review saved for week:', weekStart);
}

/**
 * Get weekly review history, sorted most recent first.
 */
function getWeeklyReviewHistory(data) {
    if (!data.weeklyReviews) return [];

    return Object.values(data.weeklyReviews)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/**
 * Get a specific week's saved review.
 */
function getSavedReview(data, weekStartDate) {
    if (!data.weeklyReviews) return null;
    return data.weeklyReviews[weekStartDate] || null;
}

/**
 * Generate a weekly review for each kid showing task-by-task breakdown.
 * weekStartOverride (YYYY-MM-DD string) allows reviewing any historical week.
 * Called BEFORE banking so weekStart still points to the week being reviewed.
 */
function generateWeeklyReview(data, weekStartOverride) {
    const kids = ['oliver', 'miles', 'zander'];
    const weekStart = weekStartOverride
        ? new Date(weekStartOverride + 'T00:00:00')
        : new Date(data.settings.weekStart || getWeekStart(new Date()).toISOString());
    const weekDates = getWeekDates(weekStart);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Include all of today

    return kids.map(kidId => {
        const kid = data.kids && data.kids[kidId];
        if (!kid) return null;
        const tasks = kid.tasks || [];
        const maxAllowance = data.settings.allowances[kidId] || 0;
        const weekPoints = calculateWeekPoints(data, kidId, weekStart.toISOString());

        // Bonus points scoped to this specific week's date range only
        const weekEndMs = weekStart.getTime() + 7 * 24 * 60 * 60 * 1000;
        let bonusPoints = 0;
        (data.pointAdjustments || []).forEach(adj => {
            if (adj.kidId !== kidId) return;
            const adjMs = new Date(adj.date).getTime();
            if (adjMs >= weekStart.getTime() && adjMs < weekEndMs) {
                bonusPoints += adj.type === 'bonus' ? adj.amount : -adj.amount;
            }
        });

        const totalEarned = weekPoints.earned + bonusPoints;
        const totalPossible = weekPoints.possible + bonusPoints;
        const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 100;
        // Compute money directly from this week's points — correct for both current and historical weeks
        const weeklyMoney = totalPossible > 0
            ? Math.round(maxAllowance * Math.max(0, Math.min(1, totalEarned / totalPossible)) * 100) / 100
            : 0;

        // Per-task breakdown
        const taskBreakdown = tasks.map(task => {
            let activeDays = 0;
            let completedDays = 0;

            weekDates.forEach(date => {
                if (date > today) return;
                if (!isTaskActiveOnDate(task, date)) return;
                activeDays++;
                if (isTaskCompleted(data, kidId, task.id, date)) {
                    completedDays++;
                }
            });

            const missedDays = activeDays - completedDays;

            // Calculate money impact of missed days for non-bonus tasks
            let moneyImpact = 0;
            if (missedDays > 0 && !task.bonusOnly && totalPossible > 0) {
                // Each missed day costs: task.points (not earned) + penalty (configurable)
                const taskPenalty = task.penalty != null ? task.penalty : 1;
                const pointsLost = missedDays * (task.points + taskPenalty);
                moneyImpact = (pointsLost / totalPossible) * maxAllowance;
                moneyImpact = Math.round(moneyImpact * 100) / 100;
            }

            return {
                task,
                activeDays,
                completedDays,
                missedDays,
                isPerfect: missedDays === 0 && activeDays > 0,
                moneyImpact
            };
        }).filter(t => t.activeDays > 0);

        // Sort: missed tasks by impact (highest first), then perfect tasks
        const missedTasks = taskBreakdown
            .filter(t => !t.isPerfect)
            .sort((a, b) => b.moneyImpact - a.moneyImpact);
        const perfectTasks = taskBreakdown.filter(t => t.isPerfect);

        return {
            kidId,
            name: kid.name,
            avatar: kid.avatar,
            money: weeklyMoney,
            maxAllowance,
            earnedPoints: totalEarned,
            possiblePoints: totalPossible,
            percentage,
            missedTasks,
            perfectTasks,
            taskBreakdown
        };
    }).filter(Boolean);
}

/**
 * Prepare remote/cloud data for use as appData.
 * Migrates old keys AND patches missing required fields (flat, no recursion).
 * Always use this instead of migrateData() when receiving data from Firebase.
 */
function prepareRemoteData(cloudData) {
    const data = migrateData(cloudData);

    // Firebase can return arrays as {0: x, 1: y} objects — convert back to real arrays
    function fixArray(val) {
        if (Array.isArray(val)) return val;
        if (val && typeof val === 'object') return Object.values(val);
        return [];
    }

    // Patch any missing top-level fields (Firebase omits empty objects)
    if (!data.completions) data.completions = {};
    if (!data.badges) data.badges = {};
    if (!data.weeklyReviews) data.weeklyReviews = {};
    data.pointAdjustments = fixArray(data.pointAdjustments);
    data.withdrawals = fixArray(data.withdrawals);
    data.cashDeposits = fixArray(data.cashDeposits);
    data.loans = fixArray(data.loans);
    data.loans.forEach(loan => {
        loan.payments = fixArray(loan.payments);
    });
    if (!data.settings) data.settings = {};
    if (!data.settings.allowances) data.settings.allowances = { oliver: 50, miles: 30, zander: 20 };
    if (data.settings.allowances.oliver == null) data.settings.allowances.oliver = 50;
    if (data.settings.allowances.miles == null) data.settings.allowances.miles = 30;
    if (data.settings.allowances.zander == null) data.settings.allowances.zander = 20;
    if (!data.kids) data.kids = {};
    ['oliver', 'miles', 'zander'].forEach(kidId => {
        if (!data.kids[kidId]) data.kids[kidId] = { name: kidId.charAt(0).toUpperCase() + kidId.slice(1), avatar: `assets/${kidId}.png`, tasks: [], badges: [] };
        data.kids[kidId].tasks = fixArray(data.kids[kidId].tasks);
        data.kids[kidId].badges = fixArray(data.kids[kidId].badges);
        // Fix activeDays inside each task (Firebase converts [0,1,2] arrays to {0:0,1:1,2:2} objects)
        data.kids[kidId].tasks.forEach(task => {
            if (task.activeDays && !Array.isArray(task.activeDays)) {
                task.activeDays = Object.values(task.activeDays).map(Number);
            }
        });
    });
    return data;
}

/**
 * Repair double-banking caused by two devices both running startNewWeek.
 * The second run would have:
 *   1. Calculated 'weekly money' based on the NEW weekStart (so only Monday's data)
 *   2. Added that to bankedMoney (double counting)
 *   3. Overwritten lastWeekEarnings with Monday's values instead of actual last week
 * 
 * This function:
 *   - Subtracts the duplicate amounts (stored in lastWeekEarnings from the bad 2nd run)
 *   - Recalculates real lastWeekEarnings from the previous week's data
 */
function repairDoubleBanking(data) {

    const kids = ['oliver', 'miles', 'zander'];
    const report = [];

    kids.forEach(kidId => {
        const kid = data.kids[kidId];
        const duplicateAmount = kid.lastWeekEarnings || 0;
        const oldBanked = kid.bankedMoney || 0;

        // Subtract the duplicate amount that was incorrectly added
        kid.bankedMoney = Math.max(0, oldBanked - duplicateAmount);

        // Recalculate the REAL last week earnings
        const realLastWeekMoney = calculateLastWeekMoney(data, kidId);
        kid.lastWeekEarnings = realLastWeekMoney;

        report.push({
            kid: kid.name,
            duplicateRemoved: duplicateAmount,
            bankBefore: oldBanked,
            bankAfter: kid.bankedMoney,
            realLastWeek: realLastWeekMoney
        });
    });

    // Mark repair as done
    data.settings.lastBankedWeekStart = formatDate(getLastWeekStart(data));

    saveData(data);
    console.table(report);
    return report;
}

/**
 * Get last week's earned money (stored when new week started)
 */
function getLastWeekEarnings(data, kidId) {
    return roundMoney(data.kids[kidId]?.lastWeekEarnings || 0);
}

/**
 * Bonus/Penalty Points Adjustments
 */
function addPointsAdjustment(data, kidId, amount, reason, type) {
    // Initialize adjustments array if not exists
    if (!data.pointAdjustments) {
        data.pointAdjustments = [];
    }

    const adjustment = {
        id: 'adj_' + Date.now(),
        kidId,
        amount: parseInt(amount),
        reason,
        type, // 'bonus' or 'penalty'
        date: new Date().toISOString()
    };

    data.pointAdjustments.unshift(adjustment); // Add to beginning

    saveData(data);
    return adjustment;
}

function getPointsAdjustments(data, kidId = null, limit = 20) {
    if (!data.pointAdjustments) return [];

    let adjustments = data.pointAdjustments;

    if (kidId) {
        adjustments = adjustments.filter(a => a.kidId === kidId);
    }

    return adjustments.slice(0, limit);
}

function getWeeklyBonusPoints(data, kidId) {
    if (!data.pointAdjustments) return 0;

    const weekStart = new Date(data.settings.weekStart || getWeekStart(new Date()).toISOString());

    let totalBonus = 0;

    data.pointAdjustments.forEach(adj => {
        const adjDate = new Date(adj.date);
        if (adj.kidId === kidId && adjDate >= weekStart) {
            if (adj.type === 'bonus') {
                totalBonus += adj.amount;
            } else if (adj.type === 'penalty') {
                totalBonus -= adj.amount;
            }
        }
    });

    return totalBonus;
}

function reorderTasks(data, kidId, taskId, direction) {
    const tasks = data.kids[kidId].tasks;
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    [tasks[index], tasks[newIndex]] = [tasks[newIndex], tasks[index]];
    saveData(data);
}

function deletePointsAdjustment(data, adjustmentId) {
    if (!data.pointAdjustments) return;

    // Find and remove the adjustment (mutate in place to preserve reference)
    const index = data.pointAdjustments.findIndex(a => a.id === adjustmentId);
    if (index !== -1) {
        data.pointAdjustments.splice(index, 1);
    }
    saveData(data);
}

/**
 * Withdrawal / Payout Operations
 */
function addWithdrawal(data, kidId, amount, note) {
    if (!data.withdrawals) {
        data.withdrawals = [];
    }
    const withdrawal = {
        id: 'wd_' + Date.now(),
        kidId,
        amount: roundMoney(amount),
        note: note || '',
        date: new Date().toISOString()
    };
    data.withdrawals.unshift(withdrawal);

    // Deduct from banked money
    if (!data.kids[kidId].bankedMoney) {
        data.kids[kidId].bankedMoney = 0;
    }
    data.kids[kidId].bankedMoney = roundMoney(Math.max(0, data.kids[kidId].bankedMoney - withdrawal.amount));

    saveData(data);
    return withdrawal;
}

function getWithdrawals(data, kidId = null, limit = 10) {
    if (!data.withdrawals) return [];
    let list = data.withdrawals;
    if (kidId) {
        list = list.filter(w => w.kidId === kidId);
    }
    return list.slice(0, limit);
}

function getTotalWithdrawn(data, kidId) {
    if (!data.withdrawals) return 0;
    return roundMoney(data.withdrawals
        .filter(w => w.kidId === kidId)
        .reduce((sum, w) => sum + w.amount, 0));
}

function addCashDeposit(data, kidId, amount, note) {
    if (!data.cashDeposits) {
        data.cashDeposits = [];
    }

    const deposit = {
        id: 'cash_' + Date.now(),
        kidId,
        amount: roundMoney(amount),
        note: note || '',
        date: new Date().toISOString()
    };

    data.cashDeposits.unshift(deposit);

    if (!data.kids[kidId].bankedMoney) {
        data.kids[kidId].bankedMoney = 0;
    }
    data.kids[kidId].bankedMoney = roundMoney(data.kids[kidId].bankedMoney + deposit.amount);

    saveData(data);
    return deposit;
}

function getCashDeposits(data, kidId = null, limit = 10) {
    if (!data.cashDeposits) return [];

    let list = data.cashDeposits;
    if (kidId) {
        list = list.filter(deposit => deposit.kidId === kidId);
    }

    return list.slice(0, limit);
}

function getTotalCashAdded(data, kidId) {
    if (!data.cashDeposits) return 0;

    return roundMoney(data.cashDeposits
        .filter(deposit => deposit.kidId === kidId)
        .reduce((sum, deposit) => sum + deposit.amount, 0));
}

function addLoan(data, kidId, amount, note) {
    if (!data.loans) {
        data.loans = [];
    }

    const normalizedAmount = roundMoney(amount);
    const now = new Date();
    const loan = {
        id: 'loan_' + Date.now(),
        kidId,
        originalAmount: normalizedAmount,
        outstandingAmount: normalizedAmount,
        note: note || '',
        date: now.toISOString(),
        lastInterestDate: formatDate(now),
        dailyInterestRate: DAILY_LOAN_INTEREST_RATE,
        status: 'active',
        payments: []
    };

    data.loans.unshift(loan);
    saveData(data);
    return loan;
}

function getLoans(data, kidId = null, limit = 10, includePaid = false) {
    if (!data.loans) return [];

    let list = data.loans;
    if (kidId) {
        list = list.filter(loan => loan.kidId === kidId);
    }
    if (!includePaid) {
        list = list.filter(loan => loan.status !== 'paid');
    }

    return list
        .map(loan => ({
            ...loan,
            currentBalance: calculateLoanCurrentBalance(loan)
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);
}

function getOutstandingLoanTotal(data, kidId) {
    if (!data.loans) return 0;

    return roundMoney(data.loans
        .filter(loan => loan.kidId === kidId && loan.status !== 'paid')
        .reduce((sum, loan) => sum + calculateLoanCurrentBalance(loan), 0));
}

function repayLoansFromBankBalance(data, kidId, asOfDate = new Date()) {
    if (!data.loans || !data.kids[kidId]) {
        return {
            totalPaid: 0,
            remainingBalance: getTotalBanked(data, kidId),
            remainingLoanBalance: 0
        };
    }

    const activeLoans = data.loans
        .filter(loan => loan.kidId === kidId && loan.status !== 'paid')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    activeLoans.forEach(loan => applyLoanInterest(loan, asOfDate));

    let availableBalance = roundMoney(data.kids[kidId].bankedMoney || 0);
    let totalPaid = 0;
    const paymentDate = new Date(asOfDate).toISOString();

    activeLoans.forEach((loan, index) => {
        if (availableBalance <= 0 || loan.status === 'paid') {
            return;
        }

        const amountDue = getLoanBaseAmount(loan);
        const paymentAmount = roundMoney(Math.min(availableBalance, amountDue));

        if (paymentAmount <= 0) {
            return;
        }

        loan.payments = Array.isArray(loan.payments) ? loan.payments : [];
        loan.payments.push({
            id: `lp_${Date.now()}_${index}`,
            amount: paymentAmount,
            date: paymentDate,
            source: 'monday_bank'
        });

        loan.outstandingAmount = roundMoney(amountDue - paymentAmount);
        loan.lastInterestDate = formatDate(asOfDate);
        availableBalance = roundMoney(availableBalance - paymentAmount);
        totalPaid = roundMoney(totalPaid + paymentAmount);

        if (loan.outstandingAmount <= 0) {
            loan.outstandingAmount = 0;
            loan.status = 'paid';
            loan.paidDate = paymentDate;
        }
    });

    data.kids[kidId].bankedMoney = availableBalance;

    return {
        totalPaid,
        remainingBalance: availableBalance,
        remainingLoanBalance: getOutstandingLoanTotal(data, kidId)
    };
}

/**
 * Get all weeks with historical data (saved snapshots + weeks derived from
 * completion keys), sorted most recent first. Excludes the current week.
 * Used for navigating to any prior week even without a saved snapshot.
 */
function getNavigableWeeks(data) {
    const weeks = new Set();

    // Include saved review snapshots
    Object.keys(data.weeklyReviews || {}).forEach(ws => weeks.add(ws));

    // Derive weeks from completion keys: "kidId_taskId_YYYY-MM-DD"
    const currentWeekStart = data.settings.weekStart
        ? formatDate(getWeekStart(new Date(data.settings.weekStart)))
        : formatDate(getWeekStart(new Date()));
    Object.keys(data.completions || {}).forEach(key => {
        const dateStr = key.split('_').pop();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const ws = formatDate(getWeekStart(new Date(dateStr + 'T00:00:00')));
            if (ws < currentWeekStart) {
                weeks.add(ws);
            }
        }
    });

    return Array.from(weeks).sort((a, b) => b.localeCompare(a));
}

// Export functions
window.Storage = {
    loadData,
    saveData,
    addTask,
    updateTask,
    deleteTask,
    isTaskCompleted,
    toggleTaskCompletion,
    calculateDayPoints,
    calculateWeekPoints,
    calculateWeeklyMoney,
    calculateLastWeekMoney,
    getLastWeekStart,
    getTotalBanked,
    getLastWeekEarnings,
    bankWeeklyEarnings,
    getLeaderboard,
    getKidBadges,
    getCurrentStreak,
    getWeekStart,
    getWeekNumber,
    getLastNDays,
    formatDate,
    startNewWeek,
    addPointsAdjustment,
    getPointsAdjustments,
    getWeeklyBonusPoints,
    deletePointsAdjustment,
    reorderTasks,
    addWithdrawal,
    getWithdrawals,
    getTotalWithdrawn,
    addCashDeposit,
    getCashDeposits,
    getTotalCashAdded,
    addLoan,
    getLoans,
    getOutstandingLoanTotal,
    repayLoansFromBankBalance,
    BADGE_TYPES,
    LEVEL_THRESHOLDS,
    calculateLevel,
    getLevelProgress,
    getLifetimePoints,
    isPerfectDay,
    saveDataLocal,
    migrateData,
    prepareRemoteData,
    repairDoubleBanking,
    generateWeeklyReview,
    getWeeklyReviewHistory,
    getNavigableWeeks,
    getSavedReview,
    saveWeeklyReviewSnapshot
};
