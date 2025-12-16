const { EmbedBuilder } = require("discord.js");

const LOG_CHANNELS = {
  BLACKJACK: "1450093401214029958",
  THREE_CARD: "1450093446416044052",
  DAILY: "1450093510077452288",
  ADMIN: "1450093401214029958", // Same as BJ or need new one? User didn't specify Admin Log.
  // Using BJ channel as fallback for generic wallet logs if needed, or just console.
};

async function sendLog(client, channelId, embed) {
  try {
    // If client not ready or invalid
    if (!client || !client.channels) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error(`Failed to log to ${channelId}`, e);
  }
}

function logDaily(client, userId, reward, streak, total) {
  const embed = new EmbedBuilder()
    .setTitle("📅 Daily Check-in")
    .setColor("Green")
    .setDescription(`<@${userId}> đã điểm danh!`)
    .addFields(
      { name: "Reward", value: `+${reward}`, inline: true },
      { name: "Streak", value: `${streak} ngày`, inline: true },
      { name: "Total Received", value: `${total}`, inline: true }
    )
    .setTimestamp();

  sendLog(client, LOG_CHANNELS.DAILY, embed);
}

function logBlackjack(client, userId, bet, outcome, profit, balance) {
  const color = profit > 0 ? "Green" : profit < 0 ? "Red" : "Yellow";
  const embed = new EmbedBuilder()
    .setTitle("🃏 Blackjack Result")
    .setColor(color)
    .setDescription(`<@${userId}> vừa chơi Blackjack.`)
    .addFields(
      { name: "Bet", value: `${bet}`, inline: true },
      { name: "Result", value: outcome, inline: true },
      { name: "Profit/Loss", value: `${profit}`, inline: true },
      { name: "Wallet", value: `${balance}`, inline: true }
    )
    .setTimestamp();

  sendLog(client, LOG_CHANNELS.BLACKJACK, embed);
}

function logThreeCard(client, userId, bet, outcome, profit, balance) {
  const color = profit > 0 ? "Green" : profit < 0 ? "Red" : "Yellow";
  const embed = new EmbedBuilder()
    .setTitle("🎲 Ba Cào Result")
    .setColor(color)
    .setDescription(`<@${userId}> vừa chơi Ba Cào.`)
    .addFields(
      { name: "Bet", value: `${bet}`, inline: true },
      { name: "Result", value: outcome, inline: true },
      { name: "Profit/Loss", value: `${profit}`, inline: true },
      { name: "Wallet", value: `${balance}`, inline: true }
    )
    .setTimestamp();

  sendLog(client, LOG_CHANNELS.THREE_CARD, embed);
}

module.exports = { logDaily, logBlackjack, logThreeCard, LOG_CHANNELS };
