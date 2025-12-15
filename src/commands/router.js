// src/commands/router.js
const { checkChannel } = require("../utils/channelCheck");

// Blackjack Modules
const bj = require("./slash/blackjack");
const bjHelp = require("./slash/blackjack-help");
const bjStats = require("./slash/blackjack-stats");

// Ba Cào Modules
const bacay = require("./slash/bacay");
const bacayHelp = require("./slash/bacay-help");
const bacayStats = require("./slash/bacay-stats");
const bacayTop = require("./slash/bacay-top");

const wallet = require("./slash/wallet");

const COMMANDS = {
  blackjack: bj.start, // blackjack.js exports 'start' not 'run' based on previous read
  "blackjack-help": bjHelp.run,
  "blackjack-stats": bjStats.run,
  wallet: wallet.run,

  bacay: bacay.run,
  "bacay-help": bacayHelp.run,
  "bacay-stats": bacayStats.run,
  "bacay-top": bacayTop.run,
};

const GAME_COMMANDS = Object.keys(COMMANDS); // All these are game-related restricted commands

function onInteractionCreate(client) {
  return async (interaction) => {
    try {
      // SLASH COMMANDS
      if (interaction.isChatInputCommand()) {
        const cmdName = interaction.commandName;
        const handler = COMMANDS[cmdName];

        if (handler) {
          // Channel Restriction Check
          // Only restrict game commands? User said "dùng bot chơi mini game".
          // Assuming all current commands are game related.
          if (!(await checkChannel(interaction))) return;

          await handler(interaction);
        }
      }

      // BUTTONS
      if (interaction.isButton()) {
        const id = interaction.customId;

        // Blackjack Buttons
        if (id.startsWith("bj:")) {
          // NOTE: channel check for buttons?
          // Usually not needed if command started in right channel, but good for safety.
          // But buttons often ephemeral or modifying existing msg.
          // Let's rely on command restriction.
          await bj.onButton(interaction); // blackjack.js exports onButton NOT defaults
        }

        // Ba Cào Buttons
        if (id.startsWith("bacay:")) {
          await bacay.onButton(interaction);
        }
      }
    } catch (e) {
      console.error("Interaction Routing Error:", e);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ Lỗi hệ thống.",
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: "❌ Lỗi hệ thống.",
            ephemeral: true,
          });
        }
      } catch {}
    }
  };
}

module.exports = { onInteractionCreate };
