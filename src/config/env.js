// src/config/env.js
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = {
  DISCORD_TOKEN,
  APPLICATION_ID,
  GUILD_ID,
  MONGODB_URI,
  GEMINI_API_KEY,

  // Webhooks
  WEBHOOK_BLACKJACK: process.env.WEBHOOK_BLACKJACK,
  WEBHOOK_WORDCHAIN: process.env.WEBHOOK_WORDCHAIN,
};
