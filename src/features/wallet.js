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

/**
 * addBalance: tăng/giảm coin an toàn, không conflict update operators
 * - Nếu user chưa tồn tại: tạo user balance = initial trước, rồi $inc delta
 *   (2 bước nhưng cực ổn định, không bị "conflicting update operators")
 */
async function addBalance(guildId, userId, delta, isAdmin) {
  const c = col();
  const key = keyOf(guildId, userId);

  if (!c) {
    await ensureUser(guildId, userId, isAdmin);
    mem.set(key, (mem.get(key) || 0) + delta);
    return mem.get(key);
  }

  // đảm bảo user tồn tại trước (balance có sẵn)
  await ensureUser(guildId, userId, isAdmin);

  const res = await c.findOneAndUpdate(
    { guildId, userId },
    { $inc: { balance: delta }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  // res là document user luôn nếu findOneAndUpdate ok (với returnDocument: 'after')
  return res.balance;
}

module.exports = {
  DEFAULT_USER_COINS,
  ADMIN_TEST_COINS,
  getBalance,
  addBalance,
};
