// src/commands/slash/blackjack.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { recordBlackjackRound } = require("../../features/blackjackStats");
const {
  startGame,
  hit,
  stand,
  payout,
} = require("../../games/blackjack/engine");
const { embed, buttons, fmt, resultLine } = require("../../games/blackjack/ui");
const { getBalance, addBalance } = require("../../features/wallet");
const {
  validateBet,
  applyWinFee,
  checkCooldown,
  setCooldown,
} = require("../../features/economyRules");

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
  const { logBlackjack } = require("../../utils/discordLogger");

  // DB Log
  await logTransaction({
    type: "BLACKJACK",
    guildId,
    userId,
    amount: pay, // Payout amount
    fee: fee,
    reason: `Result: ${result}`,
    meta: { bet, result, profit: finalProfit },
  });

  // Discord Log
  logBlackjack(client, userId, bet, result, finalProfit, balance);
}

const games = new Map(); // gameId -> { guildId, userId, state }

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

const slashData = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Chơi blackjack (Hit/Stand/Double)")
  .addIntegerOption((opt) =>
    opt
      .setName("bet")
      .setDescription("Số tiền đặt cược")
      .setRequired(true)
      .setMinValue(50)
  );

async function start(interaction) {
  // Defer removed from here


  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const admin = isAdmin(interaction.member);

  // 1. Check Cooldown
  const cd = checkCooldown(userId, "blackjack");
  if (cd) {
    return interaction.editReply(
      content: `⏳ Bạn thao tác quá nhanh! Vui lòng chờ **${(cd / 1000).toFixed(
        1
      )}s** nữa.`,
      ephemeral: true
    );
  }

  const bet = interaction.options.getInteger("bet", true);

  // 2. Validate Bet
  let balance;
  try {
    balance = await getBalance(guildId, userId, admin);
  } catch (e) {
    return interaction.reply({ content: "❌ Lỗi ví tiền. Thử lại sau.", ephemeral: true });
  }

  const errorMsg = validateBet(balance, bet);
  if (errorMsg) {
    return interaction.reply({ content: errorMsg, ephemeral: true });
  }

  // 3. Deduct Bet
  try {
    balance = await addBalance(guildId, userId, -bet, admin);
  } catch (e) {
    return interaction.reply({
      content: "❌ Không trừ được tiền cược (DB chậm/lỗi). Thử lại nhé.",
      ephemeral: true
    });
  }

  // Validated & Paid -> Now make it Public
  await interaction.deferReply();

  // Set cooldown start
  setCooldown(userId, "blackjack");

  await interaction.editReply("🃏 Đang chia bài...");

  const state = startGame(bet);

  // 4. Instant End (Blackjack or Dealer Blackjack)
  if (state.status === "ENDED") {
    let pay = payout(state);

    // Apply Fee
    const profit = pay - bet;
    const finalProfit = applyWinFee(profit);
    const fee = profit - finalProfit;
    pay = bet + finalProfit; // Total return

    try {
      balance = await addBalance(guildId, userId, pay, admin);
      await recordBlackjackRound(guildId, userId, state.result, state.bet, pay);
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
      console.error("payout/stats error:", e);
    }

    return interaction.editReply({
      embeds: [embed({ userId, state, balance, revealDealer: true })],
      content: `${resultLine(state.result)}\n💵 Tiền thưởng: **${fmt(pay)}**`,
      components: [],
    });
  }

  const gameId = makeId();
  games.set(gameId, { guildId, userId, state });

  const allowDouble = state.player.length === 2 && balance >= bet;

  await interaction.editReply({
    embeds: [embed({ userId, state, balance, revealDealer: false })],
    components: buttons(gameId, { disabled: false, allowDouble }),
    content: null,
  });

  setTimeout(() => games.delete(gameId), 60 * 1000);
}

