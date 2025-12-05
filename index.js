// index.js – lọc theo list + phát nhạc, KHÔNG dùng Gemini / API LLM

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
} = require('@discordjs/voice');

const playdl = require('play-dl');

// ====== TOKEN & APP ID ======
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;

if (!DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN trong .env hoặc Railway Variables');
  process.exit(1);
}
if (!APPLICATION_ID) {
  console.error('❌ Thiếu APPLICATION_ID trong .env hoặc Railway Variables');
  process.exit(1);
}

// ====== CẤU HÌNH ======
const allowedCommands = ['/vidu']; // thêm lệnh slash kiểu text nếu muốn
const WARNING_LIFETIME_MS = 10_000; // cảnh báo giữ 10s rồi xóa

// ID kênh 🎶︱music-request (chỉ cho dùng lệnh nhạc)
const MUSIC_REQUEST_CHANNEL_ID = '1389843995135315979';
// ID kênh 💬︱chung
const GENERAL_CHANNEL_ID = '1389842864594227270';

// ====== HÀM NORMALIZE ======
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ====== LIST TỪ CẤM (HARD KEYWORD) ======
const rawBannedWords = [
  // === TIẾNG VIỆT CỰC MẠNH + TEENCODE ===
  "đm","dm","dmm","đmm","đkm","dkm","đcm","dcm","đcmm","dcmm","đcmnr","dcmnr","đmcs","dmcs","đmm","djt","djtm","djtme","ditme","dit me","ditm","djtmm","địt mẹ","dit mẹ","đụ","du ma","duma","du me","dume","đume","đuma",
  "lồn","lon","lìn","lin","loz","lozz","l0n","l0z","l.ồn","l~ồn","lwng","lwn","lồnláo","lonlao","lồn má","lon ma","mặt lồn","mat lon","thằng lồn","thang lon",
  "cặc","cak","kak","kac","cac","cacc","c4c","c4k","k4c","concac","c@c","cu","kỳ","kym","cục cức","cuc cuc",
  "buồi","buoi","buoj","bùi","buj","bu0i","buoif","bú cu","bu cu","bucu","bú cặc","bu cak",
  "địt","dit","djt","djtcon","địt con","dit con","đis","diz","địt mẹ mày","dit me may",
  "chịch","chich","xoạc","nứng","nung","thẩm du","tham du","quay tay","quaytay","địt nhau","dit nhau",
  "vét máng","vet mang","liếm lồn","liem lon","đụ lồn","du lon","đút cặc","dut cak",
  "óc chó","oc cho","0c ch0","0ccho","oc lon",
  "ngu lồn","ngu lon",
  "chó đẻ","do cho","mẹ mày","me may",
  "phò","phỏ","phó","ph0","ph0`","cave","ca ve","gái cave","đĩ","đĩ điếm","gái điếm","con đĩ","con di",
  "thằng mặt lồn","thang mat lon","đầu buồi","dau buoi",

  // === PHÂN BIỆT CHỦNG TỘC / KỲ THỊ ===
  "nigger","nigga","niggas","neger","negro",

  // === TIẾNG ANH CỰC MẠNH + BIẾN THỂ ===
  "motherfucker","mthfckr","mthfcker","mothefucker","mofucker","maderfaker",
  "bitch","bjtch","b.i.t.c.h","bitcch","b1tch","beetch",
  "cock","cok","c0ck","kock","cawk","cack","kok",
  "dick","dik","d1ck","d1c","dic","deek",
  "pussy","pusy","pussyy","puzzy","pucci","pussi","pu.ssy",
  "asshole","ass","a.s.s","assh0le","a55","a55hole","azhole",
  "cunt","cuntz","kunt","cnut","c.unt",
  "whore","hoar","hore","ho","hoe","wh0re","whorre",
  "slut","slutt","s.lut","s1ut","slvt",
  "bastard","b4stard","basturd","basterd",
  "nigger","nigga","niggah","niggaz","niger","nigers","niggar","nigg3r","n1gger","n166er",
  "retard","retarded","r3tard","retart","reetard",
  "faggot","fag","f4g","fagot","fagget","fagg0t",
  "penis","pennis","penus","pe.nis","p3nis","cock","dick","vagina","v4gina","vag","vage","vag1na",
  "wanker","w4nker","wank","wankr",
  "cum","cumm","c.u.m","cvm","jizz","spunk",
  "tits","titties","t1ts","boobs","b00bs","boobies",
  "rape","raped","r4pe","rapist","rap3",
  "kike","chink","gook","spic","wetback","beaner","porch monkey","coon","jewboy","sandnigger"
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

// ====== DISCORD BOT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates, // để xử lý voice
  ],
});

