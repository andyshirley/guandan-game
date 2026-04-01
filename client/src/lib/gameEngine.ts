/**
 * 前端掼蛋游戏引擎
 * 对照官方规则全面修复：三带二、同花顺、顺子限5张、连对限3对、三顺限2个
 * 实现红心参谋（逢人配）的万能牌配置逻辑
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
  getTeammate,
  RANK_ORDER,
  LEVEL_ORDER,
} from "@shared/types";

// ===== 红心参谋（逢人配）支持 =====

/**
 * 判断是否为红心参谋
 */
export function isHeartRank(card: Card, currentRank: Rank): boolean {
  return card.suit === Suit.Hearts && card.rank === currentRank;
}

/**
 * 获取手中的红心参谋数量
 */
export function getHeartRankCount(hand: Card[], currentRank: Rank): number {
  return hand.filter(c => isHeartRank(c, currentRank)).length;
}

/**
 * 替换手中的红心参谋为指定点数（用于显示配置）
 * 返回替换后的牌组合，用于识别牌型
 */
export function replaceHeartRankWithRank(
  cards: Card[],
  targetRank: Rank,
  currentRank: Rank
): Card[] {
  return cards.map(c => {
    if (isHeartRank(c, currentRank)) {
      // 红心参谋替换为目标点数，保持红心花色和 id
      return { id: c.id, rank: targetRank, suit: Suit.Hearts };
    }
    return c;
  });
}

/**
 * 生成所有可能的红心参谋配置
 * 用于在出牌时提示玩家可能的配置方式
 */
export function generateHeartRankConfigurations(
  cards: Card[],
  currentRank: Rank
): Array<{ config: Card[]; description: string }> {
  const heartRankCount = getHeartRankCount(cards, currentRank);
  if (heartRankCount === 0) return [];

  const configs: Array<{ config: Card[]; description: string }> = [];
  const nonHeartCards = cards.filter(c => !isHeartRank(c, currentRank));

  // 如果全是红心参谋，不需要配置
  if (nonHeartCards.length === 0) return [];

  // 获取非红心参谋牌的点数
  const ranks = new Set(nonHeartCards.map(c => c.rank));

  // 为每个不同的点数生成一个配置
  for (const rank of Array.from(ranks)) {
    const config = replaceHeartRankWithRank(cards, rank, currentRank);
    configs.push({
      config,
      description: `配成${getRankDisplay(rank)}`,
    });
  }

  return configs;
}

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
  // 官方规则第四条十：四大天王 = 大小王各两张（共4张），是最大的炸弹
  if (cards.length !== 4) return false;
  const smallJokers = cards.filter(c => c.rank === Rank.SmallJoker).length;
  const bigJokers = cards.filter(c => c.rank === Rank.BigJoker).length;
  return smallJokers === 2 && bigJokers === 2;
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

  // 新 RANK_ORDER：2(0),3(1),4(2),5(3),6(4),7(5),8(6),9(7),10(8),J(9),Q(10),K(11),A(12)
  const rankIndices = sorted.map(r => RANK_ORDER.indexOf(r));

  // 普通连续检查（包括 10-J-Q-K-A，因为它们在新顺序中是连续的）
  let isNormalSeq = true;
  for (let i = 1; i < rankIndices.length; i++) {
    if (rankIndices[i] !== rankIndices[i - 1] + 1) {
      isNormalSeq = false;
      break;
    }
  }
  if (isNormalSeq) return true;

  // 特殊检查 A-2-3-4-5：新顺序中索引为 [0,1,2,3,12]（即 2,3,4,5,A）
  // A 在绕圈顺中作为最小牌
  const specialALow = rankIndices.length === 5 &&
    rankIndices[0] === RANK_ORDER.indexOf(Rank.Two) &&
    rankIndices[1] === RANK_ORDER.indexOf(Rank.Three) &&
    rankIndices[2] === RANK_ORDER.indexOf(Rank.Four) &&
    rankIndices[3] === RANK_ORDER.indexOf(Rank.Five) &&
    rankIndices[4] === RANK_ORDER.indexOf(Rank.Ace);
  if (specialALow) return true;

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
  
  // 红心参谋支持：将红心参谋替换为其他点数后再进行牌型识别
  // 这样可以识别出红心参谋配成的各种牌型
  const heartRankCount = getHeartRankCount(cards, currentRank);
  if (heartRankCount > 0 && heartRankCount < cards.length) {
    // 有红心参谋但不是全红心参谋，需要尝试不同的配置
    // 获取非红心参谋牌的点数，尝试将红心参谋配成这些点数
    const nonHeartCards = cards.filter(c => !isHeartRank(c, currentRank));
    const possibleRanks = new Set(nonHeartCards.map(c => c.rank));
    
    for (const rank of Array.from(possibleRanks)) {
      const configuredCards = replaceHeartRankWithRank(cards, rank, currentRank);
      // 尝试识别配置后的牌型
      if (isBomb(configuredCards)) return CardType.Bomb; // 检查炸弹（红心参谋配成的炸弹）
      if (isStraightFlush(configuredCards, currentRank)) return CardType.StraightFlush;
      if (isTripleSequence(configuredCards, currentRank)) return CardType.TripleSequence;
      if (isPairSequence(configuredCards, currentRank)) return CardType.PairSequence;
      if (isSequence(configuredCards, currentRank)) return CardType.Sequence;
      if (isFullHouse(configuredCards)) return CardType.FullHouse;

      const groups = groupCardsByRank(configuredCards);
      const groupCount = Object.keys(groups).length;
      if (configuredCards.length === 3 && groupCount === 1) return CardType.Triple;
      if (configuredCards.length === 2 && groupCount === 1) return CardType.Pair;
      if (configuredCards.length === 1) return CardType.Single;
    }
    return null;
  }
  
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
  let cardId = 0;  // 用于生成唯一 id
  for (let i = 0; i < 2; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: `card-${cardId++}`, rank, suit });
      }
    }
    deck.push({ id: `card-${cardId++}`, rank: Rank.SmallJoker, suit: Suit.Hearts });
    deck.push({ id: `card-${cardId++}`, rank: Rank.BigJoker, suit: Suit.Hearts });
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
  currentRank: Rank = Rank.Two
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
      tribute: [],
      borrowWindTriggered: false,
      flippedCard: null,
    },
    gameHistory: [],
    winningTeam: null,
    finishOrder: [],
    startedAt: new Date(),
    endedAt: null,
  };
}

