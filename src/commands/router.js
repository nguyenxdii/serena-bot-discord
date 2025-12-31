// src/commands/router.js
const { checkChannel } = require("../utils/channelCheck");
const { MessageFlags } = require("discord.js");

// Blackjack Modules
const bj = require("./slash/blackjack");
const bjHelp = require("./slash/blackjack-help");
const bjStats = require("./slash/blackjack-stats");

const wallet = require("./slash/wallet");
const daily = require("./slash/daily");
const tip = require("./slash/tip");
const pay = require("./slash/pay");

const wordchain = require("./slash/wordchain");
const wordchainHelp = require("./slash/wordchain-help");
const wordchainSimple = require("./slash/wordchain-simple");

// Admin Modules
const adminEco = require("./slash/admin-economy");
const adminUser = require("./slash/admin-user");
const adminHist = require("./slash/admin-history");
const adminMoney = require("./slash/admin-money");

const COMMANDS = {
  blackjack: bj.start,
  "blackjack-help": bjHelp.run,
  "blackjack-stats": bjStats.run,
  wallet: wallet.run,
  daily: daily.run,
  tip: tip.run,
  pay: pay.run,
  wordchain: wordchain.run,
  "wordchain-help": wordchainHelp.run,
  start: wordchainSimple.run,

  "admin-economy": adminEco.run,
  "admin-user": adminUser.run,
  "admin-history": adminHist.run,
  "admin-addcoin": adminMoney.runAdd,
  "admin-removecoin": adminMoney.runRemove,
};

const GAME_COMMANDS = Object.keys(COMMANDS);

function onInteractionCreate(client) {
  return async (interaction) => {
    try {
      // SLASH COMMANDS
      if (interaction.isChatInputCommand()) {
        const cmdName = interaction.commandName;
        const handler = COMMANDS[cmdName];

        if (handler) {
          if (!(await checkChannel(interaction))) return;
          await handler(interaction);
        }
      }

      // BUTTONS
      if (interaction.isButton()) {
        const id = interaction.customId;

        if (id.startsWith("bj:")) {
          await bj.onButton(interaction);
        }

        if (id.startsWith("wc:")) {
          await wordchain.onInteraction(interaction);
        }
      }

      // MODALS
      if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if (id.startsWith("wc:")) {
          await wordchain.onInteraction(interaction);
        }
      }
    } catch (e) {
      console.error("Interaction Routing Error:", e);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ Lỗi hệ thống.",
            title: "Error",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: "❌ Lỗi hệ thống.",
            title: "Error",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch {}
    }
  };
}

module.exports = { onInteractionCreate };