// ====== MUSIC QUEUE MỖI GUILD ======
const queues = new Map(); // guildId -> { voiceChannel, textChannel, connection, player, songs: [] }

async function getRandomSimilarSong(baseSong) {
  try {
    const results = await playdl.search(baseSong.title, {
      limit: 5,
      source: { youtube: 'video' },
    });
    if (!results || results.length === 0) return null;

    // lọc bỏ bài trùng URL (nếu có), random 1 bài
    const filtered = results.filter(r => r.url !== baseSong.url);
    const list = filtered.length > 0 ? filtered : results;
    const idx = Math.floor(Math.random() * list.length);
    return {
      title: list[idx].title,
      url: list[idx].url,
    };
  } catch (err) {
    console.error('Lỗi tìm bài tương tự:', err);
    return null;
  }
}

async function playSong(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  const song = queue.songs[0];
  if (!song) return;

  try {
    const stream = await playdl.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    queue.player.play(resource);
    console.log(`🎵 Đang phát: ${song.title} (${song.url})`);
  } catch (err) {
    console.error('Lỗi khi play song:', err);
    queue.textChannel.send('❌ Không phát được bài này, chuyển bài khác...');
    queue.songs.shift();
    if (queue.songs.length > 0) {
      playSong(guildId);
    } else {
      queue.textChannel.send('✅ Hết bài trong hàng chờ.');
    }
  }
}

// ====== READY + AUTO DEPLOY SLASH COMMANDS ======
client.once('ready', async () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Phát nhạc từ YouTube (tên bài hoặc link)')
      .addStringOption(option =>
        option
          .setName('song')
          .setDescription('Tên bài hoặc URL YouTube')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Bỏ qua bài hiện tại; nếu hết hàng chờ thì random bài tương tự'),

    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Dừng nhạc và rời kênh voice'),
  ].map(cmd => cmd.toJSON());

  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    console.log('⏳ Đang deploy slash commands...');
    await rest.put(
      Routes.applicationCommands(APPLICATION_ID),
      { body: commands }
    );
    console.log('✅ Deploy slash commands xong.');
  } catch (err) {
    console.error('❌ Lỗi deploy slash commands:', err);
  }
});

// helper nếu cần sau này
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== QUẢN LÝ VI PHẠM & TIMEOUT ======
const userViolations = new Map(); // userId -> { count, lastAt }
const VIOLATION_WINDOW_MS = 60 * 60 * 1000; // 1 tiếng không chửi thì reset đếm