export function deepCloneGameState(state: GameStateData): GameStateData {
  return JSON.parse(JSON.stringify(state));
}

/**
 * 执行出牌
 */
export function executePlay(
  gameState: GameStateData,
  playerPos: PlayerPosition,
  cards: Card[]
): { success: boolean; error?: string; newState?: GameStateData } {
  if (gameState.currentRound.currentPlayer !== playerPos) {
    return { success: false, error: "还没到你的回合" };
  }

  const player = gameState.players[playerPos];

  // 检查玩家是否拥有这些牌
  for (const card of cards) {
    const hasCard = player.hand.some(c => c.rank === card.rank && c.suit === card.suit);
    if (!hasCard) {
      return { success: false, error: "手中没有该牌" };
    }
  }

  const cardType = identifyCardType(cards, gameState.currentRank);

  if (!cardType) {
    return { success: false, error: "无效的牌型" };
  }

  const play: CardPlay = {
    type: cardType,
    cards,
    value: calculatePlayValue(cards, cardType, gameState.currentRank),
  };

  if (!canPlayCards(play, gameState.currentRound.lastPlay, gameState.currentRank)) {
    return { success: false, error: "牌型不符合规则或过小" };
  }

  const newState = deepCloneGameState(gameState);
  const newHand = removeCardsFromHand(player.hand, cards);
  newState.players[playerPos].hand = newHand;
  newState.players[playerPos].cardsRemaining = newHand.length;

  // 更新回合状态
  newState.currentRound.lastPlay = play;
  newState.currentRound.lastPlayer = playerPos;
  newState.currentRound.passCount = 0;
  newState.currentRound.borrowWindTriggered = false; // 出牌后重置借风标志
  newState.currentRound.plays.push({ player: playerPos, play });

  // 检查玩家是否出完牌
  if (newHand.length === 0) {
    // 记录完成顺序
    if (!newState.finishOrder.includes(playerPos)) {
      newState.finishOrder.push(playerPos);
    }
    // 检查剩余玩家数
    const remainingPlayers = newState.players.filter(p => p.cardsRemaining > 0);
    if (remainingPlayers.length <= 1) {
      // 最后一个玩家也完成
      const lastPlayer = remainingPlayers[0];
      if (lastPlayer && !newState.finishOrder.includes(lastPlayer.position)) {
        newState.finishOrder.push(lastPlayer.position);
      }
      newState.status = GameStatus.Finished;
      // 头游对应的队伍获胜
      newState.winningTeam = newState.finishOrder.length > 0 ? getTeam(newState.finishOrder[0]) : getTeam(playerPos);
      newState.endedAt = new Date();
      return { success: true, newState };
    }
    // 还有多个玩家未完成，继续游戏
    newState.currentRound.currentPlayer = getNextPlayer(playerPos);
    // 跳过已完成的玩家
    let nextPlayer = newState.currentRound.currentPlayer;
    let attempts = 0;
    while (newState.players[nextPlayer].cardsRemaining === 0 && attempts < 4) {
      nextPlayer = getNextPlayer(nextPlayer);
      attempts++;
    }
    newState.currentRound.currentPlayer = nextPlayer;
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

  // 3个玩家都不要，检查是否触发借风或清空出牌记录
  if (newState.currentRound.passCount >= 3) {
    const lastPlayer = newState.currentRound.lastPlayer!;
    
    // 检查是否可以借风（上游已出完最后一手牌）
    if (canBorrowWind(newState, getTeammate(lastPlayer))) {
      // 触发借风，不重置 passCount，改变 borrowWindTriggered 标志
      newState.currentRound.borrowWindTriggered = true;
      newState.currentRound.currentPlayer = getTeammate(lastPlayer);
    } else {
      // 不能借风，清空出牌记录，上一个出牌的玩家重新开始
      newState.currentRound.lastPlay = null;
      newState.currentRound.lastPlayer = null;
      newState.currentRound.passCount = 0;
      newState.currentRound.borrowWindTriggered = false;
      newState.currentRound.currentPlayer = lastPlayer;
    }
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

  // 王炸：官方规则第四条十，大小王各两张（共4张）
  const smallJokersInHand = hand.filter(c => c.rank === Rank.SmallJoker);
  const bigJokersInHand = hand.filter(c => c.rank === Rank.BigJoker);
  if (smallJokersInHand.length >= 2 && bigJokersInHand.length >= 2) {
    results.push([...smallJokersInHand.slice(0, 2), ...bigJokersInHand.slice(0, 2)]);
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
    const index = result.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (index >= 0) result.splice(index, 1);
  }
  return result;
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
  return labels[type] || "未知";
}

export function getRankDisplay(rank: Rank): string {
  const displays: Record<Rank, string> = {
    [Rank.Three]: "3",
    [Rank.Four]: "4",
    [Rank.Five]: "5",
    [Rank.Six]: "6",
    [Rank.Seven]: "7",
    [Rank.Eight]: "8",
    [Rank.Nine]: "9",
    [Rank.Ten]: "10",
    [Rank.Jack]: "J",
    [Rank.Queen]: "Q",
    [Rank.King]: "K",
    [Rank.Ace]: "A",
    [Rank.Two]: "2",
    [Rank.SmallJoker]: "小王",
    [Rank.BigJoker]: "大王",
  };
  return displays[rank] || "?";
}

export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    [Suit.Hearts]: "♥",
    [Suit.Diamonds]: "♦",
    [Suit.Clubs]: "♣",
    [Suit.Spades]: "♠",
  };
  return symbols[suit];
}

