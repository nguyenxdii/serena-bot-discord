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

// ====== HARD KEYWORD (nặng, xoá + timeout theo ngưỡng) ======
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

// ====== SOFT KEYWORD (nghi ngờ, mới nhờ AI check) ======
const rawSoftFlag = [
  // chung chung xúc phạm vừa
  'ngu', 'ngu quá', 'ngu thật',
  'đần', 'đần độn', 'khùng', 'điên',
  'mất dạy', 'vô học', 'cặn bã', 'rác rưởi',
  'vô dụng', 'vô tích sự',

  // gọi hạ thấp
  'thằng này', 'thằng kia', 'con này', 'con kia',
  'thằng ngu', 'con ngu',
  'đồ ngu', 'đồ điên', 'đồ rác', 'đồ khùng',
  'thằng chó', 'con chó',

  // đại từ dễ toxic (để AI phán, không auto ban)
  'mày', 'tụi mày', 'chúng mày', 'bọn mày',
  'tao nói thiệt', 'tao nói thật',

  // body shaming
  'béo phì', 'béo vcl', 'béo vl',
  'thằng lùn', 'con lùn',
  'xấu vãi', 'xấu vcl', 'xấu như chó',

  // drama / toxic nhẹ
  'toxic', 'drama', 'cà khịa',
  'cay cú', 'cay nghiệt',

  // English mild insults
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

// ====== PHÂN TÍCH BỞI GEMINI: ALLOW / BLOCK_SOFT / BLOCK_STRONG ======
async function analyzeByGemini(content) {
  if (!geminiModel) return { level: 'ALLOW', reason: '' };
  if (content.length > 400) return { level: 'ALLOW', reason: '' };

  const prompt = `
Bạn là bộ lọc nội dung cho một server Discord bạn bè.

Nhiệm vụ:
- Phân loại tin nhắn thành 3 mức:
  1) BLOCK_STRONG:
     - Chửi tục thô bạo, lôi bố mẹ ra chửi, xúc phạm danh dự nghiêm trọng
     - Nội dung tình dục bẩn thỉu, quấy rối tình dục nặng
     - Đe doạ bạo lực, cổ vũ tự sát, hành vi cực kỳ nguy hiểm
     - PHÂN BIỆT ĐỐI XỬ / HATE SPEECH:
       • Từ ngữ miệt thị chủng tộc, màu da, dân tộc, quốc tịch
       • Miệt thị tôn giáo, giới tính, xu hướng tính dục, khuyết tật
       • Gọi người khác bằng các từ xúc phạm nặng dựa trên các đặc điểm trên
     → Các trường hợp này phải coi là BLOCK_STRONG.

  2) BLOCK_SOFT:
     - Lời nói thiếu tôn trọng, mỉa mai, xúc phạm nhưng không quá nghiêm trọng
     - Drama, toxic vừa phải, chửi nhẹ, bóng gió nhưng không đến mức cực kỳ độc hại
     → Những cái này có thể xoá tin nhắn nhưng không cần timeout.

  3) ALLOW:
     - Trêu đùa nhẹ nhàng giữa bạn bè, không hạ nhục nghiêm trọng
     - Than phiền, cằn nhằn, nói hơi gắt nhưng không đi quá giới hạn
     - Khi bạn không chắc chắn → HÃY CHỌN ALLOW.

Yêu cầu:
- TRẢ LỜI DUY NHẤT MỘT DÒNG, dạng:
  LEVEL|LÝ_DO_NGẮN_GỌN
- LEVEL chỉ có thể là một trong: BLOCK_STRONG, BLOCK_SOFT, ALLOW
- LÝ_DO_NGẮN_GỌN viết tiếng Việt, tối đa 15 từ.

Ví dụ:
BLOCK_STRONG|Miệt thị chủng tộc nặng
BLOCK_SOFT|Chửi nhẹ, có thể hơi xúc phạm
ALLOW|Chỉ trêu đùa nhẹ

Tin nhắn người dùng:
"""${content}"""
`.trim();

  try {
    const result = await geminiModel.generateContent(prompt);
    const raw = (await result.response.text()).trim();
    console.log('🤖 Gemini đánh giá (raw):', raw, '->', content);

    const upper = raw.toUpperCase();
    const [levelRaw] = upper.split('|');
    const level = levelRaw.trim();
    const reason = raw.split('|')[1]?.trim() || ''; // reason bản gốc giữ dấu

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

// helper: kiểm tra user có quyền mod không (để sau này nếu cần)
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== QUẢN LÝ VI PHẠM & TIMEOUT (chỉ với HARD keyword) ======
const userViolations = new Map(); // userId -> { warnings, lastAt }
const VIOLATION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 tiếng

// 4 mốc: 5, 10, 15, 20
const PENALTY_STEPS = [
  { threshold: 5, durationMs: 3 * 60 * 1000 },      // 3p
  { threshold: 10, durationMs: 5 * 60 * 1000 },     // 5p
  { threshold: 15, durationMs: 10 * 60 * 1000 },    // 10p
  { threshold: 20, durationMs: 60 * 60 * 1000 },    // 1h
];

function computePenalty(warnings) {
  let currentStep = null;
  for (const step of PENALTY_STEPS) {
    if (warnings >= step.threshold) {
      currentStep = step;
    }
  }
  const nextStep = PENALTY_STEPS.find((s) => s.threshold > warnings) || null;
  return {
    timeoutMs: currentStep ? currentStep.durationMs : 0,
    currentStep,
    nextStep,
  };
}

// Xử lý vi phạm (xoá, DM, timeout nếu là HARD keyword)
async function handleViolation(message, severity, baseReason, sourceTag) {
  const user = message.author;
  const guild = message.guild;
  const member = message.member;
  const userId = user.id;

  const serverName = guild?.name || 'server';

  // chỉ HARD keyword mới tăng cảnh báo + timeout
  const isHardKeyword = severity === 'STRONG' && sourceTag === 'LIST_HARD';

  let warnings = 0;
  let penaltyInfo = { timeoutMs: 0, currentStep: null, nextStep: null };

  if (isHardKeyword) {
    const now = Date.now();
    const record = userViolations.get(userId) || { warnings: 0, lastAt: 0 };

    // reset nếu im > 2h
    if (record.lastAt && now - record.lastAt > VIOLATION_WINDOW_MS) {
      record.warnings = 0;
    }

    record.warnings += 1;
    record.lastAt = now;
    userViolations.set(userId, record);

    warnings = record.warnings;
    penaltyInfo = computePenalty(warnings);
  }

  // 1) Xoá tin nhắn
  try {
    await message.delete();
  } catch (err) {
    console.error('Không xoá được tin nhắn vi phạm:', err);
  }

  // 2) Soạn lý do + cảnh báo
  const reasonText =
    baseReason ||
    (severity === 'STRONG'
      ? 'Nội dung bị đánh giá là xúc phạm/độc hại.'
      : 'Nội dung có thể chưa phù hợp với nội quy server.');

  let extraWarningText = '';

  if (isHardKeyword) {
    const { nextStep } = penaltyInfo;

    if (warnings < PENALTY_STEPS[0].threshold) {
      const remaining = PENALTY_STEPS[0].threshold - warnings;
      extraWarningText =
        `\n\n⚠️ Cảnh báo: Bạn đã vi phạm **${warnings}** lần (trong khoảng thời gian gần đây).` +
        ` Nếu còn vi phạm thêm **${remaining}** lần nữa, bạn sẽ bị hệ thống khoá chat tạm thời.`;
    } else if (nextStep) {
      const remaining = nextStep.threshold - warnings;
      extraWarningText =
        `\n\n⚠️ Bạn đã vi phạm **${warnings}** lần. Nếu tiếp tục vi phạm thêm **${remaining}** lần nữa, ` +
        `hình thức xử lý sẽ bị nâng nặng hơn.`;
    } else {
      extraWarningText =
        `\n\n⚠️ Bạn đã vi phạm rất nhiều lần trong khoảng thời gian gần đây. ` +
        `Nếu tiếp tục, bạn có thể bị xử lý nặng hơn (kick/ban khỏi server).`;
    }
  }

  // 3) DM cho user
  try {
    await user.send(
      `🚫 Tin nhắn của bạn trong server **${serverName}** đã bị xoá.\n` +
      `> Nội dung: "${message.content}"\n` +
      `> Lý do: ${reasonText}` +
      (severity === 'STRONG'
        ? `\n\nVui lòng chú ý cách dùng từ khi chat trong server.`
        : '') +
      extraWarningText
    );
  } catch (err) {
    console.error('Không DM được cho user (có thể họ tắt DM):', err);
  }

  // Nếu không phải HARD keyword → không timeout, chỉ log
  if (!isHardKeyword) {
    console.log(
      `⚠️ Vi phạm mức ${severity} từ ${user.tag} (${sourceTag}): ${message.content}`
    );
    return;
  }

  // 4) HARD keyword → nếu đủ ngưỡng thì timeout
  const { timeoutMs } = penaltyInfo;

  if (timeoutMs > 0 && member && member.moderatable) {
    try {
      await member.timeout(
        timeoutMs,
        `Vi phạm nội quy (${sourceTag}): ${reasonText}`
      );
      console.log(
        `⏱ Đã timeout ${user.tag} trong ${Math.round(
          timeoutMs / 60000
        )} phút (tổng vi phạm keyword: ${warnings}).`
      );

      // thông báo nhẹ trong channel
      try {
        await message.channel.send(
          `🚫 <@${user.id}> đã bị tạm khoá chat do vi phạm nội quy nhiều lần.`
        );
      } catch (err) {
        // ignore
      }
    } catch (err) {
      console.error('Không timeout được member (thiếu quyền?):', err);
    }
  } else if (!member || !member.moderatable) {
    console.warn(
      `⚠️ Không thể timeout ${user.tag} (có thể bot thiếu quyền hoặc user cao role hơn).`
    );
  } else {
    console.log(
      `⚠️ Vi phạm HARD keyword từ ${user.tag} (chưa đủ ngưỡng timeout). Tổng vi phạm: ${warnings}`
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
        // Sai form lệnh → xoá + DM, KHÔNG tính cảnh báo keyword
        await handleViolation(
          message,
          'SOFT',
          'Lệnh không đúng form, vui lòng chỉ dùng các lệnh hợp lệ trong server.',
          'CMD_FORM'
        );
      }
      return;
    }

    // 2) HARD keyword → xoá + DM + tính cảnh báo + timeout theo ngưỡng
    if (containsHardBanned(content)) {
      await handleViolation(
        message,
        'STRONG',
        'Sử dụng từ ngữ tục tĩu/nặng nằm trong danh sách cấm của server.',
        'LIST_HARD'
      );
      return;
    }

    // 3) SOFT keyword → nhờ AI phân loại (chỉ xoá + DM, không tính cảnh báo)
    if (containsSoftFlag(content)) {
      const { level, reason } = await analyzeByGemini(content);

      if (level === 'ALLOW') return;

      if (level === 'BLOCK_STRONG') {
        await handleViolation(
          message,
          'STRONG',
          reason || 'Nội dung độc hại/mang tính miệt thị hoặc xúc phạm nghiêm trọng.',
          'AI_BLOCK_STRONG'
        );
        return;
      }

      if (level === 'BLOCK_SOFT') {
        await handleViolation(
          message,
          'SOFT',
          reason || 'Nội dung có thể chưa phù hợp, vui lòng chú ý cách dùng từ.',
          'AI_BLOCK_SOFT'
        );
        return;
      }

      return;
    }

    // 4) Không chứa hard / soft keyword → bỏ qua, không gọi AI (tiết kiệm API)
    return;
  } catch (err) {
    console.error('Lỗi chung trong messageCreate:', err);
  }
});

client.login(DISCORD_TOKEN);
