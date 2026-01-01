// src/utils/webhook.service.js
const { WebhookClient } = require("discord.js");
const { WEBHOOK_BLACKJACK, WEBHOOK_WORDCHAIN } = require("../config/env");

// Initialize webhook clients
const webhookClients = {
  blackjack: WEBHOOK_BLACKJACK
    ? new WebhookClient({ url: WEBHOOK_BLACKJACK })
    : null,
  wordchain: WEBHOOK_WORDCHAIN
    ? new WebhookClient({ url: WEBHOOK_WORDCHAIN })
    : null,
};

/**
 * Send message via webhook
 * @param {string} type - 'blackjack' or 'wordchain'
 * @param {object} options - Message options
 * @param {string} options.content - Message content
 * @param {Array} options.embeds - Optional embeds
 * @param {string} options.username - Optional custom username
 * @param {string} options.avatarURL - Optional custom avatar
 * @returns {Promise<Message|null>}
 */
async function sendWebhook(type, options) {
  const client = webhookClients[type];

  if (!client) {
    console.warn(`⚠️ Webhook ${type} not configured, skipping webhook send`);
    return null;
  }

  try {
    const message = await client.send(options);
    console.log(
      `📤 Webhook ${type} sent: ${
        options.content?.substring(0, 50) || "[embed]"
      }`
    );
    return message;
  } catch (error) {
    console.error(`❌ Webhook ${type} error:`, error.message);
    throw error;
  }
}

/**
 * Check if webhook is available
 * @param {string} type - 'blackjack' or 'wordchain'
 * @returns {boolean}
 */
function isWebhookAvailable(type) {
  return webhookClients[type] !== null;
}

module.exports = {
  sendWebhook,
  isWebhookAvailable,
};
