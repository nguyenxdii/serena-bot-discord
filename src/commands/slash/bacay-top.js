// src/commands/slash/bacay-top.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getTopWinners } = require("../../features/bacayStats");
const { fmt } = require("../../games/bacay/ui");

const slashData = new SlashCommandBuilder()
  .setName("bacay-top")
  .setDescription("Xem bảng xếp hạng thắng Ba Cào");

async function run(interaction) {
  await interaction.deferReply();

  const top = await getTopWinners(interaction.guildId, 10);

  if (!top || top.length === 0) {
    return interaction.editReply("Chưa có dữ liệu bảng xếp hạng.");
  }

  const list = top
    .map((s, i) => {
      const icon =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      return `${icon} <@${s.userId}> : **${fmt(s.net)}** coin`;
    })
    .join("\n");

  const e = new EmbedBuilder()
    .setTitle("🏆 BẢNG XẾP HẠNG BA CÀO (Lãi ròng)")
    .setColor("Gold")
    .setDescription(list);

  return interaction.editReply({ embeds: [e] });
}

module.exports = { slashData, run };
