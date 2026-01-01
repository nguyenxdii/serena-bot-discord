// src/commands/slash/blackjack.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
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
    amount: pay,
    fee: fee,
    reason: `Result: ${result}`,
    meta: { bet, result, profit: finalProfit },
  });

  // Discord Log
  logBlackjack(client, userId, bet, result, finalProfit, balance);
}

// Game Storage
const games = new Map(); // gameId -> { guildId, userId, state, timeoutId, locked }
const activeGames = new Map(); // userId -> gameId

// Processing lock to prevent race conditions
const processingButtons = new Set(); // Set of gameId currently being processed

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

/**
 * Auto-refund with locking mechanism
 */
async function autoRefundGame(gameId, guildId, userId, isAdmin, channel) {
  // CRITICAL: Lock check
  if (processingButtons.has(gameId)) {
    console.log(`⚠️ autoRefund blocked: ${gameId} is being processed`);
    return;
  }

  const g = games.get(gameId);
  if (!g) {
    console.log(`⚠️ autoRefund: Game ${gameId} already cleaned up`);
    return;
  }

  // Lock this game
  processingButtons.add(gameId);

  try {
    const refundAmount = g.state.bet;
    const balanceBefore = await getBalance(guildId, userId, isAdmin);

    console.log(
      `💸 AUTO-REFUND: gameId=${gameId}, userId=${userId}, amount=${refundAmount}, balanceBefore=${balanceBefore}`
    );

    // Refund
    const newBalance = await addBalance(guildId, userId, refundAmount, isAdmin);

    console.log(
      `✅ REFUNDED: ${balanceBefore} → ${newBalance} (+${
        newBalance - balanceBefore
      })`
    );

    // Notify channel
    if (channel) {
      await channel.send({
        content: `⏰ Ván bài của <@${userId}> hết hạn (3 phút). Đã hoàn **${fmt(
          refundAmount
        )}** coins.`,
      });
    }
  } catch (error) {
    console.error(`❌ autoRefund error for ${gameId}:`, error);
  } finally {
    // Cleanup
    games.delete(gameId);
    activeGames.delete(userId);
    processingButtons.delete(gameId);
    console.log(`🗑️ Game ${gameId} cleaned up`);
  }
}

/**
 * Safe game cleanup with locking
 */
