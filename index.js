require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID || process.env.CLIENT_ID; // Railway đang dùng APPLICATION_ID
const GUILD_ID = process.env.GUILD_ID;

if (!DISCORD_TOKEN) {
  console.error("❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables");
  process.exit(1);
}

// ====== CẤU HÌNH ======
const allowedCommands = ["/vidu"]; // "slash command kiểu text" (messageCreate) - không liên quan slash thật
const WARNING_LIFETIME_MS = 10_000;

// ====== ID CHỦ / ADMIN ĐẦU BÒT (WHITELIST TIMEOUT & CẢNH BÁO) ======
const OWNER_ID = "875358286487097395";

// ====== CẤU HÌNH TRIGGER "!" ======
const triggers = {
  "!botngu": (id) => `Kệ tao 😏`,
  "!hello": (id) => `Gọi tao chi? 😴`,
  "!ping": (id) => `Pong cái đầu mày 😤 Test hoài!`,

  "!ga": (id) => `Gà như mày đó <@${id}> 🐔🤣`,
  "!vl": (id) => `Vl mẹ gì <@${id}>? tao ban mày giờ! 😭`,
  "!sad": (id) => `Buồn mẹ gì <@${id}>, lớn rồi 😭`,
  "!cute": (id) => `Cute hơn mày rõ ràng <@${id}> 😌✨`,
  "!chan": (id) => `Chán thì đi ngủ, đừng hành tao 😩`,

  "!noob": (id) => `Mày số 1 <@${id}> 😌`,
  "!pro": (id) => `Không lẽ gà như mày <@${id}>? 😏🔥`,
  "!lag": (id) => `Lag là do não mày load chậm, chứ tao nhanh lắm 😏⚡`,

  "!sus": (id) => `Mày sus thấy sợ luôn á <@${id}> 😳🔪`,
  "!wtf": (id) => `Wtf cái gì <@${id}>?, chửi tao ban mày giờ!😼`,
  "!bru": (id) => `Bruhhh... 🤦`,

  "!meo": (id) => `Meowww 🐱`,
  "!cho": (id) => `Grrrr… tao cắn mày giờ 🐶`,
  "!gau": (id) => `Grrrr...`,

  "!ban": (id) => `Mày mà spam nữa <@${id}> tao ban chơi cho vui á 😤`,
  "!bye": (id) => `Biến`,

  "!ok": (id) => `Ok con dê 🐐`,
  "!ko": (id) => `Không là không, mày làm gì tao được <@${id}> 😤`,
  "!huh": (id) => `Huh? Như nào? 😐`,

  "!phatzeno": (id) => `<@864072941834862632> là con lợn bel`,
  "!feru": (id) => `<@874186912078921768> là con lợn bel`,
  "!wang": (id) => `<@493326232088346624> sủa bậy bạ tao mute cho im giờ 😤🚫`,
  "!dii": (id) => `Con mẹ gì? Gọi bố chi? 😏✨ <@875358286487097395>`,
  "!puc": () =>
    `<@894051913656578088> đang bán mình cho tư bản rồi, chưa thả về đâu 😭💼`,
};

// ID kênh 🎶︱music-request (chỉ cho dùng lệnh Rythm)
const MUSIC_REQUEST_CHANNEL_ID = "1389843995135315979";
// ID kênh 💬︱chung
const GENERAL_CHANNEL_ID = "1389842864594227270";