export function getSuitColor(suit: Suit): string {
  return suit === Suit.Hearts || suit === Suit.Diamonds ? "#e74c3c" : "#000";
}


// ===== 贡牌与还牌（逢人配） =====

/**
 * 获取下游者（需要进贡的玩家）
 * 规则：下一副牌开始前，上一副牌的下游者需向得上游者进贡
 */
export function getDownstreamPlayer(
  gameState: GameStateData,
  upstreamTeam: Team
): PlayerPosition | null {
  // 找到不属于上游队伍的两个玩家中排名最后的
  const downstreamPlayers = gameState.players.filter(p => getTeam(p.position) !== upstreamTeam);
  if (downstreamPlayers.length === 0) return null;
  
  // 返回最后一个出完牌的（下游）
  // 这里简化处理：返回第一个下游玩家
  return downstreamPlayers[0].position;
}

/**
 * 获取需要进贡的最大牌
 * 规则：进贡的牌必须是自己手中最大的牌（红心参谋除外）
 */
export function getMaxTributeCard(hand: Card[], currentRank: Rank): Card | null {
  // 排除红心参谋
  const validCards = hand.filter(c => !isHeartRank(c, currentRank));
  if (validCards.length === 0) return null;
  
  // 排序后取最大的
  const sorted = sortCards(validCards, currentRank);
  return sorted[sorted.length - 1];
}

/**
 * 获取可以还给玩家的牌
 * 规则：
 * - 还给己方搭档的牌必须是10以下（含10）
 * - 还给对方的牌可以为任意牌
 */