const PENALTY_STEPS = [
  { threshold: 5,  durationMs: 3  * 60 * 1000 },
  { threshold: 10, durationMs: 5  * 60 * 1000 },
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

// Xử lý vi phạm
async function handleViolation(message, options) {
  const {
    isHardKeyword = false,
    baseReason = 'Một số từ bạn dùng hơi “mạnh” quá so với nội quy server 😅',
    sourceTag = 'UNKNOWN',
  } = options || {};

  const user = message.author;
  const channel = message.channel;
  const userId = user.id;

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

    if (penaltyInfo.nextStep) {
      remaining = penaltyInfo.nextStep.threshold - count;
    } else {
      remaining = 0;
    }

    console.log(
      `⚠️ HARD VIOLATION từ ${user.tag} (${sourceTag}) – count=${count}`
    );
  } else {
    console.log(
      `⚠️ SOFT VIOLATION từ ${user.tag} (${sourceTag}) – không tính vào bộ đếm`
    );
  }

  const reasonText = baseReason;
  let extraLine = '';

  if (isHardKeyword) {
    if (remaining > 0) {
      extraLine =
        `\n👉 Còn **${remaining}** lần nữa là dính mute đó, nói chuyện nhẹ tay xíu nha.`;
    } else if (penaltyInfo.currentStep) {
      extraLine =
        `\n👉 Dùng mấy từ hơi nặng tay hơi nhiều nên mình cho nghỉ chat nhẹ một lúc cho hạ nhiệt.`;
    }
  }

  // Xoá tin nhắn gốc
  try {
    await message.delete();
  } catch (err) {
    console.error('Không xoá được tin nhắn vi phạm:', err);
  }

  // Gửi cảnh báo (sống 10s)
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
    console.error('Không gửi được cảnh báo:', err);
  }

  // HARD keyword → timeout
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
        console.error('Không timeout được user:', err);
      }
    } else {
      console.warn(
        `⚠️ Không thể timeout ${user.tag} (có thể bot thiếu quyền hoặc user cao role hơn).`
      );
    }
  }
}

// ====== XỬ LÝ TIN NHẮN THƯỜNG (FILTER) ======
client.on('messageCreate', async (message) => {
  try {
    const RYTHM_BOT_ID = '235088799074484224';

    if (!message.guild) return;

    // Nếu là bot
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

    // ==== LUẬT CHO CHANNEL 🎶︱music-request ====
    if (message.channel.id === MUSIC_REQUEST_CHANNEL_ID) {
      // 1) Cấm chat thường → chỉ slash / text command
      if (!content.startsWith('/')) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            `Kênh này chỉ để gọi nhạc thôi bạn ơi 🎧\n` +
            `Muốn tám chuyện thì qua kênh <#${GENERAL_CHANNEL_ID}> cho đúng chỗ nha 💬`,
          sourceTag: 'CHANNEL_RULE',
        });
        return;
      }

      // 2) Cho phép một số lệnh text (nếu ai đó vẫn dùng Rythm)
      const allowedRythmCommands = [
        '/play',
        '/stop',
        '/pause',
        '/resume',
        '/skip',
        '/queue',
        '/nowplaying',
      ];

      const firstWord = content.split(/\s+/)[0];

      if (!allowedRythmCommands.includes(firstWord)) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            `Ở đây chỉ nhận lệnh của **Rythm/bot nhạc** thôi nha 🎶\n` +
            `Nếu muốn thử lệnh khác hoặc chat linh tinh thì qua <#${GENERAL_CHANNEL_ID}> giùm cái 💬`,
          sourceTag: 'RYTHM_ONLY',
        });
        return;
      }

      // 3) Vẫn lọc chửi bậy trong kênh nhạc
      if (containsBannedWord(content)) {
        await handleViolation(message, {
          isHardKeyword: true,
          baseReason:
            'Một số từ trong tin nhắn hơi quá “mặn” so với kênh nhạc chill này.',
          sourceTag: 'LIST_HARD_MUSIC',
        });
        return;
      }

      return;
    }

    // ====== LOGIC CHUNG CHO CÁC KÊNH KHÁC ======
    if (content.startsWith('/')) {
      const firstWord = content.split(/\s+/)[0];
      if (!allowedCommands.includes(firstWord)) {
        await handleViolation(message, {
          isHardKeyword: false,
          baseReason:
            'Lệnh này không nằm trong danh sách slash command được hỗ trợ ở server.',
          sourceTag: 'CMD_FORM',
        });
      }
      return;
    }

    if (containsBannedWord(content)) {
      await handleViolation(message, {
        isHardKeyword: true,
        baseReason:
          'Một số từ trong tin nhắn hơi quá đà, đang nằm trong danh sách hạn chế của server.',
        sourceTag: 'LIST_HARD',
      });
      return;
    }
  } catch (err) {
    console.error('Lỗi chung trong messageCreate:', err);
  }
});

