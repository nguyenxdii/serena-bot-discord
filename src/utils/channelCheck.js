// src/utils/channelCheck.js
const { PermissionFlagsBits } = require("discord.js");

const ALLOWED_CHANNELS = [
  "1450065466772029481",
  "1450065511231520778",
  "1450065534312779776",
  "1450067312160805047",
];

const DAILY_CHANNEL_ID = "1450065824210489395";

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

    // Nếu dùng lệnh khác trong kênh daily -> Báo lỗi
    await interaction.reply({
      content:
        `⚠️ Kênh này chỉ dùng để điểm danh (` /
        daily`). Vui lòng qua khu vực Game Zone!`,
      ephemeral: true,
    });
    return false;
  }

  // 2. Lệnh Daily: Cho phép ở kênh Daily OR Game Zone?
  // User không nói rõ, nhưng thường daily cho phép ở cả Game Zone.
  // Nhưng user bảo "kênh điểm danh... phải là lệnh /daily", và "nếu dùng lệnh không đúng kênh thì hiện tin nhắn".
  // Tạm thời cho phép daily ở cả 2 nơi để tiện lợi.
  if (cmd === "daily") {
    if (ALLOWED_CHANNELS.includes(channelId) || channelId === DAILY_CHANNEL_ID)
      return true;

    // Warn daily wrong place
    await warnWrongChannel(interaction, [
      ...ALLOWED_CHANNELS,
      DAILY_CHANNEL_ID,
    ]);
    return false;
  }

  // 3. Các lệnh Game khác (Blackjack, Bacay, Wallet...)
  if (ALLOWED_CHANNELS.includes(channelId)) return true;

  // 4. Sai kênh -> Báo lỗi
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
