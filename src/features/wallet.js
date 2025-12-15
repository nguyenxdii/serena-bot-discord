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

async function ensureUser(guildId, userId, isAdmin) {
  const c = col();
  const key = `${guildId}:${userId}`;

  if (!c) {
    if (!mem.has(key))
      mem.set(key, isAdmin ? ADMIN_TEST_COINS : DEFAULT_USER_COINS);
    return { guildId, userId, balance: mem.get(key), _memory: true };
  }

  const existing = await c.findOne({ guildId, userId });
  if (existing) return existing;

  const doc = {
    guildId,
    userId,
    balance: isAdmin ? ADMIN_TEST_COINS : DEFAULT_USER_COINS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await c.insertOne(doc);
  return doc;
}

async function getBalance(guildId, userId, isAdmin) {
  const u = await ensureUser(guildId, userId, isAdmin);
  return u.balance;
}

async function addBalance(guildId, userId, delta, isAdmin) {
  const c = col();
  const key = `${guildId}:${userId}`;

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
  return res.value.balance;
}

module.exports = {
  DEFAULT_USER_COINS,
  ADMIN_TEST_COINS,
  getBalance,
  addBalance,
};
