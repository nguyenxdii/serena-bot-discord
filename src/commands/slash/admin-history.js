const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { getDb } = require("../../db/mongo");
const { fmt } = require("../../games/three-card/ui");

const slashData = new SlashCommandBuilder()
  .setName("admin-history")
  .setDescription("Xem lịch sử giao dịch user (Admin Only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User cần xem").setRequired(true)
  );

async function run(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ Chỉ Admin mới được dùng.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const target = interaction.options.getUser("user");

  const db = getDb();
  if (!db) return interaction.editReply("❌ DB Error.");
  const txC = db.collection("transactions");

  const logs = await txC
    .find({
      $or: [{ userId: target.id }, { targetId: target.id }],
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  if (logs.length === 0) {
    return interaction.editReply("❌ Không tìm thấy lịch sử nào.");
  }

  const lines = logs.map((l) => {
    const time = l.createdAt
      ? new Date(l.createdAt).toLocaleTimeString("vi-VN")
      : "N/A";
    const isSource = l.userId === target.id;

    let direction = "";
    let amountStr = fmt(l.amount);

    // Formatting based on Type
    if (l.type === "TIP" || l.type === "PAY") {
      if (isSource) direction = "🔴 SENT"; // Sent
      else direction = "🟢 RECV"; // Received
    } else if (l.type === "DAILY") {
      direction = "☀️ DAILY";
      amountStr = `+${amountStr}`;
    } else if (
      l.type === "BLACKJACK" ||
      l.type === "THREE_CARD" ||
      l.type === "GAME"
    ) {
      // Payout log.
      // Meta has bet. Payout - Bet = Net.
      const bet = l.meta?.bet || 0;
      const net = l.amount - bet;
      if (net > 0) {
        direction = "🟢 WIN";
        amountStr = `+${fmt(net)}`;
      } else if (net < 0) {
        direction = "🔴 LOSE";
        amountStr = `${fmt(net)}`;
      } else {
        direction = "⚪ DRAW";
        amountStr = "0";
      }
    } else if (l.type === "ADMIN_ADD") {
      direction = "➕ ADMIN";
    } else if (l.type === "ADMIN_REMOVE") {
      direction = "➖ ADMIN";
    } else {
      direction = l.type;
    }

    const feeStr = l.fee ? `(Fee: ${l.fee})` : "";

    return `\`${time}\` **${direction}** | ${amountStr} ${feeStr} | ${
      l.reason || ""
    }`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`📜 HISTORY: ${target.username}`)
    .setColor("Blurple")
    .setDescription(lines.join("\n") || "No data")
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { slashData, run };
