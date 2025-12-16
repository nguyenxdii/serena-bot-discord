// src/commands/slash/wordchain-help.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

const slashData = new SlashCommandBuilder()
  .setName("wordchain-help")
  .setDescription("Hướng dẫn cách chơi Nối Từ");

async function run(interaction) {
  const e = new EmbedBuilder()
    .setTitle("🔗 HƯỚNG DẪN CHƠI WORD CHAIN (NỐI TỪ)")
    .setColor("Green")
    .setDescription("Game nối từ tiếng Việt 2 người chơi đấu trí!")
    .addFields(
      {
        name: "📜 Cách chơi",
        value:
          "1. **Thách đấu:** `/wordchain challenge user:<đối thủ> bet:<tiền>`\n" +
          "2. **Chấp nhận:** Đối thủ bấm nút `Accept` để vào trận.\n" +
          "3. **Luật nối:**\n" +
          "   - Từ mới phải bắt đầu bằng **tiếng cuối** của từ trước (Ví dụ: Con gà ➔ Gà con).\n" +
          "   - Từ phải có nghĩa trong tiếng Việt.\n" +
          "   - Không được dùng lại từ đã có trong trận.\n" +
          "   - Thời gian suy nghĩ: **60 giây**.",
        inline: false,
      },
      {
        name: "💰 Thắng / Thua",
        value:
          "• **Thắng:** Khi đối thủ không ra được từ, nhập từ sai, hoặc hết giờ.\n" +
          "• **Tiền thưởng:** Người thắng nhận tổng tiền cược của cả 2 (x2 tiền cược gốc).",
        inline: false,
      },
      {
        name: "🏆 Xếp hạng",
        value:
          "• Hệ thống tính điểm ELO.\n" +
          "• Xem bảng xếp hạng: `/wordchain leaderboard`.",
        inline: false,
      }
    )
    .setFooter({ text: "Chúc bạn nối từ vui vẻ và không vấp!" });

  return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
}

module.exports = { slashData, run };
