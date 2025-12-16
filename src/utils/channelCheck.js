const { PermissionFlagsBits } = require("discord.js");

const DAILY_CHANNEL_ID = "1450065824210489395";
const WORDCHAIN_CHANNEL_ID = "1450065511231520778";
const CARD_GAME_CHANNEL_ID = "1450065466772029481";

// Allowed for Wallet/Economy commands (shared)
const GAME_ZONES = [WORDCHAIN_CHANNEL_ID, CARD_GAME_CHANNEL_ID];

// Command Category Mapping
const CMD_RULES = {
  daily: [DAILY_CHANNEL_ID],

  // Word Chain
  wordchain: [WORDCHAIN_CHANNEL_ID],
  "wordchain-help": [WORDCHAIN_CHANNEL_ID],

  // Card Games
  blackjack: [CARD_GAME_CHANNEL_ID],
  "blackjack-help": [CARD_GAME_CHANNEL_ID],
  "blackjack-stats": [CARD_GAME_CHANNEL_ID],
  "three-card": [CARD_GAME_CHANNEL_ID],
  "three-card-help": [CARD_GAME_CHANNEL_ID],
  "three-card-stats": [CARD_GAME_CHANNEL_ID],
  "three-card-leaderboard": [CARD_GAME_CHANNEL_ID],

  // Economy (Allowed in all GAME ZONES)
  wallet: GAME_ZONES,
  pay: GAME_ZONES,
  tip: GAME_ZONES,
};

// Admin bypass
function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

async function checkChannel(interaction) {
  // if (isAdmin(interaction.member)) return true; // Optional: Enforce for admins too for testing? strict user req.

  const channelId = interaction.channelId;
  const cmd = interaction.commandName;

  // 1. Logic cho Kênh
  // Nếu đang ở Kênh Nối Từ -> Chỉ được dùng lệnh Nối Từ
  if (channelId === WORDCHAIN_CHANNEL_ID) {
    if (
      CMD_RULES["wordchain"].includes(channelId) &&
      cmd.startsWith("wordchain")
    )
      return true;
    // Allow Economy commands too? User: "ở kênh nào thì dùng các lệnh liên quan của kênh đó"
    // Usually wallet check is needed.
    if (
      CMD_RULES["wallet"].includes(channelId) &&
      ["wallet", "pay", "tip"].includes(cmd)
    )
      return true;

    // Reject others
    await warnSpecific(
      interaction,
      "Kênh này chỉ dành cho **Nối Từ** (/wordchain)!"
    );
    return false;
  }

  // Nếu đang ở Kênh Đánh Bài -> Chỉ được dùng lệnh Đánh Bài
  if (channelId === CARD_GAME_CHANNEL_ID) {
    const isCardCmd =
      CMD_RULES["blackjack"].includes(channelId) ||
      CMD_RULES["three-card"].includes(channelId); // simplified check handled below
    const allowed = ["blackjack", "three-card", "wallet", "pay", "tip"];
    if (allowed.some((p) => cmd.startsWith(p))) return true;

    await warnSpecific(
      interaction,
      "Kênh này chỉ dành cho **Đánh Bài** (Blackjack, Three Card)!"
    );
    return false;
  }

  // 2. Logic cho Lệnh (Nếu chat ở kênh lạ)
  const allowedChannels = CMD_RULES[cmd];
  if (allowedChannels) {
    if (allowedChannels.includes(channelId)) return true;

    // Wrong Channel
    await warnWrongChannel(interaction, allowedChannels);
    return false;
  }

  // Lệnh admin/khác không trong list -> Allow (hoặc Block strict)
  // User req: "admin-*" -> Usually admin commands are ephemeral/anywhere or restricted by permissions.
  // We allow logic to pass if not defined in CMD_RULES.
  return true;
}

async function warnSpecific(interaction, msg) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: `⚠️ ${msg}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `⚠️ ${msg}`, ephemeral: true });
    }
  } catch (e) {}
}

async function warnWrongChannel(interaction, allowedIds) {
  const channelList = allowedIds.map((id) => `<#${id}>`).join(", ");
  const content = `⚠️ **Sai khu vực!** Vui lòng qua: ${channelList}`;
  await warnSpecific(interaction, content.replace("⚠️ ", ""));
}

module.exports = {
  checkChannel,
  DAILY_CHANNEL_ID,
  WORDCHAIN_CHANNEL_ID,
  CARD_GAME_CHANNEL_ID,
  ALLOWED_CHANNELS: GAME_ZONES,
};
