// src/utils/textUtils.js

/**
 * Vietnamese diacritic mapping for removing accents
 */
const DIACRITIC_MAP = {
  à: "a",
  á: "a",
  ả: "a",
  ã: "a",
  ạ: "a",
  ă: "a",
  ằ: "a",
  ắ: "a",
  ẳ: "a",
  ẵ: "a",
  ặ: "a",
  â: "a",
  ầ: "a",
  ấ: "a",
  ẩ: "a",
  ẫ: "a",
  ậ: "a",
  è: "e",
  é: "e",
  ẻ: "e",
  ẽ: "e",
  ẹ: "e",
  ê: "e",
  ề: "e",
  ế: "e",
  ể: "e",
  ễ: "e",
  ệ: "e",
  ì: "i",
  í: "i",
  ỉ: "i",
  ĩ: "i",
  ị: "i",
  ò: "o",
  ó: "o",
  ỏ: "o",
  õ: "o",
  ọ: "o",
  ô: "o",
  ồ: "o",
  ố: "o",
  ổ: "o",
  ỗ: "o",
  ộ: "o",
  ơ: "o",
  ờ: "o",
  ớ: "o",
  ở: "o",
  ỡ: "o",
  ợ: "o",
  ù: "u",
  ú: "u",
  ủ: "u",
  ũ: "u",
  ụ: "u",
  ư: "u",
  ừ: "u",
  ứ: "u",
  ử: "u",
  ữ: "u",
  ự: "u",
  ỳ: "y",
  ý: "y",
  ỷ: "y",
  ỹ: "y",
  ỵ: "y",
  đ: "d",
  À: "a",
  Á: "a",
  Ả: "a",
  Ã: "a",
  Ạ: "a",
  Ă: "a",
  Ằ: "a",
  Ắ: "a",
  Ẳ: "a",
  Ẵ: "a",
  Ặ: "a",
  Â: "a",
  Ầ: "a",
  Ấ: "a",
  Ẩ: "a",
  Ẫ: "a",
  Ậ: "a",
  È: "e",
  É: "e",
  Ẻ: "e",
  Ẽ: "e",
  Ẹ: "e",
  Ê: "e",
  Ề: "e",
  Ế: "e",
  Ể: "e",
  Ễ: "e",
  Ệ: "e",
  Ì: "i",
  Í: "i",
  Ỉ: "i",
  Ĩ: "i",
  Ị: "i",
  Ò: "o",
  Ó: "o",
  Ỏ: "o",
  Õ: "o",
  Ọ: "o",
  Ô: "o",
  Ồ: "o",
  Ố: "o",
  Ổ: "o",
  Ỗ: "o",
  Ộ: "o",
  Ơ: "o",
  Ờ: "o",
  Ớ: "o",
  Ở: "o",
  Ỡ: "o",
  Ợ: "o",
  Ù: "u",
  Ú: "u",
  Ủ: "u",
  Ũ: "u",
  Ụ: "u",
  Ư: "u",
  Ừ: "u",
  Ứ: "u",
  Ử: "u",
  Ữ: "u",
  Ự: "u",
  Ỳ: "y",
  Ý: "y",
  Ỷ: "y",
  Ỹ: "y",
  Ỵ: "y",
  Đ: "d",
};

/**
 * Remove Vietnamese diacritics
 * @param {string} text
 * @returns {string}
 */
function stripDiacritics(text) {
  return text
    .split("")
    .map((char) => DIACRITIC_MAP[char] || char)
    .join("");
}

/**
 * Normalize text for comparison
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/[.,!?;:"'()\[\]{}<>…]/g, "") // Remove punctuation
    .normalize("NFC"); // Unicode normalization
}

/**
 * Get first key (first word of the phrase)
 * For compound words like "nhà hàng", returns "nhà"
 * @param {string} word
 * @returns {string}
 */
function firstKey(word) {
  const normalized = normalize(word);
  const words = normalized.split(/\s+/);
  return words[0] || "";
}

/**
 * Get last key (last word of the phrase)
 * For compound words like "nhà hàng", returns "hàng"
 * @param {string} word
 * @returns {string}
 */
function lastKey(word) {
  const normalized = normalize(word);
  const words = normalized.split(/\s+/);
  return words[words.length - 1] || "";
}

/**
 * Check if text format is valid
 * @param {string} text
 * @returns {boolean}
 */
function isValidFormat(text) {
  if (!text || typeof text !== "string") return false;

  const trimmed = text.trim();

  // Length check
  if (trimmed.length < 1 || trimmed.length > 40) return false;

  // Reject URLs
  if (/https?:\/\/|www\./i.test(trimmed)) return false;

  // Reject Discord mentions
  if (/<@|<#|<@&/.test(trimmed)) return false;

  // Reject custom emoji
  if (/<a?:\w+:\d+>/.test(trimmed)) return false;

  // Check for excessive spaces (more than 3 consecutive)
  if (/\s{4,}/.test(trimmed)) return false;

  // Must contain at least one Vietnamese letter or a-z
  if (
    !/[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
      trimmed
    )
  ) {
    return false;
  }

  return true;
}

module.exports = {
  stripDiacritics,
  normalize,
  firstKey,
  lastKey,
  isValidFormat,
};
