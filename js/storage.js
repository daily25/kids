/**
 * Storage Module - Data persistence using LocalStorage
 */

const STORAGE_KEY = 'kidsTasksData';

// Default data structure
const defaultData = {
    settings: {
        allowances: {
            olive: 50,
            miles: 30,
            zander: 20
        },
        weekStart: null // Will be set on first load
    },
    kids: {
        olive: { name: 'Oliver', avatar: 'assets/olive.png', tasks: [], badges: [] },
        miles: { name: 'Miles', avatar: 'assets/miles.png', tasks: [], badges: [] },
        zander: { name: 'Zander', avatar: 'assets/zander.png', tasks: [], badges: [] }
    },
    completions: {}, // Format: { 'kidId_taskId_YYYY-MM-DD': true }
    badges: {} // Format: { 'kidId_badgeType_date': true }
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
 * Load data from LocalStorage
 */
function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Merge with defaults to ensure all properties exist
            return mergeDeep(defaultData, data);
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
 * Save data to LocalStorage
 */
function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving data:', e);
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
        icon: task.icon || '📝',
        color: task.color || '#4ade80',
        activeDays: task.activeDays || [0, 1, 2, 3, 4, 5, 6], // Default to all days
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

// Function to check if all ACTIVE tasks for a date are completed
function isPerfectDay(data, kidId, date) {
    const tasks = data.kids[kidId].tasks;
    if (tasks.length === 0) return false;

    const activeTasks = tasks.filter(task => isTaskActiveOnDate(task, date));
    if (activeTasks.length === 0) return false; // No tasks today = no perfect day? or auto perfect? Let's say no.

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

    // Sum points from all completions
    Object.keys(data.completions).forEach(key => {
        if (key.startsWith(kidId + '_')) {
            const parts = key.split('_');
            const taskId = parts.slice(1, -1).join('_'); // Handle task_TIMESTAMP format
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                total += task.points;
            }
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

        possible += task.points;
        if (isTaskCompleted(data, kidId, task.id, date)) {
            earned += task.points;
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
 * Leaderboard
 */
function getLeaderboard(data) {
    const kids = ['olive', 'miles', 'zander'];

    return kids.map(kidId => {
        const kid = data.kids[kidId];
        const money = calculateWeeklyMoney(data, kidId);
        const maxMoney = data.settings.allowances[kidId];
        const weekStart = data.settings.weekStart || getWeekStart(new Date()).toISOString();
        const points = calculateWeekPoints(data, kidId, weekStart);
        const bonusPoints = getWeeklyBonusPoints(data, kidId);
        const streak = getCurrentStreak(data, kidId);
        const badges = getKidBadges(data, kidId);

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
            lifetimePoints: getLifetimePoints(data, kidId),
            level: calculateLevel(getLifetimePoints(data, kidId)),
            levelProgress: getLevelProgress(getLifetimePoints(data, kidId))
        };
    }).sort((a, b) => b.percentage - a.percentage);
}

/**
 * Week Management
 */
function startNewWeek(data) {
    data.settings.weekStart = getWeekStart(new Date()).toISOString();
    // Note: We keep historical completions for the dot matrix
    saveData(data);
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

    // Keep only last 50 adjustments to prevent unbounded growth
    if (data.pointAdjustments.length > 50) {
        data.pointAdjustments = data.pointAdjustments.slice(0, 50);
    }

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

function deletePointsAdjustment(data, adjustmentId) {
    if (!data.pointAdjustments) return;

    // Find and remove the adjustment (mutate in place to preserve reference)
    const index = data.pointAdjustments.findIndex(a => a.id === adjustmentId);
    if (index !== -1) {
        data.pointAdjustments.splice(index, 1);
    }
    saveData(data);
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
    BADGE_TYPES,
    LEVEL_THRESHOLDS,
    calculateLevel,
    getLevelProgress,
    getLifetimePoints,
    isPerfectDay
};
