/**
 * 前端掼蛋游戏引擎
 * 将核心游戏逻辑运行在浏览器端，实现流畅的本地游戏体验
 */

import {
  Card,
  CardPlay,
  CardType,
  GameRound,
  GameStateData,
  GameStatus,
  Player,
  PlayerPosition,
  Rank,
  Suit,
  Team,
  getNextPlayer,
  getTeam,
  RANK_ORDER,
} from "@shared/types";

// ===== 牌值计算 =====

export function getRankValue(rank: Rank, currentRank: Rank): number {
  if (rank === Rank.BigJoker) return 1000;
  if (rank === Rank.SmallJoker) return 999;
  if (rank === currentRank) return 500 + RANK_ORDER.indexOf(currentRank);
  const index = RANK_ORDER.indexOf(rank);
  return index >= 0 ? index : -1;
}

// ===== 牌型判断 =====

export function isRoyalBomb(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const ranks = cards.map((c) => c.rank);
  return (
    (ranks.includes(Rank.SmallJoker) && ranks.includes(Rank.BigJoker))
  );
}

export function isBomb(cards: Card[]): boolean {
  if (cards.length < 4) return false;
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

export function groupCardsByRank(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const card of cards) {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank].push(card);
  }
  return groups;
}

export function isSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length < 5) return false;
  const ranks = cards.map((c) => c.rank);
  // 不能包含王牌
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

export function isPairSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length < 6 || cards.length % 2 !== 0) return false;
  const groups = groupCardsByRank(cards);
  if (Object.values(groups).some((g) => g.length !== 2)) return false;
  const ranks = Object.keys(groups).sort(
    (a, b) => getRankValue(a as Rank, currentRank) - getRankValue(b as Rank, currentRank)
  );
  for (let i = 1; i < ranks.length; i++) {
    const prev = RANK_ORDER.indexOf(ranks[i - 1] as Rank);
    const curr = RANK_ORDER.indexOf(ranks[i] as Rank);
    if (curr !== prev + 1) return false;
  }
  return true;
}

export function isTripleSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length < 6 || cards.length % 3 !== 0) return false;
  const groups = groupCardsByRank(cards);
  if (Object.values(groups).some((g) => g.length !== 3)) return false;
  const ranks = Object.keys(groups).sort(
    (a, b) => getRankValue(a as Rank, currentRank) - getRankValue(b as Rank, currentRank)
  );
  for (let i = 1; i < ranks.length; i++) {
    const prev = RANK_ORDER.indexOf(ranks[i - 1] as Rank);
    const curr = RANK_ORDER.indexOf(ranks[i] as Rank);
    if (curr !== prev + 1) return false;
  }
  return true;
}

export function identifyCardType(cards: Card[], currentRank: Rank): CardType | null {
  if (cards.length === 0) return null;
  if (isRoyalBomb(cards)) return CardType.RoyalBomb;
  if (isBomb(cards)) return CardType.Bomb;
  if (isTripleSequence(cards, currentRank)) return CardType.TripleSequence;
  if (isPairSequence(cards, currentRank)) return CardType.PairSequence;
  if (isSequence(cards, currentRank)) return CardType.Sequence;
  const groups = groupCardsByRank(cards);
  const groupCount = Object.keys(groups).length;
  if (cards.length === 3 && groupCount === 1) return CardType.Triple;
  if (cards.length === 2 && groupCount === 1) return CardType.Pair;
  if (cards.length === 1) return CardType.Single;
  return null;
}

