const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { addBalance } = require("../../features/wallet");
const { logTransaction } = require("../../features/transactionLog");
const { fmt } = require("../../games/three-card/ui");

const addSlash = new SlashCommandBuilder()
  .setName("admin-addcoin")
  .setDescription("Cộng tiền cho user (Admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((o) =>
    o.setName("user").setDescription("User").setRequired(true)
  )
  .addIntegerOption((o) =>
    o
      .setName("amount")
      .setDescription("Số tiền")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((o) =>
    o.setName("reason").setDescription("Lý do").setRequired(true)
  );

const removeSlash = new SlashCommandBuilder()
  .setName("admin-removecoin")
  .setDescription("Trừ tiền của user (Admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((o) =>
    o.setName("user").setDescription("User").setRequired(true)
  )
  .addIntegerOption((o) =>
    o
      .setName("amount")
      .setDescription("Số tiền")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((o) =>
    o.setName("reason").setDescription("Lý do").setRequired(true)
  );

async function runAdd(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
    return;
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const reason = interaction.options.getString("reason");
  const guildId = interaction.guildId;

  const newBal = await addBalance(guildId, user.id, amount, true);

  await logTransaction({
    type: "ADMIN_ADD",
    guildId,
    userId: user.id,
    amount,
    reason,
    meta: { adminId: interaction.user.id },
  });

  await interaction.editReply(
    `✅ Đã cộng **${fmt(amount)}** coin cho <@${
      user.id
    }>.\nBalance mới: **${fmt(newBal)}**\nLý do: ${reason}`
  );
}

async function runRemove(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
    return;
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const reason = interaction.options.getString("reason");
  const guildId = interaction.guildId;

  // Check balance? addBalance handles negative, but allows going into negative?
  // wallet.js addBalance logic: $inc. It CAN go negative. But user said "Không cho âm (trừ khi admin cho phép)".
  // I should check generic "ensure positive" logic?
  // User: "Không cho âm (trừ khi admin cho phép)".
  // For now I'll check balance -> if < amount -> error.

  const { getBalance } = require("../../features/wallet");
  const current = await getBalance(guildId, user.id, true);
  if (current < amount) {
    return interaction.editReply(
      `❌ User chỉ có **${fmt(current)}**. Không đủ để trừ **${fmt(amount)}**.`
    );
  }

  const newBal = await addBalance(guildId, user.id, -amount, true);

  await logTransaction({
    type: "ADMIN_REMOVE",
    guildId,
    userId: user.id,
    amount: -amount, // stored as change
    reason,
    meta: { adminId: interaction.user.id },
  });

  await interaction.editReply(
    `✅ Đã trừ **${fmt(amount)}** coin của <@${user.id}>.\nBalance mới: **${fmt(
      newBal
    )}**\nLý do: ${reason}`
  );
}

module.exports = {
  addSlash,
  runAdd,
  removeSlash,
  runRemove,
};
