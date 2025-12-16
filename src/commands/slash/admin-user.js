const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getDb } = require("../../db/mongo");
const { fmt } = require("../../games/three-card/ui");

const slashData = new SlashCommandBuilder()
  .setName("admin-user")
  .setDescription("Xem chi tiết hồ sơ user (Admin Only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User cần xem").setRequired(true)
  );

async function run(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ Chỉ Admin mới được dùng.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getUser("user");
  const guildId = interaction.guildId;

  const db = getDb();
  if (!db) return interaction.editReply("❌ DB Error.");

  const usersC = db.collection("users");
  const bjStatsC = db.collection("bj_stats");
  const threeCardStatsC = db.collection("three_card_stats");

  // Parallel Fetch
  const [userData, bjData, threeCardData] = await Promise.all([
    usersC.findOne({ guildId, userId: target.id }),
    bjStatsC.findOne({ guildId, userId: target.id }),
    threeCardStatsC.findOne({ guildId, userId: target.id }),
  ]);

  if (!userData) {
    return interaction.editReply("❌ User này chưa có dữ liệu ví.");
  }

  // Parse Stats
  const wallet = userData.balance;
  const streak = userData.dailyStreak || 0;
  const weekly = userData.weeklyCounter || 0;

  const transfer = userData.transferStats || {};
  const tipCount = transfer.tipCountToday || 0;
  const payOut = transfer.payOutToday || 0;

  // Games
  const bj = bjData || { played: 0, win: 0, lose: 0, net: 0 };
  const threeCard = threeCardData || { played: 0, win: 0, lose: 0, net: 0 };

  const totalPlayed = bj.played + threeCard.played;
  const totalNet = bj.net + threeCard.net;

  // Win Rate
  const totalWin = (bj.win || 0) + (threeCard.win || 0);
  const winRate = totalPlayed
    ? ((totalWin / totalPlayed) * 100).toFixed(1)
    : "0.0";

  const embed = new EmbedBuilder()
    .setTitle(`👤 HỒ SƠ: ${target.username}`)
    .setColor("Green")
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: "💰 Wallet", value: `${fmt(wallet)} coin`, inline: true },
      {
        name: "📅 Streak",
        value: `${streak} ngày (Weekly: ${weekly})`,
        inline: true,
      },
      { name: "📊 Total P/L", value: `${fmt(totalNet)} coin`, inline: true },

      { name: "\u200B", value: "--- **GAME STATS** ---" },
      {
        name: "🃏 Blackjack",
        value:
          `Played: ${bj.played}\n` +
          `Win/Lose: ${bj.win}/${bj.lose}\n` +
          `Net: ${fmt(bj.net)}`,
        inline: true,
      },
      {
        name: "🎲 Ba Cào",
        value:
          `**• Three Card:**\n` +
          `Played: ${threeCard.played}\n` +
          `Win/Lose: ${threeCard.win}/${threeCard.lose}\n` +
          `Net: ${fmt(threeCard.net)}`,
        inline: true,
      },
      { name: "📈 Win Rate", value: `${winRate}%`, inline: true },

      { name: "\u200B", value: "--- **TODAY STATS** ---" },
      { name: "Tip Count", value: `${tipCount}/5`, inline: true },
      { name: "Pay Out", value: `${fmt(payOut)} coin`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { slashData, run };
