// src/features/threeCardStats.js
const { getDb } = require("../db/mongo");

const mem = new Map();

function col() {
  const db = getDb();
  if (!db) return null;
  return db.collection("three_card_stats");
}

function defaultStats(guildId, userId) {
  return {
    guildId,
    userId,
    played: 0,
    win: 0,
    lose: 0,
    draw: 0,
    net: 0,
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

// netDelta = pay - bet
async function recordThreeCardGame(guildId, userId, result, bet, pay) {
  const c = col();
  const netDelta = (pay || 0) - (bet || 0);

  if (!c) {
    const s = await ensureStats(guildId, userId);
    s.played++;
    if (result === "WIN") s.win++;
    else if (result === "LOSE") s.lose++;
    else if (result === "DRAW") s.draw++;
    s.net += netDelta;
    return s;
  }

  await ensureStats(guildId, userId);

  const inc = { played: 1, net: netDelta };
  if (result === "WIN") inc.win = 1;
  else if (result === "LOSE") inc.lose = 1;
  else if (result === "DRAW") inc.draw = 1;

  const res = await c.findOneAndUpdate(
    { guildId, userId },
    { $inc: inc, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  return res;
}

async function getStats(guildId, userId) {
  return ensureStats(guildId, userId);
}

// For /three-card-leaderboard
async function getTopWinners(guildId, limit = 10) {
  const c = col();
  if (!c) return [];

  return c.find({ guildId }).sort({ net: -1 }).limit(limit).toArray();
}

module.exports = { recordThreeCardGame, getStats, getTopWinners };
