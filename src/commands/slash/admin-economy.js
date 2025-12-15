const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getDb } = require("../../db/mongo");
const { fmt } = require("../../games/bacay/ui");

const slashData = new SlashCommandBuilder()
  .setName("admin-economy")
  .setDescription("Xem thống kê toàn server (Admin Only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function run(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ Chỉ Admin mới được dùng.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const db = getDb();
  if (!db) return interaction.editReply("❌ DB Error.");

  const usersC = db.collection("users");
  const txC = db.collection("transactions");

  const EXCLUDE_IDS = ["875358286487097395"]; // Bot Owner

  // 1. User Stats
  const userStats = await usersC
    .aggregate([
      { $match: { userId: { $nin: EXCLUDE_IDS } } },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const totalCoin = userStats[0]?.totalBalance || 0;
  const userCount = userStats[0]?.count || 0;
  const avgCoin = userCount ? Math.floor(totalCoin / userCount) : 0;

  // 2. Transaction Stats (Fresh data only)
  // Minted: Daily + Game Net Profits (if > 0) + Admin Add ??
  // Burned: Game Net Loss + Fees + Admin Remove ??
  // This is complex to do perfectly with simple aggregation on mixed types.
  // Let's do simple Sums by Type.

  const txStats = await txC
    .aggregate([
      { $match: { userId: { $nin: EXCLUDE_IDS } } },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" }, // Payouts/Transferred
          totalFee: { $sum: "$fee" },
          count: { $sum: 1 },
          totalBet: { $sum: "$meta.bet" }, // Only for Games
        },
      },
    ])
    .toArray();

  let mintedDaily = 0;
  let mintedGame = 0;
  let burnedGame = 0;
  let feesBurned = 0;
  let payBurned = 0;

  txStats.forEach((s) => {
    if (s._id === "DAILY") mintedDaily += s.totalAmount;

    if (s._id === "BLACKJACK" || s._id === "BACAY") {
      // Calculation:
      // Payout = s.totalAmount
      // Bet = s.totalBet
      // Net = Payout - Bet
      // If Net < 0: Burned. If Net > 0: Minted?
      // Wait, "Coin phát ra (game thắng)" implies Player Winnings.
      // "Coin đốt (thua cược)" implies House Winnings.

      // Rough approximation from aggregates:
      const payout = s.totalAmount;
      const bet = s.totalBet || 0;

      // Fees are tracked separately in `fee` field for BJ/Bacay now?
      // Yes, I fed `fee` into log.
      feesBurned += s.totalFee;

      // House PnL: Bet - Payout.
      const housePnL = bet - payout;
      if (housePnL > 0) burnedGame += housePnL; // User Lost
      else mintedGame += -housePnL; // User Won (Net)
    }

    if (s._id === "PAY") {
      payBurned += s.totalFee;
    }
  });

  const embed = new EmbedBuilder()
    .setTitle("📊 SERVER ECONOMY STATS")
    .setColor("Blurple")
    .addFields(
      { name: "👥 User Count", value: `${userCount}`, inline: true },
      { name: "💰 Total Money", value: `${fmt(totalCoin)}`, inline: true },
      { name: "💵 Avg/User", value: `${fmt(avgCoin)}`, inline: true },

      { name: "\u200B", value: "\u200B" }, // Spacer

      {
        name: "🌱 Coin Minted (Approximated)",
        value:
          `Daily: +${fmt(mintedDaily)}\n` +
          `Game Win (Net): +${fmt(mintedGame)}`,
        inline: true,
      },
      {
        name: "🔥 Coin Burned (Approximated)",
        value:
          `Game Loss (Net): -${fmt(burnedGame)}\n` +
          `Game Fees: -${fmt(feesBurned)}\n` +
          `Pay Fees: -${fmt(payBurned)}`,
        inline: true,
      }
    )
    .setFooter({
      text: "Lưu ý: Stats game/daily chỉ tính từ lúc hệ thống Log hoạt động.",
    });

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { slashData, run };
