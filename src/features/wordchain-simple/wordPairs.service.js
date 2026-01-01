// src/features/wordchain-simple/wordPairs.service.js
const wordPairs = require("../../data/wordPairs.json");
const { normalize } = require("../../utils/textUtils");

/**
 * Check if two words can connect according to wordPairs.json
 * @param {string} fromWord - The word to connect from
 * @param {string} toWord - The word to connect to
 * @returns {boolean}
 */
function canConnect(fromWord, toWord) {
  const normalizedFrom = normalize(fromWord);
  const normalizedTo = normalize(toWord);

  const nextWords = wordPairs[normalizedFrom] || [];
  const canConnectResult = nextWords.includes(normalizedTo);

  console.log(
    `🔗 canConnect("${fromWord}", "${toWord}") => ${canConnectResult} (nextWords: ${nextWords
      .slice(0, 5)
      .join(", ")}${nextWords.length > 5 ? "..." : ""})`
  );

  return canConnectResult;
}

/**
 * Check if a word has any possible next words
 * @param {string} word
 * @returns {boolean}
 */
function hasNextWords(word) {
  const normalized = normalize(word);
  const nextWords = wordPairs[normalized] || [];

  console.log(
    `🎯 hasNextWords("${word}") => ${nextWords.length > 0} (${
      nextWords.length
    } options)`
  );

  return nextWords.length > 0;
}

/**
 * Get all possible next words for a given word
 * @param {string} word
 * @returns {string[]}
 */
function getNextWords(word) {
  const normalized = normalize(word);
  return wordPairs[normalized] || [];
}

/**
 * Get a random word from wordPairs to start the game
 * @returns {string}
 */
function getRandomWord() {
  const keys = Object.keys(wordPairs);
  // Filter to only words that have next words (can continue game)
  const validKeys = keys.filter((key) => wordPairs[key].length > 0);

  if (validKeys.length === 0) {
    // Fallback to any key if somehow no valid keys
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return randomKey;
  }

  const randomKey = validKeys[Math.floor(Math.random() * validKeys.length)];
  return randomKey;
}

/**
 * Get a random 2-word phrase to start the game
 * @returns {string} - Format: "word1 word2"
 */
function getRandomStartPhrase() {
  const firstWord = getRandomWord();
  const nextWords = getNextWords(firstWord);

  if (nextWords.length === 0) {
    // Fallback: try another word
    return getRandomStartPhrase();
  }

  const secondWord = nextWords[Math.floor(Math.random() * nextWords.length)];
  return `${firstWord} ${secondWord}`;
}

/**
 * Get an easy 2-word phrase to start the game
 * Uses a curated list of 208 common Vietnamese phrases
 * @returns {string} - Format: "word1 word2"
 */
function getEasyStartPhrase() {
  const { easyWordPairs } = require("../../data/easyWordPairs");

  // Try up to 30 random phrases from the easy list
  for (let attempt = 0; attempt < 30; attempt++) {
    const phrase =
      easyWordPairs[Math.floor(Math.random() * easyWordPairs.length)];
    const words = phrase.split(" ");

    if (words.length !== 2) {
      console.warn(`⚠️ Invalid phrase format: "${phrase}"`);
      continue;
    }

    // Validate that the two words can connect in wordPairs.json
    if (canConnect(words[0], words[1])) {
      console.log(`✨ Easy start phrase: "${phrase}"`);
      return phrase;
    }
  }

  // Fallback to completely random if no easy phrase validates
  console.warn("⚠️ No easy phrase validated after 30 attempts, using random");
  return getRandomStartPhrase();
}

module.exports = {
  canConnect,
  hasNextWords,
  getNextWords,
  getRandomWord,
  getRandomStartPhrase,
  getEasyStartPhrase,
};
