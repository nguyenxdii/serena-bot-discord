require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
}

const allowedCommands = ['/vidu']; 

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
  'vcl'
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function containsBannedWord(text) {
  const norm = normalize(text);
  return bannedWords.some((w) => norm.includes(w));
}

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

  if (content.startsWith('/')) {
    const firstWord = content.split(/\s+/)[0];

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
    return;
  }

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

client.login(DISCORD_TOKEN);
