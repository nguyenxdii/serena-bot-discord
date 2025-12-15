const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { getUserData, processTransfer } = require("../../features/wallet");
const { logTransaction } = require("../../features/transactionLog");
const { sendDM } = require("../../utils/dmUser");
const { checkCooldown, setCooldown } = require("../../features/economyRules");

// Config
const PAY_MIN = 100;
const FEE_PERCENT = 0.05;
const COOLDOWN_KEY = "cmd_pay";
const COOLDOWN_TIME = 30 * 1000;
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
    opt
      .setName("note")
      .setDescription("Lời nhắn")
      .setMaxLength(100)
      .setRequired(true)
  );

async function run(interaction) {
  // 1. Initial Private
  await interaction.deferReply({ ephemeral: true });

  const sender = interaction.user;
  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const note = interaction.options.getString("note");

  // 2. Validations
  if (sender.id === targetUser.id) {
    return interaction.editReply("❌ Không thể chuyển cho chính mình.");
  }
  if (targetUser.bot) {
    return interaction.editReply("❌ Không thể chuyển cho Bot.");
  }

  // Cooldown Memory
  const cd = checkCooldown(sender.id, COOLDOWN_KEY);
  if (cd) {
    return interaction.editReply(
      `⏳ Chờ **${(cd / 1000).toFixed(1)}s** để chuyển tiếp.`
    );
  }

  // User Data & Limits
  const guildId = interaction.guildId;
  const senderData = await getUserData(guildId, sender.id);
  const balance = senderData.balance;

  if (balance < amount) {
    return interaction.editReply(`❌ Số dư không đủ (Có: ${balance}).`);
  }

  const maxTx = Math.floor(balance * MAX_TX_PERCENT);
  if (amount > maxTx) {
    return interaction.editReply(
      `❌ Quá hạn mức giao dịch (Max 10% ví = **${maxTx}** coin).`
    );
  }

  const todayKey = getDayKey();
  let payOutToday = senderData.transferStats?.payOutToday || 0;
  const storedKey = senderData.transferStats?.payDayKey;

  if (storedKey !== todayKey) {
    payOutToday = 0;
  }

  const estimatedTotalCurve = balance + payOutToday;
  const dayLimit = Math.floor(estimatedTotalCurve * MAX_DAY_PERCENT);

  if (payOutToday + amount > dayLimit) {
    return interaction.editReply(
      `❌ Quá hạn mức ngày (Tổng pay ≤ 20% tài sản ~ **${dayLimit}** coin).`
    );
  }

  // Fee Calc
  const fee = Math.ceil(amount * FEE_PERCENT);
  const received = amount - fee;

  // 3. CONFIRMATION
  const confirmBtn = new ButtonBuilder()
    .setCustomId("confirm_pay")
    .setLabel("Xác nhận")
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId("cancel_pay")
    .setLabel("Hủy")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

  const confirmMsg = await interaction.editReply({
    content:
      `💸 **XÁC NHẬN CHUYỂN KHOẢN**\n` +
      `Người nhận: <@${targetUser.id}>\n` +
      `Số tiền trừ: **${amount}** coin\n` +
      `Phí giao dịch (5%): **${fee}** coin\n` +
      `Người nhận nhận: **${received}** coin\n` +
      `Nội dung: _${note}_`,
    components: [row],
  });

  // Collector
  const filter = (i) => i.user.id === sender.id;
  try {
    const confirmation = await confirmMsg.awaitMessageComponent({
      filter,
      componentType: ComponentType.Button,
      time: 30_000,
    });

    if (confirmation.customId === "cancel_pay") {
      await confirmation.update({
        content: "❌ Đã hủy giao dịch.",
        components: [],
      });
      return;
    }

    if (confirmation.customId === "confirm_pay") {
      await confirmation.deferUpdate();

      // 4. PROCESS
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
        amount,
        received,
        statsUpdate
      );

      if (!result.success) {
        return interaction.editReply({
          content: "❌ Giao dịch thất bại (Lỗi ví hoặc số dư).",
          components: [],
        });
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

      // 5. Notify & Public
      const timeStr = new Date().toLocaleString("vi-VN");

      await interaction.editReply({
        content: `✅ Đã chuyển **${amount}** coin cho <@${targetUser.id}>.`,
        components: [],
      });

      if (interaction.channel) {
        await interaction.channel
          .send({
            content: `💸 **GIAO DỊCH:** <@${sender.id}> đã chuyển **${amount}** coin cho <@${targetUser.id}>.\n> 📝: ${note}`,
          })
          .catch(() => {});
      }

      // DMs
      const dmSender =
        `💸 **CHUYỂN COIN THÀNH CÔNG**\n` +
        `Bạn đã chuyển cho: <@${targetUser.id}>\n` +
        `Số coin gửi: **${amount}**\n` +
        `Phí giao dịch (5%): **${fee}**\n` +
        `Người nhận nhận: **${received}**\n` +
        `Ghi chú: ${note}\n` +
        `Thời gian: ${timeStr}`;
      sendDM(sender, dmSender);

      const dmReceiver =
        `💰 **BẠN NHẬN ĐƯỢC COIN**\n\n` +
        `Người gửi: <@${sender.id}>\n` +
        `Số coin nhận: **${received}**\n` +
        `Phí đã trừ: **${fee}**\n` +
        `Ghi chú: ${note}\n` +
        `Thời gian: ${timeStr}`;
      sendDM(targetUser, dmReceiver);
    }
  } catch (e) {
    await interaction.editReply({
      content: "⏳ Đã hủy (Hết thời gian xác nhận).",
      components: [],
    });
  }
}

module.exports = { slashData, run };
