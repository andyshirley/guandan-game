/**
 * danzeroAI.ts
 *
 * 移植自 Danzero+ 开源项目 (https://github.com/submit-paper/Danzero_plus)
 * 原始实现：actor_n/utils/utils.py + actor_n/game.py
 *
 * 由于 Danzero+ 的神经网络权重（TensorFlow 1.x ckpt 格式）无法直接在浏览器中运行，
 * 本文件移植了其全部**非神经网络部分**的逻辑：
 *   1. 牌面编码（CardToNum / card2num / card2array）
 *   2. 手牌分析（combineHandcards — 识别单张/对子/三张/炸弹/顺子/同花顺）
 *   3. 万能牌标志位计算（procUniversal）
 *   4. 状态向量构建（prepareState — 567 维 observation）
 *   5. 高质量决策函数（danzeroGetAIMove）
 *
 * 决策策略（忠实还原 Danzero+ game.py 中的 back_action / tribute 规则逻辑）：
 *   - 首出：优先打出最小单张，避免拆散顺子/连对/三顺
 *   - 接牌：找到能压过上家的最小同类型牌型
 *   - 炸弹管理：优先保留大炸弹，用最小炸弹压制
 *   - 进贡/还贡：按 Danzero+ 规则选择最优进贡牌
 */

import {
  Card,
  CardPlay,
  CardType,
  GameStateData,
  PlayerPosition,
  Rank,
  Suit,
  Team,
  RANK_ORDER,
  getTeam,
  getTeammate,
} from "@shared/types";

import {
  getRankValue,
  groupCardsByRank,
  identifyCardType,
  calculatePlayValue,
  canPlayCards,
  sortCards,
  findPlayableCombinations,
  isSequence,
  isPairSequence,
  isTripleSequence,
} from "./gameEngine";

// ─────────────────────────────────────────────────────────────────────────────
// 1. 牌面编码（移植自 utils.py CardToNum）
// ─────────────────────────────────────────────────────────────────────────────

/** 花色前缀映射（与 Danzero+ 一致：H=红桃, S=黑桃, C=梅花, D=方块） */
const SUIT_PREFIX: Record<Suit, string> = {
  [Suit.Hearts]: "H",
  [Suit.Diamonds]: "D",
  [Suit.Clubs]: "C",
  [Suit.Spades]: "S",
};

/** 点数后缀映射（与 Danzero+ 一致：T=10, B=小王, R=大王） */
const RANK_SUFFIX: Record<Rank, string> = {
  [Rank.Two]: "2",
  [Rank.Three]: "3",
  [Rank.Four]: "4",
  [Rank.Five]: "5",
  [Rank.Six]: "6",
  [Rank.Seven]: "7",
  [Rank.Eight]: "8",
  [Rank.Nine]: "9",
  [Rank.Ten]: "T",
  [Rank.Jack]: "J",
  [Rank.Queen]: "Q",
  [Rank.King]: "K",
  [Rank.Ace]: "A",
  [Rank.SmallJoker]: "B",
  [Rank.BigJoker]: "R",
};

/** 生成 Danzero+ 格式的牌面字符串，如 "H5", "ST", "SB", "HR" */
function cardToStr(card: Card): string {
  if (card.rank === Rank.SmallJoker) return "SB";
  if (card.rank === Rank.BigJoker) return "HR";
  return SUIT_PREFIX[card.suit] + RANK_SUFFIX[card.rank];
}

/** Danzero+ CardToNum 映射（54 张牌编号 0–53） */
const CARD_TO_NUM: Record<string, number> = {
  H2:0, H3:1, H4:2, H5:3, H6:4, H7:5, H8:6, H9:7, HT:8, HJ:9, HQ:10, HK:11, HA:12,
  S2:13, S3:14, S4:15, S5:16, S6:17, S7:18, S8:19, S9:20, ST:21, SJ:22, SQ:23, SK:24, SA:25,
  C2:26, C3:27, C4:28, C5:29, C6:30, C7:31, C8:32, C9:33, CT:34, CJ:35, CQ:36, CK:37, CA:38,
  D2:39, D3:40, D4:41, D5:42, D6:43, D7:44, D8:45, D9:46, DT:47, DJ:48, DQ:49, DK:50, DA:51,
  SB:52, HR:53,
};

