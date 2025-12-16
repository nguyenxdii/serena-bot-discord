// src/games/three-card/cardUtils.js
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
  if (["10", "J", "Q", "K"].includes(rank)) return 0;
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
  if (score === 0) score = 0;
  return score;
}

function handText(hand) {
  return hand.map((c) => `${c.r}${c.s}`).join("  ");
}

module.exports = { createDeck, shuffle, calculateScore, handText };
