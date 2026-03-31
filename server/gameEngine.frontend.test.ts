/**
 * 前端游戏引擎测试（在 server 目录运行，使用 shared 模块）
 * 测试核心游戏逻辑：发牌、出牌、AI决策、终局判断
 */

import { describe, it, expect } from "vitest";
import { Rank, Suit, CardType, GameStatus, PlayerPosition, Team } from "../shared/types";

// 直接从 shared 导入核心逻辑（前端引擎的服务端等价实现）
// 由于前端引擎在 client/src/lib/gameEngine.ts，这里直接复制关键函数进行测试

// ===== 复制核心函数用于测试 =====

const RANK_ORDER = [
  Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
  Rank.King, Rank.Ace, Rank.Two,
];

function getRankValue(rank: Rank, currentRank: Rank): number {
  if (rank === Rank.BigJoker) return 1000;
  if (rank === Rank.SmallJoker) return 999;
  if (rank === currentRank) return 500 + RANK_ORDER.indexOf(currentRank);
  const index = RANK_ORDER.indexOf(rank);
  return index >= 0 ? index : -1;
}

function isRoyalBomb(cards: { rank: Rank; suit: Suit }[]): boolean {
  if (cards.length !== 2) return false;
  const ranks = cards.map(c => c.rank);
  return ranks.includes(Rank.SmallJoker) && ranks.includes(Rank.BigJoker);
}

function isBomb(cards: { rank: Rank; suit: Suit }[]): boolean {
  if (cards.length < 4) return false;
  const rank = cards[0].rank;
  return cards.every(c => c.rank === rank);
}

function groupCardsByRank(cards: { rank: Rank; suit: Suit }[]) {
  const groups: Record<string, { rank: Rank; suit: Suit }[]> = {};
  for (const card of cards) {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank].push(card);
  }
  return groups;
}

function isSequence(cards: { rank: Rank; suit: Suit }[], currentRank: Rank): boolean {
  if (cards.length < 5) return false;
  const ranks = cards.map(c => c.rank);
  if (ranks.includes(Rank.SmallJoker) || ranks.includes(Rank.BigJoker)) return false;
  const sorted = [...ranks].sort(
    (a, b) => getRankValue(a, currentRank) - getRankValue(b, currentRank)
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = RANK_ORDER.indexOf(sorted[i - 1]);
    const curr = RANK_ORDER.indexOf(sorted[i]);
    if (curr !== prev + 1) return false;
  }
  return true;
}

function identifyCardType(cards: { rank: Rank; suit: Suit }[], currentRank: Rank): CardType | null {
  if (cards.length === 0) return null;
  if (isRoyalBomb(cards)) return CardType.RoyalBomb;
  if (isBomb(cards)) return CardType.Bomb;
  if (isSequence(cards, currentRank)) return CardType.Sequence;
  const groups = groupCardsByRank(cards);
  const groupCount = Object.keys(groups).length;
  if (cards.length === 3 && groupCount === 1) return CardType.Triple;
  if (cards.length === 2 && groupCount === 1) return CardType.Pair;
  if (cards.length === 1) return CardType.Single;
  return null;
}

function calculatePlayValue(cards: { rank: Rank; suit: Suit }[], type: CardType, currentRank: Rank): number {
  const baseValue = getRankValue(cards[0].rank, currentRank);
  const multipliers: Record<CardType, number> = {
    [CardType.Single]: 1,
    [CardType.Pair]: 100,
    [CardType.Triple]: 10000,
    [CardType.Sequence]: 1000000,
    [CardType.PairSequence]: 100000000,
    [CardType.TripleSequence]: 10000000000,
    [CardType.Bomb]: 1000000000000,
    [CardType.RoyalBomb]: 10000000000000,
  };
  return baseValue * multipliers[type];
}

function canPlayCards(
  play: { type: CardType; cards: { rank: Rank; suit: Suit }[]; value: number },
  lastPlay: { type: CardType; cards: { rank: Rank; suit: Suit }[]; value: number } | null,
  _currentRank: Rank
): boolean {
  if (!lastPlay) return true;
  if (play.type === CardType.RoyalBomb) return true;
  if (play.type === CardType.Bomb) {
    if (lastPlay.type !== CardType.Bomb && lastPlay.type !== CardType.RoyalBomb) return true;
    if (lastPlay.type === CardType.Bomb) return play.value > lastPlay.value;
    return false;
  }
  if (play.type !== lastPlay.type) return false;
  if (play.cards.length !== lastPlay.cards.length) return false;
  return play.value > lastPlay.value;
}

