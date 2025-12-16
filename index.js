require("dotenv").config();

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { DISCORD_TOKEN } = require("./src/config/env");
const { connectMongo } = require("./src/db/mongo");
const { deploySlashCommands } = require("./src/discord/deploySlashCommands");

const { onMessageCreate } = require("./src/features/moderation");
const { onInteractionCreate } = require("./src/commands/router");

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
});

client.on("messageCreate", onMessageCreate(client));
client.on("interactionCreate", onInteractionCreate(client));

client.login(DISCORD_TOKEN);
