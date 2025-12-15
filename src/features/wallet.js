// src/features/wallet.js
const { getDb } = require("../db/mongo");

async function getBalance(guildId, userId) {
  const db = getDb();
  const col = db.collection("wallets");

  const doc = await col.findOne({ guildId, userId });

  // nếu chưa có ví → mặc định 1.000.000
  return doc?.balance ?? 1_000_000;
}

async function addBalance(guildId, userId, amount) {
  const db = getDb();
  const col = db.collection("wallets");

  const res = await col.findOneAndUpdate(
    { guildId, userId },
    {
      $inc: { balance: amount }, // ✅ CHỈ DÙNG $inc
      $setOnInsert: {
        guildId,
        userId,
        balance: 1_000_000, // số dư ban đầu
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  return res.value.balance;
}

module.exports = {
  getBalance,
  addBalance,
};
