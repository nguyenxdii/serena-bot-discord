// src/commands/slash/wordchain-simple.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const {
  startGame,
  getGameStats,
} = require("../../features/wordchain-simple/game.service");

// Hardcoded game channel
const GAME_CHANNEL_ID = "1450065511231520778";

const slashData = new SlashCommandBuilder()
  .setName("start")
  .setDescription("Bắt đầu/Reset game Nối Từ Tiếng Việt");

async function run(interaction) {
  // Check if in correct channel
  if (interaction.channelId !== GAME_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ Game chỉ chạy ở kênh <#${GAME_CHANNEL_ID}>!`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Start/restart the game
  const gameState = startGame(interaction.user.id);

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle("🎮 GAME NỐI TỪ TIẾNG VIỆT")
    .setColor("#00FF00")
    .setDescription(
      `**Từ hiện tại:** \`${gameState.currentWord.toUpperCase()}\`\n` +
        `**Hãy nhập từ bắt đầu bằng:** \`${gameState.expectedKey.toUpperCase()}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: "📜 Luật Chơi",
        value:
          "• Chat trực tiếp trong kênh này để nối từ\n" +
          "• Từ phải bắt đầu bằng chữ cái cuối của từ trước (không tính dấu)\n" +
          "• Không được lặp lại từ đã dùng\n" +
          "• Chỉ nhận từ tiếng Việt hợp lệ",
        inline: false,
      },
      {
        name: "✅ Phản Hồi",
        value: "✅ = Đúng | ❌ = Sai",
        inline: true,
      },
      {
        name: "🎯 Tip",
        value: "Dùng `/start` để reset game",
        inline: true,
      }
    )
    .setFooter({
      text: `Được bắt đầu bởi ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  console.log(
    `✅ Game started in channel ${interaction.channelId} by ${interaction.user.tag}`
  );
}

module.exports = {
  slashData,
  run,
};