async function onButton(interaction) {
  // Check Cooldown (Spam protection)
  const userId = interaction.user.id;
  await interaction.deferUpdate();

  const [, gameId, act] = interaction.customId.split(":");
  const g = games.get(gameId);

  if (!g) {
    return interaction.followUp({
      content: "Ván đã hết hạn hoặc kết thúc.",
      ephemeral: true,
    });
  }
  if (interaction.user.id !== g.userId) {
    return interaction.followUp({
      content: "Mày thích tấy mấy tay chân không 😼?",
      ephemeral: true,
    });
  }

  const guildId = interaction.guildId;
  const admin = isAdmin(interaction.member);

  let balance = await getBalance(guildId, userId, admin);

  // HIT
  if (act === "hit") {
    hit(g.state);

    if (g.state.status === "ENDED") {
      let pay = payout(g.state);

      // Fee
      const profit = pay - g.state.bet;
      const finalProfit = applyWinFee(profit);
      const fee = profit - finalProfit;
      pay = g.state.bet + finalProfit;

      balance = await addBalance(guildId, userId, pay, admin);

      await recordBlackjackRound(
        guildId,
        userId,
        g.state.result,
        g.state.bet,
        pay
      );
      await logGameEnd(
        interaction.client,
        guildId,
        userId,
        g.state.bet,
        g.state.result,
        pay,
        finalProfit,
        fee,
        balance
      );

      games.delete(gameId);
      setCooldown(userId, "blackjack"); // Reset cooldown on end game

      return interaction.editReply({
        embeds: [
          embed({ userId, state: g.state, balance, revealDealer: true }),
        ],
        content: `${resultLine(g.state.result)}\n💵 Tiền thưởng: **${fmt(
          pay
        )}**`,
        components: [],
      });
    }

    const allowDouble = g.state.player.length === 2 && balance >= g.state.bet;

    return interaction.editReply({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: false })],
      components: buttons(gameId, { disabled: false, allowDouble }),
    });
  }

  // STAND
  if (act === "stand") {
    stand(g.state);

    let pay = payout(g.state);

    const profit = pay - g.state.bet;
    const finalProfit = applyWinFee(profit);
    const fee = profit - finalProfit;
    pay = g.state.bet + finalProfit;

    balance = await addBalance(guildId, userId, pay, admin);

    await recordBlackjackRound(
      guildId,
      userId,
      g.state.result,
      g.state.bet,
      pay
    );
    await logGameEnd(
      interaction.client,
      guildId,
      userId,
      g.state.bet,
      g.state.result,
      pay,
      finalProfit,
      fee,
      balance
    );

    games.delete(gameId);
    setCooldown(userId, "blackjack");

    return interaction.editReply({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: true })],
      content: `${resultLine(g.state.result)}\n💵 Tiền thưởng: **${fmt(pay)}**`,
      components: [],
    });
  }

  // DOUBLE
  if (act === "double") {
    if (g.state.player.length !== 2) {
      return interaction.followUp({
        content: "Double chỉ dùng khi bạn mới có 2 lá.",
        ephemeral: true,
      });
    }
    if (balance < g.state.bet) {
      return interaction.followUp({
        content: "Không đủ tiền để Double.",
        ephemeral: true,
      });
    }

    // Deduct extra bet
    balance = await addBalance(guildId, userId, -g.state.bet, admin);
    g.state.bet *= 2;
    g.state.doubled = true;

    hit(g.state);
    if (g.state.status !== "ENDED") stand(g.state);

    let pay = payout(g.state);

    const profit = pay - g.state.bet;
    const finalProfit = applyWinFee(profit);
    const fee = profit - finalProfit;
    pay = g.state.bet + finalProfit;

    balance = await addBalance(guildId, userId, pay, admin);

    await recordBlackjackRound(
      guildId,
      userId,
      g.state.result,
      g.state.bet,
      pay
    );
    await logGameEnd(
      interaction.client,
      guildId,
      userId,
      g.state.bet,
      g.state.result,
      pay,
      finalProfit,
      fee,
      balance
    );

    games.delete(gameId);
    setCooldown(userId, "blackjack");

    return interaction.editReply({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: true })],
      content: `${resultLine(g.state.result)}\n💵 Tiền thưởng: **${fmt(pay)}**`,
      components: [],
    });
  }

  return interaction.followUp({
    content: "Hành động không hợp lệ.",
    ephemeral: true,
  });
}

module.exports = { slashData, start, onButton };
