const { SlashCommandBuilder } = require("discord.js");
const { getUserData, processTransfer } = require("../../features/wallet");
const { logTransaction } = require("../../features/transactionLog");
const { sendDM } = require("../../utils/dmUser");
const { checkCooldown, setCooldown } = require("../../features/economyRules"); // Need separate cooldown key

// Config
const TIP_MIN = 50;
const TIP_MAX = 1000;
const TIP_LIMIT_DAY = 5;
const COOLDOWN_KEY = "cmd_tip";
const COOLDOWN_TIME = 5 * 60 * 1000;

function getDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const slashData = new SlashCommandBuilder()
  .setName("tip")
  .setDescription("Tặng tiền cho người khác (Tip)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Người nhận").setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription(`Số tiền (${TIP_MIN} - ${TIP_MAX})`)
      .setRequired(true)
      .setMinValue(TIP_MIN)
      .setMaxValue(TIP_MAX)
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
    return interaction.editReply("❌ Không thể tip cho chính mình.");
  }
  if (targetUser.bot) {
    return interaction.editReply("❌ Không thể tip cho Bot.");
  }

  // 2. Validate Cooldown
  // Use EconomyRules checkCooldown logic, or custom?
  // economyRules uses memory map. Good.
  // We need to implement limits first.
  // Let's use memory cooldown for strictly time-based.
  const { cooldowns } = require("../../features/economyRules"); // Actually checkCooldown is exported
  // checkCooldown(userId, key)
  // But wait, economyRules cooldown is memory based.
  // Let's check importing checkCooldown.

  // NOTE: economyRules.js exports checkCooldown which checks GLOBAL memory.
  // We can stick to that.

  // 3. Check Limits (DB based)
  const guildId = interaction.guildId;
  const senderData = await getUserData(guildId, sender.id);

  if (senderData.balance < amount) {
    return interaction.editReply(
      `❌ Số dư không đủ (Có: ${senderData.balance}).`
    );
  }

  // Daily Limit Check
  const todayKey = getDayKey();
  let tipCount = senderData.transferStats?.tipCountToday || 0;
  const storedKey = senderData.transferStats?.payDayKey;

  if (storedKey !== todayKey) {
    tipCount = 0; // Reset logic in memory, applied in update
  }

  if (tipCount >= TIP_LIMIT_DAY) {
    return interaction.editReply(
      `❌ Bạn đã hết lượt Tip hôm nay (${TIP_LIMIT_DAY}/ngày).`
    );
  }

  // 4. Time Cooldown (Memory)
  const {
    checkCooldown: chk,
    setCooldown: setCd,
  } = require("../../features/economyRules");
  const cd = chk(sender.id, COOLDOWN_KEY);
  if (cd) {
    return interaction.editReply(
      `⏳ Chờ **${Math.ceil(cd / 1000 / 60)} phút** để Tip tiếp.`
    );
  }

  // 5. Process Transfer
  // Stats Update: Set dayKey, inc tipCount
  const statsUpdate = {
    $inc: { "transferStats.tipCountToday": 1 },
    $set: {
      "transferStats.payDayKey": todayKey,
      "transferStats.tipLastAt": new Date(),
    },
  };

  // Reset daily counters if new day
  if (storedKey !== todayKey) {
    // If we want to strictly reset payOutToday too, we strictly should set checks.
    // MongoDB $set will overwrite.
    statsUpdate.$set["transferStats.tipCountToday"] = 1; // Start at 1
    statsUpdate.$set["transferStats.payOutToday"] = 0; // Reset pay too?
    delete statsUpdate.$inc; // Remove inc if resetting
  } else {
    // Same day, just inc
  }

  const result = await processTransfer(
    guildId,
    sender.id,
    targetUser.id,
    amount,
    amount, // No Fee for tip
    statsUpdate
  );

  if (!result.success) {
    return interaction.editReply("❌ Giao dịch thất bại (Lỗi ví hoặc số dư).");
  }

  setCd(sender.id, COOLDOWN_KEY, COOLDOWN_TIME);
  logTransaction({
    type: "TIP",
    fromUserId: sender.id,
    toUserId: targetUser.id,
    amount,
    fee: 0,
    received: amount,
    note,
  });

  // 6. Notify
  await interaction.editReply(
    `✅ **TIP THÀNH CÔNG!**\nBạn đã gửi **${amount}** coin cho ${targetUser}.`
  );

  // 7. DM Sender
  const timeStr = new Date().toLocaleString("vi-VN");
  const dmSender =
    `🎁 **TIP THÀNH CÔNG**\n` +
    `Bạn đã tip cho: <@${targetUser.id}>\n` +
    `Số coin: **${amount}**\n` +
    `Ghi chú: ${note}\n` +
    `Thời gian: ${timeStr}`;

  sendDM(sender, dmSender);

  // 8. DM Receiver
  const dmReceiver =
    `🎁 **BẠN NHẬN ĐƯỢC TIP**\n\n` +
    `Người gửi: <@${sender.id}>\n` +
    `Số coin nhận: **${amount}**\n` +
    `Ghi chú: ${note}\n` +
    `Thời gian: ${timeStr}`;

  sendDM(targetUser, dmReceiver);
}

module.exports = { slashData, run };
