/**
 * 前端掼蛋游戏引擎
 * 对照官方规则全面修复：三带二、同花顺、顺子限5张、连对限3对、三顺限2个
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
  return ranks.includes(Rank.SmallJoker) && ranks.includes(Rank.BigJoker);
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

/**
 * 判断是否为顺子：严格5张，连续单牌，不含王牌
 * 支持绕圈顺：A-2-3-4-5 和 10-J-Q-K-A
 */
export function isSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length !== 5) return false;
  const ranks = cards.map((c) => c.rank);
  // 不能包含王牌
  if (ranks.includes(Rank.SmallJoker) || ranks.includes(Rank.BigJoker)) return false;
  // 每张点数必须不同（顺子不能有重复）
  const groups = groupCardsByRank(cards);
  if (Object.keys(groups).length !== 5) return false;

  const sorted = [...ranks].sort(
    (a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b)
  );

  // 检查是否为 A-2-3-4-5（绕圈顺，A 作为最小）
  const isALow =
    sorted[0] === Rank.Three &&
    sorted[1] === Rank.Four &&
    sorted[2] === Rank.Five &&
    sorted[3] === Rank.Two &&
    sorted[4] === Rank.Ace;
  // 实际上 A-2-3-4-5 在 RANK_ORDER 中 A=11, 2=12，需要特殊处理
  // 按照规则：A-2-3-4-5 是最小顺子
  const rankIndices = sorted.map(r => RANK_ORDER.indexOf(r));
  // 普通连续检查
  let isNormalSeq = true;
  for (let i = 1; i < rankIndices.length; i++) {
    if (rankIndices[i] !== rankIndices[i - 1] + 1) {
      isNormalSeq = false;
      break;
    }
  }
  if (isNormalSeq) return true;

  // 特殊检查 A-2-3-4-5：索引为 [0,1,2,11,12] → 排序后 [0,1,2,11,12]
  const specialALow = rankIndices.length === 5 &&
    rankIndices[0] === RANK_ORDER.indexOf(Rank.Three) &&
    rankIndices[1] === RANK_ORDER.indexOf(Rank.Four) &&
    rankIndices[2] === RANK_ORDER.indexOf(Rank.Five) &&
    rankIndices[3] === RANK_ORDER.indexOf(Rank.Ace) &&
    rankIndices[4] === RANK_ORDER.indexOf(Rank.Two);
  if (specialALow) return true;

  // 特殊检查 10-J-Q-K-A
  const specialAHigh = rankIndices.length === 5 &&
    rankIndices[0] === RANK_ORDER.indexOf(Rank.Ten) &&
    rankIndices[1] === RANK_ORDER.indexOf(Rank.Jack) &&
    rankIndices[2] === RANK_ORDER.indexOf(Rank.Queen) &&
    rankIndices[3] === RANK_ORDER.indexOf(Rank.King) &&
    rankIndices[4] === RANK_ORDER.indexOf(Rank.Ace);
  if (specialAHigh) return true;

  return false;
}

/**
 * 判断是否为同花顺：同花色的5张连续牌
 */
export function isStraightFlush(cards: Card[], currentRank: Rank): boolean {
  if (cards.length !== 5) return false;
  // 必须同花色
  const suit = cards[0].suit;
  if (!cards.every(c => c.suit === suit)) return false;
  // 不含王牌
  if (cards.some(c => c.rank === Rank.SmallJoker || c.rank === Rank.BigJoker)) return false;
  // 必须是顺子
  return isSequence(cards, currentRank);
}

/**
 * 判断是否为连对（对顺）：严格3对，连续点数
 * 规则：三对连续对牌，不可超过3对，两连对不可出
 */
export function isPairSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length !== 6) return false; // 严格3对=6张
  const groups = groupCardsByRank(cards);
  if (Object.values(groups).some((g) => g.length !== 2)) return false;
  const ranks = Object.keys(groups).sort(
    (a, b) => RANK_ORDER.indexOf(a as Rank) - RANK_ORDER.indexOf(b as Rank)
  );
  if (ranks.length !== 3) return false;
  for (let i = 1; i < ranks.length; i++) {
    const prev = RANK_ORDER.indexOf(ranks[i - 1] as Rank);
    const curr = RANK_ORDER.indexOf(ranks[i] as Rank);
    if (curr !== prev + 1) return false;
  }
  return true;
}

