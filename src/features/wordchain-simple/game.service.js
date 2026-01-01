// src/features/wordchain-simple/game.service.js
const { getEasyStartPhrase } = require("./wordPairs.service");
const { lastKey, normalize } = require("../../utils/textUtils");

// Game state (in-memory, resets on bot restart)
let gameState = null;

// Player scores (in-memory, persists until bot restart)
// Map<userId, { username: string, wins: number }>
const playerScores = new Map();

/**
 * Start or restart the game
 * @param {string} userId - User/Bot who started the game
 * @param {string} username - Username (optional)
 * @returns {object} New game state
 */
function startGame(userId, username = "Bot") {
  const startPhrase = getEasyStartPhrase();
  const normalized = normalize(startPhrase);

  gameState = {
    currentWord: startPhrase,
    normalizedWord: normalized,
    expectedKey: lastKey(startPhrase),
    usedWords: new Set([normalized]),
    recentPairs: [], // Track last 10 pairs to prevent spam (e.g., "mưa gió" -> "gió mưa" -> "mưa gió")
    startedAt: new Date(),
    startedBy: userId,
    moveCount: 0,
    sessionScores: new Map(), // Track correct words per user in THIS game
  };

  console.log(`🎮 Game started by ${username} with phrase: "${startPhrase}"`);
  return { ...gameState, usedWords: Array.from(gameState.usedWords) };
}

/**
 * Get current game state
 * @returns {object|null}
 */
function getCurrentState() {
  if (!gameState) return null;

  return {
    ...gameState,
    usedWords: Array.from(gameState.usedWords),
  };
}

/**
 * Check if game is active
 * @returns {boolean}
 */
function isGameActive() {
  return gameState !== null;
}

/**
 * Check if word was already used
 * @param {string} normalized
 * @returns {boolean}
 */
function checkDuplicate(normalized) {
  if (!gameState) return false;

  const isDuplicate = gameState.usedWords.has(normalized);

  if (isDuplicate) {
    console.log(`❌ Duplicate word: "${normalized}"`);
  }

  return isDuplicate;
}

/**
 * Check if current word pair is a reversal of recent pairs (spam prevention)
 * Prevents patterns like: "mưa gió" -> "gió mưa" -> "mưa gió"
 * @param {string} normalized - Current word pair (normalized)
 * @returns {boolean} - True if this is a spam reversal
 */
function checkReversal(normalized) {
  if (!gameState || !gameState.recentPairs) return false;

  // Check if this normalized pair exists in recent pairs
  const isReversal = gameState.recentPairs.includes(normalized);

  if (isReversal) {
    console.log(`❌ Reversal spam detected: "${normalized}"`);
  }

  return isReversal;
}

/**
 * Update game state after a valid move
 * @param {string} originalWord - Original word from user (with tones)
 * @param {string} normalizedWord - Normalized version
 * @param {string} userId - User ID
 * @param {string} username - Username
 */
function updateState(originalWord, normalizedWord, userId, username) {
  if (!gameState) {
    throw new Error("Cannot update state: game not active");
  }

  gameState.currentWord = originalWord;
  gameState.normalizedWord = normalizedWord;
  gameState.expectedKey = lastKey(originalWord);
  gameState.usedWords.add(normalizedWord);
  gameState.moveCount++;

  // Track recent pairs for spam prevention (keep last 10)
  if (!gameState.recentPairs) {
    gameState.recentPairs = [];
  }
  gameState.recentPairs.push(normalizedWord);
  if (gameState.recentPairs.length > 10) {
    gameState.recentPairs.shift(); // Remove oldest
  }

  // Track score for this user in current session
  if (!gameState.sessionScores.has(userId)) {
    gameState.sessionScores.set(userId, { username, correctWords: 0 });
  }
  const userScore = gameState.sessionScores.get(userId);
  userScore.correctWords++;
  userScore.username = username; // Update in case changed

  console.log(
    `✅ State updated: word="${originalWord}", expectedKey="${gameState.expectedKey}", moves=${gameState.moveCount}, ${username}: ${userScore.correctWords} words`
  );
}

/**
 * Record a win for a player
 * @param {string} userId
 * @param {string} username
 * @returns {number} Total wins for this player
 */
function recordWin(userId, username) {
  if (!playerScores.has(userId)) {
    playerScores.set(userId, { id: userId, username, wins: 0 });
  }

  const player = playerScores.get(userId);
  player.wins++;
  player.username = username; // Update in case username changed

  console.log(`🏆 ${username} wins! Total: ${player.wins}`);
  return player.wins;
}

/**
 * Get session scoreboard (players who participated in current game)
 * @returns {Array<{userId: string, username: string, correctWords: number}>}
 */
function getSessionScoreboard() {
  if (!gameState || !gameState.sessionScores) {
    return [];
  }

  const scoreboard = Array.from(gameState.sessionScores.entries()).map(
    ([userId, data]) => ({
      userId,
      username: data.username,
      correctWords: data.correctWords,
    })
  );

  // Sort by correct words descending
  scoreboard.sort((a, b) => b.correctWords - a.correctWords);
  return scoreboard;
}

/**
 * Get leaderboard
 * @returns {Array<{id: string, username: string, wins: number}>}
 */
function getLeaderboard() {
  const leaderboard = Array.from(playerScores.values()).sort(
    (a, b) => b.wins - a.wins
  );
  return leaderboard;
}

/**
 * Get game statistics
 * @returns {object}
 */
function getGameStats() {
  if (!gameState) {
    return {
      active: false,
      totalGamesPlayed: 0, // Note: we don't track this in memory
    };
  }

  const duration = Date.now() - gameState.startedAt.getTime();

  return {
    active: true,
    currentWord: gameState.currentWord,
    expectedKey: gameState.expectedKey,
    wordCount: gameState.usedWords.size,
    moveCount: gameState.moveCount,
    durationSeconds: Math.floor(duration / 1000),
    startedBy: gameState.startedBy,
    startedAt: gameState.startedAt,
  };
}

/**
 * Reset/end the game
 */
function endGame() {
  const stats = getGameStats();
  gameState = null;
  console.log("🏁 Game ended");
  return stats;
}

module.exports = {
  startGame,
  getCurrentState,
  isGameActive,
  checkDuplicate,
  checkReversal,
  updateState,
  recordWin,
  getLeaderboard,
  getSessionScoreboard,
  getGameStats,
  endGame,
};
