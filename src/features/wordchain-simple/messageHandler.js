// src/features/wordchain-simple/messageHandler.js
const {
  isGameActive,
  getCurrentState,
  checkConnection,
  checkDuplicate,
  updateState,
} = require("./game.service");
const { validateVietnameseWord } = require("./validator.service");
const { isValidFormat, normalize } = require("../../utils/textUtils");

// Constants
const GAME_CHANNEL_ID = "1450065511231520778";
const REACTION_MODE = "A"; // A: ✅/❌ | B: ❤️/💔

/**
 * Handle message for word chain game
 * @param {Client} client
 * @returns {Function} Message handler
 */
function onWordChainMessage(client) {
  return async (message) => {
    try {
      // 1. Filter - only process if all conditions met
      if (!message.guild) return;
      if (message.author.bot) return;
      if (message.channelId !== GAME_CHANNEL_ID) return;
      if (!isGameActive()) return;

      const candidate = message.content.trim();

      // 2. Format check - ignore silently if invalid format
      if (!isValidFormat(candidate)) {
        // Don't react to casual chat
        return;
      }

      // 3. Normalize
      const normalized = normalize(candidate);

      // 4. Check connection (first key must match expected key)
      if (!checkConnection(normalized)) {
        await reactToMessage(message, false);
        console.log(
          `❌ [${message.author.tag}] Wrong connection: "${candidate}"`
        );
        return;
      }

      // 5. Check duplicate
      if (checkDuplicate(normalized)) {
        await reactToMessage(message, false);
        console.log(
          `❌ [${message.author.tag}] Duplicate word: "${candidate}"`
        );
        return;
      }

      // 6. Gemini validation (with cache & timeout)
      let validationResult;
      try {
        const state = getCurrentState();
        validationResult = await validateVietnameseWord(normalized, {
          currentWord: state ? state.currentWord : null,
          expectedKey: state ? state.expectedKey : null,
        });
      } catch (error) {
        console.error(`❌ Validation error for "${candidate}":`, error.message);
        await reactToMessage(message, false);
        return;
      }

      // 7. React and update state
      if (validationResult.ok) {
        await reactToMessage(message, true);
        updateState(candidate, normalized);
        console.log(`✅ [${message.author.tag}] Valid word: "${candidate}"`);
      } else {
        await reactToMessage(message, false);
        console.log(
          `❌ [${message.author.tag}] Invalid word: "${candidate}" - ${validationResult.reason}`
        );
      }
    } catch (error) {
      console.error("Error in word chain message handler:", error);
      // Don't crash the bot
    }
  };
}

/**
 * React to message based on result
 * @param {Message} message
 * @param {boolean} isCorrect
 */
async function reactToMessage(message, isCorrect) {
  try {
    let emoji;
    if (REACTION_MODE === "A") {
      emoji = isCorrect ? "✅" : "⛔";
    } else {
      emoji = isCorrect ? "❤️" : "💔";
    }
    await message.react(emoji);
  } catch (error) {
    console.error("Failed to react:", error.message);
  }
}

module.exports = { onWordChainMessage };