export function getValidReturnCards(
  hand: Card[],
  toPlayer: PlayerPosition,
  fromPlayer: PlayerPosition,
  currentRank: Rank
): Card[] {
  const isTeammate = getTeam(toPlayer) === getTeam(fromPlayer);
  
  if (isTeammate) {
    // 还给己方搭档：只能是10以下的牌
    const tenValue = getRankValue(Rank.Ten, currentRank);
    return hand.filter(c => {
      const value = getRankValue(c.rank, currentRank);
      // 排除王牌和参谋
      if (c.rank === Rank.SmallJoker || c.rank === Rank.BigJoker) return false;
      if (isHeartRank(c, currentRank)) return false;
      return value <= tenValue;
    });
  } else {
    // 还给对方：任意牌（除了红心参谋）
    return hand.filter(c => !isHeartRank(c, currentRank));
  }
}

/**
 * 判断是否可以抗贡
 * 官方规则第十条三：下游者抓到两个大王（BigJoker），则不用进贡
 * 注意：小王不算，必须是大王
 */
export function canResistTribute(hand: Card[]): boolean {
  const bigJokerCount = hand.filter(c => c.rank === Rank.BigJoker).length;
  return bigJokerCount >= 2;
}

/**
 * 执行进贡
 */
export function executeTribute(
  gameState: GameStateData,
  fromPlayer: PlayerPosition,
  toPlayer: PlayerPosition,
  tributeCard: Card
): { success: boolean; error?: string; newState?: GameStateData } {
  const fromPlayerObj = gameState.players[fromPlayer];
  
  // 检查进贡的牌是否在手中
  const cardIndex = fromPlayerObj.hand.findIndex(
    c => c.rank === tributeCard.rank && c.suit === tributeCard.suit
  );
  if (cardIndex < 0) {
    return { success: false, error: "进贡的牌不在手中" };
  }
  
  // 检查是否为最大的牌（红心参谋除外）
  const maxCard = getMaxTributeCard(fromPlayerObj.hand, gameState.currentRank);
  if (!maxCard || tributeCard.rank !== maxCard.rank || tributeCard.suit !== maxCard.suit) {
    return { success: false, error: "必须进贡最大的牌" };
  }
  
  const newState = deepCloneGameState(gameState);
  
  // 从进贡者手中移除牌
  newState.players[fromPlayer].hand.splice(cardIndex, 1);
  
  // 记录进贡信息
  newState.currentRound.tribute.push({
    fromPlayer,
    toPlayer,
    tributeCard,
    returnCard: null,
    isCompleted: false,
  });
  
  return { success: true, newState };
}

/**
 * 执行还牌
 */
export function executeReturn(
  gameState: GameStateData,
  fromPlayer: PlayerPosition,
  toPlayer: PlayerPosition,
  returnCard: Card
): { success: boolean; error?: string; newState?: GameStateData } {
  const fromPlayerObj = gameState.players[fromPlayer];
  
  // 检查还牌的牌是否在手中
  const cardIndex = fromPlayerObj.hand.findIndex(
    c => c.rank === returnCard.rank && c.suit === returnCard.suit
  );
  if (cardIndex < 0) {
    return { success: false, error: "还牌的牌不在手中" };
  }
  
  // 检查还牌是否符合规则
  const validCards = getValidReturnCards(fromPlayerObj.hand, toPlayer, fromPlayer, gameState.currentRank);
  if (!validCards.find(c => c.rank === returnCard.rank && c.suit === returnCard.suit)) {
    return { success: false, error: "还牌不符合规则" };
  }
  
  const newState = deepCloneGameState(gameState);
  
  // 从还牌者手中移除牌
  newState.players[fromPlayer].hand.splice(cardIndex, 1);
  
  // 添加到接收者手中
  newState.players[toPlayer].hand.push(returnCard);
  
  // 标记对应的进贡为已完成
  const tributeIndex = newState.currentRound.tribute.findIndex(
    t => t.fromPlayer === toPlayer && t.toPlayer === fromPlayer && !t.isCompleted
  );
  if (tributeIndex >= 0) {
    newState.currentRound.tribute[tributeIndex].returnCard = returnCard;
    newState.currentRound.tribute[tributeIndex].isCompleted = true;
  }
  
  return { success: true, newState };
}


// ===== 借风出牌 =====

/**
 * 判断是否可以借风出牌
 * 规则：上游出完最后一手牌，其他三家都过牌时，由上游搭档借风出牌
 */
export function canBorrowWind(
  gameState: GameStateData,
  playerPos: PlayerPosition
): boolean {
  const lastPlayer = gameState.currentRound.lastPlayer;
  if (!lastPlayer) return false;
  
  // 检查上一个出牌的玩家是否是上游（主牌者）
  // 这里需要知道谁是主牌者，暂时简化处理
  // 实际应该检查：lastPlayer 是否已出完所有牌，且其他三家都过牌
  
  const lastPlayerHand = gameState.players[lastPlayer].hand;
  if (lastPlayerHand.length > 0) return false; // 上游还有牌，不能借风
  
  // 检查其他三家是否都过牌
  const passCount = gameState.currentRound.passCount;
  if (passCount < 3) return false; // 还没有三家都过牌
  
  // 检查当前玩家是否是上游的搭档
  return getTeammate(lastPlayer) === playerPos;
}

