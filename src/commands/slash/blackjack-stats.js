// src/commands/slash/blackjack-stats.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBlackjackStats } = require("../../features/blackjackStats");

function fmt(n) {
  return Intl.NumberFormat("vi-VN").format(n);
}

const slashData = new SlashCommandBuilder()
  .setName("blackjack-stats")
  .setDescription("Xem thống kê Blackjack của bạn");

async function run(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const s = await getBlackjackStats(guildId, userId);

  const e = new EmbedBuilder()
    .setTitle("📊 Thống kê Blackjack")
    .setDescription(`👤 <@${userId}>`)
    .addFields(
      { name: "Số ván đã chơi", value: `**${fmt(s.played)}**`, inline: true },
      { name: "Thắng", value: `**${fmt(s.win)}**`, inline: true },
      { name: "Thua", value: `**${fmt(s.lose)}**`, inline: true },
      { name: "Hòa (Push)", value: `**${fmt(s.push)}**`, inline: true },
      { name: "Blackjack", value: `**${fmt(s.blackjack)}**`, inline: true },
      {
        name: "Dealer Blackjack",
        value: `**${fmt(s.dealerBlackjack)}**`,
        inline: true,
      },
      {
        name: "Lãi / Lỗ",
        value: `**${s.net >= 0 ? "+" : ""}${fmt(s.net)}** coin`,
        inline: false,
      }
    )
    .setFooter({ text: "Chỉ bạn mới thấy thống kê này." });

  return interaction.reply({ embeds: [e], ephemeral: true });
}

module.exports = { slashData, run };
