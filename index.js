require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
}

// ====== GEMINI SETUP (OPTIONAL) ======
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let geminiModel = null;

if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('✅ Gemini filter: ENABLED (gemini-2.5-flash)');
} else {
  console.warn('⚠️ Không có GEMINI_API_KEY → chỉ dùng lọc keyword.');
}

// ----- HÀM NORMALIZE ĐỂ DÙNG CHUNG -----
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ====== LIST TỪ GỐC ======
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

  'clmm', 'ccmn', 'cmm', 'vcl'
];

// ====== LIST SAU KHI BỎ DẤU + LOWERCASE ======
const bannedWords = rawBannedWords.map((w) => normalize(w));
// Bản “dính liền không dấu cách” để bắt kiểu: conmemayngunhucho
const bannedWordsCompact = bannedWords.map((w) => w.replace(/\s+/g, ''));

// Kiểm tra nội dung có chứa từ bậy trong list
function containsBannedWord(text) {
  const norm = normalize(text);                // giữ nguyên khoảng trắng
  const normNoSpace = norm.replace(/\s+/g, ''); // bỏ hết khoảng trắng

  // match bình thường + match khi user viết liền không cách
  return (
    bannedWords.some((w) => norm.includes(w)) ||
    bannedWordsCompact.some((w) => normNoSpace.includes(w))
  );
}

// ====== CHECK THÊM BẰNG GEMINI (NHẸ NHÀNG) ======
async function shouldBlockByGemini(content) {
  if (!geminiModel) return false;
  if (content.length > 300) return false;

  const prompt = `
Bạn là bộ lọc nội dung nhẹ nhàng cho một server Discord bạn bè.
Nhiệm vụ của bạn là CHỈ phát hiện những tin nhắn thực sự tục tĩu, xúc phạm nặng,
dùng lời lẽ thô tục về tình dục, lôi bố mẹ ra chửi, miệt thị nặng, phân biệt chủng tộc, giới tính, tôn giáo,...

Đừng quá khắt khe:
- Cho phép các câu nói vui, trêu đùa nhẹ, chọc ghẹo giữa bạn bè
- Cho phép góp ý/than phiền không lịch sự lắm nhưng không quá nặng
- Nếu bạn không chắc là có nên xoá hay không → HÃY CHỌN ALLOW

Chỉ trả lời DUY NHẤT MỘT TỪ (viết hoa):
- "BLOCK" nếu tin nhắn cần bị xoá
- "ALLOW" nếu tin nhắn có thể chấp nhận được hoặc bạn không chắc

Tin nhắn người dùng:
"""${content}"""
`.trim();

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = (await result.response.text()).trim().toUpperCase();

    console.log('🤖 Gemini đánh giá:', text, '->', content);
    return text.includes('BLOCK');
  } catch (err) {
    console.error('Lỗi gọi Gemini:', err);
    return false;
  }
}

// ====== PHẦN DISCORD ======
const allowedCommands = ['/vidu'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  if (!content) return;

  // 1) Lệnh kiểu text bắt đầu bằng "/"
  if (content.startsWith('/')) {
    const firstWord = content.split(/\s+/)[0];

    if (!allowedCommands.includes(firstWord)) {
      try {
        await message.delete();
        await message.channel.send(
          `🚫 <@${message.author.id}> Mồm đi hơi xa rồi đấy, tém tém lại nhé!`
        );
        console.log(`🗑 Xoá lệnh sai form từ ${message.author.tag}: ${content}`);
      } catch (err) {
        console.error('Lỗi khi xoá lệnh sai form:', err);
      }
    }
    return;
  }

  // 2) Lọc bằng danh sách từ bậy trước
  if (containsBannedWord(content)) {
    try {
      await message.delete();
      await message.channel.send(
        `🚫 <@${message.author.id}> Mồm đi hơi xa rồi đấy, tém tém lại nhé!`
      );
      console.log(`🧹 Xoá tin nhắn có từ bậy (list) từ ${message.author.tag}: ${content}`);
    } catch (err) {
      console.error('Lỗi khi xoá tin nhắn chửi bậy (list):', err);
    }
    return;
  }

  // 3) Nếu qua được list → nhờ Gemini check thêm
  try {
    const blockByGemini = await shouldBlockByGemini(content);
    if (blockByGemini) {
      await message.delete();
      await message.channel.send(
        `🚫 <@${message.author.id}> Mồm đi hơi xa rồi đấy, tém tém lại nhé!`
      );
      console.log(`🧹 Xoá tin nhắn do Gemini đánh giá BLOCK từ ${message.author.tag}: ${content}`);
    }
  } catch (err) {
    console.error('Lỗi khi xử lý Gemini:', err);
  }
});

client.login(DISCORD_TOKEN);
