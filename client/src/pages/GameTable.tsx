import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardType, GameStateData, PlayerPosition, Rank, GameStatus, Team } from "@shared/types";
import {
  executePlay,
  executePass,
  identifyCardType,
  canPlayCards,
  calculatePlayValue,
  getCardTypeLabel,
  sortCards,
  findPlayableCombinations,
  groupCardsByRank,
  getCardReportStatus,
  isHeartRank,
  initiateTributePhase,
  executeSingleTribute,
  executeSingleReturn,
  allTributesCompleted,
  getPendingTributePlayer,
  getPendingReturnPlayer,
  getMaxTributeCard,
  getValidReturnCards,
  canResistTribute,
} from "@/lib/gameEngine";
import {
  danzeroGetAIMove,
  updateDanzeroHistory,
  createDanzeroHistory,
  type DanzeroGameHistory,
} from "@/lib/danzeroAI";
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Crown,
  Filter,
  Flame,
  History,
  Lightbulb,
  RefreshCw,
  Spade,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
  Zap as BombIcon,
} from "lucide-react";
import "./GameTable.css";

interface GameTableProps {
  gameState: GameStateData;
  playerName: string;
  onGameEnd: (finalState: GameStateData) => void;
  onBackToLobby: () => void;
  myTeamWins?: number;
  opponentTeamWins?: number;
}

interface PlayRecord {
  round: number;
  player: string;
  playerPos: PlayerPosition;
  cards: Card[];
  cardType: string;
  isPassed: boolean;
  timestamp: number;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "#e53e3e",
  diamonds: "#e53e3e",
  clubs: "#1a202c",
  spades: "#1a202c",
};

function getRankDisplay(rank: string): string {
  if (rank === "joker_small") return "小";
  if (rank === "joker_big") return "大";
  return rank;
}

function getPlayerLabel(pos: PlayerPosition): string {
  const labels = ["你", "东家", "北家", "西家"];
  return labels[pos];
}

function getPositionLabel(pos: PlayerPosition): string {
  const labels = ["南（你）", "东", "北", "西"];
  return labels[pos];
}

