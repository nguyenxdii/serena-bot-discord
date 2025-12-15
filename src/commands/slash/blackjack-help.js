// src/commands/slash/blackjack-help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const slashData = new SlashCommandBuilder()
  .setName("blackjack-help")
  .setDescription("Hướng dẫn chi tiết cách chơi Blackjack");

async function run(interaction) {
  const e = new EmbedBuilder()
    .setTitle("🃏 HƯỚNG DẪN CHƠI BLACKJACK")
    .setDescription(
      [
        "**🎯 Mục tiêu**",
        "• Tổng điểm bài **gần 21 nhất** nhưng **không vượt quá 21**",
        "• Thắng Dealer để ăn tiền cược",
        "",
        "**🃠 Giá trị lá bài**",
        "• **A = 1 hoặc 11** (tự động chọn cách có lợi nhất)",
        "• **2–10 = đúng số**",
        "• **J / Q / K = 10 điểm**",
        "",
        "**🎮 Nút thao tác**",
        "• **Hit (Rút):** rút thêm 1 lá",
        "• **Stand (Giữ):** giữ bài, đến lượt Dealer rút",
        "• **Double (x2):**",
        "  - Chỉ dùng khi bạn mới có **2 lá đầu**",
        "  - Cược **x2**",
        "  - Rút **1 lá** rồi **tự động Stand**",
        "",
        "**🤵 Luật Dealer**",
        "• Dealer sẽ rút đến khi **đủ 17 điểm trở lên**",
        "",
        "**💰 Trả thưởng** (vì bot trừ cược trước khi chơi)",
        "• **Thắng thường:** nhận lại **x2 cược**",
        "• **Blackjack** (21 với đúng 2 lá): nhận **x2.5 cược**",
        "• **Hòa (Push):** hoàn lại **x1 cược**",
        "• **Thua:** nhận **0**",
        "",
        "**⏱️ Lưu ý**",
        "• Ván chơi sẽ **hết hạn sau 2 phút** nếu bạn không bấm nút",
      ].join("\n")
    )
    .setFooter({ text: "Lệnh chơi: /blackjack money:<số>" });

  return interaction.reply({ embeds: [e], ephemeral: true });
}

module.exports = { slashData, run };
