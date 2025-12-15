// src/games/bacay/cardUtils.js
const SUITS = ["♠️", "♥️", "♦️", "♣️"];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ r, s, val: getValue(r) });
    }
  }
  return deck;
}

function getValue(rank) {
  if (rank === "A") return 1;
  if (["10", "J", "Q", "K"].includes(rank)) return 0; // Ba Cào: 10, J, Q, K = 0 (hoặc 10 tính là 0 trong mod 10)
  // Thực tế: J,Q,K = 10, rồi mod 10 thì cũng là 0.
  // User yêu cầu: 10 / J / Q / K = 0
  return parseInt(rank);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function calculateScore(hand) {
  const total = hand.reduce((sum, card) => sum + card.val, 0);
  let score = total % 10;
  // Ba cây: 10 điểm là cao nhất (thường gọi là 10 nước, hoặc bù).
  // Nhưng user bảo: Tổng điểm = (tổng điểm % 10).
  // Nếu tổng là 10, 20 => 0 điểm. (Bù/Sáp?)
  // User: "So điểm: Cao hơn -> thắng".
  // Note: Thông thường Ba Cây VN, 10 điểm tính là 10, 20 cũng tính là 10. (rank cao nhất).
  // Nhưng theo công thức user: (tổng % 10), thì 10 => 0, 20 => 0.
  // Hãy làm đúng yêu cầu: A=1, 2-9=N, 10/J/Q/K=0. Sum % 10.
  // Ví dụ: J, Q, K => 0 + 0 + 0 = 0 điểm. (Thấp nhất?)
  // Nếu user yêu cầu "10,J,Q,K = 0" và "Score = Sum % 10", thì đúng là JQK = 0 điểm.
  if (score === 0) score = 0; // Just to be explicit, logic remains.
  return score;
}

function handText(hand) {
  return hand.map((c) => `${c.r}${c.s}`).join("  ");
}

module.exports = { createDeck, shuffle, calculateScore, handText };
