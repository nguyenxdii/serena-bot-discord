// src/features/wordchain-simple/wordlist.js

/**
 * Vietnamese 2-word starter phrases for the game
 * All words are compound words (2 syllables/words)
 */
const STARTER_WORDS = [
  // Common compounds
  "nhà hàng",
  "học sinh",
  "giáo viên",
  "bạn bè",
  "gia đình",
  "con người",
  "thầy giáo",
  "cô giáo",
  "sách vở",
  "bút bi",
  "máy tính",
  "điện thoại",
  "tivi",
  "áo quần",
  "quần áo",
  "giày dép",
  "dép lê",
  "cơm nước",
  "nước chè",
  "rau củ",
  "trái cây",
  "thức ăn",
  "đồ uống",
  "món ăn",
  "phòng học",
  "lớp học",
  "trường học",
  "bàn ghế",
  "ghế gỗ",
  "xe máy",
  "máy bay",
  "bay giấy",
  "con chó",
  "chó con",
  "mèo con",
  "vịt trời",
  "trời đất",
  "đất nước",
  "nước biển",
  "biển cả",
  "núi non",
  "sông ngòi",
  "mây trời",
  "trăng sao",
  "sao mai",
  "hoa hồng",
  "cây xanh",
  "lá vàng",
  "đường phố",
  "phố cổ",
  "nhạc sĩ",
  "ca sĩ",
  "họa sĩ",
  "bác sĩ",
  "công an",
  "quân đội",
  "đội bóng",
  "bóng đá",
  "cầu lông",
  "võ thuật",
  "thể thao",
  "thao thức",
  "bài hát",
  "hát karaoke",
  "trò chơi",
  "chơi game",
  "game online",
  "hoa quả",
  "bánh kẹo",
  "kẹo dẻo",
  "mứt tết",
];

/**
 * Get a random starter word (2-word phrase)
 * @returns {string}
 */
function getRandomStartWord() {
  const index = Math.floor(Math.random() * STARTER_WORDS.length);
  return STARTER_WORDS[index];
}

/**
 * Get total count of starter words
 * @returns {number}
 */
function getWordCount() {
  return STARTER_WORDS.length;
}

module.exports = {
  STARTER_WORDS,
  getRandomStartWord,
  getWordCount,
};
