// src/games/blackjack/engine.js
const {
  createDeck,
  shuffle,
  draw,
  handValue,
  isBlackjack,
} = require("./cards");

function startGame(bet) {
  const deck = shuffle(createDeck());
  const player = [draw(deck), draw(deck)];
  const dealer = [draw(deck), draw(deck)];

  const state = {
    deck,
    player,
    dealer,
    bet,
    doubled: false,
    status: "PLAYING", // PLAYING | ENDED
    result: null, // WIN | LOSE | PUSH | BJ | DEALER_BJ
  };

  // mở bài
  const pBJ = isBlackjack(player);
  const dBJ = isBlackjack(dealer);
  if (pBJ || dBJ) {
    state.status = "ENDED";
    state.result = pBJ && dBJ ? "PUSH" : pBJ ? "BJ" : "DEALER_BJ";
  }

  return state;
}

function hit(state) {
  if (state.status !== "PLAYING") return;
  state.player.push(draw(state.deck));
  if (handValue(state.player) > 21) {
    state.status = "ENDED";
    state.result = "LOSE";
  }
}

function dealerPlay(state) {
  while (handValue(state.dealer) < 17) state.dealer.push(draw(state.deck));
}

function stand(state) {
  if (state.status !== "PLAYING") return;
  dealerPlay(state);

  const pv = handValue(state.player);
  const dv = handValue(state.dealer);

  if (dv > 21) state.result = "WIN";
  else if (pv > dv) state.result = "WIN";
  else if (pv < dv) state.result = "LOSE";
  else state.result = "PUSH";

  state.status = "ENDED";
}

function payout(state) {
  // trả về số coin cộng lại (vì ta đã trừ bet lúc start)
  const b = state.bet;
  if (state.result === "PUSH") return b;
  if (state.result === "WIN") return b * 2;
  if (state.result === "BJ") return Math.floor(b * 2.5); // 3:2
  return 0; // LOSE/DEALER_BJ
}

module.exports = { startGame, hit, stand, payout };
