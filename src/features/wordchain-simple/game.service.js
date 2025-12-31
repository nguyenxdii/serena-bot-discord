// src/features/wordchain-simple/game.service.js
const { getRandomStartWord } = require("./wordlist");
const { firstKey, lastKey, normalize } = require("../../utils/textUtils");

// Game state (in-memory, resets on bot restart)
let gameState = null;

/**
 * Start or restart the game
 * @param {string} userId - User who started the game
 * @returns {object} New game state
 */
function startGame(userId) {
  const startWord = getRandomStartWord();
  const normalized = normalize(startWord);

  gameState = {
    currentWord: startWord,
    normalizedWord: normalized,
    expectedKey: lastKey(startWord),
    usedWords: new Set([normalized]),
    startedAt: new Date(),
    startedBy: userId,
    moveCount: 0,
  };

  console.log(`🎮 Game started by ${userId} with word: "${startWord}"`);
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
 * Check if candidate word connects properly
 * @param {string} candidate
 * @returns {boolean}
 */
function checkConnection(candidate) {
  if (!gameState) return false;

  const candidateKey = firstKey(candidate);
  const matches = candidateKey === gameState.expectedKey;

  if (!matches) {
    console.log(
      `❌ Connection failed: first("${candidate}")="${candidateKey}" !== expected="${gameState.expectedKey}"`
    );
  }

  return matches;
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
 * Update game state after a valid move
 * @param {string} originalWord - Original word from user (with tones)
 * @param {string} normalizedWord - Normalized version
 */
function updateState(originalWord, normalizedWord) {
  if (!gameState) {
    throw new Error("Cannot update state: game not active");
  }

  gameState.currentWord = originalWord;
  gameState.normalizedWord = normalizedWord;
  gameState.expectedKey = lastKey(originalWord);
  gameState.usedWords.add(normalizedWord);
  gameState.moveCount++;

  console.log(
    `✅ State updated: word="${originalWord}", expectedKey="${gameState.expectedKey}", moves=${gameState.moveCount}`
  );
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
  checkConnection,
  checkDuplicate,
  updateState,
  getGameStats,
  endGame,
};
