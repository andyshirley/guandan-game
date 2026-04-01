import { describe, expect, it } from "vitest";
import {
  Card,
  CardType,
  PlayerPosition,
  Rank,
  Suit,
} from "@shared/types";
import {
  isBomb,
  isRoyalBomb,
  identifyCardType,
  canPlayCards,
  dealCards,
  createGame,
  createDeck,
  groupCardsByRank,
  isSequence,
  isPairSequence,
  isTripleSequence,
} from "./gameEngine";

describe("Card Type Identification", () => {
  it("should identify royal bomb (4 cards: 2 small + 2 big jokers)", () => {
    // 官方规则：四大天王 = 大小王各两张（共 4 张）
    const cards: Card[] = [
      { rank: Rank.SmallJoker, suit: Suit.Hearts },
      { rank: Rank.SmallJoker, suit: Suit.Hearts },
      { rank: Rank.BigJoker, suit: Suit.Hearts },
      { rank: Rank.BigJoker, suit: Suit.Hearts },
    ];
    expect(isRoyalBomb(cards)).toBe(true);
  });

  it("should NOT identify 2-card royal bomb (斗地主 style)", () => {
    const cards: Card[] = [
      { rank: Rank.SmallJoker, suit: Suit.Hearts },
      { rank: Rank.BigJoker, suit: Suit.Hearts },
    ];
    expect(isRoyalBomb(cards)).toBe(false);
  });

  it("should identify bomb", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
      { rank: Rank.Five, suit: Suit.Clubs },
      { rank: Rank.Five, suit: Suit.Spades },
    ];
    expect(isBomb(cards)).toBe(true);
  });

  it("should not identify 3 cards as bomb", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
      { rank: Rank.Five, suit: Suit.Clubs },
    ];
    expect(isBomb(cards)).toBe(false);
  });

  it("should identify single card", () => {
    const cards: Card[] = [{ rank: Rank.Five, suit: Suit.Hearts }];
    const cardType = identifyCardType(cards, Rank.Three);
    expect(cardType).toBe(CardType.Single);
  });

  it("should identify pair", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
    ];
    const cardType = identifyCardType(cards, Rank.Three);
    expect(cardType).toBe(CardType.Pair);
  });

  it("should identify triple", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
      { rank: Rank.Five, suit: Suit.Clubs },
    ];
    const cardType = identifyCardType(cards, Rank.Three);
    expect(cardType).toBe(CardType.Triple);
  });

  it("should identify sequence", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Six, suit: Suit.Diamonds },
      { rank: Rank.Seven, suit: Suit.Clubs },
      { rank: Rank.Eight, suit: Suit.Spades },
      { rank: Rank.Nine, suit: Suit.Hearts },
    ];
    const cardType = identifyCardType(cards, Rank.Three);
    expect(cardType).toBe(CardType.Sequence);
  });

  it("should identify pair sequence", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
      { rank: Rank.Six, suit: Suit.Clubs },
      { rank: Rank.Six, suit: Suit.Spades },
      { rank: Rank.Seven, suit: Suit.Hearts },
      { rank: Rank.Seven, suit: Suit.Diamonds },
    ];
    const cardType = identifyCardType(cards, Rank.Three);
    expect(cardType).toBe(CardType.PairSequence);
  });

  it("should identify triple sequence", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
      { rank: Rank.Five, suit: Suit.Clubs },
      { rank: Rank.Six, suit: Suit.Spades },
      { rank: Rank.Six, suit: Suit.Hearts },
      { rank: Rank.Six, suit: Suit.Diamonds },
    ];
    const cardType = identifyCardType(cards, Rank.Three);
    expect(cardType).toBe(CardType.TripleSequence);
  });
});

describe("Card Play Validation", () => {
  it("should allow any card as first play", () => {
    const play = {
      type: CardType.Single,
      cards: [{ rank: Rank.Five, suit: Suit.Hearts }],
      value: 5,
    };
    expect(canPlayCards(play, null, Rank.Three)).toBe(true);
  });

  it("should allow royal bomb to beat any card", () => {
    const royalBomb = {
      type: CardType.RoyalBomb,
      cards: [
        { rank: Rank.SmallJoker, suit: Suit.Hearts },
        { rank: Rank.SmallJoker, suit: Suit.Hearts },
        { rank: Rank.BigJoker, suit: Suit.Hearts },
        { rank: Rank.BigJoker, suit: Suit.Hearts },
      ],
      value: 1000,
    };
    const lastPlay = {
      type: CardType.Bomb,
      cards: [
        { rank: Rank.Ace, suit: Suit.Hearts },
        { rank: Rank.Ace, suit: Suit.Diamonds },
        { rank: Rank.Ace, suit: Suit.Clubs },
        { rank: Rank.Ace, suit: Suit.Spades },
      ],
      value: 100,
    };
    expect(canPlayCards(royalBomb, lastPlay, Rank.Three)).toBe(true);
  });

  it("should not allow lower card to beat higher card of same type", () => {
    const lowerPlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.Five, suit: Suit.Hearts }],
      value: 5,
    };
    const higherPlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.Six, suit: Suit.Hearts }],
      value: 6,
    };
    expect(canPlayCards(lowerPlay, higherPlay, Rank.Three)).toBe(false);
  });
});

describe("Deck and Dealing", () => {
  it("should create a deck with 108 cards", () => {
    const deck = createDeck();
    expect(deck.length).toBe(108);
  });

  it("should deal cards to 4 players", () => {
    const players = [
      {
        position: PlayerPosition.Player0,
        userId: 1,
        name: "Player 1",
        isAI: false,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
      {
        position: PlayerPosition.Player1,
        userId: 2,
        name: "Player 2",
        isAI: true,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
      {
        position: PlayerPosition.Player2,
        userId: 3,
        name: "Player 3",
        isAI: true,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
      {
        position: PlayerPosition.Player3,
        userId: 4,
        name: "Player 4",
        isAI: true,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
    ];

    const hands = dealCards(players);
    expect(hands.length).toBe(4);
    expect(hands[0].length).toBe(27);
    expect(hands[1].length).toBe(27);
    expect(hands[2].length).toBe(27);
    expect(hands[3].length).toBe(27);
  });
});

describe("Game Creation", () => {
  it("should create a new game with initial state", () => {
    const players = [
      {
        position: PlayerPosition.Player0,
        userId: 1,
        name: "Player 1",
        isAI: false,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
      {
        position: PlayerPosition.Player1,
        userId: 2,
        name: "Player 2",
        isAI: true,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
      {
        position: PlayerPosition.Player2,
        userId: 3,
        name: "Player 3",
        isAI: true,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
      {
        position: PlayerPosition.Player3,
        userId: 4,
        name: "Player 4",
        isAI: true,
        hand: [],
        cardsRemaining: 0,
        isReady: false,
      },
    ];

    const game = createGame(players, Rank.Three);
    expect(game.status).toBe("dealing");
    expect(game.currentRank).toBe(Rank.Three);
    expect(game.players.length).toBe(4);
    expect(game.currentRound.currentPlayer).toBe(PlayerPosition.Player0);
  });
});

describe("Card Grouping", () => {
  it("should group cards by rank", () => {
    const cards: Card[] = [
      { rank: Rank.Five, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Diamonds },
      { rank: Rank.Six, suit: Suit.Clubs },
    ];
    const groups = groupCardsByRank(cards);
    expect(Object.keys(groups).length).toBe(2);
    expect(groups[Rank.Five].length).toBe(2);
    expect(groups[Rank.Six].length).toBe(1);
  });
});
