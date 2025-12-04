require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

// ====== LIST TỪ CẤM CỨNG ======
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

  // racis / hate speech nên chặn cứng
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
     → Những cái này nên đưa cho mod xem và quyết định có xoá hay không.

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
    const [levelRaw, reasonRaw = ''] = upper.split('|');
    const level = levelRaw.trim();
    const reason = raw.split('|')[1]?.trim() || ''; // lấy reason bản gốc để giữ dấu

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

// helper: kiểm tra user có quyền mod không
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

client.on('messageCreate', async (message) => {
  try {
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
            `🚫 <@${message.author.id}> Mồm đi hơi xa rồi đấy, tém tém lại nhé! (Lệnh không đúng form)`
          );
          console.log(
            `🗑 Xoá lệnh sai form từ ${message.author.tag}: ${content}`
          );
        } catch (err) {
          console.error('Lỗi khi xoá lệnh sai form:', err);
        }
      }
      return;
    }

    // 2) Keyword nặng trong list → coi như BLOCK_STRONG
    if (containsBannedWord(content)) {
      const reason =
        'Sử dụng từ ngữ tục tĩu/nặng nằm trong danh sách cấm của server.';
      try {
        await message.delete();
        await message.channel.send(
          `🚫 <@${message.author.id}> Tin nhắn của bạn đã bị xoá.\n> Lý do: ${reason}`
        );
        console.log(
          `🧹 Xoá tin nhắn (LIST) từ ${message.author.tag}: ${content}`
        );
      } catch (err) {
        console.error('Lỗi khi xoá tin nhắn (list):', err);
      }
      return;
    }

    // 3) Không trúng list → nhờ Gemini phân loại
    const { level, reason } = await analyzeByGemini(content);

    if (level === 'ALLOW') {
      return;
    }

    if (level === 'BLOCK_STRONG') {
      const finalReason =
        reason || 'Nội dung độc hại/mang tính miệt thị hoặc xúc phạm nghiêm trọng.';
      try {
        await message.delete();
        await message.channel.send(
          `🚫 <@${message.author.id}> Tin nhắn của bạn đã bị xoá.\n> Lý do: ${finalReason}`
        );
        console.log(
          `🧹 Xoá tin nhắn (AI BLOCK_STRONG) từ ${message.author.tag}: ${content}`
        );
      } catch (err) {
        console.error('Lỗi khi xoá tin nhắn (BLOCK_STRONG):', err);
      }
      return;
    }

    if (level === 'BLOCK_SOFT') {
      const finalReason =
        reason || 'Nội dung có thể chưa phù hợp, cần mod xem xét.';
      try {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`hide_${message.id}`)
            .setLabel('Ẩn tin nhắn')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`keep_${message.id}`)
            .setLabel('Giữ nguyên')
            .setStyle(ButtonStyle.Secondary)
        );

        await message.reply({
          content:
            `⚠️ Tin nhắn này có thể chưa phù hợp: **${finalReason}**\n` +
            `Chỉ quản trị viên / mod dùng nút bên dưới để quyết định ẩn/giữ.`,
          components: [row],
        });

        console.log(
          `⚠️ Tin nhắn (AI BLOCK_SOFT) từ ${message.author.tag}: ${content}`
        );
      } catch (err) {
        console.error('Lỗi khi gửi panel BLOCK_SOFT:', err);
      }
      return;
    }
  } catch (err) {
    console.error('Lỗi chung trong messageCreate:', err);
  }
});

// Xử lý nút Ẩn / Giữ
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const [action, msgId] = customId.split('_');

    if (!isModerator(interaction.member)) {
      return interaction.reply({
        content: '❌ Bạn không có quyền dùng nút này.',
        ephemeral: true,
      });
    }

    const channel = interaction.channel;
    if (!channel || !msgId) {
      return interaction.reply({
        content: '❌ Không tìm thấy tin nhắn cần xử lý.',
        ephemeral: true,
      });
    }

    const targetMessage = await channel.messages.fetch(msgId).catch(() => null);

    if (action === 'hide') {
      if (targetMessage) {
        await targetMessage.delete().catch(() => null);
      }
      await interaction.update({
        content: '✅ Tin nhắn đã được ẩn (xoá) theo quyết định của mod.',
        components: [],
      });
      return;
    }

    if (action === 'keep') {
      await interaction.update({
        content: '✅ Quyết định giữ nguyên tin nhắn. Panel đã được đóng.',
        components: [],
      });
      return;
    }
  } catch (err) {
    console.error('Lỗi khi xử lý interaction (button):', err);
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: '❌ Đã xảy ra lỗi khi xử lý nút.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

client.login(DISCORD_TOKEN);
