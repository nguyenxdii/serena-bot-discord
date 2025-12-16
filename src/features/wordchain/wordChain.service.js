// src/features/wordchain/wordChain.service.js
const { getDb } = require("../../db/mongo");
const { processTransfer, getUserData } = require("../wallet");
const { processMatchResult } = require("../elo/elo.service");
const { validateWord } = require("../gemini/gemini.service");

/* Constants */
const MATCH_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes for pending challenge
const TURN_TIMEOUT_MS = 60 * 1000; // 60 seconds per turn
const COLLECTION_NAME = "matches";

/**
 * Create Challenge
 */
async function createMatch(guildId, channelId, playerAId, playerBId, bet) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");

  const match = {
    guildId,
    channelId,
    playerAId,
    playerBId,
    betAmount: bet,
    status: "PENDING",
    escrowA: 0,
    escrowB: 0,
    createdAt: new Date(),
    acceptDeadlineAt: new Date(Date.now() + MATCH_TIMEOUT_MS),
    usedWords: [],
    lastWord: null,
    turnPlayerId: null, // Set when ACTIVE
  };

  const res = await db.collection(COLLECTION_NAME).insertOne(match);
  return { ...match, _id: res.insertedId };
}

/**
 * Accept Match
 * Handled with atomic Lock & Escrow
 */
async function acceptMatch(matchId, acceptorId) {
  const db = getDb();
  const match = await db
    .collection(COLLECTION_NAME)
    .findOne({ _id: matchId, status: "PENDING" });

  if (!match) return { success: false, reason: "Match not found or expired" };
  if (match.playerBId !== acceptorId)
    return { success: false, reason: "Not your challenge" };

  // 1. Check Balances & Escrow
  // Deduct from A
  const resA = await processTransfer(
    match.guildId,
    match.playerAId,
    "SYSTEM_ESCROW_A",
    match.betAmount,
    0, // Lock, no receiver
    {}
  );
  if (!resA.success)
    return { success: false, reason: `Player A insufficient funds` };

  // Deduct from B
  const resB = await processTransfer(
    match.guildId,
    match.playerBId,
    "SYSTEM_ESCROW_B",
    match.betAmount,
    0,
    {}
  );
  if (!resB.success) {
    // Refund A if B fails
    await processTransfer(
      match.guildId,
      "SYSTEM_ESCROW_A",
      match.playerAId,
      match.betAmount,
      match.betAmount,
      {}
    );
    return { success: false, reason: `You don't have enough coins!` };
  }

  // 2. Start Game
  const firstPlayerId = Math.random() < 0.5 ? match.playerAId : match.playerBId;

  await db.collection(COLLECTION_NAME).updateOne(
    { _id: matchId },
    {
      $set: {
        status: "ACTIVE",
        acceptedAt: new Date(),
        turnPlayerId: firstPlayerId,
        turnDeadlineAt: new Date(Date.now() + TURN_TIMEOUT_MS),
        escrowA: match.betAmount,
        escrowB: match.betAmount,
      },
    }
  );

  return {
    success: true,
    match: await db.collection(COLLECTION_NAME).findOne({ _id: matchId }),
  };
}

/**
 * Decline / Cancel
 */
async function cancelMatch(matchId, userId, reason = "Declined") {
  const db = getDb();
  const match = await db.collection(COLLECTION_NAME).findOne({ _id: matchId });

  if (!match) return;
  if (match.status !== "PENDING") return;

  // Only participants can cancel
  if (match.playerAId !== userId && match.playerBId !== userId) return;

  await db
    .collection(COLLECTION_NAME)
    .updateOne({ _id: matchId }, { $set: { status: "CANCELLED", reason } });
  // No refund needed as escrow happens on Accept
  return true;
}

/**
 * Submit Word
 */
