// src/features/wordchain-simple/messageHandler.js
const {
  isGameActive,
  getCurrentState,
  checkDuplicate,
  checkReversal,
  updateState,
  recordWin,
  getLeaderboard,
  getSessionScoreboard,
  startGame,
} = require("./game.service");
const { canConnect, hasNextWords } = require("./wordPairs.service");
const { isValidFormat, normalize } = require("../../utils/textUtils");
const {
  createLeaderboardEmbed,
  createSessionScoreboardEmbed,
} = require("./embedBuilder");
const { sendWebhook } = require("../../utils/webhook.service");

// Constants
const GAME_CHANNEL_ID = "1450065511231520778";
const REACTION_MODE = "A"; // A: ✅/⛔ | B: ❤️/💔

// CRITICAL: Track messages being processed to prevent ANY double processing
const processingMessages = new Set();

/**
 * Main message handler - CLEAN REWRITE
 */
function onWordChainMessage(client) {
  return async (message) => {
    // ===========================================
    // STEP 1: BASIC FILTERS (fast exit)
    // ===========================================
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.channelId !== GAME_CHANNEL_ID) return;
    if (!isGameActive()) return;

    // ===========================================
    // STEP 2: DUPLICATE PROCESSING PREVENTION
    // ===========================================
    const msgId = message.id;

    // If already processing, IMMEDIATELY exit
    if (processingMessages.has(msgId)) {
      console.log(`⚠️ [${msgId}] Đang xử lý, bỏ qua request trùng`);
      return;
    }

    // Mark as processing
    processingMessages.add(msgId);

    // Auto-cleanup after 15 seconds
    setTimeout(() => processingMessages.delete(msgId), 15000);

    // ===========================================
    // STEP 3: VALIDATE FORMAT
    // ===========================================
    const candidate = message.content.trim();

    if (!isValidFormat(candidate)) {
      processingMessages.delete(msgId); // Clean up immediately for non-game messages
      return;
    }

    const words = candidate.split(/\s+/);
    if (words.length !== 2) {
      processingMessages.delete(msgId);
      return;
    }

    const [firstWord, secondWord] = words;
    const normalizedCandidate = normalize(candidate);
    const state = getCurrentState();
    const expectedWord = state.expectedKey;

    // ===========================================
    // STEP 4: VALIDATION LOGIC
    // ===========================================

    try {
      // 4.1 Check first word match
      if (normalize(firstWord) !== normalize(expectedWord)) {
        await reactOnce(message, false);
        console.log(
          `❌ [${message.author.tag}] Sai từ đầu: "${firstWord}" !== "${expectedWord}"`
        );
        return;
      }

      // 4.2 Check duplicate
      if (checkDuplicate(normalizedCandidate)) {
        await reactOnce(message, false);
        console.log(`❌ [${message.author.tag}] Trùng: "${candidate}"`);
        return;
      }

      // 4.3 Check reversal spam (e.g., "mưa gió" -> "gió mưa" -> "mưa gió")
      if (checkReversal(normalizedCandidate)) {
        await reactOnce(message, false);
        console.log(`❌ [${message.author.tag}] Spam đảo từ: "${candidate}"`);
        return;
      }

      // 4.4 Check connection
      if (!canConnect(firstWord, secondWord)) {
        await reactOnce(message, false);
        console.log(
          `❌ [${message.author.tag}] Không nối được: "${firstWord}" -> "${secondWord}"`
        );
        return;
      }

      // 4.5 Check if player wins (no next words)
      if (!hasNextWords(secondWord)) {
        await handleWin(message, client, candidate);
        return;
      }

      // ===========================================
      // STEP 5: VALID MOVE - UPDATE STATE
      // ===========================================

      // React success
      await reactOnce(message, true);

      // Update game state
      updateState(
        candidate,
        normalizedCandidate,
        message.author.id,
        message.author.username
      );

      // Send webhook notification
      await sendWebhook("wordchain", {
        content: `💡 Từ hiện tại là: **${candidate}**`,
      });

      console.log(`✅ [${message.author.tag}] Hợp lệ: "${candidate}"`);
    } catch (error) {
      console.error(`❌ Lỗi xử lý message ${msgId}:`, error);
    } finally {
      // Always cleanup
      processingMessages.delete(msgId);
    }
  };
}

/**
 * React EXACTLY ONCE to a message
 * This function GUARANTEES single reaction
 */
async function reactOnce(message, isCorrect) {
  try {
    // Determine emoji
    const emoji =
      REACTION_MODE === "A"
        ? isCorrect
          ? "✅"
          : "⛔"
        : isCorrect
        ? "❤️"
        : "💔";

    // React ONCE
    await message.react(emoji);
  } catch (error) {
    console.error(`❌ Lỗi react message ${message.id}:`, error.message);
  }
}

/**
 * Handle win scenario
 */
async function handleWin(message, client, winningWord) {
  try {
    const userId = message.author.id;
    const username = message.author.username;

    // Trophy reaction
    await message.react("🏆");
    console.log(`🏆 ${username} thắng với: "${winningWord}"`);

    // Record win
    recordWin(userId, username);

    // Get scoreboards
    const sessionScoreboard = getSessionScoreboard();
    const leaderboard = getLeaderboard();

    // Send session scoreboard
    const sessionEmbed = createSessionScoreboardEmbed(
      sessionScoreboard,
      username
    );
    await sendWebhook("wordchain", { embeds: [sessionEmbed] });

    // Send leaderboard
    const leaderboardEmbed = createLeaderboardEmbed(leaderboard, winningWord);
    await sendWebhook("wordchain", { embeds: [leaderboardEmbed] });

    // Start new game
    const newGame = startGame(client.user.id, client.user.username);
    await sendWebhook("wordchain", {
      content: `🔄 **Ván mới!** Từ mở màn: **${newGame.currentWord}**`,
    });

    console.log(`🎮 Game mới: ${newGame.currentWord}`);
  } catch (error) {
    console.error("❌ Lỗi handleWin:", error);
  }
}

module.exports = { onWordChainMessage };
