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
      .setName("money")
      .setDescription("Số tiền đặt cược")
      .setRequired(true)
      .setMinValue(1)
  );

async function start(interaction) {
  await interaction.deferReply();

  // ✅ trả lời ngay để Discord không hiện "đang suy nghĩ..." lâu
  await interaction.editReply("🃏 Đang chia bài...");

  const bet = interaction.options.getInteger("money", true);
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const admin = isAdmin(interaction.member);

  let balance;
  try {
    balance = await getBalance(guildId, userId, admin);
  } catch (e) {
    console.error("getBalance error:", e);
    return interaction.editReply(
      "❌ Ví (wallet) đang lỗi/kết nối DB chậm. Thử lại sau ít phút nhé."
    );
  }

  if (bet > balance) {
    return interaction.editReply(
      `Bạn không đủ tiền. Balance: **${fmt(balance)}**`
    );
  }

  try {
    balance = await addBalance(guildId, userId, -bet, admin);
  } catch (e) {
    console.error("addBalance(-bet) error:", e);
    return interaction.editReply(
      "❌ Không trừ được tiền cược (DB chậm/lỗi). Thử lại nhé."
    );
  }

  const state = startGame(bet);

  if (state.status === "ENDED") {
    const pay = payout(state);

    try {
      balance = await addBalance(guildId, userId, pay, admin);
      await recordBlackjackRound(guildId, userId, state.result, state.bet, pay);
    } catch (e) {
      console.error("payout/stats error:", e);
      // vẫn trả kết quả game, chỉ báo stats lỗi
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

  setTimeout(() => games.delete(gameId), 2 * 60 * 1000);
}

async function onButton(interaction) {
  // ✅ ACK nút bấm để khỏi "Ứng dụng không phản hồi"
  await interaction.deferUpdate();

  const [, gameId, act] = interaction.customId.split(":");
  const g = games.get(gameId);

  // ❗ đã deferUpdate -> muốn báo riêng thì followUp (ephemeral)
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
  const userId = interaction.user.id;
  const admin = isAdmin(interaction.member);

  let balance = await getBalance(guildId, userId, admin);

  // HIT
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

      // ❗ đã deferUpdate -> sửa message gốc bằng editReply
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

    return interaction.editReply({
      embeds: [embed({ userId, state: g.state, balance, revealDealer: true })],
      content: `${resultLine(g.state.result)}\n💵 Tiền thưởng: **${fmt(pay)}**`,
      components: [],
    });
  }

  // nếu act lạ
  return interaction.followUp({
    content: "Hành động không hợp lệ.",
    ephemeral: true,
  });
}

const ALLOWED_CHANNELS = [
  "1450065466772029481",
  "1450065511231520778",
  "1450065534312779776",
  "1450067312160805047",
];

async function checkChannel(interaction) {
  // Admin được quyền dùng mọi nơi
  if (isAdmin(interaction.member)) return true;

  // Nếu đúng kênh cho phép -> ok
  if (ALLOWED_CHANNELS.includes(interaction.channelId)) return true;

  // Nếu sai kênh -> báo lỗi + tự xóa sau 15s
  const channelList = ALLOWED_CHANNELS.map((id) => `<#${id}>`).join(", ");
  const msg = await interaction.reply({
    content: `⚠️ **Vui lòng qua đúng kênh để chơi game:**\n👉 ${channelList}\n_(Tin nhắn tự xóa sau 15 giây)_`,
    fetchReply: true,
  });

  setTimeout(() => {
    msg.delete().catch(() => {});
  }, 15000);

  return false;
}

function onInteractionCreate(client) {
  return async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;
        if (
          ["blackjack", "wallet", "blackjack-help", "blackjack-stats"].includes(
            cmd
          )
        ) {
          // Check channel trước khi chạy lệnh
          if (!(await checkChannel(interaction))) return;

          if (cmd === "blackjack") return start(interaction);
          if (cmd === "wallet") return runWallet(interaction);
          if (cmd === "blackjack-help") return runHelp(interaction);
          if (cmd === "blackjack-stats") return runStats(interaction);
        }
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith("bj:"))
          return onButton(interaction);
      }
    } catch (e) {
      console.error("interaction error:", e);

      // nếu đã reply/defer rồi thì followUp
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: "Có lỗi xảy ra 😭",
            ephemeral: true,
          });
        } else if (interaction.isRepliable()) {
          await interaction.reply({
            content: "Có lỗi xảy ra 😭",
            ephemeral: true,
          });
        }
      } catch {}
    }
  };
}

module.exports = { slashData, onInteractionCreate };
