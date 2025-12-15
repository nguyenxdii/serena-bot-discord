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
    opt
      .setName("note")
      .setDescription("Lời nhắn")
      .setMaxLength(100)
      .setRequired(true)
  );

async function run(interaction) {
  // 1. Initial Private Defer
  await interaction.deferReply({ ephemeral: true });

  const sender = interaction.user;
  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const note = interaction.options.getString("note");

  // 2. Validations
  if (sender.id === targetUser.id) {
    return interaction.editReply("❌ Không thể tip cho chính mình.");
  }
  if (targetUser.bot) {
    return interaction.editReply("❌ Không thể tip cho Bot.");
  }

  // Cooldown Memory Check
  const cd = checkCooldown(sender.id, COOLDOWN_KEY);
  if (cd) {
    return interaction.editReply(
      `⏳ Chờ **${Math.ceil(cd / 1000 / 60)} phút** để Tip tiếp.`
    );
  }

  // Limits Check (DB)
  const guildId = interaction.guildId;
  const senderData = await getUserData(guildId, sender.id);

  if (senderData.balance < amount) {
    return interaction.editReply(
      `❌ Số dư không đủ (Có: ${senderData.balance}).`
    );
  }

  const todayKey = getDayKey();
  let tipCount = senderData.transferStats?.tipCountToday || 0;
  const storedKey = senderData.transferStats?.payDayKey;

  if (storedKey !== todayKey) {
    tipCount = 0;
  }

  if (tipCount >= TIP_LIMIT_DAY) {
    return interaction.editReply(
      `❌ Bạn đã hết lượt Tip hôm nay (${TIP_LIMIT_DAY}/ngày).`
    );
  }

  // 3. CONFIRMATION
  const confirmBtn = new ButtonBuilder()
    .setCustomId("confirm_tip")
    .setLabel("Xác nhận")
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId("cancel_tip")
    .setLabel("Hủy")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

  const confirmMsg = await interaction.editReply({
    content:
      `🛑 **XÁC NHẬN TIP**\n` +
      `Bạn có chắc muốn tặng **${amount}** coin cho <@${targetUser.id}>?\n` +
      `Nội dung: _${note}_`,
    components: [row],
  });

  // Collector
  const filter = (i) => i.user.id === sender.id;
  let confirmation;
  try {
    confirmation = await confirmMsg.awaitMessageComponent({
      filter,
      componentType: ComponentType.Button,
      time: 120_000, // 2 minutes
    });
  } catch (e) {
    // Timeout Error
    return interaction.editReply({
      content: "⏳ Đã hết thời gian xác nhận (2 phút).",
      components: [],
    });
  }

  // Handle Cancel
  if (confirmation.customId === "cancel_tip") {
    await confirmation.update({
      content: "❌ Đã hủy giao dịch.",
      components: [],
    });
    return;
  }

  // Handle Confirm
  if (confirmation.customId === "confirm_tip") {
    try {
      await confirmation.deferUpdate(); // Acknowledge button

      // 4. PROCESS
      const statsUpdate = {
        $inc: { "transferStats.tipCountToday": 1 },
        $set: {
          "transferStats.payDayKey": todayKey,
          "transferStats.tipLastAt": new Date(),
        },
      };

      if (storedKey !== todayKey) {
        statsUpdate.$set["transferStats.tipCountToday"] = 1;
        statsUpdate.$set["transferStats.payOutToday"] = 0;
        delete statsUpdate.$inc;
      }

      const result = await processTransfer(
        guildId,
        sender.id,
        targetUser.id,
        amount,
        amount, // No Fee
        statsUpdate
      );

      if (!result.success) {
        return interaction.editReply({
          content: "❌ Giao dịch thất bại (Lỗi ví hoặc số dư thay đổi).",
          components: [],
        });
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

      // 5. Notify & Private Update
      const timeStr = new Date().toLocaleString("vi-VN");

      // Update Private Msg
      await interaction.editReply({
        content: `✅ Đã tip **${amount}** coin cho <@${targetUser.id}>.`,
        components: [],
      });

      // Send Public Msg
      if (interaction.channel) {
        await interaction.channel
          .send({
            content: `🎁 **TIP!** <@${sender.id}> đã tặng **${amount}** coin cho <@${targetUser.id}>.\n> 💌: ${note}`,
          })
          .catch(() => {});
      }

      // 6. DMs
      const dmSender =
        `🎁 **TIP THÀNH CÔNG**\n` +
        `Bạn đã tip cho: <@${targetUser.id}>\n` +
        `Số coin: **${amount}**\n` +
        `Nội dung: ${note}\n` +
        `Thời gian: ${timeStr}`;
      sendDM(sender, dmSender);

      const dmReceiver =
        `🎁 **BẠN NHẬN ĐƯỢC TIP**\n\n` +
        `Người gửi: <@${sender.id}>\n` +
        `Số coin nhận: **${amount}**\n` +
        `Nội dung: ${note}\n` +
        `Thời gian: ${timeStr}`;
      sendDM(targetUser, dmReceiver);
    } catch (err) {
      console.error("Tip Error:", err);
      return interaction.editReply({
        content: "❌ Có lỗi hệ thống xảy ra trong quá trình xử lý.",
        components: [],
      });
    }
  }
}

module.exports = { slashData, run };
