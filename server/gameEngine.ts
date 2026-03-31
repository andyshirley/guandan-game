/**
 * 掼蛋游戏引擎
 * 实现游戏逻辑、牌型判断、出牌规则等核心功能
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

/**
 * 牌的数值表示
 * 用于比较牌的大小
 */
function getRankValue(rank: Rank, currentRank: Rank): number {
  // 王牌最大
  if (rank === Rank.BigJoker) return 1000;
  if (rank === Rank.SmallJoker) return 999;

  // 升级牌（主牌）最大
  if (rank === currentRank) return 500 + RANK_ORDER.indexOf(currentRank);

  // 其他牌按升级顺序排列
  const index = RANK_ORDER.indexOf(rank);
  return index >= 0 ? index : -1;
}

/**
 * 判断是否为王炸（大小王）
 */
export function isRoyalBomb(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const ranks = cards.map((c) => c.rank).sort();
  return (
    (ranks[0] === Rank.SmallJoker && ranks[1] === Rank.BigJoker) ||
    (ranks[0] === Rank.BigJoker && ranks[1] === Rank.SmallJoker)
  );
}

/**
 * 判断是否为炸弹（4张或以上相同点数）
 */
export function isBomb(cards: Card[]): boolean {
  if (cards.length < 4) return false;
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

/**
 * 判断是否为三顺（连续的三张）
 */
export function isTripleSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length < 6) return false; // 至少2个三张
  if (cards.length % 3 !== 0) return false;

  // 检查是否都是三张
  const groups = groupCardsByRank(cards);
  if (Object.values(groups).some((g) => g.length !== 3)) return false;

  // 检查是否连续
  const ranks = Object.keys(groups).map((r) => r as Rank).sort(
    (a, b) => getRankValue(a, currentRank) - getRankValue(b, currentRank)
  );
  
  // 检查是否是不中断的顺序
  for (let i = 1; i < ranks.length; i++) {
    const prevIndex = RANK_ORDER.indexOf(ranks[i - 1]);
    const currIndex = RANK_ORDER.indexOf(ranks[i]);
    if (currIndex !== prevIndex + 1) return false;
  }
  return true;
}

/**
 * 判断是否为对顺（连续的对子）
 */
export function isPairSequence(cards: Card[], currentRank: Rank): boolean {
  if (cards.length < 6) return false; // 至少3对
  if (cards.length % 2 !== 0) return false;

  // 检查是否都是对子
  const groups = groupCardsByRank(cards);
  if (Object.values(groups).some((g) => g.length !== 2)) return false;

  // 检查是否连续
  const ranks = Object.keys(groups).map((r) => r as Rank).sort(
    (a, b) => getRankValue(a, currentRank) - getRankValue(b, currentRank)
  );
  
  // 检查是否是不中断的顺序
  for (let i = 1; i < ranks.length; i++) {
    const prevIndex = RANK_ORDER.indexOf(ranks[i - 1]);
    const currIndex = RANK_ORDER.indexOf(ranks[i]);
    if (currIndex !== prevIndex + 1) return false;
  }
  return true;
}

/**
 * 判断是否为顺子（连续的单牌）
 */
export function isSequence(ranks: Rank[], currentRank: Rank): boolean {
  if (ranks.length < 5) return false;

  // 排序
  const sorted = [...ranks].sort(
    (a, b) => getRankValue(a, currentRank) - getRankValue(b, currentRank)
  );

  // 检查是否连续
  for (let i = 1; i < sorted.length; i++) {
    const prevIndex = RANK_ORDER.indexOf(sorted[i - 1]);
    const currIndex = RANK_ORDER.indexOf(sorted[i]);
    if (currIndex !== prevIndex + 1) return false;
  }

  return true;
}

/**
 * 按点数分组牌
 */
export function groupCardsByRank(cards: Card[]): Record<Rank, Card[]> {
  const groups: Record<Rank, Card[]> = {} as Record<Rank, Card[]>;
  for (const card of cards) {
    if (!groups[card.rank]) {
      groups[card.rank] = [];
    }
    groups[card.rank].push(card);
  }
  return groups;
}

/**
 * 判断牌型
 */
