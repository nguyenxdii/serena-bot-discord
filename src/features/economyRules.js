// src/features/economyRules.js

/**
 * Constants
 */
const BASE_DAILY = 300;
const DAILY_STREAK_BONUS = 30;
const MAX_STREAK_BONUS = 210; // Cap at 7 days (7 * 30 = 210)
const WEEKLY_REWARD = 1500;
const WEEKLY_TARGET = 7;

const MIN_BET = 50;
const MAX_BET_PERCENT = 0.1; // 10%
const WIN_FEE_PERCENT = 0.05; // 5%

const GAME_COOLDOWN_MS = 7000; // 7 seconds
const RETRY_COOLDOWN_MS = 3000; // 3 seconds

// In-memory cooldowns to avoid DB slamming for spam checks
// Map<userId, Map<key, expireTimestamp>>
const cooldowns = new Map();

/**
 * Calculate Daily Reward based on current streak (before update)
 * @param {number} currentStreak
 * @returns {object} { reward, bonus, isWeekly }
 */
function calculateDailyReward(currentStreak, weeklyCounter) {
  // Logic:
  // Streak starts at 1.
  // Bonus = (streak - 1) * 30, capped at 210
  // But user says: "Mỗi ngày liên tiếp: +30 coin".
  // Let's assume Streak 1: 300 + 0
  // Streak 2: 300 + 30
  // Streak 7: 300 + (6*30)=180?? Or user said "Cap bonus: +210".
  // "Cap bonus +210 (max 7 ngày)" => Day 8: 300+210 = 510.

  let bonus = (currentStreak - 1) * DAILY_STREAK_BONUS;
  if (bonus > MAX_STREAK_BONUS) bonus = MAX_STREAK_BONUS;
  if (bonus < 0) bonus = 0;

  const totalDaily = BASE_DAILY + bonus;

  return {
    base: BASE_DAILY,
    bonus,
    total: totalDaily,
  };
}

/**
 * Validate Bet amount
 * @param {number} balance
 * @param {number} bet
 * @returns {string|null} returns error message or null if valid
 */
function validateBet(balance, bet) {
  if (!Number.isInteger(bet) || bet <= 0) {
    return "❌ Số tiền cược phải là số nguyên dương > 0.";
  }

  if (balance < MIN_BET) {
    return `❌ Bạn không đủ tiền! Cần tối thiểu **${MIN_BET}** coin để chơi.`;
  }

  if (bet < MIN_BET) {
    return `❌ Cược quá nhỏ! Tối thiểu: **${MIN_BET}** coin.`;
  }

  if (bet > balance) {
    return `❌ Không đủ tiền (Số dư: **${balance}**).`;
  }

  // Max bet 10% floor
  const maxBet = Math.floor(balance * MAX_BET_PERCENT);
  // Nếu balance nhỏ (ví dụ 100), 10% = 10 < MIN_BET (50).
  // "Max bet: 10% wallet (floor)"
  // Nếu 10% wallet < MIN_BET, thì user không thể cược?
  // User Rule: "Nếu balance < minBet -> không cho chơi" (handled above).
  // What if balance = 500? Max bet = 50. OK.
  // What if balance = 400? Max bet = 40. But Min bet = 50. -> Cannot play?
  // Let's strict follow: "Max bet: 10% wallet".
  // If maxBet < MIN_BET, then strictly speaking they can't bet.
  // Exception: Maybe allow betting ALL if balance is low?
  // User said "Max bet: 10% wallet (floor)". Strict.

  if (maxBet < MIN_BET) {
    // Edge case: Balance < 500. 10% < 50.
    // User: "Min bet 50".
    // Conflict? Or effectively means you need 500 coin to play safely?
    // Actually "Min bet: 50". If balance is 100, can I bet 50?
    // If Max Bet is 10% -> 10. NO.
    // So effectively need 500 balance to enter?
    // Let's return error but maybe explain.
    return `❌ Cược vượt quá giới hạn an toàn (10% ví).\nChiến thuật quản lý vốn: Bạn chỉ được cược tối đa **${maxBet}** coin.`;
  }

  if (bet > maxBet) {
    return `❌ Cược vượt quá 10% ví (Max: **${maxBet}** coin). Hãy quản lý vốn!`;
  }

  return null;
}

/**
 * Apply Win Fee (5% on profit)
 * @param {number} profit
 * @returns {number} netProfit
 */
function applyWinFee(profit) {
  if (profit <= 0) return profit;
  const fee = Math.floor(profit * WIN_FEE_PERCENT);
  return profit - fee;
}

/**
 * Check and Set Cooldown in Memory
 * @param {string} userId
 * @param {string} key (e.g., 'blackjack', 'bacay')
 * @returns {number|null} ms remaining or null if allowed
 */
function checkCooldown(userId, key) {
  if (!cooldowns.has(userId)) return null;
  const userCD = cooldowns.get(userId);
  if (!userCD.has(key)) return null;

  const expire = userCD.get(key);
  const now = Date.now();
  if (now < expire) {
    return expire - now;
  }
  return null;
}

function setCooldown(userId, key, ms = GAME_COOLDOWN_MS) {
  if (!cooldowns.has(userId)) cooldowns.set(userId, new Map());
  const userCD = cooldowns.get(userId);
  userCD.set(key, Date.now() + ms);
}

module.exports = {
  calculateDailyReward,
  validateBet,
  applyWinFee,
  checkCooldown,
  setCooldown,
  WEEKLY_REWARD,
  WEEKLY_TARGET,
  RETRY_COOLDOWN_MS,
  MIN_BET,
};
