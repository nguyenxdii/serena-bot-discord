// src/commands/slash/wordchain-surrender.js
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  isGameActive,
  endGame,
  startGame,
  getCurrentState,
} = require("../../features/wordchain-simple/game.service");
const { sendWebhook } = require("../../utils/webhook.service");

const GAME_CHANNEL_ID = "1450065511231520778";

const slashData = new SlashCommandBuilder()
  .setName("wordchain-surrender")
  .setDescription("Bỏ cuộc và bắt đầu ván mới");

async function run(interaction) {
  // Check if in correct channel
  if (interaction.channelId !== GAME_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ Lệnh này chỉ dùng được ở <#${GAME_CHANNEL_ID}>!`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Defer early to avoid conflicts
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isGameActive()) {
    return interaction.editReply({
      content: "❌ Game chưa bắt đầu!",
    });
  }

  try {
    const oldState = getCurrentState();
    const oldWord = oldState.currentWord;

    // End current game
    endGame();

    // Start new game
    const newState = startGame(interaction.user.id, interaction.user.username);

    // Send announcement via webhook
    await sendWebhook("wordchain", {
      content: `🏳️ <@${interaction.user.id}> đã bỏ cuộc!\n\n🔄 **Ván mới!** Từ mở màn: **${newState.currentWord}**`,
    });

    return interaction.editReply({
      content: `✅ Đã reset game!\n\n🔴 Từ cũ: **${oldWord}**\n🟢 Từ mới: **${newState.currentWord}**`,
    });
  } catch (error) {
    console.error("Surrender error:", error);
    return interaction.editReply({
      content: "❌ Lỗi khi reset game!",
    });
  }
}

module.exports = { slashData, run };
