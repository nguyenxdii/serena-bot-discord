// index.js – chỉ lọc theo list, không dùng Gemini

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
}

// ====== CẤU HÌNH ======
const allowedCommands = ['/vidu']; // thêm lệnh hợp lệ nếu muốn
const WARNING_LIFETIME_MS = 5000;  // thời gian giữ message cảnh báo (ms)

// ====== HÀM NORMALIZE ======
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ====== LIST TỪ CẤM (HARD KEYWORD) ======
const rawBannedWords = [
  'đm', 'dm', 'dmm', 'đmm', 'đkm', 'dkm', 'đcm', 'dcm', 'đcmm', 'dcmm',
  'vkl', 'vcl', 'vl', 'vcc', 'vc',

  'vãi lồn', 'vãi lon', 'vãi cả lồn', 'vãi cứt', 'vãi l', 'vai lon',

  'cặc', 'cak', 'kak', 'kac', 'lồn', 'loz', 'lìn', 'buồi', 'buoi', 'dái', 'dai',

  'địt', 'dit', 'đụ', 'du me', 'dume', 'dit me', 'ditme', 'chịch', 'xoạc',

  'óc chó', 'oc cho', 'óc lợn', 'oc lon', 'con chó', 'chó đẻ', 'cho de',
  'chó má', 'ngu lồn', 'ngu lon', 'ngu vcl',

  'mẹ mày', 'me may', 'mịa', 'phò', 'pho`', 'cave', 'đĩ', 'di~', 'hãm l',

  'fuck', 'fck', 'bitch', 'shit', 'cock', 'dick', 'pussy', 'asshole',

  // racist / hate speech
  'nigga',
  'nigger',

  'clmm', 'ccmn', 'cmm', 'vcl',
];

const bannedWords = rawBannedWords.map((w) => normalize(w));
const bannedWordsCompact = bannedWords.map((w) => w.replace(/\s+/g, ''));

function containsBannedWord(text) {
  const norm = normalize(text);
  const normNoSpace = norm.replace(/\s+/g, '');
  return (
    bannedWords.some((w) => norm.includes(w)) ||
    bannedWordsCompact.some((w) => normNoSpace.includes(w))
  );
}

// ====== DISCORD BOT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);
});

// helper nếu cần sau này
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== QUẢN LÝ VI PHẠM & TIMEOUT ======
const userViolations = new Map(); // userId -> { count, lastAt }
const VIOLATION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 tiếng

