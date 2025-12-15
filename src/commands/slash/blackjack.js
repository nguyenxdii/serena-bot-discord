// src/commands/slash/blackjack.js
const { run: runWallet } = require("./wallet");
const { run: runHelp } = require("./blackjack-help");
const { run: runStats } = require("./blackjack-stats");

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

const games = new Map(); // id -> { guildId, userId, state }

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function isAdmin(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

const slashData = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Chơi blackjack (nút bấm Hit/Stand/Double)")
  .addIntegerOption((opt) =>
    opt
      .setName("money")
      .setDescription("Số tiền đặt cược")
      .setRequired(true)
      .setMinValue(1)
  );

async function start(interaction) {
  await interaction.deferReply(); // ✅ tránh timeout 3s

  const bet = interaction.options.getInteger("money", true);
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const admin = isAdmin(interaction.member);
  let balance = await getBalance(guildId, userId, admin);

  if (bet > balance) {
    return interaction.reply({
      content: `Bạn không đủ tiền. Balance: **${fmt(balance)}**`,
      ephemeral: true,
    });
  }

  // trừ bet trước
  balance = await addBalance(guildId, userId, -bet, admin);

  const state = startGame(bet);

  // nếu mở bài đã END (BJ)
  if (state.status === "ENDED") {
    const pay = payout(state);
    balance = await addBalance(guildId, userId, pay, admin);

    // ghi thống kê
    await recordBlackjackRound(guildId, userId, state.result, state.bet, pay);

    return interaction.reply({
      embeds: [embed({ userId, state, balance, revealDealer: true })],
      content: `${resultLine(state.result)}\n💵 Payout: **${fmt(pay)}**`,
      components: [],
    });
  }

  const gameId = makeId();
  games.set(gameId, { guildId, userId, state });

  // allowDouble: đủ tiền để trừ thêm 1x bet + chỉ khi 2 lá
  const allowDouble = state.player.length === 2 && balance >= bet;

  const msg = await interaction.reply({
    embeds: [embed({ userId, state, balance, revealDealer: false })],
    components: buttons(gameId, { disabled: false, allowDouble }),
    fetchReply: true,
  });

  // auto expire (2 phút)
  setTimeout(() => games.delete(gameId), 2 * 60 * 1000);

  return msg;
}

async function onButton(interaction) {
  await interaction.deferUpdate();
  const [_, gameId, act] = interaction.customId.split(":");
  const g = games.get(gameId);
  if (!g)
    return interaction.reply({
      content: "Ván đã hết hạn hoặc kết thúc.",
      ephemeral: true,
    });
  if (interaction.user.id !== g.userId)
    return interaction.reply({
      content: "Không phải ván của bạn 😼",
      ephemeral: true,
    });

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const admin = isAdmin(interaction.member);

  let balance = await getBalance(guildId, userId, admin);

  if (act === "hit") {
    hit(g.state);

    if (g.state.status === "ENDED") {
      const pay = payout(g.state);
      balance = await addBalance(guildId, userId, pay, admin);
      await recordBlackjackRound(
        guildId,
        userId,
        g.state.result,
        g.state.bet,
        pay
      );

      games.delete(gameId);

      return interaction.update({
        embeds: [
          embed({ userId, state: g.state, balance, revealDealer: true }),
        ],
        content: `${resultLine(g.state.result)}\n💵 Payout: **${fmt(pay)}**`,
        components: [],
      });
    }

    const allowDouble = g.state.player.length === 2 && balance >= g.state.bet;
    return interaction.update({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: false })],
      components: buttons(gameId, { disabled: false, allowDouble }),
    });
  }

  if (act === "stand") {
    stand(g.state);
    const pay = payout(g.state);
    balance = await addBalance(guildId, userId, pay, admin);
    await recordBlackjackRound(
      guildId,
      userId,
      g.state.result,
      g.state.bet,
      pay
    );

    games.delete(gameId);

    return interaction.update({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: true })],
      content: `${resultLine(g.state.result)}\n💵 Payout: **${fmt(pay)}**`,
      components: [],
    });
  }

  if (act === "double") {
    // double chỉ khi còn 2 lá và đủ tiền thêm 1x bet
    if (g.state.player.length !== 2)
      return interaction.reply({
        content: "Double chỉ dùng khi bạn mới có 2 lá.",
        ephemeral: true,
      });
    if (balance < g.state.bet)
      return interaction.reply({
        content: "Không đủ tiền để Double.",
        ephemeral: true,
      });

    // trừ thêm 1x bet
    balance = await addBalance(guildId, userId, -g.state.bet, admin);
    g.state.bet *= 2;
    g.state.doubled = true;

    // rút 1 lá rồi auto stand
    hit(g.state);
    if (g.state.status !== "ENDED") stand(g.state);

    const pay = payout(g.state);
    balance = await addBalance(guildId, userId, pay, admin);
    await recordBlackjackRound(
      guildId,
      userId,
      g.state.result,
      g.state.bet,
      pay
    );

    games.delete(gameId);

    return interaction.update({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: true })],
      content: `${resultLine(g.state.result)}\n💵 Payout: **${fmt(pay)}**`,
      components: [],
    });
  }
}

function onInteractionCreate(client) {
  return async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "blackjack") return start(interaction);
        if (interaction.commandName === "wallet") return runWallet(interaction);
        if (interaction.commandName === "blackjack-help")
          return runHelp(interaction);
        if (interaction.commandName === "blackjack-stats")
          return runStats(interaction);
      }
      if (interaction.isButton()) {
        if (interaction.customId.startsWith("bj:"))
          return onButton(interaction);
      }
    } catch (e) {
      console.error("interaction error:", e);
      if (interaction.isRepliable()) {
        try {
          await interaction.reply({
            content: "Có lỗi xảy ra 😭",
            ephemeral: true,
          });
        } catch {}
      }
    }
  };
}

module.exports = { slashData, onInteractionCreate };
