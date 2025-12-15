// src/utils/channelCheck.js
const { PermissionFlagsBits } = require("discord.js");

const ALLOWED_CHANNELS = [
  "1450065466772029481",
  "1450065511231520778",
  "1450065534312779776",
  "1450067312160805047",
];

function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

async function checkChannel(interaction) {
  // Admin bypass
  if (isAdmin(interaction.member)) return true;

  // Check ID
  if (ALLOWED_CHANNELS.includes(interaction.channelId)) return true;

  // Warning
  const channelList = ALLOWED_CHANNELS.map((id) => `<#${id}>`).join(", ");

  let msg;
  try {
    const content = `⚠️ **Vui lòng qua đúng kênh để chơi game:**\n👉 ${channelList}\n_(Tin nhắn tự xóa sau 15 giây)_`;

    if (interaction.deferred || interaction.replied) {
      msg = await interaction.followUp({ content, ephemeral: true });
    } else {
      msg = await interaction.reply({ content, fetchReply: true });
    }

    setTimeout(() => {
      if (msg && msg.delete) msg.delete().catch(() => {});
    }, 15000);
  } catch (e) {}

  return false;
}

module.exports = { checkChannel, ALLOWED_CHANNELS };