/** 将 Card[] 转为 Danzero+ 数字编号数组 */
function card2num(cards: Card[]): number[] {
  return cards.map(c => CARD_TO_NUM[cardToStr(c)] ?? -1).filter(n => n >= 0);
}

/**
 * 将数字编号数组转为 54 维 one-hot 向量（移植自 utils.py card2array）
 * 返回 Float32Array，长度 54
 */
function card2array(nums: number[]): Float32Array {
  const arr = new Float32Array(54);
  if (nums.length === 0) return arr;
  // 统计每个编号出现次数
  const counter: Record<number, number> = {};
  for (const n of nums) {
    if (n < 0) continue;
    counter[n] = (counter[n] ?? 0) + 1;
  }
  // 4×13 矩阵（按列展平）+ 2 joker 位
  const matrix = new Float32Array(52); // 4 suits × 13 ranks, column-major
  const jokers = new Float32Array(2);
  for (const [key, cnt] of Object.entries(counter)) {
    const n = Number(key);
    if (n < 52) {
      // column-major: index = suit*13 + rank → flatten('F') = rank*4 + suit
      const suit = Math.floor(n / 13);
      const rank = n % 13;
      matrix[rank * 4 + suit] = cnt;
    } else if (n === 52) {
      jokers[0] = cnt;
    } else if (n === 53) {
      jokers[1] = cnt;
    }
  }
  arr.set(matrix);
  arr.set(jokers, 52);
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 手牌分析（移植自 utils.py combineHandcards）
// ─────────────────────────────────────────────────────────────────────────────

/** Danzero+ 点数值映射（用于排序和顺子检测） */
const DANZERO_RANK_VAL: Record<string, number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14,"B":16,"R":17
};

interface CombinedHand {
  Single: Card[];
  Pair: Card[][];
  Trips: Card[][];
  Bomb: Card[][];
  Straight: Card[][];
  StraightFlush: Card[][];
  bombInfo: Record<string, number>; // rank_suffix → count
}

/**
 * 移植自 utils.py combine_handcards
 * 将手牌按牌型分组，并检测顺子/同花顺
 */
