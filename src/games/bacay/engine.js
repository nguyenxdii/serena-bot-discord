// src/games/bacay/engine.js
const { createDeck, shuffle, calculateScore } = require("./cardUtils");

function startGame(bet) {
  const deck = shuffle(createDeck());
  const playerHand = [deck.pop(), deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop(), deck.pop()];

  return {
    bet,
    deck, // Not really needed after dealing, but kept for consistency
    player: {
      hand: playerHand,
      score: calculateScore(playerHand),
      revealed: false,
    },
    dealer: {
      hand: dealerHand,
      score: calculateScore(dealerHand),
      revealed: false,
    },
    status: "PLAYING", // PLAYING | SHOWDOWN | ENDED
    result: null, // WIN | LOSE | DRAW
  };
}

function revealPlayer(state) {
  state.player.revealed = true;
}

function resolveGame(state) {
  state.player.revealed = true;
  state.dealer.revealed = true;

  const ps = state.player.score;
  const ds = state.dealer.score;

  if (ps > ds) state.result = "WIN";
  else if (ps < ds) state.result = "LOSE";
  else state.result = "DRAW";

  state.status = "ENDED";
}

function getPayout(state) {
  if (state.result === "WIN") return state.bet * 2;
  if (state.result === "DRAW") return state.bet;
  return 0;
}

module.exports = { startGame, revealPlayer, resolveGame, getPayout };