export function calculatePlayValue(cards: Card[], type: CardType, currentRank: Rank): number {
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

export function canPlayCards(
  play: CardPlay,
  lastPlay: CardPlay | null,
  currentRank: Rank
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

// ===== 发牌 =====

export function createDeck(): Card[] {
  const deck: Card[] = [];
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

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(): Card[][] {
  const deck = shuffleDeck(createDeck());
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands;
}

// ===== 游戏状态管理 =====

export function createInitialGameState(
  playerName: string,
  currentRank: Rank = Rank.Three
): GameStateData {
  const hands = dealCards();
  const players: Player[] = [
    { position: PlayerPosition.Player0, userId: 1, name: playerName, isAI: false, hand: hands[0], cardsRemaining: hands[0].length, isReady: true },
    { position: PlayerPosition.Player1, userId: 0, name: "AI 东", isAI: true, hand: hands[1], cardsRemaining: hands[1].length, isReady: true },
    { position: PlayerPosition.Player2, userId: 0, name: "AI 北", isAI: true, hand: hands[2], cardsRemaining: hands[2].length, isReady: true },
    { position: PlayerPosition.Player3, userId: 0, name: "AI 西", isAI: true, hand: hands[3], cardsRemaining: hands[3].length, isReady: true },
  ];

  return {
    gameId: `game_${Date.now()}`,
    status: GameStatus.Playing,
    players,
    currentRank,
    currentRound: {
      roundNumber: 1,
      currentPlayer: PlayerPosition.Player0,
      lastPlay: null,
      lastPlayer: null,
      passCount: 0,
      plays: [],
    },
    gameHistory: [],
    winningTeam: null,
    startedAt: new Date(),
    endedAt: null,
  };
}

/**
 * 执行出牌，返回新的游戏状态
 */
export function executePlay(
  gameState: GameStateData,
  playerPos: PlayerPosition,
  cards: Card[]
): { success: boolean; error?: string; newState?: GameStateData } {
  if (gameState.currentRound.currentPlayer !== playerPos) {
    return { success: false, error: "还没到你的回合" };
  }

  const cardType = identifyCardType(cards, gameState.currentRank);
  if (!cardType) {
    return { success: false, error: "无效的牌型组合" };
  }

  const play: CardPlay = {
    type: cardType,
    cards,
    value: calculatePlayValue(cards, cardType, gameState.currentRank),
  };

  if (!canPlayCards(play, gameState.currentRound.lastPlay, gameState.currentRank)) {
    return { success: false, error: "出的牌不够大，无法压过上家" };
  }

  // 验证玩家手牌
  const playerHand = gameState.players[playerPos].hand;
  for (const card of cards) {
    if (!playerHand.some((c) => c.rank === card.rank && c.suit === card.suit)) {
      return { success: false, error: "手牌中没有这张牌" };
    }
  }

  // 深拷贝状态
  const newState = deepCloneGameState(gameState);

  // 从手牌中移除出的牌
  const newHand = removeCardsFromHand(newState.players[playerPos].hand, cards);
  newState.players[playerPos].hand = newHand;
  newState.players[playerPos].cardsRemaining = newHand.length;

  // 更新回合状态
  newState.currentRound.lastPlay = play;
  newState.currentRound.lastPlayer = playerPos;
  newState.currentRound.passCount = 0;
  newState.currentRound.plays.push({ player: playerPos, play });

  // 检查游戏是否结束
  if (newHand.length === 0) {
    newState.status = GameStatus.Finished;
    newState.winningTeam = getTeam(playerPos);
    newState.endedAt = new Date();
    return { success: true, newState };
  }

  // 移动到下一个玩家
  newState.currentRound.currentPlayer = getNextPlayer(playerPos);

  return { success: true, newState };
}

/**
 * 执行不要
 */
export function executePass(
  gameState: GameStateData,
  playerPos: PlayerPosition
): { success: boolean; error?: string; newState?: GameStateData } {
  if (gameState.currentRound.currentPlayer !== playerPos) {
    return { success: false, error: "还没到你的回合" };
  }
  if (!gameState.currentRound.lastPlay) {
    return { success: false, error: "首出不能不要" };
  }

  const newState = deepCloneGameState(gameState);
  newState.currentRound.passCount++;
  newState.currentRound.plays.push({ player: playerPos, play: null });

  // 3个玩家都不要，清空出牌记录，上一个出牌的玩家重新开始
  if (newState.currentRound.passCount >= 3) {
    const lastPlayer = newState.currentRound.lastPlayer!;
    newState.currentRound.lastPlay = null;
    newState.currentRound.lastPlayer = null;
    newState.currentRound.passCount = 0;
    newState.currentRound.currentPlayer = lastPlayer;
  } else {
    newState.currentRound.currentPlayer = getNextPlayer(playerPos);
  }

  return { success: true, newState };
}

/**
 * AI 决策：返回要出的牌，null 表示不要
 */
export function getAIMove(
  gameState: GameStateData,
  playerPos: PlayerPosition
): Card[] | null {
  const hand = gameState.players[playerPos].hand;
  const lastPlay = gameState.currentRound.lastPlay;
  const currentRank = gameState.currentRank;

  if (!lastPlay) {
    // 首出：出最小的单牌
    const sorted = sortCards(hand, currentRank);
    return [sorted[0]];
  }

  // 尝试找到能压过上家的最小牌型
  const candidates = findPlayableCombinations(hand, lastPlay, currentRank);

  if (candidates.length === 0) return null;

  // 选择最小的能压过的牌型
  candidates.sort((a, b) => {
    const typeA = identifyCardType(a, currentRank)!;
    const typeB = identifyCardType(b, currentRank)!;
    const valA = calculatePlayValue(a, typeA, currentRank);
    const valB = calculatePlayValue(b, typeB, currentRank);
    return valA - valB;
  });

  return candidates[0];
}

/**
 * 找到所有可以出的牌型组合
 */
export function findPlayableCombinations(
  hand: Card[],
  lastPlay: CardPlay,
  currentRank: Rank
): Card[][] {
  const results: Card[][] = [];
  const n = hand.length;

  // 根据上家牌型，只搜索相同长度（或炸弹）
  const targetLen = lastPlay.cards.length;
  const targetType = lastPlay.type;

  // 王炸
  const jokers = hand.filter(c => c.rank === Rank.SmallJoker || c.rank === Rank.BigJoker);
  if (jokers.length === 2) {
    results.push(jokers);
  }

  // 炸弹
  const groups = groupCardsByRank(hand);
  for (const [rank, cards] of Object.entries(groups)) {
    if (cards.length >= 4) {
      const bomb = cards.slice(0, 4);
      const play: CardPlay = {
        type: CardType.Bomb,
        cards: bomb,
        value: calculatePlayValue(bomb, CardType.Bomb, currentRank),
      };
      if (canPlayCards(play, lastPlay, currentRank)) {
        results.push(bomb);
      }
    }
  }

  // 同牌型搜索
  if (targetType === CardType.Single) {
    for (const card of hand) {
      const play: CardPlay = {
        type: CardType.Single,
        cards: [card],
        value: calculatePlayValue([card], CardType.Single, currentRank),
      };
      if (canPlayCards(play, lastPlay, currentRank)) {
        results.push([card]);
      }
    }
  } else if (targetType === CardType.Pair) {
    for (const [, cards] of Object.entries(groups)) {
      if (cards.length >= 2) {
        const pair = cards.slice(0, 2);
        const play: CardPlay = {
          type: CardType.Pair,
          cards: pair,
          value: calculatePlayValue(pair, CardType.Pair, currentRank),
        };
        if (canPlayCards(play, lastPlay, currentRank)) {
          results.push(pair);
        }
      }
    }
  } else if (targetType === CardType.Triple) {
    for (const [, cards] of Object.entries(groups)) {
      if (cards.length >= 3) {
        const triple = cards.slice(0, 3);
        const play: CardPlay = {
          type: CardType.Triple,
          cards: triple,
          value: calculatePlayValue(triple, CardType.Triple, currentRank),
        };
        if (canPlayCards(play, lastPlay, currentRank)) {
          results.push(triple);
        }
      }
    }
  } else if (targetType === CardType.Sequence) {
    // 顺子搜索
    const sorted = sortCards(hand, currentRank).filter(
      c => c.rank !== Rank.SmallJoker && c.rank !== Rank.BigJoker
    );
    for (let start = 0; start <= sorted.length - targetLen; start++) {
      const combo = sorted.slice(start, start + targetLen);
      if (isSequence(combo, currentRank)) {
        const play: CardPlay = {
          type: CardType.Sequence,
          cards: combo,
          value: calculatePlayValue(combo, CardType.Sequence, currentRank),
        };
        if (canPlayCards(play, lastPlay, currentRank)) {
          results.push(combo);
        }
      }
    }
  }

  return results;
}

// ===== 工具函数 =====

export function sortCards(cards: Card[], currentRank: Rank): Card[] {
  return [...cards].sort(
    (a, b) => getRankValue(a.rank, currentRank) - getRankValue(b.rank, currentRank)
  );
}

function removeCardsFromHand(hand: Card[], toRemove: Card[]): Card[] {
  const result = [...hand];
  for (const card of toRemove) {
    const idx = result.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (idx !== -1) result.splice(idx, 1);
  }
  return result;
}

function deepCloneGameState(state: GameStateData): GameStateData {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      hand: [...p.hand],
    })),
    currentRound: {
      ...state.currentRound,
      lastPlay: state.currentRound.lastPlay
        ? { ...state.currentRound.lastPlay, cards: [...state.currentRound.lastPlay.cards] }
        : null,
      plays: [...state.currentRound.plays],
    },
    gameHistory: [...state.gameHistory],
  };
}

export function getCardTypeLabel(type: CardType): string {
  const labels: Record<CardType, string> = {
    [CardType.Single]: "单牌",
    [CardType.Pair]: "对子",
    [CardType.Triple]: "三张",
    [CardType.Sequence]: "顺子",
    [CardType.PairSequence]: "对顺",
    [CardType.TripleSequence]: "三顺",
    [CardType.Bomb]: "炸弹",
    [CardType.RoyalBomb]: "王炸",
  };
  return labels[type] || type;
}