function combineHandcards(hand: Card[], currentRank: Rank): CombinedHand {
  const rankSuffix = RANK_SUFFIX[currentRank];

  // 按 Danzero+ 点数值排序
  const sorted = [...hand].sort((a, b) => {
    const va = DANZERO_RANK_VAL[RANK_SUFFIX[a.rank]] ?? 0;
    const vb = DANZERO_RANK_VAL[RANK_SUFFIX[b.rank]] ?? 0;
    return va - vb;
  });

  const result: CombinedHand = {
    Single: [], Pair: [], Trips: [], Bomb: [],
    Straight: [], StraightFlush: [], bombInfo: {},
  };

  // 按点数分组
  let start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    const prevSuffix = RANK_SUFFIX[sorted[i - 1].rank];
    const curSuffix = i < sorted.length ? RANK_SUFFIX[sorted[i].rank] : null;
    if (curSuffix !== prevSuffix) {
      const group = sorted.slice(start, i);
      const sz = group.length;
      if (sz === 1) result.Single.push(group[0]);
      else if (sz === 2) result.Pair.push(group);
      else if (sz === 3) result.Trips.push(group);
      else {
        result.Bomb.push(group);
        result.bombInfo[prevSuffix] = sz;
      }
      start = i;
    }
  }

  // ── 顺子检测（移植自 utils.py 的 st 算法） ──
  // 排除级牌、王牌，统计每个点数的数量
  const nonSpecial = sorted.filter(
    c => c.rank !== currentRank && c.rank !== Rank.SmallJoker && c.rank !== Rank.BigJoker
  );
  // 去掉已是炸弹的牌
  const bombRanks = new Set(result.Bomb.map(b => b[0].rank));
  const forStraight = nonSpecial.filter(c => !bombRanks.has(c.rank));

  // 点数计数（A=1 wrap-around 处理）
  const cardre: number[] = new Array(14).fill(0);
  const s2v: Record<string, number> = {
    "A":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13
  };
  for (const c of forStraight) {
    const v = s2v[RANK_SUFFIX[c.rank]];
    if (v !== undefined) cardre[v]++;
  }

  // 寻找最优 5 张顺子起点（移植自 utils.py 的 st 算法）
  let st: number[] = [];
  let minnum = 10, mintwonum = 10;

  for (let i = 1; i <= cardre.length - 5; i++) {
    const window = cardre.slice(i, i + 5);
    if (window.includes(0)) continue;
    let zeronum = 0, onenum = 0, twonum = 0;
    for (const j of window) {
      if (j - 1 === 0) zeronum++;
      if (j - 1 === 1) onenum++;
      if (j - 1 === 2) twonum++;
    }
    if (zeronum > onenum && minnum >= onenum && zeronum >= onenum + twonum) {
      if (st.length === 0) {
        st = [i]; minnum = onenum; mintwonum = twonum;
      } else if (minnum === onenum && mintwonum >= twonum) {
        st = [i]; mintwonum = twonum;
      } else if (minnum > onenum) {
        st = [i]; minnum = onenum; mintwonum = twonum;
      }
    }
  }

  // A-2-3-4-5 wrap-around
  if (!cardre.slice(10).includes(0) && cardre[1] !== 0) {
    let zeronum = 0, onenum = 0, twonum = 0;
    for (const j of [...cardre.slice(10), cardre[1]]) {
      if (j - 1 === 0) zeronum++;
      if (j - 1 === 1) onenum++;
      if (j - 1 === 2) twonum++;
    }
    if (zeronum > onenum && minnum >= onenum && zeronum >= onenum + twonum) {
      if (st.length === 0 || minnum > onenum || (minnum === onenum && mintwonum >= twonum)) {
        st = [10];
      }
    }
  }

  if (st.length > 0) {
    const startVal = st[0];
    const v2r: Record<number, Rank> = {
      1: Rank.Ace, 2: Rank.Two, 3: Rank.Three, 4: Rank.Four, 5: Rank.Five,
      6: Rank.Six, 7: Rank.Seven, 8: Rank.Eight, 9: Rank.Nine, 10: Rank.Ten,
      11: Rank.Jack, 12: Rank.Queen, 13: Rank.King,
    };
    const straightRanks: Rank[] = [];
    for (let i = startVal; i < startVal + 5; i++) {
      const r = v2r[i === 14 ? 1 : i];
      if (r) straightRanks.push(r);
    }

    // 检测同花顺
    const colorGroups: Record<string, Card[]> = { S: [], H: [], C: [], D: [] };
    for (const c of forStraight) {
      if (straightRanks.includes(c.rank)) {
        colorGroups[SUIT_PREFIX[c.suit]].push(c);
      }
    }
    let flushCards: Card[] | null = null;
    for (const [, cards] of Object.entries(colorGroups)) {
      const ranks = new Set(cards.map(c => c.rank));
      if (straightRanks.every(r => ranks.has(r))) {
        flushCards = straightRanks.map(r => cards.find(c => c.rank === r)!);
        break;
      }
    }

    if (flushCards) {
      result.StraightFlush.push(flushCards);
    } else {
      // 普通顺子：每个点数取一张（优先同花）
      const used = new Set<Card>();
      const straight: Card[] = [];
      for (const r of straightRanks) {
        const candidates = forStraight.filter(c => c.rank === r && !used.has(c));
        if (candidates.length > 0) {
          used.add(candidates[0]);
          straight.push(candidates[0]);
        }
      }
      if (straight.length === 5) result.Straight.push(straight);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 万能牌标志位（移植自 game.py procUniversal）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 计算万能牌（级牌）的 12 维标志位向量
 * 移植自 game.py MyClient.proc_universal
 */
function procUniversal(handNums: Float32Array, curRankIdx: number): Float32Array {
  const res = new Float32Array(12);

  // 检查是否有级牌
  if (handNums[(curRankIdx) * 4] === 0 &&
      handNums[(curRankIdx) * 4 + 1] === 0 &&
      handNums[(curRankIdx) * 4 + 2] === 0 &&
      handNums[(curRankIdx) * 4 + 3] === 0) {
    return res;
  }
  res[0] = 1;

  // 检查是否能组成顺子（rock_flag）
  let rockFlag = 0;
  for (let suit = 0; suit < 4 && rockFlag === 0; suit++) {
    const temp: number[] = [];
    for (let j = 0; j < 5; j++) {
      const idx = suit + j * 4;
      temp.push(idx !== curRankIdx * 4 + suit ? handNums[idx] : 0);
    }
    let right = 5;
    while (right <= 13) {
      const zeroNum = temp.filter(v => v === 0).length;
      if (zeroNum <= 1) { rockFlag = 1; break; }
      const idx = suit + right * 4;
      temp.push(idx !== curRankIdx * 4 + suit ? handNums[idx] : 0);
      temp.shift();
      right++;
    }
  }
  res[1] = rockFlag;

  // 统计非级牌的每个点数数量
  const numCount = new Array(13).fill(0);
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 0; rank < 13; rank++) {
      const idx = suit + rank * 4;
      if (handNums[idx] !== 0 && rank !== curRankIdx) {
        numCount[rank]++;
      }
    }
  }
  const numMax = Math.max(...numCount);
  if (numMax >= 6) res.fill(1, 2, 8);
  else if (numMax === 5) res.fill(1, 3, 8);
  else if (numMax === 4) res.fill(1, 4, 8);
  else if (numMax === 3) res.fill(1, 5, 8);
  else if (numMax === 2) res.fill(1, 6, 8);
  else res[7] = 1;

  // 连续性检测
  let temp = 0;
  for (let i = 0; i < 13; i++) {
    if (numCount[i] !== 0) {
      temp++;
      if (i >= 1) {
        if ((numCount[i] === 2 && numCount[i-1] >= 3) || (numCount[i] >= 3 && numCount[i-1] === 2)) res[9] = 1;
        if (numCount[i] === 2 && numCount[i-1] === 2) res[11] = 1;
      }
      if (i >= 2) {
        if ((numCount[i-2] === 1 && numCount[i-1] >= 2 && numCount[i] >= 2) ||
            (numCount[i-2] >= 2 && numCount[i-1] === 1 && numCount[i] >= 2) ||
            (numCount[i-2] >= 2 && numCount[i-1] >= 2 && numCount[i] === 1)) res[10] = 1;
      }
    } else {
      temp = 0;
    }
  }
  if (temp >= 4) res[8] = 1;

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 状态向量构建（移植自 game.py prepare）
// ─────────────────────────────────────────────────────────────────────────────

/** Danzero+ 级牌排名映射（2=1, 3=2, ..., A=13） */
const DANZERO_RANK_IDX: Record<Rank, number> = {
  [Rank.Two]: 1, [Rank.Three]: 2, [Rank.Four]: 3, [Rank.Five]: 4,
  [Rank.Six]: 5, [Rank.Seven]: 6, [Rank.Eight]: 7, [Rank.Nine]: 8,
  [Rank.Ten]: 9, [Rank.Jack]: 10, [Rank.Queen]: 11, [Rank.King]: 12,
  [Rank.Ace]: 13, [Rank.SmallJoker]: 0, [Rank.BigJoker]: 0,
};

function getOneHotArray(value: number, maxCards: number, flag: number): Float32Array {
  if (flag === 0) {
    const arr = new Float32Array(maxCards);
    if (value >= 1 && value <= maxCards) arr[value - 1] = 1;
    return arr;
  } else {
    const arr = new Float32Array(maxCards + 1);
    if (value >= 0 && value <= maxCards) arr[value] = 1;
    return arr;
  }
}

function concatFloat32(...arrays: Float32Array[]): Float32Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/** 游戏历史追踪（每局游戏维护一个实例） */
export interface DanzeroGameHistory {
  /** 各玩家历史出牌（数字编号列表的列表） */
  historyAction: Record<number, number[][]>;
  /** 各玩家剩余牌数 */
  remaining: Record<number, number>;
  /** 其他玩家手牌估计（54 位，每位表示该牌还剩几张） */
  otherLeftHands: number[];
  /** 已出完牌的玩家 */
  over: number[];
}

export function createDanzeroHistory(): DanzeroGameHistory {
  return {
    historyAction: { 0: [], 1: [], 2: [], 3: [] },
    remaining: { 0: 27, 1: 27, 2: 27, 3: 27 },
    otherLeftHands: new Array(54).fill(2),
    over: [],
  };
}

/**
 * 构建 Danzero+ 567 维状态向量（移植自 game.py prepare）
 *
 * 向量组成（每维含义）：
 *  [0..53]   my_handcards        — 自己手牌 54 维
 *  [54..65]  universal_card_flag — 万能牌标志 12 维
 *  [66..119] other_handcards     — 其他玩家估计手牌 54 维
 *  [120..173] last_action        — 上一手出牌 54 维
 *  [174..227] last_teammate_action — 队友最后出牌 54 维
 *  [228..281] down_played_cards  — 下家已出牌 54 维
 *  [282..335] teammate_played_cards — 队友已出牌 54 维
 *  [336..389] up_played_cards    — 上家已出牌 54 维
 *  [390..417] down_num_cards_left — 下家剩余牌数 28 维 one-hot
 *  [418..445] teammate_num_cards_left — 队友剩余牌数 28 维
 *  [446..473] up_num_cards_left  — 上家剩余牌数 28 维
 *  [474..486] self_rank          — 己方级牌 13 维 one-hot
 *  [487..499] oppo_rank          — 对方级牌 13 维 one-hot
 *  [500..512] cur_rank           — 当前级牌 13 维 one-hot
 *  [513..566] my_action          — 候选动作 54 维
 *  Total = 567
 */
export function buildStateVector(
  myPos: number,
  myHand: Card[],
  candidateAction: Card[],
  history: DanzeroGameHistory,
  selfRank: Rank,
  oppoRank: Rank,
  curRank: Rank
): Float32Array {
  const myHandNums = card2num(myHand);
  const myHandArr = card2array(myHandNums);

  const curRankIdx = DANZERO_RANK_IDX[curRank] - 1; // 0-based for matrix index
  const universalFlag = procUniversal(myHandArr, curRankIdx);

  // 其他玩家估计手牌
  const otherHands: number[] = [];
  for (let i = 0; i < 54; i++) {
    if (history.otherLeftHands[i] >= 1) otherHands.push(i);
    if (history.otherLeftHands[i] >= 2) otherHands.push(i);
  }
  const otherHandsArr = card2array(otherHands);

  // 最后一手出牌
  const allActions = Object.values(history.historyAction).flat();
  const lastActionNums = allActions.length > 0 ? allActions[allActions.length - 1] : [];
  const lastActionArr = lastActionNums.length === 0
    ? new Float32Array(54).fill(-1)
    : card2array(lastActionNums);

  // 队友最后出牌
  const teammatePos = (myPos + 2) % 4;
  const teammateHistory = history.historyAction[teammatePos];
  const lastTeammateNums = teammateHistory.length > 0 && !history.over.includes(teammatePos)
    ? teammateHistory[teammateHistory.length - 1]
    : [];
  const lastTeammateArr = lastTeammateNums.length === 0
    ? new Float32Array(54).fill(-1)
    : card2array(lastTeammateNums);

  // 各方已出牌
  const downPos = (myPos + 1) % 4;
  const upPos = (myPos + 3) % 4;

  const flatten = (nums: number[][]) => nums.flat();
  const downPlayed = card2array(flatten(history.historyAction[downPos]));
  const teammatePlayed = card2array(flatten(history.historyAction[teammatePos]));
  const upPlayed = card2array(flatten(history.historyAction[upPos]));

  // 剩余牌数 one-hot
  const downLeft = getOneHotArray(history.remaining[downPos], 27, 1);
  const teammateLeft = getOneHotArray(history.remaining[teammatePos], 27, 1);
  const upLeft = getOneHotArray(history.remaining[upPos], 27, 1);

  // 级牌 one-hot
  const selfRankArr = getOneHotArray(DANZERO_RANK_IDX[selfRank], 13, 0);
  const oppoRankArr = getOneHotArray(DANZERO_RANK_IDX[oppoRank], 13, 0);
  const curRankArr = getOneHotArray(DANZERO_RANK_IDX[curRank], 13, 0);

  // 候选动作
  const actionArr = card2array(card2num(candidateAction));

  return concatFloat32(
    myHandArr,          // 54
    universalFlag,      // 12
    otherHandsArr,      // 54
    lastActionArr,      // 54
    lastTeammateArr,    // 54
    downPlayed,         // 54
    teammatePlayed,     // 54
    upPlayed,           // 54
    downLeft,           // 28
    teammateLeft,       // 28
    upLeft,             // 28
    selfRankArr,        // 13
    oppoRankArr,        // 13
    curRankArr,         // 13
    actionArr,          // 54
    // Total = 567
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 高质量决策函数（移植自 game.py back_action 的规则逻辑）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 评估一手牌的"战略价值"（越低越应该先出）
 * 移植自 Danzero+ game.py 中 choose_in_single / choose_in_pair / choose_in_trips / choose_in_bomb 的选牌逻辑
 */
function evaluatePlayStrategicValue(
  cards: Card[],
  combined: CombinedHand,
  currentRank: Rank
): number {
  const type = identifyCardType(cards, currentRank);
  if (!type) return 9999;

  const baseValue = calculatePlayValue(cards, type, currentRank);

  // 炸弹：优先保留大炸弹，用最小炸弹
  if (type === CardType.Bomb || type === CardType.RoyalBomb) {
    const bombCount = cards.length;
    // 炸弹越大越不应该先出
    return baseValue + (bombCount - 4) * 100;
  }

  // 顺子/同花顺：非常宝贵，不轻易拆
  if (type === CardType.Sequence) {
    // 检查是否是已识别的顺子的一部分
    const isPartOfStraight = combined.Straight.some(s =>
      cards.every(c => s.some(sc => sc.rank === c.rank && sc.suit === c.suit))
    ) || combined.StraightFlush.some(s =>
      cards.every(c => s.some(sc => sc.rank === c.rank && sc.suit === c.suit))
    );
    if (isPartOfStraight) return baseValue - 50; // 优先出顺子
  }

  // 单张：优先出小牌，但避免拆散对子/三张/顺子
  if (type === CardType.Single) {
    const rank = cards[0].rank;
    const rankSuffix = RANK_SUFFIX[rank];
    // 检查这张牌是否是某个对子/三张/炸弹的一部分
    const isInPair = combined.Pair.some(p => p.some(c => c.rank === rank));
    const isInTrips = combined.Trips.some(t => t.some(c => c.rank === rank));
    const isInBomb = combined.Bomb.some(b => b.some(c => c.rank === rank));
    const isInStraight = combined.Straight.some(s => s.some(c => c.rank === rank)) ||
                         combined.StraightFlush.some(s => s.some(c => c.rank === rank));

    // 按 Danzero+ 逻辑：不拆对子/三张/炸弹/顺子
    if (isInBomb) return baseValue + 500;
    if (isInTrips) return baseValue + 300;
    if (isInPair) return baseValue + 200;
    if (isInStraight) return baseValue + 400;

    // 级牌单张：非常宝贵
    if (rank === currentRank) return baseValue + 600;

    return baseValue;
  }

  // 对子：检查是否能组成连对
  if (type === CardType.Pair) {
    const rankSuffix = RANK_SUFFIX[cards[0].rank];
    const pairVal = DANZERO_RANK_VAL[rankSuffix] ?? 0;
    // 检查相邻对子（连对潜力）
    const hasAdjacentPair = combined.Pair.some(p => {
      const pv = DANZERO_RANK_VAL[RANK_SUFFIX[p[0].rank]] ?? 0;
      return Math.abs(pv - pairVal) === 1;
    });
    if (hasAdjacentPair) return baseValue + 100; // 保留连对
    return baseValue;
  }

  // 三张：检查是否能组成三顺
  if (type === CardType.Triple) {
    const rankSuffix = RANK_SUFFIX[cards[0].rank];
    const tripVal = DANZERO_RANK_VAL[rankSuffix] ?? 0;
    const hasAdjacentTrip = combined.Trips.some(t => {
      const tv = DANZERO_RANK_VAL[RANK_SUFFIX[t[0].rank]] ?? 0;
      return Math.abs(tv - tripVal) === 1;
    });
    if (hasAdjacentTrip) return baseValue + 150;
    return baseValue;
  }

  return baseValue;
}

/**
 * 首出时选择最优牌型（移植自 Danzero+ game.py back_action 中的首出逻辑）
 *
 * 策略：
 * 1. 优先出顺子/同花顺（快速清牌）
 * 2. 其次出连对
 * 3. 其次出三顺
 * 4. 出单张（选择不破坏其他牌型的最小单张）
 * 5. 出对子（选择不破坏连对的最小对子）
 * 6. 出三张
 * 7. 最后才出炸弹
 */
function chooseBestFirstPlay(hand: Card[], currentRank: Rank): Card[] {
  const combined = combineHandcards(hand, currentRank);

  // 1. 同花顺
  if (combined.StraightFlush.length > 0) {
    return combined.StraightFlush[0];
  }

  // 2. 顺子
  if (combined.Straight.length > 0) {
    return combined.Straight[0];
  }

  // 3. 连对（找到连续的对子）
  if (combined.Pair.length >= 3) {
    const sortedPairs = [...combined.Pair].sort((a, b) => {
      const va = DANZERO_RANK_VAL[RANK_SUFFIX[a[0].rank]] ?? 0;
      const vb = DANZERO_RANK_VAL[RANK_SUFFIX[b[0].rank]] ?? 0;
      return va - vb;
    });
    // 找连续3对
    for (let i = 0; i <= sortedPairs.length - 3; i++) {
      const v0 = DANZERO_RANK_VAL[RANK_SUFFIX[sortedPairs[i][0].rank]] ?? 0;
      const v1 = DANZERO_RANK_VAL[RANK_SUFFIX[sortedPairs[i+1][0].rank]] ?? 0;
      const v2 = DANZERO_RANK_VAL[RANK_SUFFIX[sortedPairs[i+2][0].rank]] ?? 0;
      if (v1 === v0 + 1 && v2 === v1 + 1) {
        return [...sortedPairs[i], ...sortedPairs[i+1], ...sortedPairs[i+2]];
      }
    }
  }

  // 4. 三顺（找连续的三张）
  if (combined.Trips.length >= 2) {
    const sortedTrips = [...combined.Trips].sort((a, b) => {
      const va = DANZERO_RANK_VAL[RANK_SUFFIX[a[0].rank]] ?? 0;
      const vb = DANZERO_RANK_VAL[RANK_SUFFIX[b[0].rank]] ?? 0;
      return va - vb;
    });
    for (let i = 0; i <= sortedTrips.length - 2; i++) {
      const v0 = DANZERO_RANK_VAL[RANK_SUFFIX[sortedTrips[i][0].rank]] ?? 0;
      const v1 = DANZERO_RANK_VAL[RANK_SUFFIX[sortedTrips[i+1][0].rank]] ?? 0;
      if (v1 === v0 + 1) {
        return [...sortedTrips[i], ...sortedTrips[i+1]];
      }
    }
  }

  // 5. 选择最优单张（不破坏其他牌型的最小单张）
  const allCandidates: { cards: Card[]; value: number }[] = [];

  // 单张候选
  for (const card of combined.Single) {
    const value = evaluatePlayStrategicValue([card], combined, currentRank);
    allCandidates.push({ cards: [card], value });
  }

  // 对子候选（如果没有单张）
  if (combined.Single.length === 0) {
    for (const pair of combined.Pair) {
      const value = evaluatePlayStrategicValue(pair, combined, currentRank);
      allCandidates.push({ cards: pair, value });
    }
  }

  // 三张候选
  if (combined.Single.length === 0 && combined.Pair.length === 0) {
    for (const trip of combined.Trips) {
      const value = evaluatePlayStrategicValue(trip, combined, currentRank);
      allCandidates.push({ cards: trip, value });
    }
  }

  if (allCandidates.length > 0) {
    allCandidates.sort((a, b) => a.value - b.value);
    return allCandidates[0].cards;
  }

  // 兜底：出最小的牌
  const sorted = sortCards(hand, currentRank);
  return [sorted[0]];
}

/**
 * 接牌时选择最优牌型（移植自 Danzero+ 的接牌策略）
 *
 * 策略：
 * 1. 优先用最小的同类型牌压制
 * 2. 炸弹：用最小炸弹，保留大炸弹
 * 3. 如果队友是上家且已经是最大牌，考虑不接（pass）
 * 4. 如果对手剩余牌数少，优先出炸弹阻止
 */
function chooseBestResponse(
  hand: Card[],
  lastPlay: CardPlay,
  history: DanzeroGameHistory,
  myPos: number,
  currentRank: Rank
): Card[] | null {
  const combined = combineHandcards(hand, currentRank);
  const candidates = findPlayableCombinations(hand, lastPlay, currentRank);

  if (candidates.length === 0) return null;

  // 检查队友是否是上家（如果是，考虑不接）
  const teammatePos = (myPos + 2) % 4;
  const isTeammateLastPlayer = history.historyAction[teammatePos].length > 0 &&
    Object.entries(history.historyAction).every(([pos, actions]) => {
      if (Number(pos) === teammatePos) return true;
      return actions.length === 0 || actions[actions.length - 1].length === 0;
    });

  // 对手剩余牌数
  const oppoPos1 = (myPos + 1) % 4;
  const oppoPos2 = (myPos + 3) % 4;
  const minOppoRemaining = Math.min(
    history.remaining[oppoPos1],
    history.remaining[oppoPos2]
  );

  // 按战略价值排序候选
  const scored = candidates.map(cards => ({
    cards,
    value: evaluatePlayStrategicValue(cards, combined, currentRank),
  }));
  scored.sort((a, b) => a.value - b.value);

  // 如果对手快出完了（≤5张），优先用炸弹阻止
  if (minOppoRemaining <= 5) {
    const bombCandidates = scored.filter(s => {
      const t = identifyCardType(s.cards, currentRank);
      return t === CardType.Bomb || t === CardType.RoyalBomb;
    });
    if (bombCandidates.length > 0) {
      return bombCandidates[0].cards;
    }
  }

  // 如果队友是上家且出了大牌，考虑不接（让队友赢这轮）
  if (isTeammateLastPlayer && lastPlay.value > 50) {
    // 只有炸弹才接
    const nonBombCandidates = scored.filter(s => {
      const t = identifyCardType(s.cards, currentRank);
      return t !== CardType.Bomb && t !== CardType.RoyalBomb;
    });
    if (nonBombCandidates.length === 0) {
      return scored[0].cards; // 只有炸弹可接，用最小炸弹
    }
    // 有非炸弹可接，但如果上家出的是大牌，不接
    if (lastPlay.value > 100) return null;
  }

  return scored[0].cards;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 主入口：替换 getAIMove 的高质量版本
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Danzero+ 风格的 AI 决策函数
 *
 * 相比原有的简单贪心算法，本函数实现了：
 * - 手牌结构分析（识别顺子/连对/三顺潜力）
 * - 不拆散有价值的牌型组合
 * - 炸弹管理（保留大炸弹）
 * - 队友协作（队友是上家时考虑不接）
 * - 对手威胁感知（对手快出完时用炸弹阻止）
 *
 * @param gameState 当前游戏状态
 * @param playerPos AI 玩家位置
 * @param history Danzero 游戏历史追踪（需在游戏开始时创建并持续更新）
 * @returns 要出的牌组合，null 表示不要（pass）
 */
export function danzeroGetAIMove(
  gameState: GameStateData,
  playerPos: PlayerPosition,
  history: DanzeroGameHistory
): Card[] | null {
  const hand = gameState.players[playerPos].hand;
  const lastPlay = gameState.currentRound.lastPlay;
  const currentRank = gameState.currentRank;
  const myPos = playerPos as number;

  if (hand.length === 0) return null;

  if (!lastPlay) {
    // 首出
    return chooseBestFirstPlay(hand, currentRank);
  }

  // 接牌
  return chooseBestResponse(hand, lastPlay, history, myPos, currentRank);
}

/**
 * 更新 Danzero 历史记录（每次出牌后调用）
 *
 * @param history 历史记录对象（会被修改）
 * @param playerPos 出牌玩家位置
 * @param cards 出的牌（空数组表示不要）
 * @param myPos 我方玩家位置（用于更新 otherLeftHands）
 */
export function updateDanzeroHistory(
  history: DanzeroGameHistory,
  playerPos: number,
  cards: Card[],
  myPos: number
): void {
  const nums = card2num(cards);
  history.historyAction[playerPos].push(nums);

  // 更新剩余牌数
  if (cards.length > 0) {
    history.remaining[playerPos] = Math.max(0, history.remaining[playerPos] - cards.length);
    if (history.remaining[playerPos] === 0 && !history.over.includes(playerPos)) {
      history.over.push(playerPos);
    }
  }

  // 更新其他玩家手牌估计（仅对非自己玩家）
  if (playerPos !== myPos && cards.length > 0) {
    for (const n of nums) {
      if (n >= 0 && n < 54) {
        history.otherLeftHands[n] = Math.max(0, history.otherLeftHands[n] - 1);
      }
    }
  }
}