// ====== XỬ LÝ SLASH COMMAND (MUSIC) ======
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ===== /play song =====
  if (commandName === 'play') {
    const query = interaction.options.getString('song', true);
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Bạn phải vào một kênh voice trước đã.',
        ephemeral: true,
      });
      return;
    }

    // Lấy / tạo queue
    let queue = queues.get(interaction.guildId);

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      connection.subscribe(player);

      queue = {
        voiceChannel,
        textChannel: interaction.channel,
        connection,
        player,
        songs: [],
      };

      // Khi bài hiện tại phát xong
      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        if (queue.songs.length > 0) {
          playSong(interaction.guildId);
        } else {
          queue.textChannel.send('✅ Hết bài trong hàng chờ.');
        }
      });

      player.on('error', (error) => {
        console.error('Lỗi player:', error);
      });

      queues.set(interaction.guildId, queue);
    }

    await interaction.deferReply();

    let songInfo;
    try {
      if (query.startsWith('http')) {
        const info = await playdl.video_basic_info(query);
        songInfo = {
          title: info.video_details.title,
          url: info.video_details.url,
        };
      } else {
        const results = await playdl.search(query, {
          limit: 1,
          source: { youtube: 'video' },
        });
        if (!results || results.length === 0) {
          await interaction.editReply('❌ Không tìm thấy bài phù hợp trên YouTube.');
          return;
        }
        songInfo = {
          title: results[0].title,
          url: results[0].url,
        };
      }
    } catch (err) {
      console.error('Lỗi khi tìm nhạc:', err);
      await interaction.editReply('❌ Có lỗi khi tìm bài hát.');
      return;
    }

    // Thêm vào queue
    queue.songs.push(songInfo);

    if (
      queue.songs.length === 1 &&
      queue.player.state.status !== AudioPlayerStatus.Playing
    ) {
      await playSong(interaction.guildId);
      await interaction.editReply(`▶️ Đang phát: **${songInfo.title}**`);
    } else {
      await interaction.editReply(
        `➕ Đã thêm vào hàng chờ: **${songInfo.title}** (vị trí ${queue.songs.length})`
      );
    }
  }

  // ===== /skip =====
  if (commandName === 'skip') {
    const queue = queues.get(interaction.guildId);
    if (!queue || queue.songs.length === 0) {
      await interaction.reply({
        content: '❌ Không có bài nào để skip.',
        ephemeral: true,
      });
      return;
    }

    const current = queue.songs[0];
    queue.songs.shift(); // bỏ bài hiện tại

    if (queue.songs.length > 0) {
      await playSong(interaction.guildId);
      await interaction.reply(
        `⏭ Đã chuyển sang bài: **${queue.songs[0].title}**`
      );
    } else {
      // không còn bài trong queue → random bài tương tự
      const similar = await getRandomSimilarSong(current);
      if (similar) {
        queue.songs.push(similar);
        await playSong(interaction.guildId);
        await interaction.reply(
          `⏭ Không còn bài trong hàng chờ, random bài tương tự: **${similar.title}**`
        );
      } else {
        queue.player.stop();
        await interaction.reply(
          '⏹ Hết bài trong hàng chờ và không tìm được bài tương tự.'
        );
      }
    }
  }

  // ===== /stop =====
  if (commandName === 'stop') {
    const queue = queues.get(interaction.guildId);
    if (!queue) {
      await interaction.reply({
        content: '❌ Không có queue nào đang chạy.',
        ephemeral: true,
      });
      return;
    }

    queue.songs = [];
    queue.player.stop();

    const connection = getVoiceConnection(interaction.guildId);
    if (connection) connection.destroy();

    queues.delete(interaction.guildId);

    await interaction.reply('⏹ Đã dừng nhạc và rời kênh voice.');
  }
});

client.login(DISCORD_TOKEN);