/**
 * 执行借风出牌
 */
export function executeBorrowWind(
  gameState: GameStateData,
  playerPos: PlayerPosition,
  cards: Card[]
): { success: boolean; error?: string; newState?: GameStateData } {
  if (!canBorrowWind(gameState, playerPos)) {
    return { success: false, error: "不符合借风条件" };
  }
  
  // 借风出牌实际上是一次正常的出牌
  return executePlay(gameState, playerPos, cards);
}

// ===== 报牌 =====

/**
 * 获取玩家的报牌状态
 * 规则：
 * - 手牌 ≤ 6 张时必须主动报牌
 * - 手牌 ≤ 10 张时有问必报
 */
export function getCardReportStatus(hand: Card[]): "must" | "if_asked" | "none" {
  if (hand.length <= 6) return "must";
  if (hand.length <= 10) return "if_asked";
  return "none";
}

/**
 * 判断是否需要报牌
 */
export function shouldReportCards(hand: Card[]): boolean {
  return hand.length <= 6;
}

/**
 * 获取报牌信息
 */
export function getCardReportInfo(hand: Card[]): string {
  const remaining = hand.length;
  if (remaining <= 6) {
    return `还有 ${remaining} 张牌（已报牌）`;
  }
  if (remaining <= 10) {
    return `还有 ${remaining} 张牌（有问必报）`;
  }
  return `还有 ${remaining} 张牌`;
}

// ===== 洗牌与抓牌 =====

/**
 * 获取第一副牌的先手玩家
 * 规则：第一副牌通过翻牌决定先手
 */
export function getFirstRoundStarter(): PlayerPosition {
  // 随机选择一个玩家作为第一副牌的先手
  return Math.floor(Math.random() * 4) as PlayerPosition;
}

/**
 * 获取下一副牌的先手玩家
 * 规则：
 * - 第一副牌：翻牌决定
 * - 之后的副牌：下游洗牌、上游切牌、下游先抓
 */
export function getNextRoundStarter(
  gameState: GameStateData,
  currentWinnerTeam: Team
): PlayerPosition {
  // 获取下游者（输家）
  const downstreamPlayers = gameState.players.filter(
    p => getTeam(p.position) !== currentWinnerTeam
  );
  
  if (downstreamPlayers.length === 0) return PlayerPosition.Player0;
  
  // 下游先抓牌（先手）
  return downstreamPlayers[0].position;
}

/**
 * 获取洗牌者
 * 规则：下游洗牌
 */
export function getShuffler(gameState: GameStateData, currentWinnerTeam: Team): PlayerPosition {
  const downstreamPlayers = gameState.players.filter(
    p => getTeam(p.position) !== currentWinnerTeam
  );
  
  if (downstreamPlayers.length === 0) return PlayerPosition.Player0;
  return downstreamPlayers[0].position;
}

/**
 * 获取切牌者
 * 规则：上游切牌
 */
export function getCutter(gameState: GameStateData, currentWinnerTeam: Team): PlayerPosition {
  const upstreamPlayers = gameState.players.filter(
    p => getTeam(p.position) === currentWinnerTeam
  );
  
  if (upstreamPlayers.length === 0) return PlayerPosition.Player0;
  return upstreamPlayers[0].position;
}

/**
 * 执行洗牌
 * 返回洗好的牌组
 */
export function executeShuffleAndDeal(): Card[][] {
  const deck = shuffleDeck(createDeck());
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands;
}

/**
 * 开始新一轮游戏
 */
export function startNewRound(
  gameState: GameStateData,
  winningTeam: Team
): GameStateData {
  const newState = deepCloneGameState(gameState);
  
  // 获取新一轮的先手玩家
  const starter = gameState.currentRound.roundNumber === 1
    ? getFirstRoundStarter()
    : getNextRoundStarter(gameState, winningTeam);
  
  // 洗牌并发牌
  const newHands = executeShuffleAndDeal();
  const sortedHands = newHands.map(h => sortCards(h, gameState.currentRank));
  
  // 更新玩家手牌
  for (let i = 0; i < 4; i++) {
    newState.players[i].hand = sortedHands[i];
    newState.players[i].cardsRemaining = sortedHands[i].length;
  }
  
  // 初始化新回合
  newState.currentRound = {
    roundNumber: gameState.currentRound.roundNumber + 1,
    currentPlayer: starter,
    lastPlay: null,
    lastPlayer: null,
    passCount: 0,
    plays: [],
    tribute: [],
    borrowWindTriggered: false,
    flippedCard: null,
  };
  
  newState.status = GameStatus.Playing;
  
  return newState;
}


