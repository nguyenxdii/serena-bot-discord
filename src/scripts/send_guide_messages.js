// src/scripts/send_guide_messages.js
require("dotenv").config();
const path = require("path");
const {
  WebhookClient,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

const WEBHOOK_URL = process.env.WEBHOOK_LAW;

const CHANNELS = {
  checkin: "1450065824210489395", // 🧧︱điểm-danh
  gaming: [
    "1450065466772029481", // quẩy-bài-1 (Blackjack)
    "1450065511231520778", // quẩy-bài-2 (Word Chain)
  ],
  feedback: "1450072444164378736", // feed-back
};

// Helper function to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendGuides() {
  try {
    console.log("🚀 Connecting to webhook...");
    const webhook = new WebhookClient({ url: WEBHOOK_URL });

    // --- SETUP ASSETS ---
    const banner1Path = path.join(__dirname, "../assets/banner 1.png");
    const banner2Path = path.join(__dirname, "../assets/banner 2.png");

    const banner1File = new AttachmentBuilder(banner1Path, {
      name: "banner1.png",
    });
    const banner2File = new AttachmentBuilder(banner2Path, {
      name: "banner2.png",
    });

    // === STEP 1: BANNER 2 (ẢNH) ===
    console.log("📨 [1/4] Sending Banner 2...");
    await webhook.send({
      files: [banner2File],
      username: "Helper",
    });

    await wait(1500);

    // === STEP 2: BẢN ĐỒ (TEXT) ===
    console.log("📨 [2/4] Sending Map Embed...");
    const embedMap = new EmbedBuilder()
      .setTitle("# 🗺️ BẢN ĐỒ KHU VUI CHƠI")
      .setDescription("### Chào mừng bạn đến với **Tổ Dân Phố Giải Trí**! 🎉")
      .setColor("#FFD700")
      .addFields(
        {
          name: "## 🧧 Phúc Lợi Hàng Ngày",
          value: `### <#${CHANNELS.checkin}>\nĐiểm danh nhận coin miễn phí mỗi ngày`,
          inline: false,
        },
        {
          name: "## 🎰 Sàn Đấu (Game Zone)",
          value:
            `### <#${CHANNELS.gaming[0]}> - Blackjack (Xì Dách)\n` +
            `### <#${CHANNELS.gaming[1]}> - Nối Từ\n` +
            `Chơi game và kiếm coin tại đây!`,
          inline: false,
        },
        {
          name: "## 📬 Góp Ý & Báo Lỗi",
          value: `### <#${CHANNELS.feedback}>\nĐóng góp ý tưởng hoặc bug cho bot`,
          inline: false,
        }
      );

    await webhook.send({
      embeds: [embedMap],
      username: "Helper",
    });

    await wait(2000);

    // === STEP 3: BANNER 1 (ẢNH) ===
    console.log("📨 [3/4] Sending Banner 1...");
    await webhook.send({
      files: [banner1File],
      username: "Helper",
    });

    await wait(1500);

    // === STEP 4: LỆNH CƠ BẢN (TEXT) ===
    console.log("📨 [4/4] Sending Commands Embed...");
    const embedCommands = new EmbedBuilder()
      .setTitle("# ⚙️ LỆNH CƠ BẢN")
      .setColor("#3498DB")
      .setDescription("### Danh sách lệnh để sử dụng bot:")
      .addFields(
        {
          name: "## 💰 Tài Chính",
          value:
            "### `/daily` - Điểm danh nhận coin\n" +
            "### `/wallet` - Xem số dư\n" +
            "### `/tip` - Lì xì bạn bè\n" +
            "### `/pay` - Chuyển khoản (phí 5%)",
          inline: false,
        },
        {
          name: "## 🎴 Blackjack",
          value:
            "### `/blackjack` - Chơi Xì Dách\n" +
            "### `/blackjack-help` - Hướng dẫn\n" +
            "### `/blackjack-stats` - Thống kê",
          inline: false,
        },
        {
          name: "## 🔗 Nối Từ",
          value:
            "### Gõ 2 từ vào chat (VD: `mưa gió`)\n" +
            "### `/wordchain-surrender` - Đầu hàng",
          inline: false,
        }
      );

    await webhook.send({
      embeds: [embedCommands],
      username: "Helper",
    });

    console.log("✅ Done! All guide messages sent successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

sendGuides();
