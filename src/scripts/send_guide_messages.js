// src/scripts/send_guide_messages.js
require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
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

    // --- MESSAGE 1: BẢN ĐỒ KÊNH ---
    const embedMap = new EmbedBuilder()
      .setTitle('🗺️ BẢN ĐỒ "TỔ DÂN PHỐ" GIẢI TRÍ')
      .setDescription(
        "Chào mừng cư dân đến với Khu Vui Chơi! Dưới đây là hướng dẫn các khu vực:"
      )
      .setColor("Gold")
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/1698/1698535.png") // Icon bản đồ/chỉ dẫn
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

    // --- MESSAGE 2: HƯỚNG DẪN LỆNH ---
    const embedCmd = new EmbedBuilder()
      .setTitle("📜 LUẬT CHƠI & CÂU LỆNH CƠ BẢN")
      .setColor("Blue")
      .setDescription(
        "Để đảm bảo trải nghiệm tốt nhất, vui lòng tuân thủ quy định và sử dụng đúng lệnh."
      )
      .addFields(
        {
          name: "🚫 Quy Định",
          value:
            "• **Không spam** lệnh quá nhanh gây lag bot.\n" +
            "• **Không cay cú**, chửi bới khi thua cược.\n" +
            "• Vui lòng **nhắn đúng kênh** quy định (Bot sẽ nhắc nhở 15s nếu sai).",
          inline: false,
        },
        {
          name: "🃏 Blackjack (Xì Dách)",
          value:
            "`/blackjack bet:<tiền>` : Bắt đầu ván\n" +
            "`/blackjack-help` : Xem luật chơi chi tiết\n" +
            "`/blackjack-stats` : Xem thống kê thắng thua",
          inline: false,
        },
        {
          name: "🎲 Ba Cào (3 Cây)",
          value:
            "`/bacay bet:<tiền>` : Bắt đầu ván\n" +
            "`/bacay-help` : Xem luật chơi chi tiết\n" +
            "`/bacay-top` : Xem bảng xếp hạng đại gia",
          inline: false,
        },
        {
          name: "💰 Tài Chính",
          value: "`/wallet` : Xem số dư túi tiền của bạn",
          inline: false,
        }
      )
      .setImage(
        "https://media.discordapp.net/attachments/1008571069484335104/1141381373539958864/casino-banner.png?width=960&height=300"
      ); // Ví dụ ảnh banner casino đẹp

    console.log("📨 Sending Message 1...");
    const msg1 = await channel.send({ embeds: [embedMap] });
    await msg1.pin();

    console.log("📨 Sending Message 2...");
    const msg2 = await channel.send({ embeds: [embedCmd] });
    await msg2.pin();

    console.log("✅ Done! Exit in 3s...");
    setTimeout(() => process.exit(0), 3000);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
});

client.login(DISCORD_TOKEN);