// ====== HÀM NORMALIZE ======
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ====== LIST TỪ CẤM (HARD KEYWORD) ======
const rawBannedWords = [
  "đm",
  "dm",
  "dmm",
  "đmm",
  "đkm",
  "dkm",
  "đcm",
  "dcm",
  "đcmm",
  "dcmm",
  "đcmnr",
  "dcmnr",
  "đmcs",
  "dmcs",
  "đmm",
  "djt",
  "djtm",
  "djtme",
  "ditme",
  "dit me",
  "ditm",
  "djtmm",
  "địt mẹ",
  "dit mẹ",
  "đụ",
  "du ma",
  "duma",
  "du me",
  "dume",
  "đume",
  "đuma",
  "lồn",
  "lon",
  "lìn",
  "lin",
  "loz",
  "lozz",
  "l0n",
  "l0z",
  "l.ồn",
  "l~ồn",
  "lwng",
  "lwn",
  "lồnláo",
  "lonlao",
  "lồn má",
  "lon ma",
  "mặt lồn",
  "mat lon",
  "thằng lồn",
  "thang lon",
  "cặc",
  "cak",
  "kak",
  "kac",
  "cac",
  "cacc",
  "c4c",
  "c4k",
  "k4c",
  "concac",
  "c@c",
  "cu",
  "kỳ",
  "kym",
  "cục cức",
  "cuc cuc",
  "buồi",
  "buoi",
  "buoj",
  "bùi",
  "buj",
  "bu0i",
  "buoif",
  "bú cu",
  "bu cu",
  "bucu",
  "bú cặc",
  "bu cak",
  "địt",
  "dit",
  "djt",
  "djtcon",
  "địt con",
  "dit con",
  "đis",
  "diz",
  "địt mẹ mày",
  "dit me may",
  "chịch",
  "chich",
  "xoạc",
  "nứng",
  "nung",
  "thẩm du",
  "tham du",
  "quay tay",
  "quaytay",
  "địt nhau",
  "dit nhau",
  "vét máng",
  "vet mang",
  "liếm lồn",
  "liem lon",
  "đụ lồn",
  "du lon",
  "đút cặc",
  "dut cak",
  "óc chó",
  "oc cho",
  "0c ch0",
  "0ccho",
  "oc lon",
  "ngu lồn",
  "ngu lon",
  "chó đẻ",
  "do cho",
  "mẹ mày",
  "me may",
  "phò",
  "phỏ",
  "phó",
  "ph0",
  "ph0`",
  "cave",
  "ca ve",
  "gái cave",
  "đĩ",
  "đĩ điếm",
  "gái điếm",
  "con đĩ",
  "con di",
  "thằng mặt lồn",
  "thang mat lon",
  "đầu buồi",
  "dau buoi",
  "cc",
  "cl",
  "cdmm",
  "cmm",
  "clmm",
  "clm",
  "nigger",
  "nigga",
  "niggas",
  "neger",
  "negro",
  "motherfucker",
  "mthfckr",
  "mthfcker",
  "mothefucker",
  "mofucker",
  "maderfaker",
  "bitch",
  "bjtch",
  "b.i.t.c.h",
  "bitcch",
  "b1tch",
  "beetch",
  "cock",
  "cok",
  "c0ck",
  "kock",
  "cawk",
  "cack",
  "kok",
  "dick",
  "dik",
  "d1ck",
  "d1c",
  "dic",
  "deek",
  "pussy",
  "pusy",
  "pussyy",
  "puzzy",
  "pucci",
  "pussi",
  "pu.ssy",
  "asshole",
  "ass",
  "a.s.s",
  "assh0le",
  "a55",
  "a55hole",
  "azhole",
  "cunt",
  "cuntz",
  "kunt",
  "cnut",
  "c.unt",
  "whore",
  "hoar",
  "hore",
  "ho",
  "hoe",
  "wh0re",
  "whorre",
  "slut",
  "slutt",
  "s.lut",
  "s1ut",
  "slvt",
  "bastard",
  "b4stard",
  "basturd",
  "basterd",
  "nigger",
  "nigga",
  "niggah",
  "niggaz",
  "niger",
  "nigers",
  "niggar",
  "nigg3r",
  "n1gger",
  "n166er",
  "retard",
  "retarded",
  "r3tard",
  "retart",
  "reetard",
  "faggot",
  "fag",
  "f4g",
  "fagot",
  "fagget",
  "fagg0t",
  "penis",
  "pennis",
  "penus",
  "pe.nis",
  "p3nis",
  "cock",
  "dick",
  "vagina",
  "v4gina",
  "vag",
  "vage",
  "vag1na",
  "wanker",
  "w4nker",
  "wank",
  "wankr",
  "cum",
  "cumm",
  "c.u.m",
  "cvm",
  "jizz",
  "spunk",
  "tits",
  "titties",
  "t1ts",
  "boobs",
  "b00bs",
  "boobies",
  "rape",
  "raped",
  "r4pe",
  "rapist",
  "rap3",
  "kike",
  "chink",
  "gook",
  "spic",
  "wetback",
  "beaner",
  "porch monkey",
  "coon",
  "jewboy",
  "sandnigger",
];

// ====== TIỀN XỬ LÝ TỪ CẤM ======
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const processedBannedWords = rawBannedWords.map((raw) => {
  const norm = normalize(raw).trim();
  const compact = norm.replace(/\s+/g, "");
  const isPhrase = norm.includes(" ");
  const isShortToken = !isPhrase && norm.length <= 3;
  return { raw, norm, compact, isPhrase, isShortToken };
});

