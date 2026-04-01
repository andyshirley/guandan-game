/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * 掼蛋游戏核心类型定义
 */

/** 牌的花色 */
export enum Suit {
  Hearts = "hearts",      // 红桃
  Diamonds = "diamonds",  // 方块
  Clubs = "clubs",        // 梅花
  Spades = "spades",      // 黑桃
}

/** 牌的点数 */
export enum Rank {
  Three = "3",
  Four = "4",
  Five = "5",
  Six = "6",
  Seven = "7",
  Eight = "8",
  Nine = "9",
  Ten = "10",
  Jack = "J",
  Queen = "Q",
  King = "K",
  Ace = "A",
  Two = "2",
  SmallJoker = "joker_small",
  BigJoker = "joker_big",
}

/** 单张牌 */
export interface Card {
  rank: Rank;
  suit: Suit;
}

/** 牌型类型 */
export enum CardType {
  Single = "single",           // 单牌
  Pair = "pair",               // 对子
  Triple = "triple",           // 三张
  FullHouse = "full_house",    // 三带二（3张同点+1对）
  Sequence = "sequence",       // 顺子（五张连续单牌）
  PairSequence = "pair_seq",   // 对顺（三对连续对）
  TripleSequence = "triple_seq", // 三顺（两个连续三张）
  StraightFlush = "straight_flush", // 同花顺（同花色五张连续）
  Bomb = "bomb",               // 炸弹（4张或以上）
  RoyalBomb = "royal_bomb",    // 王炸（大小王）
}

/** 出牌组合 */
export interface CardPlay {
  type: CardType;
  cards: Card[];
  value: number; // 用于比较大小的数值
}

/** 玩家位置 */
export enum PlayerPosition {
  Player0 = 0,
  Player1 = 1,
  Player2 = 2,
  Player3 = 3,
}

/** 队伍 */
export enum Team {
  Team1 = 0, // Player 0 和 Player 2
  Team2 = 1, // Player 1 和 Player 3
}

/** 玩家信息 */
export interface Player {
  position: PlayerPosition;
  userId: number;
  name: string;
  isAI: boolean;
  hand: Card[];
  cardsRemaining: number;
  isReady: boolean;
}

/** 游戏状态 */
export enum GameStatus {
  Waiting = "waiting",         // 等待玩家加入
  Dealing = "dealing",         // 发牌中
  Playing = "playing",         // 游戏进行中
  Finished = "finished",       // 游戏结束
}

/** 游戏回合状态 */
/** 贡牌与还牌 */
export interface TributeInfo {
  fromPlayer: PlayerPosition;  // 进贡者
  toPlayer: PlayerPosition;    // 接收者
  tributeCard: Card | null;    // 进贡的牌
  returnCard: Card | null;     // 还回的牌
  isCompleted: boolean;        // 是否已完成还牌
}

export interface GameRound {
  roundNumber: number;
  currentPlayer: PlayerPosition;
  lastPlay: CardPlay | null;
  lastPlayer: PlayerPosition | null;
  passCount: number; // 连续"不要"的玩家数
  plays: Array<{
    player: PlayerPosition;
    play: CardPlay | null; // null 表示"不要"
  }>;
  tribute: TributeInfo[]; // 本轮的贡牌信息
  borrowWindTriggered: boolean; // 是否已经触发借风（用于不重置 passCount）
  flippedCard: Card | null; // 第一副牌翻牌的结果（用于决定先手）
}

/** 游戏状态 */
export interface GameStateData {
  gameId: string;
  status: GameStatus;
  players: Player[];
  currentRank: Rank; // 当前升级级别
  currentRound: GameRound;
  gameHistory: GameRound[];
  winningTeam: Team | null;
  finishOrder: PlayerPosition[]; // 出牌完成顺序：[0]=头游, [1]=二游, [2]=三游, [3]=末游
  startedAt: Date;
  endedAt: Date | null;
}

/** 游戏操作结果 */
export interface GameAction {
  type: "play" | "pass";
  player: PlayerPosition;
  play?: CardPlay;
  timestamp: Date;
}

/** 玩家统计 */
export interface PlayerStatistics {
  userId: number;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  currentRank: Rank;
  maxRank: Rank;
  winStreak: number;
  maxWinStreak: number;
  totalScore: number;
}

/** 牌点大小顺序（升序）
 * 官方规则：大王 > 小王 > 参谋 > A > K > Q > J > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2
 * 大小王通过 getRankValue 特殊处理，参谋通过 currentRank 匹配特殊处理
 * 2 是最小的普通牌，A 是最大的普通牌
 */
export const RANK_ORDER = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
  Rank.King, Rank.Ace,
];

/** 升级级别顺序（包含 2）
 * 官方规则第三条十一：每局第一副牌从打 2 开始
 * 升级从 2 开始到 A，打完 A 即赢得游戏
 */
export const LEVEL_ORDER = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
  Rank.King, Rank.Ace,
];

/** 获取队伍 */
export function getTeam(position: PlayerPosition): Team {
  return position === PlayerPosition.Player0 || position === PlayerPosition.Player2
    ? Team.Team1
    : Team.Team2;
}

/** 获取队友位置 */
export function getTeammate(position: PlayerPosition): PlayerPosition {
  return position === PlayerPosition.Player0
    ? PlayerPosition.Player2
    : position === PlayerPosition.Player2
    ? PlayerPosition.Player0
    : position === PlayerPosition.Player1
    ? PlayerPosition.Player3
    : PlayerPosition.Player1;
}

/** 获取下一个玩家位置 */
export function getNextPlayer(position: PlayerPosition): PlayerPosition {
  return ((position + 1) % 4) as PlayerPosition;
}

/** 获取前一个玩家位置 */
export function getPreviousPlayer(position: PlayerPosition): PlayerPosition {
  return ((position - 1 + 4) % 4) as PlayerPosition;
}
