// index.js

// Load biến môi trường từ .env
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Lấy token & api key từ .env
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Kiểm tra token
if (!DISCORD_TOKEN) {
    console.error('❌ Thiếu DISCORD_TOKEN trong file .env');
    process.exit(1);
}

// Khởi tạo client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,          // join server
        GatewayIntentBits.GuildMessages,   // nhận message trong server
        GatewayIntentBits.MessageContent   // đọc nội dung message
    ]
});

// Danh sách lệnh đúng form
// Ví dụ: chỉ cho phép /vidu, sau này bạn thêm thoải mái
const allowedCommands = ['/vidu'];

// --------- CẤU HÌNH GEMINI (tùy chọn) ---------
let model = null;
const useGemini = !!GEMINI_API_KEY;

if (useGemini) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('✅ Gemini đã được bật');
} else {
    console.log('ℹ️ Không có GEMINI_API_KEY -> chỉ dùng lọc form đơn giản, không dùng AI');
}

/**
 * Hàm dùng Gemini để xem tin nhắn có "xấu" không
 * Trả về true = nên xóa, false = cho qua
 */
async function shouldBlockWithGemini(text) {
    if (!model) return false;

    const prompt = `
Bạn là bộ lọc tin nhắn cho server Discord Việt Nam.
Hãy phân loại tin nhắn có nên bị xoá không.

Tiêu chí XOÁ (BLOCK):
- Chửi thề nặng, xúc phạm người khác
- Phân biệt chủng tộc, giới tính, tôn giáo
- Gạ gẫm 18+, nội dung quá nhạy cảm
- Spam, quảng cáo lộ liễu (link scam, cờ bạc, ...)

Chỉ trả lời đúng một từ:
- "BLOCK" nếu nên xoá
- "OK" nếu được phép giữ lại

Tin nhắn: "${text}"
    `.trim();

    try {
        const result = await model.generateContent(prompt);
        const reply = result.response.text().toLowerCase();

        // console.log('Gemini trả lời:', reply);

        if (reply.includes('block')) return true;
        return false;
    } catch (err) {
        console.error('Lỗi gọi Gemini:', err);
        return false; // nếu lỗi thì cho qua, tránh crash bot
    }
}

// --------- EVENT DISCORD ---------

// Khi bot online
client.once('clientReady', () => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
});

// Khi có tin nhắn mới
client.on('messageCreate', async (message) => {
    // Bỏ qua tin của bot
    if (message.author.bot) return;

    const content = message.content.trim();
    if (content.length === 0) return;

    // 1) LỌC LỆNH SAI FORM (bắt đầu bằng "/")
    if (content.startsWith('/')) {
        // Lấy từ đầu tiên, vd: "/vidu", "/setting"
        const firstWord = content.split(/\s+/)[0];

        // Nếu không thuộc danh sách allowedCommands -> xoá
        if (!allowedCommands.includes(firstWord)) {
            try {
                await message.delete(); // xoá tin nhắn sai form

                await message.channel.send(
                    `⚠️ <@${message.author.id}> lệnh không đúng form. Chỉ cho phép: ${allowedCommands.join(', ')}`
                );

                console.log(`🗑 Đã xoá lệnh sai form từ ${message.author.tag}: ${content}`);
            } catch (err) {
                console.error('Lỗi khi xoá tin nhắn sai form:', err);
            }
        }

        // xử lý xong lệnh thì thôi, không check Gemini nữa
        return;
    }

    // 2) (TUỲ CHỌN) LỌC NỘI DUNG BẰNG GEMINI
    // Chỉ chạy nếu bạn có GEMINI_API_KEY
    if (useGemini) {
        try {
            const shouldBlock = await shouldBlockWithGemini(content);

            if (shouldBlock) {
                await message.delete();
                await message.channel.send(
                    `🚫 <@${message.author.id}> tin nhắn của bạn vi phạm quy tắc và đã bị xoá.`
                );
                console.log(`🤖 Gemini đề xuất xoá tin nhắn từ ${message.author.tag}: ${content}`);
            }
        } catch (err) {
            console.error('Lỗi khi xử lý Gemini:', err);
        }
    }
});

// Đăng nhập bot
client.login(DISCORD_TOKEN);
