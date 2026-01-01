// src/features/wordchain-simple/embedBuilder.js
const { EmbedBuilder } = require("discord.js");

/**
 * Create leaderboard embed
 * @param {Array<{id: string, username: string, wins: number}>} leaderboard
 * @param {string} currentWord - Current word in the game
 * @returns {EmbedBuilder}
 */
function createLeaderboardEmbed(leaderboard, currentWord = "quý mến") {
  const embed = new EmbedBuilder()
    .setTitle("🏆 Bảng xếp hạng")
    .setColor("Gold");

  let description = "";

  if (leaderboard.length === 0) {
    description = "Chưa có ai thắng! Hãy là người đầu tiên! 🎯";
  } else {
    leaderboard.slice(0, 5).forEach((user, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;
      description += `${medal} **${user.username}** — 🏆 ${user.wins} lần thắng\n`;
    });
  }

  embed.setDescription(description);
  embed.setFooter({ text: `💡 Từ hiện tại là: ${currentWord}` });

  return embed;
}

/**
 * Create win announcement embed
 * @param {string} username
 * @param {number} totalWins
 * @returns {EmbedBuilder}
 */
function createWinEmbed(username, totalWins) {
  const embed = new EmbedBuilder()
    .setTitle("🎉 Chiến thắng!")
    .setDescription(`**${username}** thắng! (tổng: **${totalWins}** lần thắng)`)
    .setColor("Green")
    .setFooter({ text: "Cố gắng giành nhiều chiến thắng hơn nhé!" });

  return embed;
}

/**
 * Create session scoreboard embed (who played in THIS game)
 * @param {Array<{userId: string, username: string, correctWords: number}>} scoreboard
 * @param {string} winner - Winner's username
 * @returns {EmbedBuilder}
 */
function createSessionScoreboardEmbed(scoreboard, winner) {
  const embed = new EmbedBuilder()
    .setTitle("🏁 Bảng xếp hạng ván này")
    .setColor("Blue");

  let description = `🏆 **${winner}** thắng!\n\n`;

  if (scoreboard.length > 0) {
    scoreboard.forEach((user, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;
      description += `${medal} **${user.username}** — 🏆 ${user.correctWords} từ đúng\n`;
    });
  }

  description += "\n_Cố gắng giành nhiều chiến thắng hơn nhé!_";

  embed.setDescription(description);
  return embed;
}

module.exports = {
  createLeaderboardEmbed,
  createWinEmbed,
  createSessionScoreboardEmbed,
};