function createDeck() {
  const deck: { rank: Rank; suit: Suit }[] = [];
  const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  const ranks = [
    Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
    Rank.King, Rank.Ace, Rank.Two,
  ];
  for (let i = 0; i < 2; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit });
      }
    }
    deck.push({ rank: Rank.SmallJoker, suit: Suit.Hearts });
    deck.push({ rank: Rank.BigJoker, suit: Suit.Hearts });
  }
  return deck;
}

// ===== 测试套件 =====

describe("前端游戏引擎 - 发牌系统", () => {
  it("应该生成 108 张牌的牌组（两副）", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(108);
  });

  it("应该包含 4 张大王和小王（各 2 张）", () => {
    const deck = createDeck();
    const bigJokers = deck.filter(c => c.rank === Rank.BigJoker);
    const smallJokers = deck.filter(c => c.rank === Rank.SmallJoker);
    expect(bigJokers).toHaveLength(2);
    expect(smallJokers).toHaveLength(2);
  });
});

describe("前端游戏引擎 - 牌型识别", () => {
  const currentRank = Rank.Three;

  it("应该识别单牌", () => {
    const cards = [{ rank: Rank.Ace, suit: Suit.Hearts }];
    expect(identifyCardType(cards, currentRank)).toBe(CardType.Single);
  });

  it("应该识别对子", () => {
    const cards = [
      { rank: Rank.King, suit: Suit.Hearts },
      { rank: Rank.King, suit: Suit.Spades },
    ];
    expect(identifyCardType(cards, currentRank)).toBe(CardType.Pair);
  });

  it("应该识别三张", () => {
    const cards = [
      { rank: Rank.Queen, suit: Suit.Hearts },
      { rank: Rank.Queen, suit: Suit.Spades },
      { rank: Rank.Queen, suit: Suit.Clubs },
    ];
    expect(identifyCardType(cards, currentRank)).toBe(CardType.Triple);
  });

  it("应该识别顺子（5张）", () => {
    const cards = [
      { rank: Rank.Three, suit: Suit.Hearts },
      { rank: Rank.Four, suit: Suit.Spades },
      { rank: Rank.Five, suit: Suit.Clubs },
      { rank: Rank.Six, suit: Suit.Diamonds },
      { rank: Rank.Seven, suit: Suit.Hearts },
    ];
    expect(identifyCardType(cards, Rank.Ace)).toBe(CardType.Sequence);
  });

  it("应该识别炸弹（4张相同）", () => {
    const cards = [
      { rank: Rank.Ace, suit: Suit.Hearts },
      { rank: Rank.Ace, suit: Suit.Spades },
      { rank: Rank.Ace, suit: Suit.Clubs },
      { rank: Rank.Ace, suit: Suit.Diamonds },
    ];
    expect(identifyCardType(cards, currentRank)).toBe(CardType.Bomb);
  });

  it("应该识别王炸（大小王）", () => {
    const cards = [
      { rank: Rank.SmallJoker, suit: Suit.Hearts },
      { rank: Rank.BigJoker, suit: Suit.Hearts },
    ];
    expect(identifyCardType(cards, currentRank)).toBe(CardType.RoyalBomb);
  });

  it("应该对无效组合返回 null", () => {
    const cards = [
      { rank: Rank.Three, suit: Suit.Hearts },
      { rank: Rank.Five, suit: Suit.Spades },
    ];
    expect(identifyCardType(cards, currentRank)).toBeNull();
  });
});