function cleanupGame(gameId, userId) {
  const g = games.get(gameId);

  if (g && g.timeoutId) {
    clearTimeout(g.timeoutId);
  }

  games.delete(gameId);
  activeGames.delete(userId);
  processingButtons.delete(gameId);

  console.log(`🗑️ cleanupGame: ${gameId} for user ${userId}`);
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
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const admin = isAdmin(interaction.member);

  // 0. Check for active game
  if (activeGames.has(userId)) {
    return interaction.reply({
      content: `❌ Bạn đang có ván bài chưa hoàn thành! Hãy chơi xong trước.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // 1. Check Cooldown
  const cd = checkCooldown(userId, "blackjack");
  if (cd) {
    return interaction.reply({
      content: `⏳ Thao tác quá nhanh! Chờ **${(cd / 1000).toFixed(1)}s**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const bet = interaction.options.getInteger("bet", true);

  // 2. Validate Bet
  let balance;
  try {
    balance = await getBalance(guildId, userId, admin);
  } catch (e) {
    return interaction.reply({
      content: "❌ Lỗi ví tiền. Thử lại sau.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const errorMsg = validateBet(balance, bet);
  if (errorMsg) {
    return interaction.reply({
      content: errorMsg,
      flags: MessageFlags.Ephemeral,
    });
  }

  // 3. Deduct Bet ONCE
  console.log(
    `💰 [${userId}] Deducting bet: ${bet}. Balance before: ${balance}`
  );

  try {
    balance = await addBalance(guildId, userId, -bet, admin);
    console.log(`💰 [${userId}] Bet deducted. Balance after: ${balance}`);
  } catch (e) {
    console.error(`❌ Failed to deduct bet for ${userId}:`, e);
    return interaction.reply({
      content: "❌ Không trừ được tiền cược. Thử lại.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Set cooldown
  setCooldown(userId, "blackjack");

  const state = startGame(bet);

  // 4. Instant End (Blackjack)
  if (state.status === "ENDED") {
    let pay = payout(state);

    // Apply Fee
    const profit = pay - bet;
    const finalProfit = applyWinFee(profit);
    const fee = profit - finalProfit;
    pay = bet + finalProfit;

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

    await interaction.reply({
      content: `${resultLine(state.result)}\n💵 Tiền thưởng: **${fmt(pay)}**`,
      flags: MessageFlags.Ephemeral,
    });

    return interaction.channel.send({
      embeds: [embed({ userId, state, balance, revealDealer: true })],
    });
  }

  // 5. Active Game - Create gameId and timeout
  const gameId = makeId();
  const allowDouble = state.player.length === 2 && balance >= bet;

  // 3-minute timeout
  const timeoutId = setTimeout(async () => {
    await autoRefundGame(gameId, guildId, userId, admin, interaction.channel);
  }, 3 * 60 * 1000);

  games.set(gameId, {
    guildId,
    userId,
    state,
    timeoutId,
    bet, // Store original bet
  });

  activeGames.set(userId, gameId);

  console.log(`🎮 Game ${gameId} created for ${userId} with bet ${bet}`);

  // Send game message - only 1 message now
  await interaction.reply({
    content: `✅ Ván bài đã bắt đầu!`,
    flags: MessageFlags.Ephemeral,
  });

  return interaction.channel.send({
    embeds: [embed({ userId, state, balance, revealDealer: false })],
    components: buttons(gameId, { disabled: false, allowDouble }),
  });
}

async function onButton(interaction) {
  const userId = interaction.user.id;
  const [, gameId, act] = interaction.customId.split(":");

  // CRITICAL: Check if this game is already being processed
  if (processingButtons.has(gameId)) {
    return interaction.reply({
      content: "⚠️ Đang xử lý, vui lòng chờ...",
      flags: MessageFlags.Ephemeral,
    });
  }

  const g = games.get(gameId);

  if (!g) {
    return interaction.reply({
      content: "⏰ Ván bài đã hết hạn hoặc đã kết thúc rồi!",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== g.userId) {
    return interaction.reply({
      content: "❌ Đây không phải ván bài của bạn!",
      flags: MessageFlags.Ephemeral,
    });
  }

  // LOCK this game
  processingButtons.add(gameId);
  console.log(`🔒 Button processing locked for game ${gameId}`);

  try {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const admin = isAdmin(interaction.member);

    let balance = await getBalance(guildId, userId, admin);

    // HIT
    if (act === "hit") {
      hit(g.state);

      if (g.state.status === "ENDED") {
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

        cleanupGame(gameId, userId);
        setCooldown(userId, "blackjack");

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

      processingButtons.delete(gameId); // Unlock for next action

      return interaction.editReply({
        embeds: [
          embed({ userId, state: g.state, balance, revealDealer: false }),
        ],
        content: `🎲 <@${userId}> đã rút thêm lá!`,
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

      cleanupGame(gameId, userId);
      setCooldown(userId, "blackjack");

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

    // DOUBLE
    if (act === "double") {
      if (g.state.player.length !== 2) {
        processingButtons.delete(gameId);
        return interaction.followUp({
          content: "Double chỉ dùng khi bạn mới có 2 lá.",
          flags: MessageFlags.Ephemeral,
        });
      }
      if (balance < g.state.bet) {
        processingButtons.delete(gameId);
        return interaction.followUp({
          content: "Không đủ tiền để Double.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Deduct extra bet
      console.log(`💰 [${userId}] Double - deducting extra ${g.state.bet}`);
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

      cleanupGame(gameId, userId);
      setCooldown(userId, "blackjack");

      return interaction.editReply({
        embeds: [
          embed({ userId, state: g.state, balance, revealDealer: true }),
        ],
        content: `${resultLine(
          g.state.result
        )} **(DOUBLE!)** \n💵 Tiền thưởng: **${fmt(pay)}**`,
        components: [],
      });
    }

    processingButtons.delete(gameId);
    return interaction.followUp({
      content: "Hành động không hợp lệ.",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(`❌ Error processing button for ${gameId}:`, error);
    processingButtons.delete(gameId);

    return interaction
      .followUp({
        content: "❌ Có lỗi xảy ra. Vui lòng liên hệ admin.",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
}

module.exports = { slashData, start, onButton };
