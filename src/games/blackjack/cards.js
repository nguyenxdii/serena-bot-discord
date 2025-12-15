// src/games/blackjack/cards.js
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
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  return deck;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw(deck) {
  return deck.pop();
}

function handValue(hand) {
  let total = 0;
  let aces = 0;

  for (const c of hand) {
    if (c.r === "A") {
      aces++;
      total += 11;
    } else if (["J", "Q", "K"].includes(c.r)) {
      total += 10;
    } else total += Number(c.r);
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function handText(hand) {
  return hand.map((c) => `${c.r}${c.s}`).join("  ");
}

module.exports = {
  createDeck,
  shuffle,
  draw,
  handValue,
  isBlackjack,
  handText,
};