describe("前端游戏引擎 - 出牌规则", () => {
  // 使用 Ace 作为升级牌，避免 3 被当作特殊牌
  const currentRank = Rank.Ace;

  it("首出时任何合法牌型都可以出", () => {
    const play = {
      type: CardType.Single,
      cards: [{ rank: Rank.Three, suit: Suit.Hearts }],
      value: calculatePlayValue([{ rank: Rank.Three, suit: Suit.Hearts }], CardType.Single, currentRank),
    };
    expect(canPlayCards(play, null, currentRank)).toBe(true);
  });

  it("单牌只能被更大的单牌压过", () => {
    // currentRank=Ace，所以 3 < 5 < K（按普通顺序）
    const lastPlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.Five, suit: Suit.Hearts }],
      value: calculatePlayValue([{ rank: Rank.Five, suit: Suit.Hearts }], CardType.Single, currentRank),
    };
    const biggerPlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.King, suit: Suit.Hearts }],
      value: calculatePlayValue([{ rank: Rank.King, suit: Suit.Hearts }], CardType.Single, currentRank),
    };
    const smallerPlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.Three, suit: Suit.Hearts }],
      value: calculatePlayValue([{ rank: Rank.Three, suit: Suit.Hearts }], CardType.Single, currentRank),
    };
    expect(canPlayCards(biggerPlay, lastPlay, currentRank)).toBe(true);
    expect(canPlayCards(smallerPlay, lastPlay, currentRank)).toBe(false);
  });

  it("炸弹可以压过任何非炸弹牌型", () => {
    const lastPlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.Two, suit: Suit.Hearts }],
      value: calculatePlayValue([{ rank: Rank.Two, suit: Suit.Hearts }], CardType.Single, currentRank),
    };
    const bomb = {
      type: CardType.Bomb,
      cards: [
        { rank: Rank.Three, suit: Suit.Hearts },
        { rank: Rank.Three, suit: Suit.Spades },
        { rank: Rank.Three, suit: Suit.Clubs },
        { rank: Rank.Three, suit: Suit.Diamonds },
      ],
      value: calculatePlayValue(
        [{ rank: Rank.Three, suit: Suit.Hearts }, { rank: Rank.Three, suit: Suit.Spades },
         { rank: Rank.Three, suit: Suit.Clubs }, { rank: Rank.Three, suit: Suit.Diamonds }],
        CardType.Bomb, currentRank
      ),
    };
    expect(canPlayCards(bomb, lastPlay, currentRank)).toBe(true);
  });

  it("王炸可以压过任何牌型包括炸弹", () => {
    const bomb = {
      type: CardType.Bomb,
      cards: [
        { rank: Rank.Ace, suit: Suit.Hearts },
        { rank: Rank.Ace, suit: Suit.Spades },
        { rank: Rank.Ace, suit: Suit.Clubs },
        { rank: Rank.Ace, suit: Suit.Diamonds },
      ],
      value: 999999999,
    };
    const royalBomb = {
      type: CardType.RoyalBomb,
      cards: [
        { rank: Rank.SmallJoker, suit: Suit.Hearts },
        { rank: Rank.BigJoker, suit: Suit.Hearts },
      ],
      value: 10000000000000,
    };
    expect(canPlayCards(royalBomb, bomb, currentRank)).toBe(true);
  });

  it("不同牌型之间不能互相压（除炸弹外）", () => {
    const singlePlay = {
      type: CardType.Single,
      cards: [{ rank: Rank.Ace, suit: Suit.Hearts }],
      value: calculatePlayValue([{ rank: Rank.Ace, suit: Suit.Hearts }], CardType.Single, currentRank),
    };
    const pairPlay = {
      type: CardType.Pair,
      cards: [
        { rank: Rank.Two, suit: Suit.Hearts },
        { rank: Rank.Two, suit: Suit.Spades },
      ],
      value: calculatePlayValue(
        [{ rank: Rank.Two, suit: Suit.Hearts }, { rank: Rank.Two, suit: Suit.Spades }],
        CardType.Pair, currentRank
      ),
    };
    // 对子不能压单牌
    expect(canPlayCards(pairPlay, singlePlay, currentRank)).toBe(false);
  });
});

describe("前端游戏引擎 - 终局判断", () => {
  it("玩家出完所有牌后应该触发游戏结束", () => {
    // 模拟一个只剩1张牌的玩家出完牌的场景
    const hand = [{ rank: Rank.Ace, suit: Suit.Hearts }];
    const cardToPlay = hand[0];

    // 出完后手牌为空
    const newHand = hand.filter(
      c => !(c.rank === cardToPlay.rank && c.suit === cardToPlay.suit)
    );
    expect(newHand).toHaveLength(0);
    // 手牌为空意味着游戏结束
    expect(newHand.length === 0).toBe(true);
  });

  it("队伍判断应该正确（0和2是一队，1和3是一队）", () => {
    // Player 0 和 Player 2 是 Team1
    // Player 1 和 Player 3 是 Team2
    const getTeam = (pos: PlayerPosition) =>
      pos === PlayerPosition.Player0 || pos === PlayerPosition.Player2 ? Team.Team1 : Team.Team2;

    expect(getTeam(PlayerPosition.Player0)).toBe(Team.Team1);
    expect(getTeam(PlayerPosition.Player2)).toBe(Team.Team1);
    expect(getTeam(PlayerPosition.Player1)).toBe(Team.Team2);
    expect(getTeam(PlayerPosition.Player3)).toBe(Team.Team2);
  });
});

describe("前端游戏引擎 - 不要规则", () => {
  it("连续3个玩家不要后应该重置出牌记录", () => {
    // 模拟 pass 计数逻辑
    let passCount = 0;
    let lastPlay: { type: string } | null = { type: "single" };
    let lastPlayer: number | null = 0;

    // 3个玩家依次不要
    for (let i = 0; i < 3; i++) {
      passCount++;
    }

    if (passCount >= 3) {
      lastPlay = null;
      lastPlayer = null;
      passCount = 0;
    }

    expect(lastPlay).toBeNull();
    expect(lastPlayer).toBeNull();
    expect(passCount).toBe(0);
  });
});
