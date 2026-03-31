import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardType, GameStateData, PlayerPosition, Rank, GameStatus, Team } from "@shared/types";
import {
  executePlay,
  executePass,
  getAIMove,
  identifyCardType,
  canPlayCards,
  calculatePlayValue,
  getCardTypeLabel,
  sortCards,
} from "@/lib/gameEngine";
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  History,
  RefreshCw,
  Spade,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./GameTable.css";

interface GameTableProps {
  gameState: GameStateData;
  playerName: string;
  onGameEnd: (finalState: GameStateData) => void;
  onBackToLobby: () => void;
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
}: GameTableProps) {
  const [gameState, setGameState] = useState<GameStateData>(initialGameState);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("游戏开始！轮到你出牌");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [playHistory, setPlayHistory] = useState<PlayRecord[]>([]);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPlayer = gameState.currentRound.currentPlayer;
  const isMyTurn = currentPlayer === PlayerPosition.Player0;
  const myHand = sortCards(gameState.players[PlayerPosition.Player0].hand, gameState.currentRank);
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

  const runAITurn = useCallback((state: GameStateData) => {
    const pos = state.currentRound.currentPlayer;
    if (pos === PlayerPosition.Player0) return;
    if (state.status === GameStatus.Finished) return;

    setIsAIThinking(true);
    const delay = 600 + Math.random() * 500;

    aiTimerRef.current = setTimeout(() => {
      const aiCards = getAIMove(state, pos);

      let newState: GameStateData;
      if (aiCards && aiCards.length > 0) {
        const result = executePlay(state, pos, aiCards);
        if (result.success && result.newState) {
          newState = result.newState;
          const typeLabel = identifyCardType(aiCards, state.currentRank);
          setStatusMsg(`${getPlayerLabel(pos)} 出了 ${typeLabel ? getCardTypeLabel(typeLabel) : ""}（${aiCards.length}张）`);
          addPlayRecord(state, pos, aiCards, false);
        } else {
          const passResult = executePass(state, pos);
          newState = passResult.newState!;
          setStatusMsg(`${getPlayerLabel(pos)} 不要`);
          addPlayRecord(state, pos, [], true);
        }
      } else {
        const passResult = executePass(state, pos);
        if (passResult.success && passResult.newState) {
          newState = passResult.newState;
          setStatusMsg(`${getPlayerLabel(pos)} 不要`);
          addPlayRecord(state, pos, [], true);
        } else {
          setIsAIThinking(false);
          return;
        }
      }

      setIsAIThinking(false);
      setGameState(newState);

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
    const isSelected = selectedCards.some(
      (c) => c.rank === card.rank && c.suit === card.suit
    );
    if (isSelected) {
      setSelectedCards(prev => prev.filter(c => !(c.rank === card.rank && c.suit === card.suit)));
    } else {
      setSelectedCards(prev => [...prev, card]);
    }
    setErrorMsg("");
  };

  const handlePlay = () => {
    if (selectedCards.length === 0) {
      setErrorMsg("请先选择要出的牌");
      return;
    }
    const result = executePlay(gameState, PlayerPosition.Player0, selectedCards);
    if (!result.success) {
      setErrorMsg(result.error || "出牌失败");
      return;
    }
    const typeLabel = identifyCardType(selectedCards, gameState.currentRank);
    setStatusMsg(`你出了 ${typeLabel ? getCardTypeLabel(typeLabel) : ""}（${selectedCards.length}张）`);
    addPlayRecord(gameState, PlayerPosition.Player0, selectedCards, false);
    setSelectedCards([]);
    setGameState(result.newState!);
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
    setSelectedCards([]);
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

  return (
    <div className="gt-root">
      {/* ===== 顶部导航栏 ===== */}
      <header className="gt-header">
        <button className="gt-header-btn" onClick={onBackToLobby}>
          <ArrowLeft size={15} />
          <span>大厅</span>
        </button>

        <div className="gt-header-center">
          <div className="gt-badge">
            <TrendingUp size={12} />
            <span>升 <strong>{gameState.currentRank}</strong></span>
          </div>
          <div className="gt-badge">
            <RefreshCw size={12} />
            <span>第 {gameState.currentRound.roundNumber} 轮</span>
          </div>
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
                  <div className="gt-last-play">
                    <div className="gt-last-play-header">
                      <span className="gt-last-play-who">{getPlayerLabel(gameState.currentRound.lastPlayer!)}</span>
                      <span className="gt-type-chip">{getCardTypeLabel(lastPlay.type)}</span>
                    </div>
                    <div className="gt-last-play-cards">
                      {lastPlay.cards.slice(0, 12).map((card, i) => (
                        <MiniCard key={i} card={card} />
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
                label="东家"
                teamColor="enemy"
                compact
              />
            </div>
          </div>

          {/* ===== 玩家区域（南家） ===== */}
          <div className="gt-player-zone">
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

            {/* 手牌 — 扇形叠牌展示 */}
            <div className="gt-hand-wrap">
              <div className="gt-hand">
                {myHand.map((card, index) => {
                  const isSelected = selectedCards.some(
                    c => c.rank === card.rank && c.suit === card.suit
                  );
                  const isJoker = card.rank === "joker_small" || card.rank === "joker_big";
                  const isBig = card.rank === "joker_big";
                  const isRed = card.suit === "hearts" || card.suit === "diamonds";
                  return (
                    <div
                      key={`${card.rank}-${card.suit}-${index}`}
                      className={`gt-card${isSelected ? " selected" : ""}${!isMyTurn || isAIThinking ? " disabled" : ""}${isJoker ? (isBig ? " joker-big" : " joker-small") : ""}${isRed ? " red" : ""}`}
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

              {/* 操作按钮 */}
              <div className="gt-actions">
                {!isMyTurn ? (
                  <div className="gt-waiting-msg">
                    {isAIThinking ? (
                      <><Zap size={13} className="gt-pulse" /> AI 出牌中...</>
                    ) : (
                      <><Clock size={13} /> 等待中...</>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      className="gt-btn-pass"
                      onClick={handlePass}
                      disabled={!isMyTurn || isAIThinking || !lastPlay}
                    >
                      不要
                    </button>
                    <button
                      className={`gt-btn-play${validation.valid ? " ready" : ""}`}
                      onClick={handlePlay}
                      disabled={!isMyTurn || isAIThinking || selectedCards.length === 0 || !validation.valid}
                    >
                      {selectedCards.length > 0 ? `出牌（${selectedCards.length}张）` : "出牌"}
                    </button>
                  </>
                )}
              </div>

              {/* 牌谱快捷按钮（移动端） */}
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
          <div className="gt-history-header">
            <div className="gt-history-title">
              <History size={15} />
              <span>牌谱</span>
              <span className="gt-history-count">{playHistory.length}</span>
            </div>
            <button className="gt-history-close" onClick={() => setShowHistory(false)}>
              <X size={15} />
            </button>
          </div>

          <div className="gt-history-body">
            {playHistory.length === 0 ? (
              <div className="gt-history-empty">
                <Clock size={22} />
                <span>暂无记录</span>
              </div>
            ) : (
              <div className="gt-history-list">
                {playHistory.map((record, i) => (
                  <div
                    key={i}
                    className={`gt-history-item${record.isPassed ? " passed" : ""}${record.playerPos === PlayerPosition.Player0 ? " mine" : ""}`}
                  >
                    <div className="gt-history-meta">
                      <span className={`gt-history-dot ${record.playerPos === PlayerPosition.Player0 ? "mine" : record.playerPos === PlayerPosition.Player2 ? "ally" : "enemy"}`} />
                      <span className="gt-history-who">{record.player}</span>
                      <span className="gt-history-type">{record.cardType}</span>
                      <span className="gt-history-round">R{record.round}</span>
                    </div>
                    {!record.isPassed && record.cards.length > 0 && (
                      <div className="gt-history-cards">
                        {record.cards.map((c, ci) => {
                          const isRed = c.suit === "hearts" || c.suit === "diamonds";
                          const isJoker = c.rank === "joker_small" || c.rank === "joker_big";
                          return (
                            <span
                              key={ci}
                              className={`gt-history-card${isRed || (isJoker && c.rank === "joker_big") ? " red" : ""}`}
                            >
                              {getRankDisplay(c.rank)}{!isJoker ? SUIT_SYMBOLS[c.suit] || "" : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={historyEndRef} />
              </div>
            )}
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
}: {
  player: { name: string; cardsRemaining: number; position: PlayerPosition };
  isCurrentTurn: boolean;
  isThinking: boolean;
  label: string;
  teamColor: "ally" | "enemy";
  compact?: boolean;
}) {
  return (
    <div className={`gt-player-seat${isCurrentTurn ? " active" : ""}${compact ? " compact" : ""} ${teamColor}`}>
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
          <span className="gt-cards-num">{player.cardsRemaining}</span>
          <span className="gt-cards-label">张</span>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ card }: { card: Card }) {
  const isJoker = card.rank === "joker_small" || card.rank === "joker_big";
  const isBig = card.rank === "joker_big";
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const suit = SUIT_SYMBOLS[card.suit] || "";
  const rank = getRankDisplay(card.rank);

  return (
    <div className={`gt-mini-card${isJoker ? (isBig ? " joker-big" : " joker-small") : ""}${isRed ? " red" : ""}`}>
      <span className="gt-mini-rank">{rank}</span>
      {!isJoker && <span className="gt-mini-suit">{suit}</span>}
    </div>
  );
}
