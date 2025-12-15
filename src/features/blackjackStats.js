// src/features/blackjackStats.js
const { getDb } = require("../db/mongo");

// fallback memory nếu chưa có Mongo
const mem = new Map(); // key = guildId:userId -> stats

function col() {
  const db = getDb();
  if (!db) return null;
  return db.collection("bj_stats");
}

function defaultStats(guildId, userId) {
  return {
    guildId,
    userId,
    played: 0,
    win: 0,
    lose: 0,
    push: 0,
    blackjack: 0,
    dealerBlackjack: 0,
    net: 0, // lãi/lỗ tổng
    updatedAt: new Date(),
    createdAt: new Date(),
  };
}

async function ensureStats(guildId, userId) {
  const c = col();
  const key = `${guildId}:${userId}`;

  if (!c) {
    if (!mem.has(key)) mem.set(key, defaultStats(guildId, userId));
    return mem.get(key);
  }

  const existing = await c.findOne({ guildId, userId });
  if (existing) return existing;

  const doc = defaultStats(guildId, userId);
  await c.insertOne(doc);
  return doc;
}

/**
 * netDelta = pay - bet (vì bet đã trừ trước)
 */
async function recordBlackjackRound(guildId, userId, result, bet, pay) {
  const c = col();
  const key = `${guildId}:${userId}`;
  const netDelta = (pay || 0) - (bet || 0);

  // fallback memory
  if (!c) {
    const s = await ensureStats(guildId, userId);
    s.played += 1;
    if (result === "WIN") s.win += 1;
    else if (result === "LOSE") s.lose += 1;
    else if (result === "PUSH") s.push += 1;
    else if (result === "BJ") s.blackjack += 1;
    else if (result === "DEALER_BJ") s.dealerBlackjack += 1;
    s.net += netDelta;
    s.updatedAt = new Date();
    mem.set(key, s);
    return s;
  }

  await ensureStats(guildId, userId);

  const inc = {
    played: 1,
    net: netDelta,
  };

  if (result === "WIN") inc.win = 1;
  else if (result === "LOSE") inc.lose = 1;
  else if (result === "PUSH") inc.push = 1;
  else if (result === "BJ") inc.blackjack = 1;
  else if (result === "DEALER_BJ") inc.dealerBlackjack = 1;

  const res = await c.findOneAndUpdate(
    { guildId, userId },
    { $inc: inc, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  return res;
}

async function getBlackjackStats(guildId, userId) {
  return ensureStats(guildId, userId);
}

module.exports = { recordBlackjackRound, getBlackjackStats };
