// src/commands/slash/blackjack-help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const slashData = new SlashCommandBuilder()
  .setName("blackjack-help")
  .setDescription("Hướng dẫn chi tiết cách chơi Blackjack");

async function run(interaction) {
  const e = new EmbedBuilder()
    .setColor("Gold")
    .setThumbnail("https://cdn-icons-png.flaticon.com/512/2830/2830305.png") // Example icon or remove if not wanted
    .setDescription(
      "Chào mừng bạn đến với sòng bài **Blackjack**! Dưới đây là luật chơi chi tiết."
    )
    .addFields(
      {
        name: "🎯 Mục tiêu",
        value:
          "• Tổng điểm gần **21** nhất nhưng không quá 21.\n" +
          "• Điểm cao hơn Dealer là thắng.",
        inline: false,
      },
      {
        name: "🃠 Tính điểm",
        value:
          "• **A (Át):** 1 hoặc 11 điểm (tự động có lợi nhất).\n" +
          "• **J, Q, K:** 10 điểm.\n" +
          "• **2 - 10:** Tính theo số điểm trên lá bài.",
        inline: false,
      },
      {
        name: "🎮 Cách chơi",
        value:
          "• **Hit (Rút):** Rút thêm 1 lá bài.\n" +
          "• **Stand (Dừng):** Giữ nguyên bài hiện tại.\n" +
          "• **Double (X2 Cược):**\n" +
          "  - Chỉ được chọn khi mới có **2 lá đầu**.\n" +
          "  - Cược gấp đôi, chỉ rút thêm **duy nhất 1 lá** rồi tự dừng.",
        inline: false,
      },
      {
        name: "🤵 Luật Dealer",
        value:
          "• Dealer bắt buộc **Rút (Hit)** nếu dưới **17 điểm**.\n" +
          "• Dealer bắt buộc **Dừng (Stand)** nếu từ **17 điểm** trở lên.",
        inline: false,
      },
      {
        name: "💰 Tỷ lệ trả thưởng",
        value:
          "• **Thắng thường:** 1 ăn 1 (x2 cược).\n" +
          "• **Blackjack (21 điểm 2 lá đầu):** 2 ăn 3 (x2.5 cược).\n" +
          "• **Hòa (Push):** Hoàn lại tiền cược.",
        inline: false,
      }
    )
    .setFooter({ text: "Chúc bạn may mắn! • /blackjack money:<số tiền>" });

  return interaction.reply({ embeds: [e], ephemeral: true });
}

module.exports = { slashData, run };