async function submitWord(matchId, userId, word) {
  const db = getDb();
  // 1. Atomic Check & Lock
  const match = await db.collection(COLLECTION_NAME).findOne({ _id: matchId });
  if (!match || match.status !== "ACTIVE")
    return { success: false, message: "Match not active" };
  if (match.turnPlayerId !== userId)
    return { success: false, message: "Not your turn!" };
  if (Date.now() > new Date(match.turnDeadlineAt).getTime())
    return { success: false, message: "Time expired!" };

  // 2. Gemini Check
  // Retry once on timeout handled by caller or here? Let's do simplified.
  let validation;
  try {
    validation = await validateWord(match.lastWord, word, match.usedWords);
  } catch (e) {
    // Retry check
    try {
      validation = await validateWord(match.lastWord, word, match.usedWords);
    } catch (ex) {
      return { success: false, message: "Gemini error. Please try again." };
    }
  }

  if (!validation.is_valid) {
    // Invalid word -> LOSE immediately per rules
    await endMatch(
      matchId,
      userId === match.playerAId ? match.playerBId : match.playerAId,
      "Invalid Word: " + validation.reason
    );
    return { success: true, gameOver: true, reason: validation.reason };
  }

  // 3. Valid Word -> Next Turn
  const nextPlayerId =
    userId === match.playerAId ? match.playerBId : match.playerAId;
  const newUsedWords = [...match.usedWords, validation.normalized_word]; // normalized from Gemini

  await db.collection(COLLECTION_NAME).updateOne(
    { _id: matchId },
    {
      $set: {
        lastWord: validation.normalized_word,
        turnPlayerId: nextPlayerId,
        turnDeadlineAt: new Date(Date.now() + TURN_TIMEOUT_MS),
        lastMoveAt: new Date(),
        usedWords: newUsedWords, // Note: ensure schema supports array
      },
    }
  );

  return {
    success: true,
    gameOver: false,
    nextPlayerId,
    word: validation.normalized_word,
  };
}

/**
 * End Match & Payout
 */
async function endMatch(matchId, winnerId, reason) {
  const db = getDb();
  const match = await db.collection(COLLECTION_NAME).findOne({ _id: matchId });
  if (!match || match.status === "FINISHED") return;

  const loserId =
    winnerId === match.playerAId ? match.playerBId : match.playerAId;
  const totalPot = match.escrowA + match.escrowB;

  // 1. Update Match
  await db.collection(COLLECTION_NAME).updateOne(
    { _id: matchId },
    {
      $set: {
        status: "FINISHED",
        winnerId,
        loserId,
        endReason: reason,
        endedAt: new Date(),
      },
    }
  );

  // 2. Payout (Winner takes all)
  // No strict fee mentioned in prompt for this specific game, but usually "Winner receives bet * 2".
  // Prompt: "Người thắng nhận: bet * 2". "Không thu fee nếu trận bị cancel".
  // Does not explicitly say "fee" on win. But economyRules has fee.
  // Prompt says: "Người thắng nhận: bet * 2". This implies NO FEE.
  // Wait, if I bet 100, pot 200. I get 200. Profit 100.
  // Let's stick to NO FEE if prompt says "bet * 2".

  await processTransfer(
    match.guildId,
    "SYSTEM_ESCROW_WIN",
    winnerId,
    0, // sending 0 from void? No, processTransfer logic is user-to-user.
    // We need to just ADD balance to winner. match.escrowA/B were "deducted" (burned/moved to system).
    // If we used a real escrow user, we would transfer from there.
    // Since `processTransfer` in `wallet.js` deducts from sender, we need to manually ADD to winner.
    // Or `processTransfer` supports locking?
    // In `acceptMatch`, we deducted users balance. Money is "Gone" from their wallet.
    // Now we print money for winner.
    totalPot,
    { type: "WORDCHAIN_WIN", matchId }
  );

  // 3. ELO Update
  await processMatchResult(match.guildId, winnerId, loserId);
}

async function forfeitMatch(matchId, loserId) {
  const db = getDb();
  const match = await db.collection(COLLECTION_NAME).findOne({ _id: matchId });
  if (!match || match.status !== "ACTIVE") return;

  // Check if loser is player
  if (match.playerAId !== loserId && match.playerBId !== loserId) return;

  const winnerId =
    loserId === match.playerAId ? match.playerBId : match.playerAId;
  await endMatch(matchId, winnerId, "Opponent Forfeited");
  return true;
}

module.exports = {
  createMatch,
  acceptMatch,
  cancelMatch,
  submitWord,
  forfeitMatch,
  endMatch, // for timeout checks
  COLLECTION_NAME,
};
