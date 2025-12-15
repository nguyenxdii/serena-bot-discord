// src/commands/slash/daily.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { claimDaily } = require("../../features/wallet");
const { fmt } = require("../../games/bacay/ui"); // Reusing fmt helper
const { logTransaction } = require("../../features/transactionLog");
const { logDaily } = require("../../utils/discordLogger");

const slashData = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Nhận thưởng hàng ngày (Daily Reward)");

async function run(interaction) {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const isAdmin = interaction.member?.permissions?.has(
    PermissionFlagsBits.Administrator
  );

  const result = await claimDaily(guildId, userId, isAdmin);

  // 1. Fail: Cooldown
  if (result.status === "fail") {
    const nextTime = result.nextTime;
    const timestamp = Math.floor(nextTime.getTime() / 1000);
    return interaction.editReply({
      content: `⏳ Bạn đã điểm danh hôm nay rồi! Hãy quay lại vào <t:${timestamp}:R>.`,
    });
  }

  // 2. Fail: Error
  if (result.status === "fail_race" || result.status === "error") {
    return interaction.editReply("❌ Có lỗi xảy ra. Vui lòng thử lại!");
  }

  // 3. Success
  const { reward, streakBonus, weeklyBonus, total, streak, weekly, balance } =
    result;

  // Log DB
  await logTransaction({
    type: "DAILY",
    guildId,
    userId,
    amount: total,
    reason: `Streak: ${streak}, Weekly: ${weekly}`,
    meta: result,
  });

  // Log Discord
  logDaily(interaction.client, userId, reward, streak, total);

  const embed = new EmbedBuilder()
    .setTitle("📅 ĐIỂM DANH HÀNG NGÀY")
    .setColor("Green")
    .setDescription(`Chúc mừng <@${userId}> đã điểm danh thành công!`)
    .addFields(
      {
        name: "💰 Phần thưởng",
        value: `+**${fmt(total)}** coin`,
        inline: true,
      },
      { name: "🔥 Streak", value: `**${streak}** ngày`, inline: true },
      { name: "🏦 Ví của bạn", value: `**${fmt(balance)}** coin`, inline: true }
    );

  // Chi tiết bonus
  let details = [];
  if (streakBonus > 0) details.push(`Bonus chuỗi: +${fmt(streakBonus)}`);
  if (weeklyBonus > 0)
    details.push(`🎁 **Bonus tuần (7 ngày): +${fmt(weeklyBonus)}**`);

  if (details.length > 0) {
    embed.addFields({
      name: "Chi tiết",
      value: details.join("\n"),
      inline: false,
    });
  }

  // Weekly Progress bar
  const progress = "🟦".repeat(weekly) + "⬜".repeat(7 - weekly);
  embed.addFields({
    name: "📅 Tiến độ tuần",
    value: `${progress} (${weekly}/7)`,
    inline: false,
  });

  return interaction.editReply({ embeds: [embed] });
}

module.exports = { slashData, run };
