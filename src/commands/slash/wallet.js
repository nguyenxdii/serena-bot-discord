// src/commands/slash/wallet.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getBalance } = require("../../features/wallet");

function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

function fmt(n) {
  return Intl.NumberFormat("vi-VN").format(n);
}

const slashData = new SlashCommandBuilder()
  .setName("wallet")
  .setDescription("Xem số coin của bạn");

async function run(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const admin = isAdmin(interaction.member);
  const bal = await getBalance(guildId, userId, admin);

  return interaction.reply({
    content: `💰 Ví của bạn: **${fmt(bal)}** coin`,
    ephemeral: true,
  });
}

module.exports = { slashData, run };
