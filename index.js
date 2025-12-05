// index.js – lọc theo list, KHÔNG dùng Gemini / API

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
const WARNING_LIFETIME_MS = 10_000; // cảnh báo giữ 10s rồi xóa

// ID kênh 🎶︱music-request (chỉ cho dùng lệnh Rythm)
const MUSIC_REQUEST_CHANNEL_ID = '1389843995135315979';
// ID kênh 📢︱chung 
// const GENERAL_CHAT_CHANNEL_ID = '1389842864594227270';


// ====== HÀM NORMALIZE ======
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ====== LIST TỪ CẤM (HARD KEYWORD) ======
// Sau này bạn muốn chia 3 lớp thì chỉ cần tách list này ra thành nhiều list nhỏ.
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

  'nigga', 'nigger',

  'clmm', 'ccmn', 'cmm',
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
const VIOLATION_WINDOW_MS = 60 * 60 * 1000; // 1 tiếng không chửi thì reset đếm

// các mốc vi phạm → timeout tăng dần
const PENALTY_STEPS = [
  { threshold: 5,  durationMs: 3  * 60 * 1000 },  // 5 lần → 3 phút
  { threshold: 10, durationMs: 5  * 60 * 1000 },  // 10 lần → 5 phút
  { threshold: 15, durationMs: 10 * 60 * 1000 },  // 15 lần → 10 phút
  // cần thêm mốc nữa thì add vào đây
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

    // nếu im hơn 1h → reset đếm
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
        `\n👉 Còn **${remaining}** lần nữa là bị khóa mõm thiệt đó 😼`;
    } else if (penaltyInfo.currentStep) {
      extraLine =
        `\n👉 Mồm hư hơi nhiều rồi đó, tao đang **khóa mõm** nhẹ cho tỉnh người.`;
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
        // Thông báo này KHÔNG auto delete, để mọi người thấy rõ bị khóa mõm
        await channel.send(
          `🔇 <@${userId}> tạm thời "câm nín" **${minutes} phút**. Suy nghĩ về cuộc đời đi 😎`
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
    // Cho phép Rythm, nhưng chặn bot khác trong kênh music-request
    const RYTHM_BOT_ID = '235088799074484224';
    const GENERAL_CHANNEL_ID = '1389842864594227270'; // 💬︱chung

    if (message.author.bot) {
      // Nếu ở kênh music-request
      if (message.channel.id === MUSIC_REQUEST_CHANNEL_ID) {

        // Nếu bot này không phải Rythm → xoá
        if (message.author.id !== RYTHM_BOT_ID) {
          message.delete().catch(() => {});
        }

        return; // bot không xử lý gì thêm
      }

      return; // bot ở kênh khác thì bỏ qua
    }

    const content = message.content.trim();
    if (!content) return;

    // ==== LUẬT CHO CHANNEL 🎶︱music-request ====
    if (message.channel.id === MUSIC_REQUEST_CHANNEL_ID) {
      // 1) Cấm chat thường → chỉ cho lệnh slash command
      if (!content.startsWith('/')) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            `Kênh này chỉ dùng lệnh nhạc thôi bạn êi 🎧\n` +
            `Muốn tám thì qua kênh <#${GENERAL_CHANNEL_ID}> mà sủa nha 💬`,
          sourceTag: 'CHANNEL_RULE',
        });
        return;
      }

      // 2) Chỉ cho phép lệnh của Rythm
      const allowedRythmCommands = [
        '/play',
        '/stop',
        '/pause',
        '/resume',
        '/skip',
        '/queue',
        '/nowplaying',
      ];

      const firstWord = content.split(/\s+/)[0];

      if (!allowedRythmCommands.includes(firstWord)) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            `Kênh này chỉ nhận lệnh của **Rythm** thôi nha 🎶\n` +
            `Chat thường thì qua <#${GENERAL_CHANNEL_ID}> giùm cái 💬`,
          sourceTag: 'RYTHM_ONLY',
        });
        return;
      }

      // 3) Vẫn lọc chửi bậy trong kênh nhạc
      if (containsBannedWord(content)) {
        await handleViolation(message, {
          isHardKeyword: true,
          baseReason:
            'Sử dụng từ ngữ tục tĩu/nặng nằm trong danh sách cấm của server.',
          sourceTag: 'LIST_HARD_MUSIC',
        });
        return;
      }

      // Lệnh Rythm hợp lệ → cho qua, không xử lý tiếp
      return;
    }

    // ====== LOGIC CHUNG CHO CÁC KÊNH KHÁC ======

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

    // 3) Không nằm trong list → bỏ qua (không xoá, không gọi API)
    return;
  } catch (err) {
    console.error('Lỗi chung trong messageCreate:', err);
  }
});

client.login(DISCORD_TOKEN);
