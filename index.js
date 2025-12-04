require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
}

// ====== GEMINI SETUP ======
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let geminiModel = null;

if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('✅ Gemini filter: ENABLED (gemini-2.5-flash)');
} else {
  console.warn('⚠️ Không có GEMINI_API_KEY → chỉ dùng lọc keyword.');
}

// ====== HÀM NORMALIZE ======
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ====== HARD KEYWORD (nặng, dùng để đếm & ban) ======
const rawHardBanned = [
  'đm', 'dm', 'dmm', 'đmm', 'đkm', 'dkm', 'đcm', 'dcm', 'đcmm', 'dcmm',
  'vkl', 'vcl', 'vl', 'vcc', 'vc',

  'vãi lồn', 'vãi lon', 'vãi cả lồn', 'vãi cứt', 'vãi l', 'vai lon',

  'cặc', 'cak', 'kak', 'kac', 'lồn', 'loz', 'lìn', 'buồi', 'buoi', 'dái', 'dai',

  'địt', 'dit', 'đụ', 'du me', 'dume', 'dit me', 'ditme', 'chịch', 'xoạc',

  'óc chó', 'oc cho', 'óc lợn', 'oc lon', 'con chó', 'chó đẻ', 'cho de',
  'chó má', 'ngu lồn', 'ngu lon', 'ngu vcl',

  'mẹ mày', 'me may', 'mịa', 'phò', 'pho`', 'cave', 'đĩ', 'di~', 'hãm l',

  'fuck', 'fck', 'bitch', 'shit', 'cock', 'dick', 'pussy', 'asshole',

  // racist / hate speech nên chặn cứng
  'nigga',
  'nigger',

  'clmm', 'ccmn', 'cmm', 'vcl',
];

// ====== SOFT KEYWORD (nghi ngờ, để gọi AI) ======
const rawSoftFlag = [
  'ngu', 'ngu quá', 'ngu thật',
  'đần', 'đần độn', 'khùng', 'điên',
  'mất dạy', 'vô học', 'cặn bã', 'rác rưởi',
  'vô dụng', 'vô tích sự',

  'thằng này', 'thằng kia', 'con này', 'con kia',
  'thằng ngu', 'con ngu',
  'đồ ngu', 'đồ điên', 'đồ rác', 'đồ khùng',
  'thằng chó', 'con chó',

  'mày', 'tụi mày', 'chúng mày', 'bọn mày',
  'tao nói thiệt', 'tao nói thật',

  'béo phì', 'béo vcl', 'béo vl',
  'thằng lùn', 'con lùn',
  'xấu vãi', 'xấu vcl', 'xấu như chó',

  'toxic', 'drama', 'cà khịa',
  'cay cú', 'cay nghiệt',

  'stupid', 'idiot', 'dumb',
  'you suck', 'loser', 'moron',
  'retard', 'retarded', 'cringe', 'lame',
];

// ====== MAP KEYWORD ======
const hardBanned = rawHardBanned.map((w) => normalize(w));
const hardBannedCompact = hardBanned.map((w) => w.replace(/\s+/g, ''));

const softFlag = rawSoftFlag.map((w) => normalize(w));
const softFlagCompact = softFlag.map((w) => w.replace(/\s+/g, ''));

function containsHardBanned(text) {
  const norm = normalize(text);
  const normNoSpace = norm.replace(/\s+/g, '');
  return (
    hardBanned.some((w) => norm.includes(w)) ||
    hardBannedCompact.some((w) => normNoSpace.includes(w))
  );
}

function containsSoftFlag(text) {
  const norm = normalize(text);
  const normNoSpace = norm.replace(/\s+/g, '');
  return (
    softFlag.some((w) => norm.includes(w)) ||
    softFlagCompact.some((w) => normNoSpace.includes(w))
  );
}

// ====== PHÂN TÍCH BỞI GEMINI ======
async function analyzeByGemini(content) {
  if (!geminiModel) return { level: 'ALLOW', reason: '' };
  if (content.length > 400) return { level: 'ALLOW', reason: '' };

  const prompt = `
Bạn là bộ lọc nội dung cho một server Discord của bạn bè.

Nhiệm vụ:
- Phân loại tin nhắn thành 3 mức:
  1) BLOCK_STRONG: chửi tục nặng, miệt thị nhóm yếu thế, hate speech, đe doạ nghiêm trọng.
  2) BLOCK_SOFT: xúc phạm nhẹ, nói chuyện thiếu tôn trọng nhưng không quá nghiêm trọng.
  3) ALLOW: trêu đùa nhẹ, góp ý hơi gắt, hoặc khi bạn không chắc.

Yêu cầu:
- TRẢ LỜI DUY NHẤT 1 DÒNG, dạng:
  LEVEL|LÝ_DO_NGẮN_GỌN
- LEVEL ∈ {BLOCK_STRONG, BLOCK_SOFT, ALLOW}
- LÝ_DO_NGẮN_GỌN tiếng Việt, tối đa ~15 từ.

Tin nhắn:
"""${content}"""
`.trim();

  try {
    const result = await geminiModel.generateContent(prompt);
    const raw = (await result.response.text()).trim();
    console.log('🤖 Gemini đánh giá (raw):', raw, '->', content);

    const upper = raw.toUpperCase();
    const [levelRaw] = upper.split('|');
    const level = levelRaw.trim();
    const reason = raw.split('|')[1]?.trim() || '';

    if (!['BLOCK_STRONG', 'BLOCK_SOFT', 'ALLOW'].includes(level)) {
      return { level: 'ALLOW', reason: '' };
    }
    return { level, reason };
  } catch (err) {
    console.error('Lỗi gọi Gemini:', err);
    return { level: 'ALLOW', reason: '' };
  }
}

