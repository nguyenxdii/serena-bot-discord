// src/commands/slash/three-card-help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const slashData = new SlashCommandBuilder()
  .setName("three-card-help")
  .setDescription("Three Card Game Instructions");

async function run(interaction) {
  const e = new EmbedBuilder()
    .setTitle("🎲 HOW TO PLAY THREE CARD (SCRATCH)")
    .setColor("Gold")
    .setDescription("Basic Rules of Three Card (Ba Cay).")
    .addFields(
      {
        name: "🔢 Giá trị bài",
        value:
          "• **A:** 1 điểm\n• **2-9:** Điểm bằng số\n• **10, J, Q, K:** 0 điểm",
        inline: false,
      },
      {
        name: "🧮 Cách tính điểm",
        value:
          "• Cộng điểm 3 lá bài.\n• Lấy số lẻ (Tổng % 10).\n• Ví dụ: 7 + 5 + 9 = 21 ➔ **1 điểm**.\n• Ví dụ: J + 3 + 7 = 10 ➔ **0 điểm** (Bù).",
        inline: false,
      },
      {
        name: "🏆 Thắng thua",
        value:
          "• Điểm cao hơn Dealer ➔ **Thắng (x2)**\n• Điểm bằng Dealer ➔ **Hòa (Hoàn tiền)**\n• Điểm thấp hơn ➔ **Thua**",
        inline: false,
      }
    )
    .setFooter({ text: "Lệnh: /three-card bet:<số tiền>" });

  return interaction.reply({ embeds: [e], ephemeral: true });
}

module.exports = { slashData, run };