// ===== 出牌规范与升级级数 =====

/**
 * 验证出牌顺序是否符合规范
 * 规则：必须从小到大排列，红心参谋必须放在应有位置
 */
export function validatePlayOrder(cards: Card[], currentRank: Rank): boolean {
  if (cards.length <= 1) return true;
  
  const sorted = sortCards(cards, currentRank);
  
  // 检查出牌顺序是否与排序后一致
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].rank !== sorted[i].rank || cards[i].suit !== sorted[i].suit) {
      return false;
    }
  }
  
  return true;
}

/**
 * 获取升级步数（用于 UI 显示）
 * 官方规则（2017版）：
 * - 双下（头游和二游同队）：赢家升 3 级
 * - 搭档是二游：赢家升 2 级
 * - 搭档是末游：赢家升 1 级
 */
export function getUpgradeSteps(gameState: GameStateData): number {
  const finishOrder = gameState.finishOrder;
  if (finishOrder.length < 2) return 1;
  const first = finishOrder[0];
  const second = finishOrder[1];
  const teammate = getTeammate(first);
  if (getTeam(first) === getTeam(second)) return 3;
  if (second === teammate) return 2;
  return 1;
}

/**
 * 计算升级数
 * 官方规则（2017版）：
 * - 双下（头游和二游同队）：赢家升 3 级
 * - 搭档是二游：赢家升 2 级
 * - 搭档是末游：赢家升 1 级
 */
export function calculateNextRank(currentRank: Rank, winningTeam: Team, gameState: GameStateData): Rank {
  const currentIndex = LEVEL_ORDER.indexOf(currentRank);
  if (currentIndex < 0) return currentRank;
  
  // 根据 finishOrder 计算升级数
  let upgradeSteps = 1; // 默认升 1 级
  const finishOrder = gameState.finishOrder;
  
  if (finishOrder.length >= 2) {
    const first = finishOrder[0]; // 头游
    const second = finishOrder[1]; // 二游
    const teammate = getTeammate(first); // 头游的搭档
    
    // 双下：头游和二游是同一队伍
    if (getTeam(first) === getTeam(second)) {
      upgradeSteps = 3;
    } else if (second === teammate) {
      // 搭档是二游：升 2 级
      upgradeSteps = 2;
    } else {
      // 搭档是三游或末游：升 1 级
      upgradeSteps = 1;
    }
  }
  
  // 升级到对应级别，不超过最高级 A
  const newIndex = Math.min(currentIndex + upgradeSteps, LEVEL_ORDER.length - 1);
  return LEVEL_ORDER[newIndex];
}

/**
 * 验证升级是否有效
 * 规则：升级必须是连续的（3→4→5...→A→2→3）
 */
export function isValidRankProgression(from: Rank, to: Rank): boolean {
  const fromIndex = LEVEL_ORDER.indexOf(from);
  const toIndex = LEVEL_ORDER.indexOf(to);
  
  if (fromIndex < 0 || toIndex < 0) return false;
  
  // 下一级应该是 fromIndex + 1（2 不参与升级）
  return toIndex === fromIndex + 1;
}

/**
 * 获取升级后的级别描述
 */
export function getRankDescription(rank: Rank): string {
  const descriptions: Record<Rank, string> = {
    [Rank.Three]: "打 3",
    [Rank.Four]: "打 4",
    [Rank.Five]: "打 5",
    [Rank.Six]: "打 6",
    [Rank.Seven]: "打 7",
    [Rank.Eight]: "打 8",
    [Rank.Nine]: "打 9",
    [Rank.Ten]: "打 10",
    [Rank.Jack]: "打 J",
    [Rank.Queen]: "打 Q",
    [Rank.King]: "打 K",
    [Rank.Ace]: "打 A",
    [Rank.Two]: "打 2",
    [Rank.SmallJoker]: "小王",
    [Rank.BigJoker]: "大王",
  };
  return descriptions[rank] || "未知";
}

/**
 * 获取升级进度
 * 返回从当前级别到目标级别需要升级的次数
 */
export function getRankProgressToTarget(currentRank: Rank, targetRank: Rank): number {
  const currentIndex = RANK_ORDER.indexOf(currentRank);
  const targetIndex = RANK_ORDER.indexOf(targetRank);
  
  if (currentIndex < 0 || targetIndex < 0) return -1;
  
  if (targetIndex >= currentIndex) {
    return targetIndex - currentIndex;
  } else {
    return RANK_ORDER.length - currentIndex + targetIndex;
  }
}

