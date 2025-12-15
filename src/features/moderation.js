// src/features/moderation.js
const { PermissionsBitField } = require("discord.js");
const { rawBannedWords } = require("../data/bannedWords");
const { triggers } = require("../data/triggers");

const allowedCommands = ["/vidu"];
const WARNING_LIFETIME_MS = 10_000;

const OWNER_ID = "875358286487097395";

const MUSIC_REQUEST_CHANNEL_ID = "1389843995135315979";
const GENERAL_CHANNEL_ID = "1389842864594227270";

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const processedBannedWords = rawBannedWords.map((raw) => {
  const norm = normalize(raw).trim();
  const compact = norm.replace(/\s+/g, "");
  const isPhrase = norm.includes(" ");
  const isShortToken = !isPhrase && norm.length <= 3;
  return { raw, norm, compact, isPhrase, isShortToken };
});

function containsBannedWord(text) {
  const norm = normalize(text);
  const normNoSpace = norm.replace(/\s+/g, "");

  for (const bw of processedBannedWords) {
    if (bw.isPhrase) {
      if (norm.includes(bw.norm)) return true;
      if (normNoSpace.includes(bw.compact)) return true;
      continue;
    }

    if (bw.isShortToken) {
      const pattern = `\\b${escapeRegex(bw.norm)}\\b`;
      const re = new RegExp(pattern, "i");
      if (re.test(norm)) return true;
      continue;
    }

    if (norm.includes(bw.norm)) return true;
    if (normNoSpace.includes(bw.compact)) return true;
  }

  return false;
}

function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== VI PHẠM & TIMEOUT ======
const userViolations = new Map();
const VIOLATION_WINDOW_MS = 60 * 60 * 1000;

const PENALTY_STEPS = [
  { threshold: 5, durationMs: 3 * 60 * 1000 },
  { threshold: 10, durationMs: 5 * 60 * 1000 },
  { threshold: 15, durationMs: 10 * 60 * 1000 },
];

function computePenalty(count) {
  let currentStep = null;
  for (const step of PENALTY_STEPS) {
    if (count >= step.threshold) currentStep = step;
  }
  const nextStep = PENALTY_STEPS.find((s) => s.threshold > count) || null;
  return {
    timeoutMs: currentStep ? currentStep.durationMs : 0,
    currentStep,
    nextStep,
  };
}

async function handleViolation(message, options) {
  const {
    isHardKeyword = false,
    baseReason = "Một số từ bạn dùng hơi “mạnh” quá so với nội quy server 😅",
    sourceTag = "UNKNOWN",
  } = options || {};

  const user = message.author;
  const channel = message.channel;
  const userId = user.id;

  if (userId === OWNER_ID) return;

  let count = 0;
  let remaining = null;
  let penaltyInfo = { timeoutMs: 0, currentStep: null, nextStep: null };

  if (isHardKeyword) {
    const now = Date.now();
    const record = userViolations.get(userId) || { count: 0, lastAt: 0 };

    if (record.lastAt && now - record.lastAt > VIOLATION_WINDOW_MS) {
      record.count = 0;
    }

    record.count += 1;
    record.lastAt = now;
    userViolations.set(userId, record);

    count = record.count;
    penaltyInfo = computePenalty(count);
    remaining = penaltyInfo.nextStep
      ? penaltyInfo.nextStep.threshold - count
      : 0;

    console.log(
      `⚠️ HARD VIOLATION ${user.tag} (${sourceTag}) – count=${count}`
    );
  }

  try {
    await message.delete();
  } catch {}

  try {
    const extra =
      isHardKeyword && remaining > 0
        ? `\n👉 Còn **${remaining}** lần nữa là dính mute đó, nhẹ tay xíu nha.`
        : isHardKeyword && penaltyInfo.currentStep
        ? `\n👉 Nghỉ chat nhẹ một lúc cho hạ nhiệt.`
        : "";

    const content = isHardKeyword
      ? `🚫 Ê, đi hơi xa rồi đó <@${userId}>.\n> Lý do: ${baseReason}${extra}`
      : baseReason;

    const warn = await channel.send({
      content,
      allowedMentions: isHardKeyword ? { users: [userId] } : undefined,
    });

    setTimeout(() => warn.delete().catch(() => {}), WARNING_LIFETIME_MS);
  } catch {}

  if (isHardKeyword && penaltyInfo.timeoutMs > 0) {
    const member = message.member;
    if (member && member.moderatable) {
      try {
        await member.timeout(
          penaltyInfo.timeoutMs,
          `Auto-timeout: từ ngữ nặng (${sourceTag}, ${count} lần)`
        );
        const minutes = Math.round(penaltyInfo.timeoutMs / 60000);
        await channel.send(`🔇 <@${userId}> bị mute **${minutes} phút**.`);
      } catch {}
    }
  }
}

function onMessageCreate(client) {
  return async (message) => {
    try {
      const RYTHM_BOT_ID = "235088799074484224";
      if (!message.guild) return;

      // bot message
      if (message.author.bot) {
        if (message.channel.id === MUSIC_REQUEST_CHANNEL_ID) {
          if (
            message.author.id !== RYTHM_BOT_ID &&
            message.author.id !== client.user.id
          ) {
            message.delete().catch(() => {});
          }
        }
        return;
      }

      const content = message.content.trim();
      if (!content) return;

      const { DAILY_CHANNEL_ID } = require("../utils/channelCheck");

      // ... (existing music request logic) ...

      // Kênh điểm danh: Cấm chat, chỉ cho Bot hoạt động (Bot replies handled elsewhere, user messages blocked)
      if (message.channel.id === DAILY_CHANNEL_ID) {
        // Allow bot messages (interaction replies)
        // Block user messages
        try {
          await message.delete();
          const warn = await message.channel.send(
            `<@${message.author.id}> 🤫 Kênh này chỉ dùng để nhập lệnh \`/daily\` thôi nhé!`
          );
          setTimeout(() => warn.delete().catch(() => {}), 5000);
        } catch (e) {}
        return;
      }

      // trigger !

      // trigger !
      if (content.startsWith("!")) {
        const firstWord = content.split(/\s+/)[0].toLowerCase();
        const trigger = triggers[firstWord];
        if (trigger) {
          const replyText =
            typeof trigger === "function"
              ? trigger(message.author.id)
              : String(trigger);
          await message.reply(replyText);
          return;
        }
      }

      // slash kiểu text
      if (content.startsWith("/")) {
        const firstWord = content.split(/\s+/)[0];
        if (!allowedCommands.includes(firstWord)) {
          await handleViolation(message, {
            isHardKeyword: false,
            baseReason: "Lệnh này không nằm trong danh sách hỗ trợ ở server.",
            sourceTag: "CMD_FORM",
          });
        }
        return;
      }

      // HARD keyword
      if (containsBannedWord(content)) {
        await handleViolation(message, {
          isHardKeyword: true,
          baseReason:
            "Một số từ trong tin nhắn hơi quá đà, đang nằm trong danh sách hạn chế.",
          sourceTag: "LIST_HARD",
        });
      }
    } catch (err) {
      console.error("Lỗi messageCreate:", err);
    }
  };
}

module.exports = { onMessageCreate, isModerator };
