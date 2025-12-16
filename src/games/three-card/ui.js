// src/games/three-card/ui.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { handText } = require("./cardUtils");

function fmt(n) {
  return Intl.NumberFormat("vi-VN").format(n);
}

function getStatusColor(state) {
  if (state.status === "PLAYING") return "Gold";
  if (state.result === "WIN") return "Green";
  if (state.result === "LOSE") return "Red";
  return "Grey";
}

function buildEmbed({ userId, state, balance }) {
  const pHand = state.player.revealed
    ? `${handText(state.player.hand)}\n👉 **Điểm: ${state.player.score}**`
    : "🂠 🂠 🂠\n*(Bài đang úp)*";

  const dHand = state.dealer.revealed
    ? `${handText(state.dealer.hand)}\n👉 **Điểm: ${state.dealer.score}**`
    : "🂠 🂠 🂠\n*(Bài đang úp)*";

  let resultMsg = "";
  if (state.status === "ENDED") {
    if (state.result === "WIN")
      resultMsg = `\n🏆 **BẠN THẮNG!** (+${fmt(state.bet * 2)})`;
    else if (state.result === "LOSE") resultMsg = "\n💸 **BẠN THUA!**";
    else resultMsg = "\n🤝 **HÒA!** (Hoàn tiền)";
  }

  return new EmbedBuilder()
    .setTitle("🎲 BA CÀO (3 CÂY)")
    .setColor(getStatusColor(state))
    .setDescription(
      `👤 <@${userId}>\n💰 Số dư: **${fmt(balance)}**\n💵 Cược: **${fmt(
        state.bet
      )}**${resultMsg}`
    )
    .addFields(
      { name: "🧑‍🎤 Bài Bạn", value: `\`\`\`\n${pHand}\n\`\`\``, inline: true },
      { name: "🤵 Dealer", value: `\`\`\`\n${dHand}\n\`\`\``, inline: true }
    )
    .setFooter({ text: "Luật: A=1, 10/J/Q/K=0. Lấy số lẻ của tổng." });
}

function buildButtons(gameId, state) {
  const row = new ActionRowBuilder();

  if (state.status === "PLAYING") {
    if (!state.player.revealed) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`tc:${gameId}:view`)
          .setLabel("Xem bài")
          .setEmoji("🃏")
          .setStyle(ButtonStyle.Primary)
      );
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tc:${gameId}:confirm`)
        .setLabel("Chốt (Ngửa bài)")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row.components.length > 0 ? [row] : [];
}

module.exports = { buildEmbed, buildButtons, fmt };
