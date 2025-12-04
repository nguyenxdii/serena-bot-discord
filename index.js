require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN) {
    console.error('❌ Thiếu DISCORD_TOKEN trong .env');
    process.exit(1);
}

// Khởi tạo Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message],
});

// Lệnh Slash hợp lệ
const allowedCommands = ['/vidu'];

// Danh sách từ cấm kiểm tra nhanh (nếu có match → xoá luôn)
const bannedWords = ['địt', 'lồn', 'cặc', 'chịch', 'đụ', 'fuck', 'bitch', 'dm', 'dmm', 'vcl'];

// Cấu hình Gemini 2.5 Flash
let model = null;
if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('🤖 Gemini 2.5 Flash đã được bật!');
} else {
    console.log('⚠️ Không có API KEY → chỉ lọc từ cấm & lệnh sai');
}

async function shouldBlockWithGemini(content) {
    if (!model) return false;

    const prompt = `
Bạn là bộ lọc tin nhắn Discord Việt Nam.
BLOCK nếu:
- Chửi tục
- Xúc phạm nặng
- Phân biệt chủng tộc
- 18+, tục tĩu
- Spam, scam, quảng cáo xấu

OK nếu:
- Nội dung lịch sự, bình thường
- Chỉ tán gẫu, ký tự vô nghĩa

Chỉ trả lời BLOCK hoặc OK.

Tin nhắn: "${content}"
`.trim();

    try {
        const result = await model.generateContent(prompt);
        const reply = result.response.text().trim().toLowerCase();

        console.log(`🔎 Gemini đánh giá: ${reply} → (${content})`);

        return reply.includes("block");
    } catch (err) {
        console.error("❌ Lỗi AI:", err);
        return false; // Để tránh crash bot
    }
}

client.on('ready', () => {
    console.log(`🔥 Bot đã online: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase().trim();
    if (!content) return;

    // ✳️ Nếu là slash command
    if (content.startsWith('/')) {
        const firstWord = content.split(/\s+/)[0];
        if (!allowedCommands.includes(firstWord)) {
            await message.delete().catch(() => {});
            await message.channel.send(
                `⚠️ <@${message.author.id}> Lệnh không đúng! Chỉ cho phép: ${allowedCommands.join(', ')}`
            );
            console.log(`❌ Xoá lệnh sai: ${content}`);
        }
        return;
    }

    // ✳️ Nếu chứa từ bị cấm → xoá ngay
    if (bannedWords.some(w => content.includes(w))) {
        await message.delete().catch(() => {});
        await message.channel.send(
            `🚫 <@${message.author.id}> Không được nói tục trong server!`
        );
        console.log(`🗑 Xóa vì từ cấm: ${content}`);
        return;
    }

    // ✳️ Nếu có Gemini thì nhờ đánh giá thêm
    if (model) {
        const blocked = await shouldBlockWithGemini(content);
        if (blocked) {
            await message.delete().catch(() => {});
            await message.channel.send(
                `🚨 <@${message.author.id}> Nội dung vi phạm quy tắc và đã bị xoá!`
            );
            console.log(`💥 AI BLOCK: ${content}`);
        }
    }
});

client.login(DISCORD_TOKEN);
