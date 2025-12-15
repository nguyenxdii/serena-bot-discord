// src/games/blackjack/ui.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { handValue, handText } = require("./cards");

function fmt(n) {
  return Intl.NumberFormat("vi-VN").format(n);
}

function resultLine(r) {
  if (r === "BJ") return "✨ **BLACKJACK!** Bạn thắng (x2.5)!";
  if (r === "DEALER_BJ") return "💀 Dealer BLACKJACK! Bạn thua.";
  if (r === "WIN") return "🏆 **Bạn thắng!**";
  if (r === "LOSE") return "💸 **Bạn thua!**";
  if (r === "PUSH") return "🤝 **Hòa (Push)** – Hoàn tiền cược";
  return "";
}

function embed({ userId, state, balance, revealDealer }) {
  const pv = handValue(state.player);

  const dealerShown = revealDealer ? state.dealer : [state.dealer[0]];

  const dv = handValue(dealerShown);

  const dealerText = revealDealer
    ? handText(state.dealer)
    : `${state.dealer[0].r}${state.dealer[0].s}  🂠`;

  return new EmbedBuilder()
    .setTitle("🃏 BLACKJACK")
    .setColor(
      state.result === "WIN" || state.result === "BJ"
        ? "Green"
        : state.result === "LOSE" || state.result === "DEALER_BJ"
        ? "Red"
        : "Gold"
    )
    .setDescription(
      `👤 <@${userId}>\n` +
        `💰 Số dư: **${fmt(balance)}**\n` +
        `🎲 Cược: **${fmt(state.bet)}**${state.doubled ? " (x2 🔥)" : ""}`
    )
    .addFields(
      {
        name: `🧑‍🎤 Bạn (${pv})`,
        value: `\`\`\`\n${handText(state.player)}\n\`\`\``,
        inline: false,
      },
      {
        name: `🤵 Dealer (${dv}${revealDealer ? "" : " + ?"})`,
        value: `\`\`\`\n${dealerText}\n\`\`\``,
        inline: false,
      }
    )
    .setFooter({
      text: "Hit = rút | Stand = giữ | Double = gấp đôi (rút 1 lá rồi giữ)",
    });
}

function buttons(gameId, { disabled, allowDouble }) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bj:${gameId}:hit`)
        .setLabel("Hit (Rút)")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!disabled),
      new ButtonBuilder()
        .setCustomId(`bj:${gameId}:stand`)
        .setLabel("Stand (Giữ)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!disabled),
      new ButtonBuilder()
        .setCustomId(`bj:${gameId}:double`)
        .setLabel("Double (x2)")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!!disabled || !allowDouble)
    ),
  ];
}

module.exports = { fmt, resultLine, embed, buttons };
