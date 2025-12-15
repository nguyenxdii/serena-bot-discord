// src/discord/deploySlashCommands.js
const { REST, Routes } = require("discord.js");
const { DISCORD_TOKEN, APPLICATION_ID, GUILD_ID } = require("../config/env");
const { slashData } = require("../commands/slash/blackjack");

async function deploySlashCommands() {
  if (!DISCORD_TOKEN) return;

  if (!APPLICATION_ID || !GUILD_ID) {
    console.warn(
      "⚠️ Thiếu APPLICATION_ID hoặc GUILD_ID → bỏ qua deploy slash."
    );
    return;
  }

  const commands = [slashData.toJSON()];
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
