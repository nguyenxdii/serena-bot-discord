// src/features/elo/elo.service.js
const { getDb } = require("../../db/mongo");

/**
 * Constants
 */
const K_NOVICE = 40; // < 20 games
const K_NORMAL = 24; // Standard
const K_MASTER = 16; // > 1800 ELO

const GAME_THRESHOLD = 20;
const MASTER_ELO = 1800;
const MIN_ELO = 800;

/**
 * Calculate expected score for Player A
 * @param {number} ra Rating Player A
 * @param {number} rb Rating Player B
 * @returns {number} Expected score (0-1)
 */
function getExpectedScore(ra, rb) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/**
 * Get K-Factor for a player
 * @param {number} elo
 * @param {number} gamesPlayed
 */
function getKFactor(elo, gamesPlayed) {
  if (gamesPlayed < GAME_THRESHOLD) return K_NOVICE;
  if (elo >= MASTER_ELO) return K_MASTER;
  return K_NORMAL;
}

/**
 * Calculate new ELO rating
 * @param {number} currentElo
 * @param {number} actualScore (1 for win, 0 for loss, 0.5 draw)
 * @param {number} expectedScore
 * @param {number} kFactor
 */
function calculateNewElo(currentElo, actualScore, expectedScore, kFactor) {
  let newElo = currentElo + kFactor * (actualScore - expectedScore);
  newElo = Math.round(newElo);
  return Math.max(newElo, MIN_ELO);
}

/**
 * Process Match Result & Update ELO
 * @param {string} guildId
 * @param {string} winnerId
 * @param {string} loserId
 * @returns {Promise<object>} { winnerNewElo, loserNewElo, winnerDiff, loserDiff }
 */
async function processMatchResult(guildId, winnerId, loserId) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  const users = db.collection("users");

  // Get current stats
  const [winner, loser] = await Promise.all([
    users.findOne({ guildId, userId: winnerId }),
    users.findOne({ guildId, userId: loserId }),
  ]);

  if (!winner || !loser) throw new Error("User data not found");

  const rw = winner.elo || 1000;
  const rl = loser.elo || 1000;

  const gw = winner.gamesPlayed || 0;
  const gl = loser.gamesPlayed || 0;

  // Calculate ELO
  const ew = getExpectedScore(rw, rl);
  const el = getExpectedScore(rl, rw);

  const kw = getKFactor(rw, gw);
  const kl = getKFactor(rl, gl);

  const newRw = calculateNewElo(rw, 1, ew, kw);
  const newRl = calculateNewElo(rl, 0, el, kl);

  // Update DB
  const now = new Date();

  await users.updateOne(
    { guildId, userId: winnerId },
    {
      $set: { elo: newRw, updatedAt: now },
      $inc: { gamesPlayed: 1, wins: 1 },
    }
  );

  await users.updateOne(
    { guildId, userId: loserId },
    {
      $set: { elo: newRl, updatedAt: now },
      $inc: { gamesPlayed: 1, losses: 1 },
    }
  );

  return {
    winnerId,
    loserId,
    winnerOldElo: rw,
    winnerNewElo: newRw,
    winnerDiff: newRw - rw,
    loserOldElo: rl,
    loserNewElo: newRl,
    loserDiff: newRl - rl,
  };
}

async function getTopElo(guildId, limit = 5) {
  const db = getDb();
  if (!db) return [];

  return db
    .collection("users")
    .find({ guildId })
    .sort({ elo: -1 })
    .limit(limit)
    .toArray();
}

module.exports = {
  getExpectedScore,
  getKFactor,
  calculateNewElo,
  processMatchResult,
  getTopElo,
};
