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

  try {
    const content = `⚠️ **Vui lòng qua đúng kênh để chơi game:**\n👉 ${channelList}`;

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (e) {}

  return false;
}

module.exports = { checkChannel, ALLOWED_CHANNELS };
