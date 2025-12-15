// src/features/wallet.js
const { getDb } = require("../db/mongo");

const DEFAULT_USER_COINS = 1000;
const ADMIN_TEST_COINS = 999999;

// fallback memory nếu chưa có Mongo
const mem = new Map(); // key = guildId:userId -> balance

function col() {
  const db = getDb();
  if (!db) return null;
  return db.collection("users");
}

function keyOf(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function ensureUser(guildId, userId, isAdmin) {
  const c = col();
  const key = keyOf(guildId, userId);

  if (!c) {
    if (!mem.has(key))
      mem.set(key, isAdmin ? ADMIN_TEST_COINS : DEFAULT_USER_COINS);
    return { guildId, userId, balance: mem.get(key), _memory: true };
  }

  const initial = isAdmin ? ADMIN_TEST_COINS : DEFAULT_USER_COINS;

  await c.updateOne(
    { guildId, userId },
    {
      $setOnInsert: {
        guildId,
        userId,
        balance: initial,
        createdAt: new Date(),
        // Economy Fields
        dailyStreak: 0,
        weeklyCounter: 0,
        lastDailyAt: new Date(0), // 1970
        cooldowns: {},
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  return c.findOne({ guildId, userId });
}

async function getBalance(guildId, userId, isAdmin) {
  const u = await ensureUser(guildId, userId, isAdmin);
  return u.balance;
}

// Helper to get full user data (for economy stats)
async function getUserData(guildId, userId) {
  return ensureUser(guildId, userId, false);
}

/**
 * addBalance: tăng/giảm coin an toàn
 */
async function addBalance(guildId, userId, delta, isAdmin) {
  // ... (giữ nguyên logic cũ) ...
  const c = col();
  const key = keyOf(guildId, userId);

  if (!c) {
    await ensureUser(guildId, userId, isAdmin);
    mem.set(key, (mem.get(key) || 0) + delta);
    return mem.get(key);
  }

  await ensureUser(guildId, userId, isAdmin);

  const res = await c.findOneAndUpdate(
    { guildId, userId },
    { $inc: { balance: delta }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  return res.balance;
}

/**
 * claimDaily: Xử lý daily reward + streak + weekly
 * Return: { status: 'success'|'fail', reward, bonus, streak, weeklyReward, nextTime }
 */
async function claimDaily(guildId, userId) {
  const {
    calculateDailyReward,
    WEEKLY_REWARD,
    WEEKLY_TARGET,
  } = require("./economyRules");
  const c = col();
  if (!c) return { status: "error", message: "No DB connection" };

  await ensureUser(guildId, userId, false);

  const now = new Date();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // 1. Get current state
  const user = await c.findOne({ guildId, userId });

  // 2. Check time
  const lastDaily = new Date(user.lastDailyAt || 0);
  const diff = now - lastDaily;

  // Nếu chưa đủ 24h
  if (diff < ONE_DAY) {
    return {
      status: "fail",
      nextTime: new Date(lastDaily.getTime() + ONE_DAY),
    };
  }

  // 3. Logic Streak & Weekly
  let streak = user.dailyStreak || 0;
  let weekly = user.weeklyCounter || 0;

  // Nếu quá 48h (tức là miss 1 ngày, vì 24h là cooldown, 48h là hạn chót)
  // Thực tế: if diff >= 48h -> Reset
  if (diff >= 2 * ONE_DAY) {
    streak = 1; // Reset về ngày 1
    weekly = 1; // Reset tuần về ngày 1
  } else {
    streak += 1; // Giữ streak
    weekly += 1;
  }

  // 4. Calculate Reward
  const { base, bonus, total } = calculateDailyReward(streak, weekly);
  let finalReward = total;
  let weeklyBonus = 0;

  // Weekly Logic
  if (weekly >= WEEKLY_TARGET) {
    weeklyBonus = WEEKLY_REWARD;
    finalReward += weeklyBonus;
    weekly = 0; // Reset as requested
  }

  // 5. ATOMIC UPDATE
  // Lock by lastDailyAt to prevent double claim
  const res = await c.findOneAndUpdate(
    {
      guildId,
      userId,
      lastDailyAt: user.lastDailyAt, // Optimistic Locking
    },
    {
      $set: {
        lastDailyAt: now,
        dailyStreak: streak,
        weeklyCounter: weekly,
        updatedAt: now,
      },
      $inc: { balance: finalReward },
    },
    { returnDocument: "after" }
  );

  if (!res) {
    // Failed to update (race condition or someone else updated)
    return { status: "fail_race" };
  }

  return {
    status: "success",
    reward: base,
    streakBonus: bonus,
    weeklyBonus,
    total: finalReward,
    streak,
    weekly,
    balance: res.balance,
  };
}

module.exports = {
  DEFAULT_USER_COINS,
  ADMIN_TEST_COINS,
  getBalance,
  addBalance,
  getUserData,
  claimDaily,
};