export function identifyCardType(cards: Card[], currentRank: Rank): CardType | null {
  if (cards.length === 0) return null;

  // 王炸
  if (isRoyalBomb(cards)) return CardType.RoyalBomb;

  // 炸弹
  if (isBomb(cards)) return CardType.Bomb;

  // 三顺
  if (isTripleSequence(cards, currentRank)) return CardType.TripleSequence;

  // 对顺
  if (isPairSequence(cards, currentRank)) return CardType.PairSequence;

  // 顺子
  const ranks = cards.map((c) => c.rank);
  if (isSequence(ranks, currentRank)) return CardType.Sequence;

  // 三张
  const groups = groupCardsByRank(cards);
  if (cards.length === 3 && Object.keys(groups).length === 1) {
    return CardType.Triple;
  }

  // 对子
  if (cards.length === 2 && Object.keys(groups).length === 1) {
    return CardType.Pair;
  }

  // 单牌
  if (cards.length === 1) return CardType.Single;

  return null;
}

/**
 * 计算出牌的数值（用于比较大小）
 */
export function calculateCardPlayValue(play: CardPlay, currentRank: Rank): number {
  const baseValue = getRankValue(play.cards[0].rank, currentRank);

  // 根据牌型调整数值
  const typeMultiplier: Record<CardType, number> = {
    [CardType.Single]: 1,
    [CardType.Pair]: 100,
    [CardType.Triple]: 10000,
    [CardType.Sequence]: 1000000,
    [CardType.PairSequence]: 100000000,
    [CardType.TripleSequence]: 10000000000,
    [CardType.Bomb]: 1000000000000,
    [CardType.RoyalBomb]: 10000000000000,
  };

  return baseValue * typeMultiplier[play.type];
}

/**
 * 判断是否可以出牌（相对于上一张牌）
 */
export function canPlayCards(
  play: CardPlay,
  lastPlay: CardPlay | null,
  currentRank: Rank
): boolean {
  // 第一张牌，任何牌型都可以
  if (!lastPlay) return true;

  // 王炸可以压任何牌
  if (play.type === CardType.RoyalBomb) return true;

  // 炸弹可以压非炸弹的牌
  if (play.type === CardType.Bomb && lastPlay.type !== CardType.Bomb && lastPlay.type !== CardType.RoyalBomb) {
    return true;
  }

  // 同牌型比较大小
  if (play.type === lastPlay.type) {
    const playValue = calculateCardPlayValue(play, currentRank);
    const lastValue = calculateCardPlayValue(lastPlay, currentRank);
    return playValue > lastValue;
  }

  return false;
}

/**
 * 创建新游戏
 */
export function createGame(players: Player[], currentRank: Rank = Rank.Three): GameStateData {
  return {
    gameId: generateGameId(),
    status: GameStatus.Dealing,
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
 * 生成游戏 ID
 */
export function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * 创建标准牌组（两副牌）
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  const ranks = [
    Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
    Rank.King, Rank.Ace, Rank.Two,
  ];

  // 两副牌
  for (let i = 0; i < 2; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit });
      }
    }
    // 加入王牌
    deck.push({ rank: Rank.SmallJoker, suit: Suit.Hearts });
    deck.push({ rank: Rank.BigJoker, suit: Suit.Hearts });
  }

  return deck;
}

/**
 * 洗牌
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 发牌
 */
export function dealCards(players: Player[]): Card[][] {
  const deck = createDeck();
  const shuffled = shuffleDeck(deck);

  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < shuffled.length; i++) {
    hands[i % 4].push(shuffled[i]);
  }

  return hands;
}

/**
 * 处理出牌
 */
