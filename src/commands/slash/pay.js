const { SlashCommandBuilder } = require("discord.js");
const { getUserData, processTransfer } = require("../../features/wallet");
const { logTransaction } = require("../../features/transactionLog");
const { sendDM } = require("../../utils/dmUser");
const { checkCooldown, setCooldown } = require("../../features/economyRules");

// Config
const PAY_MIN = 100;
const FEE_PERCENT = 0.05;
const COOLDOWN_KEY = "cmd_pay";
const COOLDOWN_TIME = 30 * 1000; // 30s as requested
const MAX_TX_PERCENT = 0.1; // 10% wallet
const MAX_DAY_PERCENT = 0.2; // 20% wallet

function getDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const slashData = new SlashCommandBuilder()
  .setName("pay")
  .setDescription("Chuyển coin (Fee 5%)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Người nhận").setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription(`Số tiền (Min ${PAY_MIN})`)
      .setRequired(true)
      .setMinValue(PAY_MIN)
  )
  .addStringOption((opt) =>
    opt.setName("note").setDescription("Lời nhắn").setMaxLength(100)
  );

async function run(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const sender = interaction.user;
  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const note = interaction.options.getString("note") || "Không có";

  // 1. Validate User
  if (sender.id === targetUser.id) {
    return interaction.editReply("❌ Không thể chuyển cho chính mình.");
  }
  if (targetUser.bot) {
    return interaction.editReply("❌ Không thể chuyển cho Bot.");
  }

  // 2. Validate Cooldown
  const {
    checkCooldown: chk,
    setCooldown: setCd,
  } = require("../../features/economyRules");
  const cd = chk(sender.id, COOLDOWN_KEY);
  if (cd) {
    return interaction.editReply(
      `⏳ Chờ **${(cd / 1000).toFixed(1)}s** để chuyển tiếp.`
    );
  }

  // 3. User Data & Limits
  const guildId = interaction.guildId;
  const senderData = await getUserData(guildId, sender.id);
  const balance = senderData.balance;

  if (balance < amount) {
    return interaction.editReply(`❌ Số dư không đủ (Có: ${balance}).`);
  }

  // Max Pay per Tx logic: floor(wallet * 0.10)
  const maxTx = Math.floor(balance * MAX_TX_PERCENT);
  if (amount > maxTx) {
    return interaction.editReply(
      `❌ Quá hạn mức giao dịch (Max 10% ví = **${maxTx}** coin).`
    );
  }

  // Daily Limit
  const todayKey = getDayKey();
  let payOutToday = senderData.transferStats?.payOutToday || 0;
  const storedKey = senderData.transferStats?.payDayKey;

  // Reset if new day
  if (storedKey !== todayKey) {
    payOutToday = 0;
  }

  // Limit Check: payOutToday + amount <= StartBalance?
  // User spec: "Tổng pay <= 20% wallet/ngày".
  // Let's use strict: (payOutToday + amount) <= balance * 0.20?
  // Current logic: balance includes CURRENT money.
  // If I have 1000. 20% = 200. I pay 100. new bal 900. payOut 100.
  // Next pay 100. payOut 200. Limit 20%? 20% of 900 is 180.
  // Fail? That seems too strict/dynamic.
  // Let's approximate "Start of Day Balance" or "Max Capacity" as (Balance + payOutToday).
  // So limit = (Balance + payOutToday) * 0.20.
  const estimatedTotalCurve = balance + payOutToday;
  const dayLimit = Math.floor(estimatedTotalCurve * MAX_DAY_PERCENT);

  if (payOutToday + amount > dayLimit) {
    return interaction.editReply(
      `❌ Quá hạn mức ngày (Tổng pay ≤ 20% tài sản ~ **${dayLimit}** coin).`
    );
  }

  // 4. Calculate Fee (Burn)
  // User: Fee = ceil(amount * 0.05). User pays 'amount', receiver gets 'amount - fee'.
  const fee = Math.ceil(amount * FEE_PERCENT);
  const received = amount - fee;

  // 5. Process
  const statsUpdate = {
    $inc: { "transferStats.payOutToday": amount },
    $set: {
      "transferStats.payDayKey": todayKey,
      "transferStats.payLastAt": new Date(),
    },
  };

  if (storedKey !== todayKey) {
    statsUpdate.$set["transferStats.payOutToday"] = amount;
    statsUpdate.$set["transferStats.tipCountToday"] = 0;
    delete statsUpdate.$inc;
  }

  const result = await processTransfer(
    guildId,
    sender.id,
    targetUser.id,
    amount, // Deduct full amount
    received, // Add partial amount
    statsUpdate
  );

  if (!result.success) {
    return interaction.editReply("❌ Giao dịch thất bại (Lỗi ví hoặc số dư).");
  }

  setCd(sender.id, COOLDOWN_KEY, COOLDOWN_TIME);
  logTransaction({
    type: "PAY",
    fromUserId: sender.id,
    toUserId: targetUser.id,
    amount,
    fee,
    received,
    note,
  });

  // 6. Notify
  const timeStr = new Date().toLocaleString("vi-VN");
  await interaction.editReply(
    `💸 **CHUYỂN KHOẢN THÀNH CÔNG!**\nĐã chuyển **${amount}** coin (Fee: ${fee}) cho ${targetUser}.`
  );

  // DM Sender
  const dmSender =
    `💸 **CHUYỂN COIN THÀNH CÔNG**\n` +
    `Bạn đã chuyển cho: <@${targetUser.id}>\n` +
    `Số coin gửi: **${amount}**\n` +
    `Phí giao dịch (5%): **${fee}**\n` +
    `Người nhận nhận: **${received}**\n` +
    `Ghi chú: ${note}\n` +
    `Thời gian: ${timeStr}`;
  sendDM(sender, dmSender);

  // DM Receiver
  const dmReceiver =
    `💰 **BẠN NHẬN ĐƯỢC COIN**\n\n` +
    `Người gửi: <@${sender.id}>\n` +
    `Số coin nhận: **${received}**\n` +
    `Phí đã trừ: **${fee}**\n` +
    `Ghi chú: ${note}\n` +
    `Thời gian: ${timeStr}`;
  sendDM(targetUser, dmReceiver);
}

module.exports = { slashData, run };
