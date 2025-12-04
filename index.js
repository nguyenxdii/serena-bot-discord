// index.js - bản nhẹ, không dùng Gemini

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
}

// ====== CẤU HÌNH LỆNH ĐÚNG FORM ======
const allowedCommands = ['/vidu']; 
// Sau này muốn thêm lệnh hợp lệ thì thêm, ví dụ:
// const allowedCommands = ['/vidu', '/play', '/stop'];

// ====== LIST TỪ CHỬI BẬY / TỪ CẦN CHẶN ======
// 👉 THÊM / BỚT TỪ Ở ĐÂY CHO DỄ TÙY CHỈNH
const bannedWords = [
  // --- Nhóm ĐM / ĐCM ---
  'đm',
  'dm',
  'dmm',
  'đmm',
  'đkm',
  'dkm',
  'đcm',
  'dcm',
  'đcmm',
  'dcmm',
  'đm',
  'vkl',
  'vcl',
  'vl',
  'vcc',
  'vc', // Cẩn thận từ này có thể chặn "vợ chồng" viết tắt
  
  // --- Nhóm Vãi ---
  'vãi lồn',
  'vãi lon',
  'vãi cả lồn',
  'vãi cứt',
  'vãi l',
  'vai lon',
  
  // --- Nhóm Bộ phận nhạy cảm (Nam/Nữ) ---
  'cặc',
  'cak',
  'kak',
  'kac',
  'lồn',
  'loz',
  'lìn',
  'buồi',
  'buoi',
  'dái',
  'dai',
  
  // --- Nhóm Địt / Đụ ---
  'địt',
  'dit',
  'đụ',
  'du me',
  'dume',
  'dit me',
  'ditme',
  'chịch',
  'xoạc',
  
  // --- Nhóm Xúc phạm trí tuệ / Con vật ---
  'óc chó',
  'oc cho',
  'óc lợn',
  'oc lon',
  'con chó',
  'chó đẻ',
  'cho de',
  'chó má',
  'ngu lồn',
  'ngu lon',
  'ngu vcl',
  
  // --- Nhóm Khác (Phò, Đĩ, ...) ---
  'mẹ mày',
  'me may',
  'mịa',
  'phò',
  'pho`',
  'cave',
  'đĩ',
  'di~',
  'hãm l',
  
  // --- Tiếng Anh phổ biến ---
  'fuck',
  'fck',
  'bitch',
  'shit',
  'cock',
  'dick',
  'pussy',
  'asshole',
  
  // --- Teencode / Viết tắt 3 chữ ---
  'clmm',
  'ccmn',
  'cmm', // con mẹ mày (cẩn thận chặn nhầm cm = centimet)
  'đm',
];

// Hàm normalize: bỏ dấu + lowercase để check dễ hơn
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // bỏ dấu tiếng Việt
}

// Kiểm tra nội dung có chứa từ bậy hay không
function containsBannedWord(text) {
  const norm = normalize(text);

  // dùng includes cho đơn giản, vì đa số từ bậy khá đặc trưng
  return bannedWords.some((w) => norm.includes(w));
}

// ====== KHỞI TẠO DISCORD CLIENT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Bot online
client.once('clientReady', () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);
});

// Xử lý tin nhắn
client.on('messageCreate', async (message) => {
  // bỏ qua bot
  if (message.author.bot) return;

  const content = message.content.trim();
  if (!content) return;

  // 1) LỆNH BẮT ĐẦU BẰNG "/"
  if (content.startsWith('/')) {
    const firstWord = content.split(/\s+/)[0]; // "/vidu", "/play", ...

    // nếu KHÔNG nằm trong danh sách allowedCommands → xoá
    if (!allowedCommands.includes(firstWord)) {
      try {
        await message.delete();
        await message.channel.send(
          `⚠️ <@${message.author.id}> lệnh không đúng form. Chỉ cho phép: ${allowedCommands.join(', ')}`
        );
        console.log(`🗑 Xoá lệnh sai form từ ${message.author.tag}: ${content}`);
      } catch (err) {
        console.error('Lỗi khi xoá lệnh sai form:', err);
      }
    }

    // lệnh đã xử lý xong thì return, không check chửi bậy nữa
    return;
  }

  // 2) LỌC TIN NHẮN CHỬI BẬY BẰNG LIST TỪ
  if (containsBannedWord(content)) {
    try {
      await message.delete();
      await message.channel.send(
        `🚫 <@${message.author.id}> Mồm đi hơi xa rồi đấy, tém tém lại nhé!`
      );
      console.log(`🧹 Xoá tin nhắn có từ bậy từ ${message.author.tag}: ${content}`);
    } catch (err) {
      console.error('Lỗi khi xoá tin nhắn chửi bậy:', err);
    }
  }
});

// Login bot
client.login(DISCORD_TOKEN);
