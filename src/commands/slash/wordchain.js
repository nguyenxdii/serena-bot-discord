// src/commands/slash/wordchain.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

const {
  createMatch,
  acceptMatch,
  cancelMatch,
  submitWord,
  forfeitMatch,
  endMatch,
} = require("../../features/wordchain/wordChain.service");
const { getTopElo } = require("../../features/elo/elo.service");
const { getBalance, getUserData } = require("../../features/wallet");
const { formatCurrency } = require("../../utils/format"); // Assuming exists or I format manually

const slashData = new SlashCommandBuilder()
  .setName("wordchain")
  .setDescription("Chơi game Nối Từ (Word Chain)")
  .addSubcommand((sub) =>
    sub
      .setName("challenge")
      .setDescription("Thách đấu người khác")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("Người bạn muốn thách đấu")
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("bet")
          .setDescription("Số tiền cược (Mỗi người)")
          .setRequired(true)
          .setMinValue(50)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("leaderboard").setDescription("Xem Bảng Xếp Hạng ELO")
  );

// --- HANDLERS ---

async function run(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "leaderboard") {
    return handleLeaderboard(interaction);
  }

  if (sub === "challenge") {
    return handleChallenge(interaction);
  }
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply();
  const top = await getTopElo(interaction.guildId, 5);

  let desc = "";
  if (top.length === 0) {
    desc = "Chưa có dữ liệu xếp hạng.";
  } else {
    top.forEach((u, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `${index + 1}️⃣`;
      const winRate =
        u.gamesPlayed > 0 ? Math.round((u.wins / u.gamesPlayed) * 100) : 0;
      desc += `${medal} <@${u.userId}> — **${u.elo} ELO**\n`;
      desc += `   └ ${u.gamesPlayed} trận (${winRate}% thắng)\n\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 Bảng Xếp Hạng Nối Từ (ELO)")
    .setColor("#FFD700")
    .setDescription(desc)
    .setFooter({ text: "Top 5 Cao Thủ" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleChallenge(interaction) {
  const targetUser = interaction.options.getUser("user");
  const bet = interaction.options.getInteger("bet");
  const author = interaction.user;

  if (targetUser.id === author.id) {
    return interaction.reply({
      content: "❌ Không thể tự thách đấu bản thân!",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (targetUser.bot) {
    return interaction.reply({
      content: "❌ Không thể thách đấu Bot!",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Check balance author
  const balance = await getBalance(interaction.guildId, author.id);
  if (balance < bet) {
    return interaction.reply({
      content: `❌ Bạn không đủ tiền! (Có: ${balance})`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Create PENDING match
  const match = await createMatch(
    interaction.guildId,
    interaction.channelId,
    author.id,
    targetUser.id,
    bet
  );

  const embed = new EmbedBuilder()
    .setTitle("🔥 Thách Đấu Nối Từ")
    .setDescription(
      `<@${author.id}> muốn thách đấu <@${targetUser.id}>\n\n💰 **Cược:** ${bet} coin\n⏳ **Luật chơi:** Nối từ tiếng Việt, 60s/lượt.\n\nNhấn **Accept** để chấp nhận!`
    )
    .setColor("#FFA500")
    .setFooter({ text: "Kèo tự hủy sau 3 phút" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wc:accept:${match._id}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`wc:decline:${match._id}`)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    content: `<@${targetUser.id}>`,
    embeds: [embed],
    components: [row],
  });
}

// --- BUTTONS / MODALS ---

async function onInteraction(interaction) {
  const id = interaction.customId;

  if (interaction.isButton()) {
    if (id.startsWith("wc:accept:")) {
      await handleAccept(interaction);
    } else if (id.startsWith("wc:decline:")) {
      await handleDecline(interaction);
    } else if (id.startsWith("wc:surrender:")) {
      await handleSurrender(interaction);
    } else if (id.startsWith("wc:submit_btn:")) {
      await showInputModal(interaction);
    }
  } else if (interaction.isModalSubmit()) {
    if (id.startsWith("wc:modal:")) {
      await handleWordSubmit(interaction);
    }
  }
}

async function handleAccept(interaction) {
  const matchId = interaction.customId.split(":")[2];
  // 1. Logic Accept
  const result = await acceptMatch(matchId, interaction.user.id);

  if (!result.success) {
    return interaction.reply({
      content: `❌ Lỗi: ${result.reason}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // 2. Start Game UI
  const match = result.match;
  await updateGameUI(interaction, match);
}

async function handleDecline(interaction) {
  const matchId = interaction.customId.split(":")[2];
  // Verify user is target
  // We can just try cancel, service checks permissions
  const res = await cancelMatch(matchId, interaction.user.id, "Bị từ chối");

  if (res) {
    await interaction.update({
      content: `❌ Kèo đã bị hủy bởi <@${interaction.user.id}>`,
      components: [],
      embeds: [],
    });
  } else {
    interaction.reply({
      content: "❌ Không thể hủy.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSurrender(interaction) {
  const matchId = interaction.customId.split(":")[2];
  await forfeitMatch(matchId, interaction.user.id);

  // UI update handled by refreshing via "endMatch" or just replying
  // Best is to Edit the main message? We don't have easy access to main message unless we stored messageId.
  // We didn't store messageId in createMatch!
  // Let's rely on interaction.update

  await interaction.update({
    content: `🏳️ <@${interaction.user.id}> đã đầu hàng!`,
    components: [],
  });

  // Note: Ideally we edit the GAME Embed to show Winner.
  // But strictly `update` here works for the button clicker.
  // To handle the opponent seeing logic, we usually send a new message "Game Over".
  await interaction.channel.send(
    `🏳️ <@${interaction.user.id}> đã đầu hàng! Trận đấu kết thúc.`
  );
}

async function showInputModal(interaction) {
  const matchId = interaction.customId.split(":")[2];

  const modal = new ModalBuilder()
    .setCustomId(`wc:modal:${matchId}`)
    .setTitle("Nhập từ tiếp theo");

  const input = new TextInputBuilder()
    .setCustomId("word_input")
    .setLabel("Từ của bạn (Tiếng Việt)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(20);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleWordSubmit(interaction) {
  await interaction.deferUpdate(); // Acknowledge modal submission but we will edit the message separately or send new?
  // We want to edit the Game Board (the message with buttons).
  // Modal interaction has message? yes `interaction.message` is the message the button was on.

  const matchId = interaction.customId.split(":")[2];
  const word = interaction.fields.getTextInputValue("word_input");

  const res = await submitWord(matchId, interaction.user.id, word);

  if (!res.success) {
    if (res.gameOver) {
      // Player lost
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setTitle("🔴 GAME OVER");
      embed.setDescription(
        `❌ **${word}** không hợp lệ!\nLý do: ${res.reason}\n\nNgười thua: <@${interaction.user.id}>`
      );
      embed.setColor("#FF0000"); // Red

      await interaction.editReply({ embeds: [embed], components: [] });
      // Also announce winner
      // winner is handled in service endMatch
    } else {
      // Just a warning (not turn, or wrong time, or internal error)
      await interaction.followUp({
        content: `⚠️ ${res.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // Success -> Update UI
  // Need to fetch fresh match data to get "nextPlayerId" etc.
  // Or just construct it.

  // Re-fetch match or use returned data
  // We need to rebuild the Embed.
  const turnUser = `<@${res.nextPlayerId}>`;

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  embed.setDescription(
    `👉 **Từ mới:** "${res.word.toUpperCase()}"\n` +
      `👤 **Lượt của:** ${turnUser}\n` +
      `⏱️ **Thời gian:** 60s\n` +
      `💰 **Pot:** (Hidden/Fixed)`
  );
  // Should update fields explicitly
  const fields = [
    { name: "Last Word", value: res.word, inline: true },
    { name: "Current Turn", value: turnUser, inline: true },
  ];
  // Better: Just Description

  await interaction.editReply({ embeds: [embed] });
}

// Helper to init UI
async function updateGameUI(interaction, match) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 Word Chain: Serving...")
    .setColor("#00FF00")
    .addFields(
      {
        name: "Last Word",
        value: match.lastWord || "Chưa có (Người đi trước ra đề)",
        inline: true,
      },
      { name: "Current Turn", value: `<@${match.turnPlayerId}>`, inline: true },
      {
        name: "Pot",
        value: `${match.escrowA + match.escrowB} coin`,
        inline: true,
      }
    )
    .setFooter({ text: "Dùng nút bên dưới để nhập từ hoặc đầu hàng" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wc:submit_btn:${match._id}`)
      .setLabel("✍️ Submit Word")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`wc:surrender:${match._id}`)
      .setLabel("🏳️ Đầu Hàng")
      .setStyle(ButtonStyle.Secondary)
  );

  // If responding to "Accept" button click, we update that message.
  await interaction.update({
    content: "Trận đấu bắt đầu!",
    embeds: [embed],
    components: [row],
  });
}

module.exports = {
  slashData,
  run,
  onInteraction,
};