/**
 * 判断是否为三顺（钢板）：严格2个连续三张
 * 规则：二个连续三张牌，不可超过2个
 */
export function isTripleSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length !== 6) return false; // 严格2个三张=6张
  const groups = groupCardsByRank(cards);
  if (Object.values(groups).some((g) => g.length !== 3)) return false;
  const ranks = Object.keys(groups).sort(
    (a, b) => RANK_ORDER.indexOf(a as Rank) - RANK_ORDER.indexOf(b as Rank)
  );
  if (ranks.length !== 2) return false;
  const prev = RANK_ORDER.indexOf(ranks[0] as Rank);
  const curr = RANK_ORDER.indexOf(ranks[1] as Rank);
  return curr === prev + 1;
}

/**
 * 判断是否为三带二：3张同点数 + 1对（共5张）
 */
export function isFullHouse(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const groups = groupCardsByRank(cards);
  const counts = Object.values(groups).map(g => g.length).sort();
  // 必须是 [2, 3]
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

export function identifyCardType(cards: Card[], currentRank: Rank): CardType | null {
  if (cards.length === 0) return null;
  if (isRoyalBomb(cards)) return CardType.RoyalBomb;
  if (isBomb(cards)) return CardType.Bomb;
  // 同花顺优先于普通顺子判断
  if (isStraightFlush(cards, currentRank)) return CardType.StraightFlush;
  if (isTripleSequence(cards, currentRank)) return CardType.TripleSequence;
  if (isPairSequence(cards, currentRank)) return CardType.PairSequence;
  if (isSequence(cards, currentRank)) return CardType.Sequence;
  if (isFullHouse(cards)) return CardType.FullHouse;
  const groups = groupCardsByRank(cards);
  const groupCount = Object.keys(groups).length;
  // 大小王不能单独出牌（单张、对子、三张），只能一起出王炸
  const hasJoker = cards.some(c => c.rank === Rank.SmallJoker || c.rank === Rank.BigJoker);
  if (hasJoker) return null;
  if (cards.length === 3 && groupCount === 1) return CardType.Triple;
  if (cards.length === 2 && groupCount === 1) return CardType.Pair;
  if (cards.length === 1) return CardType.Single;
  return null;
}

/**
 * 计算出牌的数值（用于比较大小）
 * 规则：四王 > 6张+炸弹 > 同花顺 > 5张炸弹 > 4张炸弹 > 普通牌型
 * 三带二比较三张部分的点数
 */
export function calculatePlayValue(cards: Card[], type: CardType, currentRank: Rank): number {
  // 三带二：取三张部分的点数作为基准值
  if (type === CardType.FullHouse) {
    const groups = groupCardsByRank(cards);
    const tripleRank = Object.entries(groups).find(([, g]) => g.length === 3)?.[0] as Rank;
    const baseValue = getRankValue(tripleRank, currentRank);
    return baseValue * 50000;
  }

  const baseValue = getRankValue(cards[0].rank, currentRank);

  // 炸弹：张数越多越大（5张 > 4张），同张数再比点数
  if (type === CardType.Bomb) {
    return cards.length * 1000000000000 + baseValue;
  }

  // 同花顺：介于5张炸弹和6张炸弹之间
  // 6张炸弹值 = 6 * 1e12 + base ≈ 6e12
  // 5张炸弹值 = 5 * 1e12 + base ≈ 5e12
  // 同花顺值 = 5.5e12 + base（大于5张炸弹，小于6张炸弹）
  if (type === CardType.StraightFlush) {
    return 5500000000000 + baseValue;
  }

  const multipliers: Record<CardType, number> = {
    [CardType.Single]: 1,
    [CardType.Pair]: 100,
    [CardType.Triple]: 10000,
    [CardType.FullHouse]: 50000,
    [CardType.Sequence]: 1000000,
    [CardType.PairSequence]: 100000000,
    [CardType.TripleSequence]: 10000000000,
    [CardType.StraightFlush]: 5500000000000,
    [CardType.Bomb]: 1000000000000,
    [CardType.RoyalBomb]: 100000000000000,
  };
  return baseValue * multipliers[type];
}

/**
 * 判断是否可以出牌（相对于上一手牌）
 * 规则：
 * - 王炸最大，可压任何牌
 * - 炸弹可压非炸弹牌型；炸弹之间比张数再比点数
 * - 同花顺只能被炸弹/王炸压过，不能被普通顺子压
 * - 其他牌型：必须同类型同张数，比点数大小
 */
export function canPlayCards(
  play: CardPlay,
  lastPlay: CardPlay | null,
  currentRank: Rank
): boolean {
  if (!lastPlay) return true;
  if (play.type === CardType.RoyalBomb) return true;

  if (play.type === CardType.Bomb) {
    // 炸弹可压非炸弹、非同花顺（同花顺 > 普通炸弹，但 < 6张炸弹）
    if (lastPlay.type === CardType.RoyalBomb) return false;
    if (lastPlay.type === CardType.Bomb) return play.value > lastPlay.value;
    if (lastPlay.type === CardType.StraightFlush) {
      // 同花顺 > 5张炸弹，只有6张及以上炸弹才能压同花顺
      return play.cards.length >= 6;
    }
    return true; // 炸弹可压普通牌型
  }

  if (play.type === CardType.StraightFlush) {
    if (lastPlay.type === CardType.RoyalBomb) return false;
    if (lastPlay.type === CardType.Bomb) return false; // 炸弹大于同花顺（除非是5张以下，但炸弹最少4张）
    if (lastPlay.type === CardType.StraightFlush) return play.value > lastPlay.value;
    // 同花顺不能压普通顺子（同花顺是特殊炸弹级别）
    return false;
  }

  // 普通牌型：必须同类型同张数
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
  // 发牌后对所有手牌按点数从小到大排序
  const sortedHands = hands.map(h => sortCards(h, currentRank));
  const players: Player[] = [
    { position: PlayerPosition.Player0, userId: 1, name: playerName, isAI: false, hand: sortedHands[0], cardsRemaining: sortedHands[0].length, isReady: true },
    { position: PlayerPosition.Player1, userId: 0, name: "AI 东", isAI: true, hand: sortedHands[1], cardsRemaining: sortedHands[1].length, isReady: true },
    { position: PlayerPosition.Player2, userId: 0, name: "AI 北", isAI: true, hand: sortedHands[2], cardsRemaining: sortedHands[2].length, isReady: true },
    { position: PlayerPosition.Player3, userId: 0, name: "AI 西", isAI: true, hand: sortedHands[3], cardsRemaining: sortedHands[3].length, isReady: true },
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
  const targetType = lastPlay.type;

  // 王炸
  const jokers = hand.filter(c => c.rank === Rank.SmallJoker || c.rank === Rank.BigJoker);
  if (jokers.length === 2) {
    results.push(jokers);
  }

  // 炸弹：推荐所有可能的炸弹张数（4、5、...N 张）
  const groups = groupCardsByRank(hand);
  for (const [, cards] of Object.entries(groups)) {
    if (cards.length >= 4) {
      for (let bombSize = 4; bombSize <= cards.length; bombSize++) {
        const bomb = cards.slice(0, bombSize);
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
  }

  // 同花顺搜索
  if (targetType === CardType.StraightFlush || targetType === CardType.Sequence) {
    // 按花色分组，在每种花色中找5张连续牌
    const bySuit: Record<string, Card[]> = {};
    for (const card of hand) {
      if (!bySuit[card.suit]) bySuit[card.suit] = [];
      bySuit[card.suit].push(card);
    }
    for (const suitCards of Object.values(bySuit)) {
      const sorted = sortCards(suitCards, currentRank).filter(
        c => c.rank !== Rank.SmallJoker && c.rank !== Rank.BigJoker
      );
      for (let start = 0; start <= sorted.length - 5; start++) {
        const combo = sorted.slice(start, start + 5);
        if (isStraightFlush(combo, currentRank)) {
          const play: CardPlay = {
            type: CardType.StraightFlush,
            cards: combo,
            value: calculatePlayValue(combo, CardType.StraightFlush, currentRank),
          };
          if (canPlayCards(play, lastPlay, currentRank)) {
            results.push(combo);
          }
        }
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
  } else if (targetType === CardType.FullHouse) {
    // 三带二搜索：找所有三张组合，再配一对
    for (const [tripleRank, tripleCards] of Object.entries(groups)) {
      if (tripleCards.length >= 3) {
        const triple = tripleCards.slice(0, 3);
        // 找配对（不同点数）
        for (const [pairRank, pairCards] of Object.entries(groups)) {
          if (pairRank !== tripleRank && pairCards.length >= 2) {
            const combo = [...triple, ...pairCards.slice(0, 2)];
            const play: CardPlay = {
              type: CardType.FullHouse,
              cards: combo,
              value: calculatePlayValue(combo, CardType.FullHouse, currentRank),
            };
            if (canPlayCards(play, lastPlay, currentRank)) {
              results.push(combo);
            }
          }
        }
      }
    }
  } else if (targetType === CardType.Sequence) {
    // 顺子搜索（严格5张）
    const sorted = sortCards(hand, currentRank).filter(
      c => c.rank !== Rank.SmallJoker && c.rank !== Rank.BigJoker
    );
    // 去重（同点数只取一张）
    const uniqueSorted: Card[] = [];
    const seen = new Set<string>();
    for (const card of sorted) {
      if (!seen.has(card.rank)) {
        seen.add(card.rank);
        uniqueSorted.push(card);
      }
    }
    for (let start = 0; start <= uniqueSorted.length - 5; start++) {
      const combo = uniqueSorted.slice(start, start + 5);
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
  } else if (targetType === CardType.PairSequence) {
    // 连对搜索（严格3对=6张）
    const pairRanks = Object.entries(groups)
      .filter(([, g]) => g.length >= 2)
      .map(([r]) => r as Rank)
      .sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
    for (let start = 0; start <= pairRanks.length - 3; start++) {
      const threeRanks = pairRanks.slice(start, start + 3);
      // 检查是否连续
      let consecutive = true;
      for (let i = 1; i < threeRanks.length; i++) {
        if (RANK_ORDER.indexOf(threeRanks[i]) !== RANK_ORDER.indexOf(threeRanks[i-1]) + 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) {
        const combo = threeRanks.flatMap(r => groups[r].slice(0, 2));
        const play: CardPlay = {
          type: CardType.PairSequence,
          cards: combo,
          value: calculatePlayValue(combo, CardType.PairSequence, currentRank),
        };
        if (canPlayCards(play, lastPlay, currentRank)) {
          results.push(combo);
        }
      }
    }
  } else if (targetType === CardType.TripleSequence) {
    // 三顺搜索（严格2个三张=6张）
    const tripleRanks = Object.entries(groups)
      .filter(([, g]) => g.length >= 3)
      .map(([r]) => r as Rank)
      .sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
    for (let start = 0; start <= tripleRanks.length - 2; start++) {
      const twoRanks = tripleRanks.slice(start, start + 2);
      if (RANK_ORDER.indexOf(twoRanks[1]) === RANK_ORDER.indexOf(twoRanks[0]) + 1) {
        const combo = twoRanks.flatMap(r => groups[r].slice(0, 3));
        const play: CardPlay = {
          type: CardType.TripleSequence,
          cards: combo,
          value: calculatePlayValue(combo, CardType.TripleSequence, currentRank),
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
    [CardType.FullHouse]: "三带二",
    [CardType.Sequence]: "顺子",
    [CardType.PairSequence]: "连对",
    [CardType.TripleSequence]: "三顺",
    [CardType.StraightFlush]: "同花顺",
    [CardType.Bomb]: "炸弹",
    [CardType.RoyalBomb]: "王炸",
  };
  return labels[type] || type;
}
