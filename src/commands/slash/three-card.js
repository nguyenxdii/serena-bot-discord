// src/commands/slash/three-card.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getBalance, addBalance } = require("../../features/wallet");
const { applyWinFee } = require("../../features/economyRules");

// Helper for Logging
async function logGameEnd(
  client,
  guildId,
  userId,
  bet,
  result,
  pay,
  finalProfit,
  fee,
  balance
) {
  const { logTransaction } = require("../../features/transactionLog");
  const { logThreeCard } = require("../../utils/discordLogger");

  // DB Log
  await logTransaction({
    type: "THREE_CARD",
    guildId,
    userId,
    amount: pay, // Payout amount
    fee: fee,
    reason: `Result: ${result}`,
    meta: { bet, result, profit: finalProfit },
  });

  // Discord Log
  logThreeCard(client, userId, bet, result, finalProfit, balance);
}
const {
  startGame,
  revealPlayer,
  resolveGame,
  getPayout,
} = require("../../games/three-card/engine");
const { buildEmbed, buildButtons, fmt } = require("../../games/three-card/ui");
const { recordThreeCardGame } = require("../../features/threeCardStats");

// Memory store for active games
const games = new Map(); // gameId -> { guildId, userId, state, timer }

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

const slashData = new SlashCommandBuilder()
  .setName("three-card")
  .setDescription("Play Three Card Game (Scratch Card) - High Score Wins")
  .addIntegerOption((opt) =>
    opt
      .setName("bet")
      .setDescription("Bet Amount")
      .setRequired(true)
      .setMinValue(1)
  );

async function run(interaction) {
  // Defer removed

  const bet = interaction.options.getInteger("bet", true);
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const admin = isAdmin(interaction.member);

  // Check Balance
  let balance;
  try {
    balance = await getBalance(guildId, userId, admin);
  } catch (e) {
    console.error("getBalance error:", e);
    return interaction.reply({
      content: "❌ Lỗi ví tiền. Thử lại sau.",
      ephemeral: true,
    });
  }

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Không đủ tiền! Số dư: **${fmt(balance)}**`,
      ephemeral: true,
    });
  }

  // Deduct Bet
  try {
    balance = await addBalance(guildId, userId, -bet, admin);
  } catch (e) {
    return interaction.reply({
      content: "❌ Lỗi trừ tiền. Thử lại sau.",
      ephemeral: true,
    });
  }

  // Validated & Paid -> Public
  await interaction.deferReply();

  // Start Game
  const state = startGame(bet);
  const gameId = makeId();

  games.set(gameId, { guildId, userId, state });

  await interaction.editReply({
    embeds: [buildEmbed({ userId, state, balance })],
    components: buildButtons(gameId, state),
  });

  // Timeout cleanup (60s)
  const timer = setTimeout(() => {
    if (games.has(gameId)) {
      games.delete(gameId);
    }
  }, 60 * 1000);

  games.get(gameId).timer = timer;
}

async function onButton(interaction) {
  await interaction.deferUpdate();

  const [, gameId, action] = interaction.customId.split(":");
  const game = games.get(gameId);

  if (!game) {
    return interaction.followUp({
      content: "❌ Ván chơi đã hết hạn hoặc không tồn tại.",
      ephemeral: true,
    });
  }

  if (interaction.user.id !== game.userId) {
    return interaction.followUp({
      content: "❌ Không phải ván của bạn!",
      ephemeral: true,
    });
  }

  const { state, guildId, userId } = game;
  const admin = isAdmin(interaction.member);

  // VIEW CARDS
  if (action === "view") {
    revealPlayer(state);

    // Update UI only (no state change affecting result yet)
    // Balance chưa đổi
    const balance = await getBalance(guildId, userId, admin);

    await interaction.editReply({
      embeds: [buildEmbed({ userId, state, balance })],
      components: buildButtons(gameId, state),
    });
    return;
  }

  // CONFIRM (SHOWDOWN)
  if (action === "confirm") {
    resolveGame(state);

    let pay = getPayout(state); // RAW payout

    // FEE LOGIC
    const profit = pay - state.bet;
    const finalProfit = applyWinFee(profit); // Net profit
    const fee = profit - finalProfit;
    pay = state.bet + finalProfit; // Final Payout

    let balance;

    // Payout
    try {
      if (pay > 0) {
        balance = await addBalance(guildId, userId, pay, admin);
      } else {
        balance = await getBalance(guildId, userId, admin);
      }

      // Record Stats
      await recordThreeCardGame(guildId, userId, state.result, state.bet, pay);

      // Log DB + Discord
      await logGameEnd(
        interaction.client,
        guildId,
        userId,
        state.bet,
        state.result,
        pay,
        finalProfit,
        fee,
        balance
      );
    } catch (e) {
      console.error("Payout error:", e);
    }

    // Clear Game
    clearTimeout(game.timer);
    games.delete(gameId); // Xóa khỏi active games, nhưng UI vẫn hiện nút Replay

    await interaction.editReply({
      embeds: [buildEmbed({ userId, state, balance })],
      components: buildButtons(gameId, state), // Hiện nút Retry / Exit
    });
    return;
  }
}

module.exports = { slashData, run, onButton };
