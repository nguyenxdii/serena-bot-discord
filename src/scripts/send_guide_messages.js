// src/scripts/send_guide_messages.js
const fs = require("fs");
const path = require("path");

function log(msg) {
  console.log(msg);
  fs.appendFileSync("debug_guide.log", msg + "\n");
}

require("dotenv").config();
log("🚀 Script started...");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { DISCORD_TOKEN } = require("../config/env");

const TARGET_CHANNEL_ID = "1450073214620405903"; // 🎲｜luật-vui-chơi

const CHANNELS = {
  event: "1450065791860080744", // 📢︱thông-báo-event
  checkin: "1450065824210489395", // 🧧︱điểm-danh
  reward: "1450065852895465574", // 🎁︱nhận-thưởng
  gaming: [
    "1450065466772029481", // quẩy-bài-1
    "1450065511231520778", // quẩy-bài-2
    "1450065534312779776", // quẩy-bài-3
    "1450067312160805047", // quẩy-bài-4
  ],
  feedback: "1450072444164378736", // feed-back
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) {
      console.error("❌ Không tìm thấy kênh luật!");
      process.exit(1);
    }

    console.log(`✅ Found channel: ${channel.name}`);

    // --- SETUP ASSETS ---
    const banner1Path = path.join(__dirname, "../assets/banner 1.png");
    const banner2Path = path.join(__dirname, "../assets/banner 2.png");

    const banner1File = new AttachmentBuilder(banner1Path, {
      name: "banner1.png",
    });
    const banner2File = new AttachmentBuilder(banner2Path, {
      name: "banner2.png",
    });

    // --- MESSAGE 1: BẢN ĐỒ KÊNH + BANNER 2 ---
    const embedMap = new EmbedBuilder()
      .setTitle('🗺️ BẢN ĐỒ "TỔ DÂN PHỐ" GIẢI TRÍ')
      .setDescription(
        "Chào mừng đến với Khu Vui Chơi! Dưới đây là hướng dẫn các khu vực:"
      )
      .setColor("Gold")
      .addFields(
        {
          name: "📢 Thông Tin & Sự Kiện",
          value: `<#${CHANNELS.event}>: Cập nhật các event hot, đua top nhận quà.`,
          inline: false,
        },
        {
          name: "🧧 Phúc Lợi Hàng Ngày",
          value:
            `<#${CHANNELS.checkin}>: Điểm danh nhận coin mỗi ngày.\n` +
            `<#${CHANNELS.reward}>: Nơi trao giải và nhận thưởng event.`,
          inline: false,
        },
        {
          name: "🎰 Sàn Đấu (Game Zone)",
          value:
            `Các kênh: <#${CHANNELS.gaming[0]}>, <#${CHANNELS.gaming[1]}>...\n` +
            "👉 Chỉ huy BOT và chơi game (Blackjack, Ba Cào) tại đây.",
          inline: false,
        },
        {
          name: "📬 Góp Ý",
          value: `<#${CHANNELS.feedback}>: Báo lỗi bot hoặc đóng góp ý tưởng hay.`,
          inline: false,
        }
      )
      .setFooter({ text: "Chúc các bạn chơi vui vẻ và văn minh!" });

    // --- MESSAGE 2: HƯỚNG DẪN LỆNH + BANNER 1 ---
    const embedCmd = new EmbedBuilder()
      .setTitle("📜 LUẬT CHƠI & CÂU LỆNH CƠ BẢN")
      .setColor("Blue")
      .setDescription(
        "Để đảm bảo trải nghiệm tốt nhất, vui lòng tuân thủ quy định và sử dụng đúng lệnh."
      )
      .addFields(
        {
          name: "🚫 Quy Định & Lưu Ý",
          value:
            "• **Không spam** lệnh quá nhanh.\n" +
            "• **Không cay** khi thua.\n" +
            "• **Nhắn đúng kênh** quy định (Bot sẽ nhắc nhở nếu sai).\n" +
            "• Game luôn có yếu tố may mắn, hãy chơi giải trí!",
          inline: false,
        },
        {
          name: "📅 Điểm Danh & Tài Chính",
          value:
            "`/daily` : Điểm danh tại <#" +
            CHANNELS.checkin +
            ">\n" +
            "`/wallet` : Xem số dư túi tiền (Riêng tư)\n" +
            "`/tip` : Lì xì cho bạn bè (Miễn phí, chỉ cần xác nhận)\n" +
            "`/pay` : Chuyển khoản giao dịch (Phí 5%, cần xác nhận)",
          inline: false,
        },
        {
          name: "🃏 Blackjack (Xì Dách)",
          value:
            "`/blackjack bet:<tiền>` : Bắt đầu ván mới\n" +
            "`/blackjack-help` : Hướng dẫn luật chơi Blackjack\n" +
            "`/blackjack-stats` : Xem thống kê thắng/thua của bạn",
          inline: false,
        },
        {
          name: "🎲 Ba Cào (3 Cây)",
          value:
            "`/bacay bet:<tiền>` : Bắt đầu ván mới\n" +
            "`/bacay-help` : Hướng dẫn luật chơi Ba Cào\n" +
            "`/bacay-stats` : Xem thống kê thắng/thua của bạn",
          inline: false,
        }
      );

    console.log("📨 Sending Message 1 (Map + Banner 2)...");
    const msg1 = await channel.send({
      embeds: [embedMap],
      files: [banner2File],
    });
    await msg1.pin();

    console.log("📨 Sending Message 2 (Rules + Banner 1)...");
    const msg2 = await channel.send({
      embeds: [embedCmd],
      files: [banner1File],
    });
    await msg2.pin();

    console.log("✅ Done! Exit in 3s...");
    setTimeout(() => process.exit(0), 3000);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
});

client.login(DISCORD_TOKEN);
