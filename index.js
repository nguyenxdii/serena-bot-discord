require("dotenv").config();

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { DISCORD_TOKEN } = require("./src/config/env");
const { connectMongo } = require("./src/db/mongo");
const { deploySlashCommands } = require("./src/discord/deploySlashCommands");

const { onMessageCreate } = require("./src/features/moderation");
const { onInteractionCreate } = require("./src/commands/router");
const {
  onWordChainMessage,
} = require("./src/features/wordchain-simple/messageHandler");

if (!DISCORD_TOKEN) {
  console.error("❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);

  await connectMongo(); // nếu có MONGODB_URI
  await deploySlashCommands(); // nếu có APPLICATION_ID + GUILD_ID

  // Auto-start word chain game
  try {
    const {
      startGame,
    } = require("./src/features/wordchain-simple/game.service");
    const { sendWebhook } = require("./src/utils/webhook.service");

    const gameState = startGame(client.user.id, client.user.username);

    // Send auto-start message via webhook
    await sendWebhook("wordchain", {
      content: `🔄 **Ván mới!** Từ mở màn: **${gameState.currentWord}**`,
    });

    console.log(
      `🎮 Word chain game auto-started with word: ${gameState.currentWord}`
    );
  } catch (error) {
    console.error("❌ Failed to auto-start word chain game:", error);
  }
});

// Message handlers - word chain first for game, then moderation
client.on("messageCreate", onWordChainMessage(client));
client.on("messageCreate", onMessageCreate(client));
client.on("interactionCreate", onInteractionCreate(client));

client.login(DISCORD_TOKEN);