// ====== DISCORD BOT ======
const allowedCommands = ['/vidu'];

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

// just in case nếu sau này cần
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== QUẢN LÝ VI PHẠM (HARD keyword → ban) ======
const userViolations = new Map(); // userId -> { count, lastAt }
const VIOLATION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 tiếng
const BAN_THRESHOLD = 20; // chửi bậy hard >= 20 lần trong 2h → auto ban

// Xử lý vi phạm (xoá + reply vui vui, và nếu HARD keyword thì đếm & có thể ban)
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

  const serverName = guild?.name || 'server';

  // 1) Đếm vi phạm (chỉ với HARD keyword)
  let count = 0;
  let remaining = null;
  let shouldBan = false;

  if (isHardKeyword) {
    const now = Date.now();
    const record = userViolations.get(userId) || { count: 0, lastAt: 0 };

    // nếu lần trước > 2h → reset
    if (record.lastAt && now - record.lastAt > VIOLATION_WINDOW_MS) {
      record.count = 0;
    }

    record.count += 1;
    record.lastAt = now;
    userViolations.set(userId, record);

    count = record.count;
    if (count >= BAN_THRESHOLD) {
      shouldBan = true;
      remaining = 0;
    } else {
      remaining = BAN_THRESHOLD - count;
    }

    console.log(
      `⚠️ HARD VIOLATION từ ${user.tag} (${sourceTag}) – count=${count}/${BAN_THRESHOLD}`
    );
  } else {
    console.log(
      `⚠️ SOFT/AI VIOLATION từ ${user.tag} (${sourceTag}) – không tính vào ban`
    );
  }

  // 2) Gửi message kiểu “mồm đi hơi xa”
  const reasonText = baseReason;

  let extraLine = '';
  if (isHardKeyword) {
    if (!shouldBan && remaining !== null) {
      extraLine = `\n👉 Thử mồm hư thêm **${remaining}** lần nữa đi, xem như nào 😏`;
    } else if (shouldBan) {
      extraLine = `\n👉 Mồm hư quá nhiều, tao chịu.`;
    }
  }

  try {
    const reply = await message.reply({
      content:
        `🚫 Mồm đi hơi xa rồi đó <@${userId}>.\n` +
        `> Lý do: ${reasonText}` +
        extraLine,
      allowedMentions: { repliedUser: false },
    });

    // auto xoá message cảnh báo sau 5s cho đỡ rác
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 5000);
  } catch (err) {
    console.error('Không gửi được reply cảnh báo:', err);
  }

  // 3) Xoá tin nhắn gốc
  try {
    await message.delete();
  } catch (err) {
    console.error('Không xoá được tin nhắn vi phạm:', err);
  }

  // 4) Nếu đạt ngưỡng BAN_THRESHOLD và là HARD keyword → ban
  if (
    isHardKeyword &&
    shouldBan &&
    guild &&
    guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)
  ) {
    try {
      await guild.members.ban(userId, {
        reason: `Auto-ban: mồm hư quá nhiều (${sourceTag}, ${count} lần trong 2h)`,
      });

      // thông báo 1 câu ngắn trong kênh
      try {
        await channel.send(
          `⛔ <@${userId}> đã bị auto-ban vì mồm đi hơi xa.`
        );
      } catch {
        // ignore
      }

      // clear record
      userViolations.delete(userId);
      console.log(`⛔ ĐÃ BAN ${user.tag} do vượt quá BAN_THRESHOLD.`);
    } catch (err) {
      console.error('Không ban được user (thiếu quyền?):', err);
    }
  } else if (isHardKeyword && shouldBan && guild) {
    console.warn(
      `⚠️ Bot không có quyền BanMembers nên không ban được ${user.tag}.`
    );
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
        // Sai form lệnh → xoá + reply, KHÔNG tính vào ban
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            'Lệnh không đúng form, hãy dùng đúng slash command được cho phép.',
          sourceTag: 'CMD_FORM',
        });
      }
      return;
    }

    // 2) HARD keyword → xoá + reply + đếm + có thể ban
    if (containsHardBanned(content)) {
      await handleViolation(message, {
        isHardKeyword: true,
        baseReason:
          'Sử dụng từ ngữ tục tĩu/nặng nằm trong danh sách cấm của server.',
        sourceTag: 'LIST_HARD',
      });
      return;
    }

    // 3) SOFT keyword → mới nhờ AI check (không tính vào ban)
    if (containsSoftFlag(content)) {
      const { level, reason } = await analyzeByGemini(content);

      if (level === 'ALLOW') return;

      if (level === 'BLOCK_STRONG') {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            reason ||
            'Nội dung độc hại/mang tính miệt thị hoặc xúc phạm nghiêm trọng.',
          sourceTag: 'AI_BLOCK_STRONG',
        });
        return;
      }

      if (level === 'BLOCK_SOFT') {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            reason || 'Nội dung có thể chưa phù hợp, vui lòng chú ý cách dùng từ.',
          sourceTag: 'AI_BLOCK_SOFT',
        });
        return;
      }

      return;
    }

    // 4) Không chứa hard / soft keyword → bỏ qua, không gọi AI
    return;
  } catch (err) {
    console.error('Lỗi chung trong messageCreate:', err);
  }
});

client.login(DISCORD_TOKEN);
