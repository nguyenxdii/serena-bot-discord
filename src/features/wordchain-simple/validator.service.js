// src/features/wordchain-simple/validator.service.js
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GEMINI_API_KEY } = require("../../config/env");
const { normalize } = require("../../utils/textUtils");

// Constants
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 5000; // Reduced from 10000ms for faster response
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 10000;

// Common Vietnamese words dictionary for instant validation (no API call needed)
const COMMON_WORDS = new Set([
  // Single syllable words
  "nhà",
  "hàng",
  "học",
  "sinh",
  "bạn",
  "bè",
  "gia",
  "đình",
  "thầy",
  "giáo",
  "cô",
  "trường",
  "lớp",
  "sách",
  "vở",
  "bút",
  "bi",
  "máy",
  "tính",
  "điện",
  "thoại",
  "xe",
  "đạp",
  "con",
  "người",
  "cây",
  "xanh",
  "hoa",
  "hồng",
  "trái",
  "cây",
  "rau",
  "củ",
  "cơm",
  "nước",
  "chè",
  "bánh",
  "kẹo",
  "mứt",
  "tết",
  "áo",
  "quần",
  "giày",
  "dép",
  "lê",
  "bàn",
  "ghế",
  "gỗ",
  "phòng",
  "võ",
  "thuật",
  "thể",
  "thao",
  "bóng",
  "đá",
  "cầu",
  "lông",
  "bài",
  "hát",
  "nhạc",
  "sĩ",
  "ca",
  "họa",
  "bác",
  "công",
  "an",
  "quân",
  "đội",
  "trò",
  "chơi",
  "game",
  "online",
  "bay",
  "giấy",
  "chó",
  "mèo",
  "vịt",
  "trời",
  "đất",
  "biển",
  "cả",
  "núi",
  "non",
  "sông",
  "ngòi",
  "mây",
  "trăng",
  "sao",
  "mai",
  "lá",
  "vàng",
  "đường",
  "phố",
  "cổ",
  "thao",
  "thức",
  "karaoke",
  "dẻo",
  "hoa",
  "quả",

  // Common verbs
  "ăn",
  "uống",
  "ngủ",
  "đi",
  "về",
  "làm",
  "nói",
  "nghe",
  "viết",
  "đọc",
  "chạy",
  "nhìn",
  "mở",
  "đóng",
  "cho",
  "yêu",
  "thương",
  "ghét",
  "thích",
  "muốn",
  "cần",
  "được",
  "biết",
  "hiểu",
  "quên",
  "nhớ",
  "sợ",
  "tin",
  "mong",
  "ước",
  "mơ",
  "bơi",
  "leo",
  "nhảy",
  "bay",

  // Common adjectives
  "đẹp",
  "xấu",
  "tốt",
  "hay",
  "vui",
  "buồn",
  "to",
  "nhỏ",
  "cao",
  "thấp",
  "nhanh",
  "chậm",
  "mới",
  "cũ",
  "sạch",
  "bẩn",
  "nóng",
  "lạnh",
  "khỏe",
  "yếu",
  "đỏ",
  "xanh",
  "vàng",
  "trắng",
  "đen",

  // Common nouns
  "xe",
  "cây",
  "hoa",
  "nước",
  "lửa",
  "gió",
  "đất",
  "trời",
  "mây",
  "mưa",
  "nắng",
  "sao",
  "trăng",
  "biển",
  "núi",
  "sông",
  "cỏ",
  "lá",
  "quả",
  "người",
  "bàn",
  "ghế",
  "cửa",
  "nhà",
]);

// In-memory cache
// key: normalized word, value: { ok: boolean, reason: string, timestamp: number }
const wordCache = new Map();

// In-flight requests to prevent duplicate API calls
const inFlightRequests = new Map();

let model = null;

/**
 * Initialize Gemini model
 */
function initGemini() {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY missing. Word validation will fail.");
    return false;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            is_valid_vietnamese_word: { type: SchemaType.BOOLEAN },
            reason: { type: SchemaType.STRING },
            is_proper_noun: { type: SchemaType.BOOLEAN },
            is_profane_or_sensitive: { type: SchemaType.BOOLEAN },
          },
          required: [
            "is_valid_vietnamese_word",
            "reason",
            "is_proper_noun",
            "is_profane_or_sensitive",
          ],
        },
      },
    });
    console.log(`✅ Gemini initialized with model: ${GEMINI_MODEL}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Gemini:", error);
    return false;
  }
}

/**
 * Clean old cache entries (TTL expired)
 */
function cleanOldCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of wordCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      wordCache.delete(key);
      cleaned++;
    }
  }

  // If cache is still too large, remove oldest entries
  if (wordCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(wordCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = wordCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      wordCache.delete(entries[i][0]);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} old cache entries`);
  }
}