export default function GameTable({
  gameState: initialGameState,
  playerName,
  onGameEnd,
  onBackToLobby,
  myTeamWins = 0,
  opponentTeamWins = 0,
}: GameTableProps) {
  const [gameState, setGameState] = useState<GameStateData>(initialGameState);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("游戏开始！轮到你出牌");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [playHistory, setPlayHistory] = useState<PlayRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState<number | "all">("all"); // "all" or PlayerPosition
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const [historyView, setHistoryView] = useState<"detail" | "summary">("detail"); // 明细 or 汇总
  const [hoverCard, setHoverCard] = useState<Card | null>(null); // 当前 hover 的牌
  // 贡牌还牌相关状态
  const [tributePhase, setTributePhase] = useState<'none' | 'tribute' | 'return'>('none'); // 贡牌还牌阶段
  const [tributeGameState, setTributeGameState] = useState<GameStateData | null>(null); // 贡牌还牌中的游戏状态
  const [tributeSelectedCard, setTributeSelectedCard] = useState<Card | null>(null); // 已选择的贡牌/还牌牌
  const [lastPlayKey, setLastPlayKey] = useState(0); // 每次出牌时自增，用于触发动画重播
  // 过牌浮动提示动画：记录每个玩家最近一次过牌的时间戳
  const [passAnimKey, setPassAnimKey] = useState<Record<number, number>>({}); // pos -> timestamp
  const lastClickTimeRef = useRef<{ rank: string; suit: string; time: number } | null>(null); // 双击检测
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 单击即出定时器
  const gameStateRef = useRef(gameState); // 始终指向最新 gameState，避免陷旧闭包
  const historyEndRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTributeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // AI 贡牌自动处理定时器
  const danzeroHistoryRef = useRef<DanzeroGameHistory>(createDanzeroHistory());
  // 下面几个 ref 需要在 handleCardClick 和键盘快捷键中共用，必须在两者之前声明
  const selectedCardsRef = useRef<Card[]>([]);
  const isMyTurnRef = useRef(false);
  const isAIThinkingRef = useRef(false);
  // playCardsRef 在 playCards 定义后立即更新
  const playCardsRef = useRef<(cards: Card[]) => boolean>(() => false);

  // Safety check: ensure gameState and currentRound are defined
  if (!gameState || !gameState.currentRound) {
    console.error("GameTable: Invalid gameState", gameState);
    return null;
  }

  const currentPlayer = gameState.currentRound.currentPlayer;
  const isMyTurn = currentPlayer === PlayerPosition.Player0;
  const myHand = sortCards(gameState.players[PlayerPosition.Player0].hand, gameState.currentRank);

  // 始终同步最新 gameState 到 ref，供异步回调使用
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // AI 贡牌还牌自动化：当轮到 AI 贡牌/还牌时，自动延迟 1-2 秒后执行
  useEffect(() => {
    if (tributePhase === 'none' || !tributeGameState) return;
    const myPos = PlayerPosition.Player0;
    const pendingTributePlayer = getPendingTributePlayer(tributeGameState);
    const pendingReturnPlayer = getPendingReturnPlayer(tributeGameState);
    const isMyTributeTime = pendingTributePlayer === myPos;
    const isMyReturnTime = pendingReturnPlayer === myPos;

    // 如果是我方的回合，不自动处理
    if (isMyTributeTime || isMyReturnTime) return;

    // 清除旧定时器
    if (aiTributeTimerRef.current) clearTimeout(aiTributeTimerRef.current);

    // AI 贡牌阶段自动处理
    if (tributePhase === 'tribute' && pendingTributePlayer !== null) {
      const delay = 1000 + Math.random() * 800;
      aiTributeTimerRef.current = setTimeout(() => {
        const state = tributeGameState;
        const maxCard = getMaxTributeCard(state.players[pendingTributePlayer].hand, state.currentRank);
        if (maxCard) {
          const result = executeSingleTribute(state, pendingTributePlayer, maxCard);
          if (result.success && result.newState) {
            const allTribDone = result.newState.currentRound.tribute.every(t => t.tributeCard !== null);
            if (allTribDone) {
              setTributeGameState(result.newState);
              setTributePhase('return');
            } else {
              setTributeGameState(result.newState);
            }
          }
        }
      }, delay);
    }

    // AI 还牌阶段自动处理
    if (tributePhase === 'return' && pendingReturnPlayer !== null) {
      const delay = 1000 + Math.random() * 800;
      aiTributeTimerRef.current = setTimeout(() => {
        const state = tributeGameState;
        const tributeInfo = state.currentRound.tribute.find(t => t.toPlayer === pendingReturnPlayer);
        if (tributeInfo) {
          const validCards = getValidReturnCards(
            state.players[pendingReturnPlayer].hand,
            pendingReturnPlayer,
            tributeInfo.fromPlayer,
            state.currentRank
          );
          if (validCards.length > 0) {
            const result = executeSingleReturn(state, pendingReturnPlayer, validCards[0], tributeInfo.fromPlayer);
            if (result.success && result.newState) {
              const allDone = result.newState.currentRound.tribute.every(t => t.isCompleted);
              if (allDone) {
                setTributePhase('none');
                setTributeGameState(null);
                onGameEnd(result.newState);
              } else {
                setTributeGameState(result.newState);
              }
            }
          }
        }
      }, delay);
    }

    return () => {
      if (aiTributeTimerRef.current) clearTimeout(aiTributeTimerRef.current);
    };
  }, [tributePhase, tributeGameState]);
  useEffect(() => { selectedCardsRef.current = selectedCards; }, [selectedCards]);
  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);
  useEffect(() => { isAIThinkingRef.current = isAIThinking; }, [isAIThinking]);

  const lastPlay = gameState.currentRound.lastPlay;

  useEffect(() => {
    if (showHistory && historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [playHistory, showHistory]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(""), 2500);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (gameState.status === GameStatus.Finished) {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      // 检查是否需要进入贡牌阶段
      // 贡牌条件：每局结束后（包括第一局），且有赢家队伍
      // 官方规则第十条：每副牌结束后，下游向上游贡牌
      if (gameState.winningTeam !== null) {
        const newState = initiateTributePhase(gameState, gameState.winningTeam);
        if (newState && newState.currentRound.tribute && newState.currentRound.tribute.length > 0) {
          const allDone = newState.currentRound.tribute.every(t => t.isCompleted);
          if (!allDone) {
            setTributeGameState(newState);
            setTributePhase('tribute');
            return; // 不直接调用 onGameEnd，等贡牌还牌完成后再调用
          }
        }
      }
      onGameEnd(gameState);
    }
  }, [gameState.status]);

  const addPlayRecord = useCallback((
    state: GameStateData,
    pos: PlayerPosition,
    cards: Card[],
    isPassed: boolean
  ) => {
    const cardType = isPassed ? "" : (identifyCardType(cards, state.currentRank) || "");
    const record: PlayRecord = {
      round: state.currentRound.roundNumber,
      player: getPlayerLabel(pos),
      playerPos: pos,
      cards: isPassed ? [] : cards,
      cardType: isPassed ? "不要" : getCardTypeLabel(cardType as CardType),
      isPassed,
      timestamp: Date.now(),
    };
    setPlayHistory(prev => [...prev, record]);
  }, []);

  // 统一出牌函数：使用 gameStateRef 避免异步回调中的陷旧闭包
  const playCards = useCallback((cards: Card[]) => {
    const state = gameStateRef.current;
    const result = executePlay(state, PlayerPosition.Player0, cards);
    if (result.success) {
      const tLabel = identifyCardType(cards, state.currentRank);
      setStatusMsg(`你出了 ${tLabel ? getCardTypeLabel(tLabel) : ""}${cards.length > 1 ? `（${cards.length}张）` : ""}`);
      addPlayRecord(state, PlayerPosition.Player0, cards, false);
      updateDanzeroHistory(danzeroHistoryRef.current, PlayerPosition.Player0, cards, PlayerPosition.Player0);
      setSelectedCards([]);
      setLastPlayKey(k => k + 1); // 触发出牌动画
      setGameState(result.newState!);
      return true;
    } else {
      setErrorMsg(result.error || "出牌失败");
      return false;
    }
  }, [addPlayRecord]);
  // 始终同步最新 playCards 到 ref
  useEffect(() => { playCardsRef.current = playCards; }, [playCards]);

  const runAITurn = useCallback((state: GameStateData) => {
    const pos = state.currentRound.currentPlayer;
    if (pos === PlayerPosition.Player0) return;
    if (state.status === GameStatus.Finished) return;

    setIsAIThinking(true);
    const delay = 600 + Math.random() * 500;

    aiTimerRef.current = setTimeout(() => {
      const aiCards = danzeroGetAIMove(state, pos, danzeroHistoryRef.current);

      let newState: GameStateData;
      if (aiCards && aiCards.length > 0) {
        const result = executePlay(state, pos, aiCards);
        if (result.success && result.newState) {
          newState = result.newState;
          const typeLabel = identifyCardType(aiCards, state.currentRank);
          setStatusMsg(`${getPlayerLabel(pos)} 出了 ${typeLabel ? getCardTypeLabel(typeLabel) : ""}（${aiCards.length}张）`);
          addPlayRecord(state, pos, aiCards, false);
          updateDanzeroHistory(danzeroHistoryRef.current, pos, aiCards, PlayerPosition.Player0);
          setLastPlayKey(k => k + 1); // 触发 AI 出牌动画
        } else {
          const passResult = executePass(state, pos);
          newState = passResult.newState!;
          setStatusMsg(`${getPlayerLabel(pos)} 不要`);
          addPlayRecord(state, pos, [], true);
          updateDanzeroHistory(danzeroHistoryRef.current, pos, [], PlayerPosition.Player0);
          setPassAnimKey(prev => ({ ...prev, [pos]: Date.now() }));
        }
      } else {
        const passResult = executePass(state, pos);
        if (passResult.success && passResult.newState) {
          newState = passResult.newState;
          setStatusMsg(`${getPlayerLabel(pos)} 不要`);
          addPlayRecord(state, pos, [], true);
          updateDanzeroHistory(danzeroHistoryRef.current, pos, [], PlayerPosition.Player0);
          setPassAnimKey(prev => ({ ...prev, [pos]: Date.now() }));
        } else {
          setIsAIThinking(false);
          return;
        }
      }

      setIsAIThinking(false);
      setGameState(newState);

      // Safety check: ensure currentRound exists before accessing
      if (!newState.currentRound) {
        console.error("runAITurn: newState.currentRound is undefined", newState);
        return;
      }

      if (newState.status !== GameStatus.Finished && newState.currentRound.currentPlayer !== PlayerPosition.Player0) {
        runAITurn(newState);
      } else if (newState.currentRound.currentPlayer === PlayerPosition.Player0) {
        if (newState.currentRound.lastPlay) {
          setStatusMsg("轮到你了，请出牌或不要");
        } else {
          setStatusMsg("轮到你了，请首出");
        }
      }
    }, delay);
  }, [addPlayRecord]);

  useEffect(() => {
    if (gameState.status === GameStatus.Finished) return;
    if (currentPlayer !== PlayerPosition.Player0) {
      runAITurn(gameState);
    }
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [currentPlayer, gameState.status]);

  const handleCardClick = (card: Card) => {
    if (!isMyTurn || isAIThinking) return;
    setErrorMsg("");

    const now = Date.now();
    const last = lastClickTimeRef.current;
    const isSameCard = last && last.rank === card.rank && last.suit === card.suit;
    const isDoubleClick = isSameCard && (now - last!.time) < 350;

    // 双击：全选同点数的所有牌
    if (isDoubleClick) {
      lastClickTimeRef.current = null;
      const sameRankCards = myHand.filter(c => c.rank === card.rank);
      const allAlreadySelected = sameRankCards.every(c =>
        selectedCards.some(s => s.rank === c.rank && s.suit === c.suit)
      );
      if (allAlreadySelected) {
        // 已全选则取消全选
        setSelectedCards(prev => prev.filter(c => c.rank !== card.rank));
      } else {
        // 全选同点数
        setSelectedCards(prev => {
          const withoutRank = prev.filter(c => c.rank !== card.rank);
          return [...withoutRank, ...sameRankCards];
        });
      }
      return;
    }

    // 记录本次点击时间
    lastClickTimeRef.current = { rank: card.rank, suit: card.suit, time: now };

    const isSelected = selectedCards.some(
      (c) => c.rank === card.rank && c.suit === card.suit
    );

    if (isSelected) {
      // 已选中：取消选中
      setSelectedCards(prev => prev.filter(c => !(c.rank === card.rank && c.suit === card.suit)));
      return;
    }

    // 未选中：先选中该牌
    const newSelected = [...selectedCards, card];
    setSelectedCards(newSelected);

    // 单击只选牌，需要点出牌按钮才出牌
  };

  const handlePlay = () => {
    if (selectedCards.length === 0) {
      setErrorMsg("请先选择要出的牌");
      return;
    }
    playCards(selectedCards);
  };

  const handlePass = () => {
    if (!lastPlay) {
      setErrorMsg("首出不能不要");
      return;
    }
    const result = executePass(gameState, PlayerPosition.Player0);
    if (!result.success) {
      setErrorMsg(result.error || "操作失败");
      return;
    }
    setStatusMsg("你选择不要");
    addPlayRecord(gameState, PlayerPosition.Player0, [], true);
    updateDanzeroHistory(danzeroHistoryRef.current, PlayerPosition.Player0, [], PlayerPosition.Player0);
    setSelectedCards([]);
    setPassAnimKey(prev => ({ ...prev, [PlayerPosition.Player0]: Date.now() }));
    setGameState(result.newState!);
  };

  const getPlayValidation = (): { valid: boolean; reason: string } => {
    if (selectedCards.length === 0) return { valid: false, reason: "请选择牌" };
    const type = identifyCardType(selectedCards, gameState.currentRank);
    if (!type) return { valid: false, reason: "无效牌型" };
    if (!lastPlay) return { valid: true, reason: getCardTypeLabel(type) };
    const play = {
      type,
      cards: selectedCards,
      value: calculatePlayValue(selectedCards, type, gameState.currentRank),
    };
    if (!canPlayCards(play, lastPlay, gameState.currentRank)) {
      return { valid: false, reason: "牌不够大" };
    }
    return { valid: true, reason: getCardTypeLabel(type) };
  };

  const validation = getPlayValidation();

  // ===== 智能推荐：当选了部分牌时，找出所有包含已选牌的合法组合 =====
  const recommendations: Card[][] = (() => {
    if (!isMyTurn || isAIThinking || selectedCards.length === 0) return [];
    if (validation.valid) return []; // 已经是合法牌型，无需推荐
    const results: Card[][] = [];
    const hand = myHand;
    const currentRank = gameState.currentRank;
    // 基于已选牌找包含它们的合法组合
    if (lastPlay) {
      const candidates = findPlayableCombinations(hand, lastPlay, currentRank);
      for (const combo of candidates) {
        const hasAllSelected = selectedCards.every(s =>
          combo.some(c => c.rank === s.rank && c.suit === s.suit)
        );
        if (hasAllSelected) results.push(combo);
      }
    } else {
      // 首出：找包含已选牌的合法牌型
      const groups = groupCardsByRank(hand);
      // 对子
      for (const [, cards] of Object.entries(groups)) {
        if (cards.length >= 2) {
          const pair = cards.slice(0, 2);
          if (selectedCards.every(s => pair.some(c => c.rank === s.rank && c.suit === s.suit))) {
            if (identifyCardType(pair, currentRank)) results.push(pair);
          }
        }
        // 三张
        if (cards.length >= 3) {
          const triple = cards.slice(0, 3);
          if (selectedCards.every(s => triple.some(c => c.rank === s.rank && c.suit === s.suit))) {
            if (identifyCardType(triple, currentRank)) results.push(triple);
          }
        }
        // 炸弹
        if (cards.length >= 4) {
          const bomb = cards.slice(0, 4);
          if (selectedCards.every(s => bomb.some(c => c.rank === s.rank && c.suit === s.suit))) {
            if (identifyCardType(bomb, currentRank)) results.push(bomb);
          }
        }
      }
    }
    // 去重并按牌数排序
    const seen = new Set<string>();
    return results
      .filter(combo => {
        const key = combo.map(c => `${c.rank}-${c.suit}`).sort().join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.length - b.length)
      .slice(0, 4); // 最多显示 4 个推荐
  })();

  // ===== 键盘快捷键：使用 ref 避免频繁重绑 =====
  // selectedCardsRef / isMyTurnRef / isAIThinkingRef / playCardsRef 已在组件顶部声明并同步

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMyTurnRef.current || isAIThinkingRef.current) return;
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      const state = gameStateRef.current;
      const cards = selectedCardsRef.current;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (cards.length > 0) {
          const type = identifyCardType(cards, state.currentRank);
          if (type) {
            const play = { type, cards, value: calculatePlayValue(cards, type, state.currentRank) };
            if (canPlayCards(play, state.currentRound.lastPlay, state.currentRank)) {
              playCards(cards);
            }
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedCards([]);
        setErrorMsg("");
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (state.currentRound.lastPlay) {
          const result = executePass(state, PlayerPosition.Player0);
          if (result.success) {
            setStatusMsg("你选择不要");
            addPlayRecord(state, PlayerPosition.Player0, [], true);
            setSelectedCards([]);
            setGameState(result.newState!);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // 只在挂载时绑定一次，所有状态通过 ref 访问
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playCards, addPlayRecord]);

  return (
    <div className="gt-root">
      {/* ===== 顶部导航栏 ===== */}
      <header className="gt-header">
        <button className="gt-header-btn" onClick={onBackToLobby}>
          <ArrowLeft size={15} />
          <span>大厅</span>
        </button>

        <div className="gt-header-center">
          {/* 级牌显示：本局打 X */}
          <div className="gt-rank-badge">
            <Crown size={13} />
            <span>打 <strong>{gameState.currentRank}</strong></span>
          </div>
          <div className="gt-badge">
            <RefreshCw size={12} />
            <span>第 {gameState.currentRound.roundNumber} 轮</span>
          </div>
          {/* 连局战绩 */}
          {(myTeamWins > 0 || opponentTeamWins > 0) && (
            <div className="gt-score-badge">
              <span className="gt-score-my">{myTeamWins}</span>
              <span className="gt-score-sep">:</span>
              <span className="gt-score-opp">{opponentTeamWins}</span>
            </div>
          )}
          <div className="gt-status-pill">
            {isAIThinking ? (
              <><Zap size={12} className="gt-pulse" />AI 思考中</>
            ) : (
              <>{statusMsg}</>
            )}
          </div>
        </div>

        <button
          className={`gt-header-btn gt-history-toggle ${showHistory ? "active" : ""}`}
          onClick={() => setShowHistory(v => !v)}
        >
          <History size={15} />
          <span>牌谱</span>
          {playHistory.length > 0 && (
            <span className="gt-badge-count">{playHistory.length}</span>
          )}
        </button>
      </header>

      {/* ===== 贡牌还牌覆盖层 ===== */}
      {tributePhase !== 'none' && tributeGameState && (() => {
        const tribute = tributeGameState.currentRound.tribute;
        const myPos = PlayerPosition.Player0;
        const pendingTributePlayer = getPendingTributePlayer(tributeGameState);
        const pendingReturnPlayer = getPendingReturnPlayer(tributeGameState);
        const isMyTributeTime = pendingTributePlayer === myPos;
        const isMyReturnTime = pendingReturnPlayer === myPos;
        const myHand = tributeGameState.players[myPos].hand;
        const myMaxCard = isMyTributeTime ? getMaxTributeCard(tributeGameState.players[myPos].hand, tributeGameState.currentRank) : null;
        // 找到我方对应的进贡信息
        const myTributeInfo = isMyReturnTime ? tributeGameState.currentRound.tribute.find(t => t.toPlayer === myPos) : null;
        const myTributePlayer = myTributeInfo?.fromPlayer ?? null;
        const myReturnCards = (isMyReturnTime && myTributePlayer !== null)
          ? getValidReturnCards(tributeGameState.players[myPos].hand, myPos, myTributePlayer, tributeGameState.currentRank)
          : [];
        const canResist = isMyTributeTime && canResistTribute(tributeGameState.players[myPos].hand);

        return (
          <div className="gt-tribute-overlay">
            <div className="gt-tribute-panel">
              <div className="gt-tribute-title">
                {tributePhase === 'tribute' ? '贡牌阶段' : '还牌阶段'}
              </div>
              <div className="gt-tribute-desc">
                {tributePhase === 'tribute' && pendingTributePlayer !== null && (
                  <>
                    {pendingTributePlayer === myPos
                      ? `当前为打 ${tributeGameState.currentRank} 局，你是下游，需要进贡最大的牌给上游`
                      : `等待 AI 玩家进贡中...`
                    }
                  </>
                )}
                {tributePhase === 'return' && pendingReturnPlayer !== null && (
                  <>
                    {pendingReturnPlayer === myPos
                      ? '你是上游，请选择一张牌还给下游'
                      : `等待 AI 玩家还牌中...`
                    }
                  </>
                )}
              </div>

              {/* 贡牌进度 */}
              <div className="gt-tribute-progress">
                {tribute.map((t, i) => (
                  <div key={i} className={`gt-tribute-item ${t.isCompleted ? 'done' : 'pending'}`}>
                    <span>玩家{t.fromPlayer} → 玩家{t.toPlayer}</span>
                    <span>{t.isCompleted ? '✅ 已完成' : '⏳ 等待'}</span>
                  </div>
                ))}
              </div>

              {/* 抗贡提示 */}
              {canResist && (
                <div className="gt-tribute-resist">
                  你有两张大王，可以抗贡！
                  <button
                    className="gt-tribute-btn resist"
                    onClick={() => {
                      // 抗贡：直接跳过贡牌阶段，传递贡牌状态（含抗贡标记）
                      setTributePhase('none');
                      setTributeGameState(null);
                      onGameEnd(tributeGameState);
                    }}
                  >
                    抗贡！
                  </button>
                </div>
              )}

              {/* 我的贡牌选择 */}
              {isMyTributeTime && !canResist && myMaxCard && (
                <div className="gt-tribute-action">
                  <div className="gt-tribute-action-title">你必须进贡此牌：</div>
                  <div
                    className={`gt-tribute-card ${tributeSelectedCard?.rank === myMaxCard.rank && tributeSelectedCard?.suit === myMaxCard.suit ? 'selected' : ''}`}
                    onClick={() => setTributeSelectedCard(myMaxCard)}
                  >
                    <span className={`gt-tc-rank ${myMaxCard.suit === 'hearts' || myMaxCard.suit === 'diamonds' ? 'red' : ''}`}>
                      {myMaxCard.rank === 'joker_big' ? '大王' : myMaxCard.rank === 'joker_small' ? '小王' : myMaxCard.rank}
                    </span>
                    <span className="gt-tc-suit">
                      {myMaxCard.suit === 'hearts' ? '♥' : myMaxCard.suit === 'diamonds' ? '♦' : myMaxCard.suit === 'clubs' ? '♣' : '♠'}
                    </span>
                  </div>
                  <button
                    className="gt-tribute-btn confirm"
                    disabled={!tributeSelectedCard}
                    onClick={() => {
                      if (!tributeSelectedCard) return;
                      const result = executeSingleTribute(tributeGameState, myPos, tributeSelectedCard);
                      if (result.success && result.newState) {
                        setTributeSelectedCard(null);
                        const allTribDone = result.newState.currentRound.tribute.every(t => t.tributeCard !== null);
                        if (allTribDone) {
                          setTributeGameState(result.newState);
                          setTributePhase('return');
                        } else {
                          setTributeGameState(result.newState);
                        }
                      }
                    }}
                  >
                    确认进贡
                  </button>
                </div>
              )}

              {/* 我的还牌选择 */}
              {isMyReturnTime && myReturnCards.length > 0 && (
                <div className="gt-tribute-action">
                  <div className="gt-tribute-action-title">选择还给对方的牌：</div>
                  <div className="gt-tribute-cards">
                    {myReturnCards.map((card, i) => (
                      <div
                        key={i}
                        className={`gt-tribute-card ${tributeSelectedCard?.rank === card.rank && tributeSelectedCard?.suit === card.suit ? 'selected' : ''}`}
                        onClick={() => setTributeSelectedCard(card)}
                      >
                        <span className={`gt-tc-rank ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : ''}`}>
                          {card.rank === 'joker_big' ? '大王' : card.rank === 'joker_small' ? '小王' : card.rank}
                        </span>
                        <span className="gt-tc-suit">
                          {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="gt-tribute-btn confirm"
                    disabled={!tributeSelectedCard}
                    onClick={() => {
                      if (!tributeSelectedCard || pendingReturnPlayer === null || myTributePlayer === null) return;
                      const result = executeSingleReturn(tributeGameState, myPos, tributeSelectedCard, myTributePlayer);
                      if (result.success && result.newState) {
                        setTributeSelectedCard(null);
                        const allDone = result.newState.currentRound.tribute.every(t => t.isCompleted);
                        if (allDone) {
                          setTributePhase('none');
                          setTributeGameState(null);
                          onGameEnd(result.newState); // 传递含贡还牌结果的最终状态
                        } else {
                          setTributeGameState(result.newState);
                        }
                      }
                    }}
                  >
                    确认还牌
                  </button>
                </div>
              )}

              {/* AI 自动处理非我方贡牌 - 显示思考中状态 */}
              {!isMyTributeTime && !isMyReturnTime && (tributePhase === 'tribute' || tributePhase === 'return') && (
                <div className="gt-tribute-ai-thinking">
                  <span className="gt-tribute-ai-dot" />
                  <span className="gt-tribute-ai-dot" />
                  <span className="gt-tribute-ai-dot" />
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>AI 正在处理...</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== 主体 ===== */}
      <div className="gt-body">
        {/* ===== 牌桌区域 ===== */}
        <div className={`gt-table ${showHistory ? "with-panel" : ""}`}>

          {/* ===== 北家 ===== */}
          <div className="gt-seat gt-seat-top">
            <PlayerSeat
              player={gameState.players[PlayerPosition.Player2]}
              isCurrentTurn={currentPlayer === PlayerPosition.Player2}
              isThinking={isAIThinking && currentPlayer === PlayerPosition.Player2}
              label="北家"
              teamColor="ally"
              passAnimKey={passAnimKey[PlayerPosition.Player2]}
              finishRank={gameState.finishOrder.includes(PlayerPosition.Player2) ? gameState.finishOrder.indexOf(PlayerPosition.Player2) + 1 : undefined}
            />
          </div>

          {/* ===== 中间行 ===== */}
          <div className="gt-middle">
            {/* 西家 */}
            <div className="gt-seat gt-seat-side">
              <PlayerSeat
                player={gameState.players[PlayerPosition.Player3]}
                isCurrentTurn={currentPlayer === PlayerPosition.Player3}
                isThinking={isAIThinking && currentPlayer === PlayerPosition.Player3}
                label="西家"
                teamColor="enemy"
                compact
                passAnimKey={passAnimKey[PlayerPosition.Player3]}
                finishRank={gameState.finishOrder.includes(PlayerPosition.Player3) ? gameState.finishOrder.indexOf(PlayerPosition.Player3) + 1 : undefined}
              />
            </div>

            {/* 中央出牌区 */}
            <div className="gt-center">
              {/* 队伍标识 */}
              <div className="gt-teams">
                <div className="gt-team ally">
                  <Users size={11} />
                  <span>你 &amp; 北家</span>
                </div>
                <div className="gt-team-vs">VS</div>
                <div className="gt-team enemy">
                  <Bot size={11} />
                  <span>东家 &amp; 西家</span>
                </div>
              </div>

              {/* 出牌展示区 */}
              <div className="gt-play-zone">
                {lastPlay ? (
                  <div className="gt-last-play" key={lastPlayKey}>
                    <div className="gt-last-play-header">
                      <span className="gt-last-play-who">{getPlayerLabel(gameState.currentRound.lastPlayer!)}</span>
                      <span className="gt-type-chip">{getCardTypeLabel(lastPlay.type)}</span>
                    </div>
                    <div className="gt-last-play-cards gt-play-anim">
                      {lastPlay.cards.slice(0, 12).map((card, i) => (
                        <MiniCard key={i} card={card} style={{ animationDelay: `${i * 40}ms` }} />
                      ))}
                      {lastPlay.cards.length > 12 && (
                        <div className="gt-more-chip">+{lastPlay.cards.length - 12}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="gt-play-empty">
                    <Crown size={26} className="gt-crown-icon" />
                    <span>等待首出</span>
                  </div>
                )}
              </div>

              {/* 回合指示器 */}
              <div className="gt-turn-track">
                {([
                  { pos: 0, label: "南" },
                  { pos: 1, label: "东" },
                  { pos: 2, label: "北" },
                  { pos: 3, label: "西" },
                ] as const).map(({ pos, label }) => (
                  <div
                    key={pos}
                    className={`gt-turn-pip ${currentPlayer === pos ? "active" : ""}`}
                    title={getPositionLabel(pos as PlayerPosition)}
                  >
                    <span className="gt-turn-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 东家 */}
            <div className="gt-seat gt-seat-side">
              <PlayerSeat
                player={gameState.players[PlayerPosition.Player1]}
                isCurrentTurn={currentPlayer === PlayerPosition.Player1}
                isThinking={isAIThinking && currentPlayer === PlayerPosition.Player1}
                passAnimKey={passAnimKey[PlayerPosition.Player1]}
                label="东家"
                teamColor="enemy"
                compact
                finishRank={gameState.finishOrder.includes(PlayerPosition.Player1) ? gameState.finishOrder.indexOf(PlayerPosition.Player1) + 1 : undefined}
              />
            </div>
          </div>

          {/* ===== 玩家区域（南家） ===== */}
          <div className="gt-player-zone" style={{ position: 'relative' }}>
            {/* 南家过牌动画 */}
            {passAnimKey[PlayerPosition.Player0] && (
              <div key={passAnimKey[PlayerPosition.Player0]} className="gt-pass-float gt-pass-float-south">不要</div>
            )}
            {/* 报牌提示 */}
            {(() => {
              const reportStatus = getCardReportStatus(myHand);
              if (reportStatus === 'must') return (
                <div className="gt-report-toast must">
                  <span>⚠️ 报牌！手牌剩 {myHand.length} 张，必须主动报牌</span>
                </div>
              );
              if (reportStatus === 'if_asked') return (
                <div className="gt-report-toast if-asked">
                  <span>手牌剩 {myHand.length} 张，有问必报</span>
                </div>
              );
              return null;
            })()}

            {/* 错误提示 */}
            {errorMsg && (
              <div className="gt-error-toast">
                <X size={13} />
                {errorMsg}
              </div>
            )}

            {/* 牌型提示 */}
            {selectedCards.length > 0 && (
              <div className={`gt-hint ${validation.valid ? "valid" : "invalid"}`}>
                {validation.valid ? <Flame size={12} /> : <X size={12} />}
                已选 {selectedCards.length} 张 · {validation.reason}
              </div>
            )}

            {/* 手牌 — 展开叠牌展示 */}
            <div className="gt-hand-wrap">
              <div className="gt-hand">
                {myHand.map((card, index) => {
                  const isSelected = selectedCards.some(
                    c => c.rank === card.rank && c.suit === card.suit
                  );
                  const isJoker = card.rank === "joker_small" || card.rank === "joker_big";
                  const isBig = card.rank === "joker_big";
                  const isRed = card.suit === "hearts" || card.suit === "diamonds";
                  const isHeartRankCard = isHeartRank(card, gameState.currentRank); // 红心参谋（逢人配）
                  // 同点数分组：当前牌与上一张点数不同时，加大间距
                  const prevCard = index > 0 ? myHand[index - 1] : null;
                  const isGroupStart = index > 0 && prevCard && prevCard.rank !== card.rank;
                  return (
                    <div
                      key={`${card.rank}-${card.suit}-${index}`}
                      className={`gt-card${isSelected ? " selected" : ""}${!isMyTurn || isAIThinking ? " disabled" : ""}${isJoker ? (isBig ? " joker-big" : " joker-small") : ""}${isRed ? " red" : ""}${isGroupStart ? " group-start" : ""}${isHeartRankCard ? " heart-rank" : ""}`}
                      onClick={() => handleCardClick(card)}
                    >
                      {/* 左上角 */}
                      <div className="gt-card-tl">
                        <span className="gt-rank">{getRankDisplay(card.rank)}</span>
                        {!isJoker && <span className="gt-suit-sm">{SUIT_SYMBOLS[card.suit]}</span>}
                      </div>
                      {/* 中央花色 */}
                      <div className="gt-card-mid">
                        {isJoker ? (
                          <span className="gt-joker-text">{isBig ? "大王" : "小王"}</span>
                        ) : (
                          <span className="gt-suit-lg">{SUIT_SYMBOLS[card.suit]}</span>
                        )}
                        {isHeartRankCard && <span className="gt-heart-rank-badge">配</span>}
                      </div>
                      {/* 右下角（倒置） */}
                      <div className="gt-card-br">
                        <span className="gt-rank">{getRankDisplay(card.rank)}</span>
                        {!isJoker && <span className="gt-suit-sm">{SUIT_SYMBOLS[card.suit]}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 智能推荐出牌条 */}
            {recommendations.length > 0 && (
              <div className="gt-recommendations">
                <span className="gt-rec-label"><Lightbulb size={12} /> 推荐</span>
                {recommendations.map((combo, i) => {
                  const type = identifyCardType(combo, gameState.currentRank);
                  return (
                    <button
                      key={i}
                      className="gt-rec-chip"
                      title="点击选牌，再点出牌按钮出牌"
                      onClick={() => setSelectedCards(combo)}
                    >
                      {type ? getCardTypeLabel(type) : ""}
                      <span className="gt-rec-cards">
                        {combo.map((c, ci) => (
                          <span key={ci} className={`gt-rec-card-val${c.suit === "hearts" || c.suit === "diamonds" ? " red" : ""}`}>
                            {getRankDisplay(c.rank)}
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 控制栏 */}
            <div className="gt-control-bar">
              {/* 玩家信息 */}
              <div className="gt-self-info">
                <div className="gt-self-avatar">
                  <User size={15} />
                </div>
                <div className="gt-self-detail">
                  <span className="gt-self-name">{playerName}</span>
                  <span className="gt-self-cards">{myHand.length} 张</span>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="gt-actions">
                {myHand.length === 0 ? (
                  <div className="gt-finished-badge">
                    {(() => {
                      const rank = gameState.finishOrder.indexOf(PlayerPosition.Player0);
                      const labels = ['上游！🏆', '二游', '三游'];
                      return rank >= 0 ? labels[rank] || `第${rank+1}名` : '已出完';
                    })()}
                  </div>
                ) : !isMyTurn ? (
                  <div className="gt-waiting-msg">
                    {isAIThinking ? (
                      <><Zap size={13} className="gt-pulse" /> AI 出牌中...</>
                    ) : (
                      <><Clock size={13} /> 等待中...</>
                    )}
                  </div>
                ) : (
                  <>
                    {lastPlay && (
                      <button
                        className="gt-btn-pass"
                        onClick={handlePass}
                        disabled={!isMyTurn || isAIThinking}
                        title="不要 (P)"
                      >
                        不要
                      </button>
                    )}
                    <button
                      className={`gt-btn-play${validation.valid ? " ready" : ""}`}
                      onClick={handlePlay}
                      disabled={!isMyTurn || isAIThinking || selectedCards.length === 0 || !validation.valid}
                      title={validation.valid ? "出牌 (Space/Enter)" : validation.reason}
                    >
                      {selectedCards.length > 0 ? `出牌（${selectedCards.length}张）` : "出牌"}
                    </button>
                  </>
                )}
              </div>
              {/* 牌谱快捷按鈕（移动端） */}
              <button
                className={`gt-history-fab ${showHistory ? "active" : ""}`}
                onClick={() => setShowHistory(v => !v)}
                title="牌谱"
              >
                <History size={15} />
                {playHistory.length > 0 && <span className="gt-fab-count">{playHistory.length}</span>}
              </button>
            </div>
          </div>
        </div>

        {/* ===== 牌谱侧边栏 ===== */}
        <aside className={`gt-history-panel ${showHistory ? "open" : ""}`}>
          {/* 头部 */}
          <div className="gt-history-header">
            <div className="gt-history-title">
              <History size={15} />
              <span>牌谱</span>
              <span className="gt-history-count">{playHistory.length}</span>
            </div>
            <div className="gt-history-view-toggle">
              <button
                className={`gt-view-btn${historyView === "detail" ? " active" : ""}`}
                onClick={() => setHistoryView("detail")}
              >明细</button>
              <button
                className={`gt-view-btn${historyView === "summary" ? " active" : ""}`}
                onClick={() => setHistoryView("summary")}
              >汇总</button>
            </div>
            <button className="gt-history-close" onClick={() => setShowHistory(false)}>
              <X size={15} />
            </button>
          </div>

          {/* 玩家筛选 Tab（仅明细模式显示） */}
          {historyView === "detail" && (
            <div className="gt-history-tabs">
              {([
                { key: "all", label: "全部" },
                { key: PlayerPosition.Player0, label: "我" },
                { key: PlayerPosition.Player2, label: "北" },
                { key: PlayerPosition.Player1, label: "东" },
                { key: PlayerPosition.Player3, label: "西" },
              ] as { key: number | "all"; label: string }[]).map(tab => (
                <button
                  key={String(tab.key)}
                  className={`gt-history-tab${historyFilter === tab.key ? " active" : ""}`}
                  onClick={() => setHistoryFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* 内容区 */}
          <div className="gt-history-body">
            {playHistory.length === 0 ? (
              <div className="gt-history-empty">
                <Clock size={22} />
                <span>暂无记录</span>
              </div>
            ) : historyView === "summary" ? (() => {
              // ===== 汇总视图 =====
              const plays = playHistory.filter(r => !r.isPassed);
              const passes = playHistory.filter(r => r.isPassed);

              // 各玩家统计
              const playerLabels = ["我（南）", "东家", "北家", "西家"];
              const playerColors = ["mine", "enemy", "ally", "enemy"];
              const playerStats = [0, 1, 2, 3].map(pos => {
                const myPlays = plays.filter(r => r.playerPos === pos);
                const myPasses = passes.filter(r => r.playerPos === pos);
                const bombs = myPlays.filter(r => r.cardType === "炸弹" || r.cardType === "王炸");
                return { pos, label: playerLabels[pos], color: playerColors[pos], plays: myPlays.length, passes: myPasses.length, bombs: bombs.length };
              });

              // 牌型分类汇总
              const typeOrder = ["单牌", "对子", "三张", "三带一", "三带二", "顺子", "连对", "飞机", "炸弹", "王炸"];
              const typeMap: Map<string, { count: number; best: PlayRecord }> = new Map();
              plays.forEach(r => {
                const t = r.cardType || "其他";
                if (!typeMap.has(t)) typeMap.set(t, { count: 0, best: r });
                const entry = typeMap.get(t)!;
                entry.count++;
                // 保留牌数最多的作为代表
                if (r.cards.length > entry.best.cards.length) entry.best = r;
              });
              const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => {
                const ai = typeOrder.indexOf(a[0]);
                const bi = typeOrder.indexOf(b[0]);
                if (ai === -1 && bi === -1) return b[1].count - a[1].count;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });

              return (
                <div className="gt-summary">
                  {/* 玩家统计卡片 */}
                  <div className="gt-summary-section-title">
                    <Users size={11} />
                    <span>玩家出牌统计</span>
                  </div>
                  <div className="gt-player-stats">
                    {playerStats.map(ps => (
                      <div key={ps.pos} className={`gt-player-stat-card ${ps.color}`}>
                        <div className="gt-pstat-name">
                          <span className={`gt-history-dot ${ps.color}`} />
                          {ps.label}
                        </div>
                        <div className="gt-pstat-nums">
                          <div className="gt-pstat-item">
                            <span className="gt-pstat-val">{ps.plays}</span>
                            <span className="gt-pstat-lbl">出牌</span>
                          </div>
                          <div className="gt-pstat-item">
                            <span className="gt-pstat-val">{ps.passes}</span>
                            <span className="gt-pstat-lbl">不要</span>
                          </div>
                          <div className={`gt-pstat-item${ps.bombs > 0 ? " bomb" : ""}`}>
                            <span className="gt-pstat-val">{ps.bombs}</span>
                            <span className="gt-pstat-lbl">炸弹</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 牌型分类汇总 */}
                  <div className="gt-summary-section-title" style={{ marginTop: 14 }}>
                    <Filter size={11} />
                    <span>牌型分类汇总</span>
                  </div>
                  <div className="gt-type-summary">
                    {sortedTypes.map(([type, { count, best }]) => {
                      const isBomb = type === "炸弹" || type === "王炸";
                      return (
                        <div key={type} className={`gt-type-row${isBomb ? " bomb" : ""}`}>
                          <div className="gt-type-row-left">
                            <span className={`gt-type-name-badge${isBomb ? " bomb" : ""}`}>
                              {isBomb && <Flame size={9} />}{type}
                            </span>
                            <span className="gt-type-count">×{count}</span>
                          </div>
                          <div className="gt-type-row-cards">
                            {best.cards.slice(0, 6).map((c, ci) => {
                              const isRed = c.suit === "hearts" || c.suit === "diamonds";
                              const isJoker = c.rank === "joker_small" || c.rank === "joker_big";
                              return (
                                <span
                                  key={ci}
                                  className={`gt-history-card${isRed || (isJoker && c.rank === "joker_big") ? " red" : ""}${isJoker ? " joker" : ""}`}
                                >
                                  {getRankDisplay(c.rank)}
                                  {!isJoker ? <sub className="gt-card-suit-sub">{SUIT_SYMBOLS[c.suit] || ""}</sub> : null}
                                </span>
                              );
                            })}
                            {best.cards.length > 6 && (
                              <span className="gt-type-more">+{best.cards.length - 6}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (() => {
              // 按玩家筛选
              const filtered = historyFilter === "all"
                ? playHistory
                : playHistory.filter(r => r.playerPos === historyFilter);

              if (filtered.length === 0) {
                return (
                  <div className="gt-history-empty">
                    <Filter size={18} />
                    <span>该玩家暂无出牌</span>
                  </div>
                );
              }

              // 按回合分组
              const groups: Map<number, PlayRecord[]> = new Map();
              filtered.forEach(r => {
                if (!groups.has(r.round)) groups.set(r.round, []);
                groups.get(r.round)!.push(r);
              });
              const roundNums = Array.from(groups.keys()).sort((a, b) => b - a); // 最新回合在前

              return (
                <div className="gt-history-list">
                  {roundNums.map(roundNum => {
                    const records = groups.get(roundNum)!;
                    const isCollapsed = collapsedRounds.has(roundNum);
                    const hasBomb = records.some(r => r.cardType === "炸弹" || r.cardType === "王炸");
                    return (
                      <div key={roundNum} className="gt-round-group">
                        {/* 回合标题行 */}
                        <button
                          className={`gt-round-header${hasBomb ? " has-bomb" : ""}`}
                          onClick={() => setCollapsedRounds(prev => {
                            const next = new Set(prev);
                            if (next.has(roundNum)) next.delete(roundNum);
                            else next.add(roundNum);
                            return next;
                          })}
                        >
                          <span className="gt-round-label">
                            {hasBomb && <Flame size={11} className="gt-round-bomb" />}
                            第 {roundNum} 轮
                          </span>
                          <span className="gt-round-meta">{records.length} 手</span>
                          <ChevronDown
                            size={13}
                            className={`gt-round-chevron${isCollapsed ? " collapsed" : ""}`}
                          />
                        </button>

                        {/* 回合内记录 */}
                        {!isCollapsed && (
                          <div className="gt-round-records">
                            {records.map((record, i) => {
                              const isMine = record.playerPos === PlayerPosition.Player0;
                              const isAlly = record.playerPos === PlayerPosition.Player2;
                              const isBomb = record.cardType === "炸弹" || record.cardType === "王炸";
                              return (
                                <div
                                  key={i}
                                  className={`gt-history-item${
                                    record.isPassed ? " passed" : ""
                                  }${isMine ? " mine" : ""}${isBomb ? " bomb" : ""}`}
                                >
                                  {/* 玩家标识 + 牌型标签 */}
                                  <div className="gt-history-meta">
                                    <span className={`gt-history-dot ${
                                      isMine ? "mine" : isAlly ? "ally" : "enemy"
                                    }`} />
                                    <span className="gt-history-who">{record.player}</span>
                                    {record.isPassed ? (
                                      <span className="gt-type-badge pass">不要</span>
                                    ) : isBomb ? (
                                      <span className="gt-type-badge bomb">
                                        <Flame size={9} />{record.cardType}
                                      </span>
                                    ) : record.cardType ? (
                                      <span className="gt-type-badge">{record.cardType}</span>
                                    ) : null}
                                  </div>
                                  {/* 迷你牌面 */}
                                  {!record.isPassed && record.cards.length > 0 && (
                                    <div className="gt-history-cards">
                                      {record.cards.map((c, ci) => {
                                        const isRed = c.suit === "hearts" || c.suit === "diamonds";
                                        const isJoker = c.rank === "joker_small" || c.rank === "joker_big";
                                        return (
                                          <span
                                            key={ci}
                                            className={`gt-history-card${
                                              isRed || (isJoker && c.rank === "joker_big") ? " red" : ""
                                            }${isJoker ? " joker" : ""}`}
                                          >
                                            {getRankDisplay(c.rank)}
                                            {!isJoker ? (
                                              <sub className="gt-card-suit-sub">{SUIT_SYMBOLS[c.suit] || ""}</sub>
                                            ) : null}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={historyEndRef} />
                </div>
              );
            })()}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ===== 子组件 =====

function PlayerSeat({
  player,
  isCurrentTurn,
  isThinking,
  label,
  teamColor,
  compact = false,
  passAnimKey,
  finishRank,
}: {
  player: { name: string; cardsRemaining: number; position: PlayerPosition };
  isCurrentTurn: boolean;
  isThinking: boolean;
  label: string;
  teamColor: "ally" | "enemy";
  compact?: boolean;
  passAnimKey?: number;
  finishRank?: number; // 1=上游, 2=二游, 3=三游
}) {
  const rankLabels = ['上游', '二游', '三游'];
  const rankColors = ['#f59e0b', '#9ca3af', '#cd7c2f'];
  return (
    <div className={`gt-player-seat${isCurrentTurn ? " active" : ""}${compact ? " compact" : ""}${player.cardsRemaining === 0 ? " finished" : ""} ${teamColor}`} style={{ position: 'relative' }}>
      {passAnimKey && (
        <div key={passAnimKey} className="gt-pass-float">不要</div>
      )}
      {finishRank !== undefined && (
        <div className="gt-finish-badge" style={{ backgroundColor: rankColors[finishRank - 1] || '#6b7280' }}>
          {rankLabels[finishRank - 1] || `第${finishRank}名`}
        </div>
      )}
      <div className="gt-player-avatar">
        {isThinking ? (
          <Zap size={16} className="gt-pulse" />
        ) : (
          <Bot size={16} />
        )}
        {isCurrentTurn && <div className="gt-active-ring" />}
      </div>
      <div className="gt-player-info">
        <div className="gt-player-label">{label}</div>
        <div className="gt-player-name">{player.name}</div>
        <div className="gt-player-cards-left">
          {player.cardsRemaining === 0 ? (
            <span className="gt-cards-done">已出完</span>
          ) : (
            <><span className="gt-cards-num">{player.cardsRemaining}</span><span className="gt-cards-label">张</span></>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ card, style }: { card: Card; style?: React.CSSProperties }) {
  const isJoker = card.rank === "joker_small" || card.rank === "joker_big";
  const isBig = card.rank === "joker_big";
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const suit = SUIT_SYMBOLS[card.suit] || "";
  const rank = getRankDisplay(card.rank);

  return (
    <div
      className={`gt-mini-card${isJoker ? (isBig ? " joker-big" : " joker-small") : ""}${isRed ? " red" : ""} gt-mini-card-anim`}
      style={style}
    >
      <span className="gt-mini-rank">{rank}</span>
      {!isJoker && <span className="gt-mini-suit">{suit}</span>}
    </div>
  );
}
