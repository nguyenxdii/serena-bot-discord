// src/discord/deploySlashCommands.js
const { REST, Routes } = require("discord.js");
const { DISCORD_TOKEN, APPLICATION_ID, GUILD_ID } = require("../config/env");

const { slashData: blackjackSlash } = require("../commands/slash/blackjack");
const { slashData: walletSlash } = require("../commands/slash/wallet");
const { slashData: dailySlash } = require("../commands/slash/daily");
const { slashData: helpSlash } = require("../commands/slash/blackjack-help");
const { slashData: statsSlash } = require("../commands/slash/blackjack-stats");

const { slashData: bacaySlash } = require("../commands/slash/bacay");
const { slashData: bacayHelp } = require("../commands/slash/bacay-help");
const { slashData: bacayStats } = require("../commands/slash/bacay-stats");
const { slashData: bacayTop } = require("../commands/slash/bacay-top");

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
    helpSlash.toJSON(),
    statsSlash.toJSON(),
    bacaySlash.toJSON(),
    bacayHelp.toJSON(),
    bacayStats.toJSON(),
    bacayTop.toJSON(),
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
