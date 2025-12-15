// src/commands/slash/bacay-stats.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getStats } = require("../../features/bacayStats");
const { fmt } = require("../../games/bacay/ui");

const slashData = new SlashCommandBuilder()
  .setName("bacay-stats")
  .setDescription("Xem thống kê chơi Ba Cào")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("Người cần xem (để trống là xem của mình)")
  );

async function run(interaction) {
  const target = interaction.options.getUser("user") || interaction.user;
  const s = await getStats(interaction.guildId, target.id);

  const winRate = s.played > 0 ? ((s.win / s.played) * 100).toFixed(1) : 0;
  // Format net profit: +Blue / -Red
  const netStr = s.net >= 0 ? `+${fmt(s.net)}` : `-${fmt(Math.abs(s.net))}`;

  const e = new EmbedBuilder()
    .setTitle(`📊 Thống Kê Ba Cào: ${target.username}`)
    .setColor("Blue")
    .addFields(
      { name: "Số ván chơi", value: `${s.played}`, inline: true },
      { name: "Tỉ lệ thắng", value: `${winRate}%`, inline: true },
      { name: "Lãi / Lỗ", value: netStr, inline: true },
      {
        name: "Chi tiết",
        value: `🏆 Thắng: **${s.win}**\n💸 Thua: **${s.lose}**\n🤝 Hòa: **${s.draw}**`,
        inline: false,
      }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [e] });
}

module.exports = { slashData, run };
