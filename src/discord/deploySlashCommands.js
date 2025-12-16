// src/discord/deploySlashCommands.js
const { REST, Routes } = require("discord.js");
const { DISCORD_TOKEN, APPLICATION_ID, GUILD_ID } = require("../config/env");

const { slashData: blackjackSlash } = require("../commands/slash/blackjack");
const { slashData: walletSlash } = require("../commands/slash/wallet");
const { slashData: dailySlash } = require("../commands/slash/daily");
const { slashData: tipSlash } = require("../commands/slash/tip");
const { slashData: paySlash } = require("../commands/slash/pay");
const { slashData: adminEcoSlash } = require("../commands/slash/admin-economy");
const { slashData: adminUserSlash } = require("../commands/slash/admin-user");
const {
  slashData: adminHistSlash,
} = require("../commands/slash/admin-history");
const { addSlash, removeSlash } = require("../commands/slash/admin-money");

const { slashData: helpSlash } = require("../commands/slash/blackjack-help");
const { slashData: statsSlash } = require("../commands/slash/blackjack-stats");

const { slashData: threeCardSlash } = require("../commands/slash/three-card");
const {
  slashData: threeCardHelp,
} = require("../commands/slash/three-card-help");
const {
  slashData: threeCardStats,
} = require("../commands/slash/three-card-stats");
const {
  slashData: threeCardTop,
} = require("../commands/slash/three-card-leaderboard");
const { slashData: wordchainSlash } = require("../commands/slash/wordchain");
const {
  slashData: wordchainHelpSlash,
} = require("../commands/slash/wordchain-help");

async function deploySlashCommands() {
  if (!DISCORD_TOKEN) return;

  if (!APPLICATION_ID || !GUILD_ID) {
    console.warn(
      "⚠️ Thiếu APPLICATION_ID hoặc GUILD_ID → bỏ qua deploy slash."
    );
    return;
  }

  const commands = [
    blackjackSlash.toJSON(),
    walletSlash.toJSON(),
    dailySlash.toJSON(),
    tipSlash.toJSON(),
    paySlash.toJSON(),
    adminEcoSlash.toJSON(),
    adminUserSlash.toJSON(),
    adminHistSlash.toJSON(),
    addSlash.toJSON(),
    removeSlash.toJSON(),
    helpSlash.toJSON(),
    statsSlash.toJSON(),
    threeCardSlash.toJSON(),
    threeCardHelp.toJSON(),
    threeCardStats.toJSON(),
    threeCardTop.toJSON(),
    wordchainSlash.toJSON(),
    wordchainHelpSlash.toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    console.log("⏳ Deploying slash commands to guild...");
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands deployed!");
  } catch (err) {
    console.error("❌ Deploy slash commands failed:", err);
  }
}

module.exports = { deploySlashCommands };
