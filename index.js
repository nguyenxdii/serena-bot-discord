require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
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

// ====== LIST SAU KHI ĐÃ BỎ DẤU + LOWERCASE ======
const bannedWords = rawBannedWords.map((w) => normalize(w));

// Kiểm tra nội dung có chứa từ bậy hay không
function containsBannedWord(text) {
  const norm = normalize(text);               // tin nhắn đã bỏ dấu
  return bannedWords.some((w) => norm.includes(w)); // so với list đã bỏ dấu
}

// ====== PHẦN CÒN LẠI GIỮ NGUYÊN ======
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