/**
 * 验证游戏是否应该结束
 * 规则：当某队升级到 2 后赢得一局，则游戏结束
 */
export function shouldGameEnd(currentRank: Rank, winningTeam: Team): boolean {
  // 如果赢家已经打到 2，则游戏结束
  if (currentRank === Rank.Two) {
    return true;
  }
  return false;
}

/**
 * 获取游戏最终胜者
 * 规则：第一个升级到 2 并赢得一局的队伍获胜
 */
export function getFinalWinner(gameState: GameStateData): Team | null {
  if (gameState.status !== GameStatus.Finished) return null;
  
  if (gameState.currentRank === Rank.Two && gameState.winningTeam) {
    return gameState.winningTeam;
  }
  
  return null;
}


// ===== 贡牌还牌流程集成 =====

/**
 * 获取本局的贡牌者（下游玩家）
 * 规则：
 * - 头游与二游同队：双下，下游和末游各贡一张（双贡）
 * - 头游与二游不同队：仅末游进贡一张给头游
 * - 拆贡：末游有两张大王则不用进贡
 */
export function getTributePlayers(
  gameState: GameStateData,
  winningTeam: Team
): PlayerPosition[] {
  const finishOrder = gameState.finishOrder;
  
  // 如果没有完成顺序，回退到旧逻辑
  if (finishOrder.length < 2) {
    const losers: PlayerPosition[] = [];
    for (let i = 0; i < 4; i++) {
      if (getTeam(i as PlayerPosition) !== winningTeam) {
        losers.push(i as PlayerPosition);
      }
    }
    return losers;
  }
  
  const first = finishOrder[0]; // 头游
  const second = finishOrder[1]; // 二游
  const third = finishOrder[2]; // 三游
  const fourth = finishOrder[3]; // 末游
  
  // 判断是否双下：头游和二游是同一队伍
  const isDoubleDown = getTeam(first) === getTeam(second);
  
  if (isDoubleDown) {
    // 双下：下游和末游各贡一张（双贡）
    const tributePlayers: PlayerPosition[] = [];
    if (third !== undefined) tributePlayers.push(third);
    if (fourth !== undefined) tributePlayers.push(fourth);
    return tributePlayers;
  } else {
    // 非双下：仅末游进贡一张给头游
    if (fourth !== undefined) return [fourth];
    if (third !== undefined) return [third];
    return [];
  }
}

/**
 * 初始化贡牌流程
 * 在游戏结束后调用，准备进贡
 */
export function initiateTributePhase(
  gameState: GameStateData,
  winningTeam: Team
): GameStateData {
  const newState = deepCloneGameState(gameState);
  const tributePlayers = getTributePlayers(gameState, winningTeam);
  const finishOrder = gameState.finishOrder;
  
  // 清空旧的贡牌信息
  newState.currentRound.tribute = [];
  
  if (tributePlayers.length === 0) return newState;
  
  const first = finishOrder[0]; // 头游
  const second = finishOrder[1]; // 二游
  const isDoubleDown = first !== undefined && second !== undefined && getTeam(first) === getTeam(second);
  
  if (isDoubleDown && tributePlayers.length === 2) {
    // 双贡：下游贡给头游，末游贡给二游
    // 分配贡牌接收者：头游拿大牌，二游拿小牌
    // 下游（三游）贡给二游，末游贡给头游
    const third = finishOrder[2];
    const fourth = finishOrder[3];
    if (fourth !== undefined && first !== undefined) {
      newState.currentRound.tribute.push({
        fromPlayer: fourth, // 末游贡给头游（大牌）
        toPlayer: first,
        tributeCard: null,
        returnCard: null,
        isCompleted: false,
      });
    }
    if (third !== undefined && second !== undefined) {
      newState.currentRound.tribute.push({
        fromPlayer: third, // 三游贡给二游（小牌）
        toPlayer: second,
        tributeCard: null,
        returnCard: null,
        isCompleted: false,
      });
    }
  } else {
    // 非双贡：仅末游贡给头游
    const tributePlayer = tributePlayers[0];
    if (tributePlayer !== undefined && first !== undefined) {
      newState.currentRound.tribute.push({
        fromPlayer: tributePlayer,
        toPlayer: first,
        tributeCard: null,
        returnCard: null,
        isCompleted: false,
      });
    }
  }
  
  return newState;
}

/**
 * 执行单个玩家的进贡
 */
