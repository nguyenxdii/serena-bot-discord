// src/utils/channelCheck.js
const { PermissionFlagsBits } = require("discord.js");

const ALLOWED_CHANNELS = [
  "1450065466772029481", // Main Game Channel (Quầy 1)
  "1450065511231520778", // Word Chain Channel (Formerly Table 2)
  // "1450065534312779776", // Quầy 3 (Removed)
  // "1450067312160805047", // Quầy 4 (Removed)
];

const DAILY_CHANNEL_ID = "1450065824210489395";
const WORDCHAIN_CHANNEL_ID = "1450065511231520778";

// Admin bypass
function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

async function checkChannel(interaction) {
  if (isAdmin(interaction.member)) return true;

  const channelId = interaction.channelId;
  const cmd = interaction.commandName;

  // 1. Kênh Điểm Danh: Chỉ cho phép /daily
  if (channelId === DAILY_CHANNEL_ID) {
    if (cmd === "daily") return true;

    await interaction.reply({
      content: `⚠️ Kênh này chỉ dùng để điểm danh (\`/daily\`). Vui lòng qua khu vực Game Zone!`,
      ephemeral: true,
    });
    return false;
  }

  // 2. Lệnh Daily: CHỈ cho phép ở kênh Daily
  if (cmd === "daily") {
    if (channelId === DAILY_CHANNEL_ID) return true;

    await warnWrongChannel(interaction, [DAILY_CHANNEL_ID]);
    return false;
  }

  // 3. Lệnh Wordchain: CHỈ cho phép ở kênh Word Chain
  if (cmd === "wordchain") {
    if (channelId === WORDCHAIN_CHANNEL_ID) return true;

    await warnWrongChannel(interaction, [WORDCHAIN_CHANNEL_ID]);
    return false;
  }

  // 4. Các lệnh Game khác (Blackjack, ThreeCard, Wallet...)
  // Chỉ cho phép ở các kênh trong ALLOWED_CHANNELS
  if (ALLOWED_CHANNELS.includes(channelId)) return true;

  // 5. Sai kênh -> Báo lỗi
  await warnWrongChannel(interaction, ALLOWED_CHANNELS);
  return false;
}

async function warnWrongChannel(interaction, allowedIds) {
  const channelList = allowedIds.map((id) => `<#${id}>`).join(", ");
  try {
    const content = `⚠️ **Vui lòng qua đúng kênh quy định:**\n👉 ${channelList}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (e) {}
}

module.exports = { checkChannel, ALLOWED_CHANNELS, DAILY_CHANNEL_ID };
