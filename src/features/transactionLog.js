const { getDb } = require("../db/mongo");

function col() {
  const db = getDb();
  if (!db) return null;
  return db.collection("transactions");
}

/**
 * Log a transaction to DB
 * @param {object} data
 * @param {string} data.type "TIP"|"PAY"|"DAILY"|"BLACKJACK"|"THREE_CARD"|"ADMIN_ADD"|"ADMIN_REMOVE"
 * @param {string} data.guildId
 * @param {string} data.userId
 * @param {number} data.amount (Change in balance)
 * @param {number} data.fee (Fee deducted, if any)
 * @param {string} data.reason (or note)
 * @param {object} data.meta (Extra data like game result, streak)
 */
async function logTransaction(data) {
  const c = col();
  if (!c) return;

  try {
    // Normalize fields
    const entry = {
      type: data.type,
      guildId: data.guildId,
      userId: data.userId || data.fromUserId, // Support legacy
      targetId: data.toUserId || null, // For transfers
      amount: data.amount,
      fee: data.fee || 0,
      reason: data.reason || data.note || "",
      meta: data.meta || {},
      createdAt: new Date(),
    };

    await c.insertOne(entry);
  } catch (e) {
    console.error("Log Tx Error:", e);
  }
}

module.exports = { logTransaction };