export function executeSingleTribute(
  gameState: GameStateData,
  tributePlayer: PlayerPosition,
  tributeCard: Card
): { success: boolean; error?: string; newState?: GameStateData } {
  const player = gameState.players[tributePlayer];
  
  // 检查玩家是否持有该牌
  const hasCard = player.hand.some(c => c.rank === tributeCard.rank && c.suit === tributeCard.suit);
  if (!hasCard) {
    return { success: false, error: "玩家没有该牌" };
  }
  
  // 检查是否是最大的牌（红心参谋除外）
  const maxCard = getMaxTributeCard(player.hand, gameState.currentRank);
  if (!maxCard || getRankValue(tributeCard.rank, gameState.currentRank) !== getRankValue(maxCard.rank, gameState.currentRank)) {
    return { success: false, error: "必须进贡最大的牌" };
  }
  
  const newState = deepCloneGameState(gameState);
  
  // 移除贡牌
  const newHand = removeCardsFromHand(newState.players[tributePlayer].hand, [tributeCard]);
  newState.players[tributePlayer].hand = newHand;
  newState.players[tributePlayer].cardsRemaining = newHand.length;
  
  // 更新贡牌信息
  const tributeInfo = newState.currentRound.tribute.find(t => t.fromPlayer === tributePlayer);
  if (tributeInfo) {
    tributeInfo.tributeCard = tributeCard;
  }
  
  return { success: true, newState };
}

/**
 * 执行单个玩家的还牌
 */
export function executeSingleReturn(
  gameState: GameStateData,
  returnPlayer: PlayerPosition,
  returnCard: Card,
  tributePlayer: PlayerPosition
): { success: boolean; error?: string; newState?: GameStateData } {
  const player = gameState.players[returnPlayer];
  
  // 检查玩家是否持有该牌
  const hasCard = player.hand.some(c => c.rank === returnCard.rank && c.suit === returnCard.suit);
  if (!hasCard) {
    return { success: false, error: "玩家没有该牌" };
  }
  
  // 检查还牌限制
  const validCards = getValidReturnCards(player.hand, returnPlayer, tributePlayer, gameState.currentRank);
  const isValid = validCards.some(c => c.rank === returnCard.rank && c.suit === returnCard.suit);
  if (!isValid) {
    return { success: false, error: "还牌不符合规则" };
  }
  
  const newState = deepCloneGameState(gameState);
  
  // 移除还牌
  const newHand = removeCardsFromHand(newState.players[returnPlayer].hand, [returnCard]);
  newState.players[returnPlayer].hand = newHand;
  newState.players[returnPlayer].cardsRemaining = newHand.length;
  
  // 添加还回的牌到进贡者手中
  newState.players[tributePlayer].hand.push(returnCard);
  newState.players[tributePlayer].cardsRemaining++;
  
  // 更新贡牌信息
  const tributeInfo = newState.currentRound.tribute.find(t => t.fromPlayer === tributePlayer);
  if (tributeInfo) {
    tributeInfo.returnCard = returnCard;
    tributeInfo.isCompleted = true;
  }
  
  return { success: true, newState };
}


/**
 * 检查所有贡牌是否已完成
 */
export function allTributesCompleted(gameState: GameStateData): boolean {
  return gameState.currentRound.tribute.length > 0 && 
         gameState.currentRound.tribute.every(t => t.isCompleted);
}

/**
 * 获取待进贡的玩家
 */
export function getPendingTributePlayer(gameState: GameStateData): PlayerPosition | null {
  const pending = gameState.currentRound.tribute.find(t => t.tributeCard === null);
  return pending ? pending.fromPlayer : null;
}

/**
 * 获取待还牌的玩家
 */
export function getPendingReturnPlayer(gameState: GameStateData): PlayerPosition | null {
  const pending = gameState.currentRound.tribute.find(t => t.tributeCard !== null && !t.isCompleted);
  return pending ? pending.toPlayer : null;
}


// ===== 翻牌定先手 =====

/**
 * 翻牌决定先手
 * 规则：第一副牌翻牌决定先手，根据翻出牌的点数决定
 */
export function flipCardForStarter(
  gameState: GameStateData,
  flippedCard: Card
): { starter: PlayerPosition; flippedCard: Card } {
  // 根据翻出的牌的点数决定先手
  // 简化处理：按点数从小到大循环分配先手
  const rankIndex = RANK_ORDER.indexOf(flippedCard.rank);
  const starter = (rankIndex % 4) as PlayerPosition;
  
  return { starter, flippedCard };
}

/**
 * 获取翻牌的中文描述
 */
export function getFlippedCardDescription(card: Card): string {
  const rankDisplay = getRankDisplay(card.rank);
  const suitSymbol = getSuitSymbol(card.suit);
  return `${suitSymbol}${rankDisplay}`;
}