export function playCards(
  gameState: GameStateData,
  player: PlayerPosition,
  cards: Card[] | null
): { success: boolean; error?: string; updatedGame?: GameStateData } {
  // 验证是否轮到该玩家
  if (gameState.currentRound.currentPlayer !== player) {
    return { success: false, error: "Not your turn" };
  }

  // 如果是"不要"
  if (cards === null || cards.length === 0) {
    return handlePass(gameState, player);
  }

  // 验证玩家是否拥有这些牌
  const playerHand = gameState.players[player].hand;
  for (const card of cards) {
    if (!playerHand.some((c) => c.rank === card.rank && c.suit === card.suit)) {
      return { success: false, error: "Invalid card" };
    }
  }

  // 判断牌型
  const cardType = identifyCardType(cards, gameState.currentRank);
  if (!cardType) {
    return { success: false, error: "Invalid card combination" };
  }

  // 创建出牌
  const play: CardPlay = {
    type: cardType,
    cards,
    value: calculateCardPlayValue({ type: cardType, cards, value: 0 }, gameState.currentRank),
  };

  // 检查是否可以出牌
  if (!canPlayCards(play, gameState.currentRound.lastPlay, gameState.currentRank)) {
    return { success: false, error: "Cannot play this card combination" };
  }

  // 更新游戏状态
  const updatedGame = { ...gameState };
  updatedGame.players[player].hand = playerHand.filter(
    (c) => !cards.some((pc) => pc.rank === c.rank && pc.suit === c.suit)
  );
  updatedGame.players[player].cardsRemaining = updatedGame.players[player].hand.length;

  updatedGame.currentRound.lastPlay = play;
  updatedGame.currentRound.lastPlayer = player;
  updatedGame.currentRound.passCount = 0;
  updatedGame.currentRound.plays.push({ player, play });

  // 检查是否游戏结束
  if (updatedGame.players[player].cardsRemaining === 0) {
    updatedGame.status = GameStatus.Finished;
    updatedGame.winningTeam = getTeam(player);
    updatedGame.endedAt = new Date();
  } else {
    // 移动到下一个玩家
    updatedGame.currentRound.currentPlayer = getNextPlayer(player);
  }

  return { success: true, updatedGame };
}

/**
 * 处理"不要"
 */
export function handlePass(
  gameState: GameStateData,
  player: PlayerPosition
): { success: boolean; error?: string; updatedGame?: GameStateData } {
  const updatedGame = { ...gameState };
  updatedGame.currentRound.passCount++;
  updatedGame.currentRound.plays.push({ player, play: null });

  // 如果3个玩家都"不要"，清空出牌记录，重新开始
  if (updatedGame.currentRound.passCount === 3) {
    updatedGame.currentRound.lastPlay = null;
    updatedGame.currentRound.lastPlayer = null;
    updatedGame.currentRound.passCount = 0;
  }

  // 移动到下一个玩家
  updatedGame.currentRound.currentPlayer = getNextPlayer(player);

  return { success: true, updatedGame };
}

/**
 * AI 决策（简单规则基础）
 */
export function getAIMove(
  gameState: GameStateData,
  playerPosition: PlayerPosition
): Card[] | null {
  const player = gameState.players[playerPosition];
  const hand = player.hand;

  // 如果没有上一张牌，出最小的牌
  if (!gameState.currentRound.lastPlay) {
    return [hand[0]];
  }

  // 尝试找到能压过上一张牌的最小牌型
  const lastPlay = gameState.currentRound.lastPlay;

  // 尝试出炸弹
  for (let i = 4; i <= hand.length; i++) {
    for (let j = 0; j <= hand.length - i; j++) {
      const cards = hand.slice(j, j + i);
      if (isBomb(cards)) {
        const play: CardPlay = {
          type: CardType.Bomb,
          cards,
          value: calculateCardPlayValue({ type: CardType.Bomb, cards, value: 0 }, gameState.currentRank),
        };
        if (canPlayCards(play, lastPlay, gameState.currentRank)) {
          return cards;
        }
      }
    }
  }

  // 尝试出同牌型的牌
  for (let i = 1; i <= hand.length; i++) {
    for (let j = 0; j <= hand.length - i; j++) {
      const cards = hand.slice(j, j + i);
      const cardType = identifyCardType(cards, gameState.currentRank);
      if (cardType) {
        const play: CardPlay = {
          type: cardType,
          cards,
          value: calculateCardPlayValue({ type: cardType, cards, value: 0 }, gameState.currentRank),
        };
        if (canPlayCards(play, lastPlay, gameState.currentRank)) {
          return cards;
        }
      }
    }
  }

  // 无法出牌
  return null;
}