// các mốc vi phạm → timeout tăng dần
const PENALTY_STEPS = [
  { threshold: 5,  durationMs: 3  * 60 * 1000 },   // 5 lần → 3 phút
  { threshold: 10, durationMs: 5  * 60 * 1000 },   // 10 lần → 5 phút
  { threshold: 15, durationMs: 10 * 60 * 1000 },   // 15 lần → 10 phút
  { threshold: 20, durationMs: 60 * 60 * 1000 },   // 20 lần → 1 giờ
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

// Xử lý vi phạm (xoá + cảnh báo + có thể timeout)
async function handleViolation(message, options) {
  const {
    isHardKeyword = false,
    baseReason = 'Nội dung không phù hợp với nội quy server.',
    sourceTag = 'UNKNOWN',
  } = options || {};

  const user = message.author;
  const guild = message.guild;
  const channel = message.channel;
  const userId = user.id;

  let count = 0;
  let remaining = null;
  let penaltyInfo = { timeoutMs: 0, currentStep: null, nextStep: null };

  // chỉ HARD keyword mới bị tính vào bộ đếm
  if (isHardKeyword) {
    const now = Date.now();
    const record = userViolations.get(userId) || { count: 0, lastAt: 0 };

    // nếu im hơn 2h → reset đếm
    if (record.lastAt && now - record.lastAt > VIOLATION_WINDOW_MS) {
      record.count = 0;
    }

    record.count += 1;
    record.lastAt = now;
    userViolations.set(userId, record);

    count = record.count;
    penaltyInfo = computePenalty(count);

    if (penaltyInfo.nextStep) {
      remaining = penaltyInfo.nextStep.threshold - count;
    } else {
      remaining = 0; // đã tới mốc cao nhất
    }

    console.log(
      `⚠️ HARD VIOLATION từ ${user.tag} (${sourceTag}) – count=${count}`
    );
  } else {
    console.log(
      `⚠️ SOFT VIOLATION từ ${user.tag} (${sourceTag}) – không tính vào bộ đếm`
    );
  }

  const reasonText = baseReason;
  let extraLine = '';

  if (isHardKeyword) {
    if (remaining > 0) {
      extraLine =
        `\n👉 Thử mồm hư thêm **${remaining}** lần nữa đi, xem như nào 😏`;
    } else if (penaltyInfo.currentStep) {
      extraLine =
        `\n👉 Mồm hư hơi nhiều rồi đó, hệ thống đang khoá chat nhẹ cho tỉnh người.`;
    }
  }

  // gửi cảnh báo trong kênh, auto xoá sau WARNING_LIFETIME_MS
  try {
    const reply = await message.reply({
      content:
        `🚫 Mồm đi hơi xa rồi đó <@${userId}>.\n` +
        `> Lý do: ${reasonText}` +
        extraLine,
      allowedMentions: { repliedUser: false },
    });

    setTimeout(() => {
      reply.delete().catch(() => {});
    }, WARNING_LIFETIME_MS);
  } catch (err) {
    console.error('Không gửi được reply cảnh báo:', err);
  }

  // xoá tin nhắn gốc
  try {
    await message.delete();
  } catch (err) {
    console.error('Không xoá được tin nhắn vi phạm:', err);
  }

  // HARD keyword → nếu đủ mốc thì timeout (khóa chat), KHÔNG BAN
  if (isHardKeyword && penaltyInfo.timeoutMs > 0) {
    const member = message.member;
    if (member && member.moderatable) {
      try {
        await member.timeout(
          penaltyInfo.timeoutMs,
          `Auto-timeout do chửi bậy nhiều lần (${sourceTag}, ${count} lần)`
        );

        const minutes = Math.round(penaltyInfo.timeoutMs / 60000);
        await channel.send(
          `⏱ <@${userId}> đã bị khoá chat **${minutes} phút** vì mồm đi hơi xa quá mức.`
        );
      } catch (err) {
        console.error('Không timeout được user:', err);
      }
    } else {
      console.warn(
        `⚠️ Không thể timeout ${user.tag} (có thể bot thiếu quyền hoặc user cao role hơn).`
      );
    }
  }
}

// ====== XỬ LÝ TIN NHẮN ======
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const content = message.content.trim();
    if (!content) return;

    // 1) Lệnh kiểu text bắt đầu bằng "/"
    if (content.startsWith('/')) {
      const firstWord = content.split(/\s+/)[0];
      if (!allowedCommands.includes(firstWord)) {
        // sai form lệnh → xoá + nhắc, nhưng không tính vào bộ đếm
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            'Lệnh không đúng form, hãy dùng đúng slash command được cho phép.',
          sourceTag: 'CMD_FORM',
        });
      }
      return;
    }

    // 2) HARD keyword → xoá + cảnh báo + đếm + có thể timeout
    if (containsBannedWord(content)) {
      await handleViolation(message, {
        isHardKeyword: true,
        baseReason:
          'Sử dụng từ ngữ tục tĩu/nặng nằm trong danh sách cấm của server.',
        sourceTag: 'LIST_HARD',
      });
      return;
    }

    // 3) Không nằm trong list → bỏ qua (không gọi API, không xoá)
    return;
  } catch (err) {
    console.error('Lỗi chung trong messageCreate:', err);
  }
});

client.login(DISCORD_TOKEN);
