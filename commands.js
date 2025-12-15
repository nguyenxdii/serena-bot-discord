require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("❌ Thiếu DISCORD_TOKEN / CLIENT_ID / GUILD_ID trong .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Chơi blackjack")
    .addIntegerOption((opt) =>
      opt
        .setName("money")
        .setDescription("Số tiền đặt")
        .setRequired(true)
        .setMinValue(1)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("⏳ Deploying slash commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.log("✅ Done! (lệnh sẽ hiện gần như ngay lập tức trong server)");
  } catch (err) {
    console.error("❌ Deploy failed:", err);
  }
})();