/**
 * Call Gemini API to validate word
 * @param {string} word - normalized word
 * @param {object} context - { currentWord, expectedKey }
 * @returns {Promise<object>}
 */
async function callGeminiAPI(word, context) {
  if (!model) {
    const initialized = initGemini();
    if (!initialized) {
      throw new Error("Gemini API not available");
    }
  }

  const prompt = `
You are validating a word for a Vietnamese Word Chain game.

RULES:
1. The word must be a valid, meaningful Vietnamese word (1-4 syllables).
2. The word must NOT be a proper noun (tên riêng, địa danh, tên người).
3. The word must NOT contain profanity or sensitive content.
4. The word should be commonly used in everyday Vietnamese.
5. Nonsense words or made-up words are INVALID.

CONTEXT:
- Current word in game: "${context.currentWord || "N/A"}"
- New word to validate: "${word}"
- Expected starting key (without tone): "${context.expectedKey || "N/A"}"

TASK:
Evaluate if "${word}" is a valid Vietnamese word according to the rules above.
Return your evaluation in the specified JSON format.

Do NOT check syllable connection - that is handled separately.
Focus ONLY on whether the word itself is valid Vietnamese.
`.trim();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Gemini API timeout")),
        GEMINI_TIMEOUT_MS
      )
    );

    const apiPromise = model.generateContent(prompt);

    const result = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = result.response.text();

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    throw error;
  }
}

/**
 * Validate Vietnamese word with caching and deduplication
 * @param {string} candidateWord
 * @param {object} context - { currentWord, expectedKey }
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
async function validateVietnameseWord(candidateWord, context = {}) {
  const normalized = normalize(candidateWord);

  // Check cache first
  if (wordCache.has(normalized)) {
    const cached = wordCache.get(normalized);
    console.log(`📦 Cache hit for: "${normalized}"`);
    return { ok: cached.ok, reason: cached.reason };
  }

  // ✨ NEW: Check common words dictionary (instant validation)
  if (COMMON_WORDS.has(normalized)) {
    const result = { ok: true, reason: "OK (dictionary)" };
    wordCache.set(normalized, {
      ok: result.ok,
      reason: result.reason,
      timestamp: Date.now(),
    });
    console.log(`⚡ Dictionary hit for: "${normalized}"`);
    return result;
  }

  // Check if request is already in-flight
  if (inFlightRequests.has(normalized)) {
    console.log(`⏳ Waiting for in-flight request: "${normalized}"`);
    return await inFlightRequests.get(normalized);
  }

  // Create promise for this validation
  const validationPromise = (async () => {
    try {
      const geminiResult = await callGeminiAPI(normalized, context);

      // Determine if word is valid
      const isValid =
        geminiResult.is_valid_vietnamese_word &&
        !geminiResult.is_proper_noun &&
        !geminiResult.is_profane_or_sensitive;

      const result = {
        ok: isValid,
        reason: isValid ? "OK" : geminiResult.reason,
      };

      // Cache the result
      wordCache.set(normalized, {
        ok: result.ok,
        reason: result.reason,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      // On error, return invalid
      console.error(`❌ Validation error for "${normalized}":`, error.message);

      // Don't cache errors, allow retry
      return {
        ok: false,
        reason: "Validation error",
      };
    } finally {
      // Remove from in-flight
      inFlightRequests.delete(normalized);
    }
  })();

  // Store in-flight request
  inFlightRequests.set(normalized, validationPromise);

  return await validationPromise;
}

/**
 * Get cache statistics
 * @returns {object}
 */
function getCacheStats() {
  return {
    size: wordCache.size,
    inFlight: inFlightRequests.size,
    maxSize: MAX_CACHE_SIZE,
    ttlDays: CACHE_TTL_MS / (24 * 60 * 60 * 1000),
  };
}

// Cleanup job - run every 24 hours
setInterval(cleanOldCache, 24 * 60 * 60 * 1000);

module.exports = {
  validateVietnameseWord,
  getCacheStats,
  cleanOldCache,
};