function containsBannedWord(text) {
  const norm = normalize(text);
  const normNoSpace = norm.replace(/\s+/g, "");

  for (const bw of processedBannedWords) {
    if (bw.isPhrase) {
      if (norm.includes(bw.norm)) return true;
      if (normNoSpace.includes(bw.compact)) return true;
      continue;
    }

    if (bw.isShortToken) {
      const pattern = `\\b${escapeRegex(bw.norm)}\\b`;
      const re = new RegExp(pattern, "i");
      if (re.test(norm)) return true;
      continue;
    }

    if (norm.includes(bw.norm)) return true;
    if (normNoSpace.includes(bw.compact)) return true;
  }
  return false;
}

// ====== DISCORD BOT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ====== AUTO DEPLOY SLASH COMMANDS (GUILD) ======
async function deploySlashCommands() {
  if (!APPLICATION_ID || !GUILD_ID) {
    console.warn(
      "⚠️ Thiếu APPLICATION_ID/CLIENT_ID hoặc GUILD_ID → không deploy slash command. (Bot vẫn chạy bình thường)"
    );
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("blackjack")
      .setDescription("Chơi blackjack")
      .addIntegerOption((opt) =>
        opt
          .setName("money")
          .setDescription("Số tiền đặt")
          .setRequired(true)
          .setMinValue(1)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    console.log("⏳ Deploying slash commands to guild...");
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands deployed!");
  } catch (err) {
    console.error("❌ Deploy slash commands failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);
  await deploySlashCommands(); // <-- tự register /blackjack money
});

// helper nếu cần sau này
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== QUẢN LÝ VI PHẠM & TIMEOUT ======
const userViolations = new Map();
const VIOLATION_WINDOW_MS = 60 * 60 * 1000;

const PENALTY_STEPS = [
  { threshold: 5, durationMs: 3 * 60 * 1000 },
  { threshold: 10, durationMs: 5 * 60 * 1000 },
  { threshold: 15, durationMs: 10 * 60 * 1000 },
];

function computePenalty(count) {
  let currentStep = null;
  for (const step of PENALTY_STEPS) {
    if (count >= step.threshold) currentStep = step;
  }
  const nextStep = PENALTY_STEPS.find((s) => s.threshold > count) || null;
  return {
    timeoutMs: currentStep ? currentStep.durationMs : 0,
    currentStep,
    nextStep,
  };
}

async function handleViolation(message, options) {
  const {
    isHardKeyword = false,
    baseReason = "Một số từ bạn dùng hơi “mạnh” quá so với nội quy server 😅",
    sourceTag = "UNKNOWN",
  } = options || {};

  const user = message.author;
  const channel = message.channel;
  const userId = user.id;
  const isOwner = userId === OWNER_ID;

  if (isOwner) {
    console.log(`👑 OWNER VIOLATION (${sourceTag}) – bỏ qua hết cho bố`);
    return;
  }

  let count = 0;
  let remaining = null;
  let penaltyInfo = { timeoutMs: 0, currentStep: null, nextStep: null };

  if (isHardKeyword) {
    const now = Date.now();
    const record = userViolations.get(userId) || { count: 0, lastAt: 0 };

    if (record.lastAt && now - record.lastAt > VIOLATION_WINDOW_MS) {
      record.count = 0;
    }

    record.count += 1;
    record.lastAt = now;
    userViolations.set(userId, record);

    count = record.count;
    penaltyInfo = computePenalty(count);
    remaining = penaltyInfo.nextStep
      ? penaltyInfo.nextStep.threshold - count
      : 0;

    console.log(
      `⚠️ HARD VIOLATION từ ${user.tag} (${sourceTag}) – count=${count}`
    );
  } else {
    console.log(
      `⚠️ SOFT VIOLATION từ ${user.tag} (${sourceTag}) – không tính vào bộ đếm`
    );
  }

  const reasonText = baseReason;
  let extraLine = "";

  if (isHardKeyword) {
    if (remaining > 0) {
      extraLine = `\n👉 Còn **${remaining}** lần nữa là dính mute đó, nói chuyện nhẹ tay xíu nha.`;
    } else if (penaltyInfo.currentStep) {
      extraLine = `\n👉 Dùng mấy từ hơi nặng tay hơi nhiều nên mình cho nghỉ chat nhẹ một lúc cho hạ nhiệt.`;
    }
  }

  try {
    await message.delete();
  } catch (err) {
    console.error("Không xoá được tin nhắn vi phạm:", err);
  }

  try {
    let content;

    if (isHardKeyword) {
      content =
        `🚫 Ê, đi hơi xa rồi đó <@${userId}>.\n` +
        `> Lý do: ${reasonText}` +
        extraLine;
    } else {
      content = baseReason;
    }

    const warningMsg = await channel.send({
      content,
      allowedMentions: isHardKeyword ? { users: [userId] } : undefined,
    });

    setTimeout(() => {
      warningMsg.delete().catch(() => {});
    }, WARNING_LIFETIME_MS);
  } catch (err) {
    console.error("Không gửi được cảnh báo:", err);
  }

  if (isHardKeyword && penaltyInfo.timeoutMs > 0) {
    const member = message.member;

    if (member && member.moderatable) {
      try {
        await member.timeout(
          penaltyInfo.timeoutMs,
          `Auto-timeout: dùng từ ngữ quá nặng nhiều lần (${sourceTag}, ${count} lần)`
        );

        const minutes = Math.round(penaltyInfo.timeoutMs / 60000);
        await channel.send(
          `🔇 <@${userId}> tạm thời bị mute **${minutes} phút**. Nghỉ tay xíu rồi chat tiếp cho vui nha.`
        );
      } catch (err) {
        console.error("Không timeout được user:", err);
      }
    } else {
      console.warn(
        `⚠️ Không thể timeout ${user.tag} (thiếu quyền hoặc user cao role hơn).`
      );
    }
  }
}

// ====== XỬ LÝ TIN NHẮN ======
client.on("messageCreate", async (message) => {
  try {
    const RYTHM_BOT_ID = "235088799074484224";
    if (!message.guild) return;

    if (message.author.bot) {
      if (message.channel.id === MUSIC_REQUEST_CHANNEL_ID) {
        if (
          message.author.id !== RYTHM_BOT_ID &&
          message.author.id !== client.user.id
        ) {
          message.delete().catch(() => {});
        }
        return;
      }
      return;
    }

    const content = message.content.trim();
    if (!content) return;

    if (message.channel.id === MUSIC_REQUEST_CHANNEL_ID) {
      if (!content.startsWith("/")) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            `Kênh này chỉ để gọi nhạc thôi bạn ơi 🎧\n` +
            `Muốn tám chuyện thì qua kênh <#${GENERAL_CHANNEL_ID}> cho đúng chỗ nha 💬`,
          sourceTag: "CHANNEL_RULE",
        });
        return;
      }

      const allowedRythmCommands = [
        "/play",
        "/stop",
        "/pause",
        "/resume",
        "/skip",
        "/queue",
        "/nowplaying",
      ];

      const firstWord = content.split(/\s+/)[0];
      if (!allowedRythmCommands.includes(firstWord)) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            `Ở đây chỉ nhận lệnh của **Rythm** thôi nha 🎶\n` +
            `Nếu muốn thử lệnh khác hoặc chat linh tinh thì qua <#${GENERAL_CHANNEL_ID}> giùm cái 💬`,
          sourceTag: "RYTHM_ONLY",
        });
        return;
      }

      if (containsBannedWord(content)) {
        await handleViolation(message, {
          isHardKeyword: true,
          baseReason:
            "Một số từ trong tin nhắn hơi quá “mặn” so với kênh nhạc chill này.",
          sourceTag: "LIST_HARD_MUSIC",
        });
        return;
      }

      return;
    }

    // Trigger "!"
    if (content.startsWith("!")) {
      const firstWord = content.split(/\s+/)[0].toLowerCase();
      const trigger = triggers[firstWord];

      if (trigger) {
        const replyText =
          typeof trigger === "function"
            ? trigger(message.author.id)
            : String(trigger);

        await message.reply(replyText);
        return;
      }
    }

    // Slash command kiểu text (không phải slash thật)
    if (content.startsWith("/")) {
      const firstWord = content.split(/\s+/)[0];
      if (!allowedCommands.includes(firstWord)) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            "Lệnh này không nằm trong danh sách slash command được hỗ trợ ở server.",
          sourceTag: "CMD_FORM",
        });
      }
      return;
    }

    // HARD keyword
    if (containsBannedWord(content)) {
      await handleViolation(message, {
        isHardKeyword: true,
        baseReason:
          "Một số từ trong tin nhắn hơi quá đà, đang nằm trong danh sách hạn chế của server.",
        sourceTag: "LIST_HARD",
      });
      return;
    }

    return;
  } catch (err) {
    console.error("Lỗi chung trong messageCreate:", err);
  }
});

// ====== SLASH COMMAND HANDLER ======
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "blackjack") {
    const money = interaction.options.getInteger("money", true);
    await interaction.reply(`🃏 Bạn cược **${money}** (sắp nối game ở đây)`);
  }
});

client.login(DISCORD_TOKEN);
