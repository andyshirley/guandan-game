import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardType, GameStateData, PlayerPosition, Rank, GameStatus } from "@shared/types";
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
import "./GameTable.css";

interface GameTableProps {
  gameState: GameStateData;
  playerName: string;
  onGameEnd: (finalState: GameStateData) => void;
  onBackToLobby: () => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "#e74c3c",
  diamonds: "#e74c3c",
  clubs: "#1a1a2e",
  spades: "#1a1a2e",
};

function getRankDisplay(rank: string): string {
  if (rank === "joker_small") return "小王";
  if (rank === "joker_big") return "大王";
  return rank;
}

function getPlayerLabel(pos: PlayerPosition): string {
  const labels = ["你", "AI 东", "AI 北", "AI 西"];
  return labels[pos];
}

function getPositionLabel(pos: PlayerPosition): string {
  const labels = ["南（你）", "东", "北", "西"];
  return labels[pos];
}

/**
 * 游戏牌桌主组件 - 完整的前端游戏引擎驱动
 */
export default function GameTable({
  gameState: initialGameState,
  playerName,
  onGameEnd,
  onBackToLobby,
}: GameTableProps) {
  const [gameState, setGameState] = useState<GameStateData>(initialGameState);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [message, setMessage] = useState<string>("游戏开始！轮到你出牌");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [lastPlayedCards, setLastPlayedCards] = useState<Card[]>([]);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPlayer = gameState.currentRound.currentPlayer;
  const isMyTurn = currentPlayer === PlayerPosition.Player0;
  const myHand = sortCards(gameState.players[PlayerPosition.Player0].hand, gameState.currentRank);
  const lastPlay = gameState.currentRound.lastPlay;

  // 清除错误消息
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(""), 2500);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // 游戏结束检测
  useEffect(() => {
    if (gameState.status === GameStatus.Finished) {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      onGameEnd(gameState);
    }
  }, [gameState.status]);

  // AI 自动出牌
  const runAITurn = useCallback((state: GameStateData) => {
    const pos = state.currentRound.currentPlayer;
    if (pos === PlayerPosition.Player0) return;
    if (state.status === GameStatus.Finished) return;

    setIsAIThinking(true);
    const delay = 800 + Math.random() * 600;

    aiTimerRef.current = setTimeout(() => {
      const aiCards = getAIMove(state, pos);

      let newState: GameStateData;
      if (aiCards && aiCards.length > 0) {
        const result = executePlay(state, pos, aiCards);
        if (result.success && result.newState) {
          newState = result.newState;
          const typeLabel = identifyCardType(aiCards, state.currentRank);
          setMessage(`${getPlayerLabel(pos)} 出了 ${typeLabel ? getCardTypeLabel(typeLabel) : ""} (${aiCards.length}张)`);
          setLastPlayedCards(aiCards);
        } else {
          // 出牌失败，改为不要
          const passResult = executePass(state, pos);
          newState = passResult.newState!;
          setMessage(`${getPlayerLabel(pos)} 不要`);
          setLastPlayedCards([]);
        }
      } else {
        const passResult = executePass(state, pos);
        if (passResult.success && passResult.newState) {
          newState = passResult.newState;
          setMessage(`${getPlayerLabel(pos)} 不要`);
          setLastPlayedCards([]);
        } else {
          setIsAIThinking(false);
          return;
        }
      }

      setIsAIThinking(false);
      setGameState(newState);

      // 如果下一个还是 AI，继续
      if (newState.status !== GameStatus.Finished && newState.currentRound.currentPlayer !== PlayerPosition.Player0) {
        runAITurn(newState);
      } else if (newState.currentRound.currentPlayer === PlayerPosition.Player0) {
        if (newState.currentRound.lastPlay) {
          setMessage("轮到你了，请出牌或选择不要");
        } else {
          setMessage("轮到你了，请首出");
        }
      }
    }, delay);
  }, []);

  // 监听回合变化，触发 AI
  useEffect(() => {
    if (gameState.status === GameStatus.Finished) return;
    if (currentPlayer !== PlayerPosition.Player0) {
      runAITurn(gameState);
    }
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [currentPlayer, gameState.status]);

  // 选牌
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

  // 出牌
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
    setMessage(`你出了 ${typeLabel ? getCardTypeLabel(typeLabel) : ""} (${selectedCards.length}张)`);
    setLastPlayedCards(selectedCards);
    setSelectedCards([]);
    setGameState(result.newState!);
  };

  // 不要
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
    setMessage("你选择不要");
    setLastPlayedCards([]);
    setSelectedCards([]);
    setGameState(result.newState!);
  };

  // 检查选中的牌是否合法
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
    <div className="gt-container">
      {/* ===== 顶部信息栏 ===== */}
      <div className="gt-topbar">
        <button className="gt-back-btn" onClick={onBackToLobby}>← 返回大厅</button>
        <div className="gt-game-info">
          <span className="gt-rank-badge">升级: <strong>{gameState.currentRank}</strong></span>
          <span className="gt-round-badge">第 {gameState.currentRound.roundNumber} 轮</span>
        </div>
        <div className="gt-status-msg">{message}</div>
      </div>

      {/* ===== 牌桌主体 ===== */}
      <div className="gt-table">

        {/* 北方（AI 北，position 2） */}
        <div className="gt-player gt-player-top">
          <AIPlayerDisplay
            player={gameState.players[PlayerPosition.Player2]}
            isCurrentTurn={currentPlayer === PlayerPosition.Player2}
            isThinking={isAIThinking && currentPlayer === PlayerPosition.Player2}
          />
        </div>

        {/* 中间行：西 + 出牌区 + 东 */}
        <div className="gt-middle-row">
          {/* 西方（AI 西，position 3） */}
          <div className="gt-player gt-player-left">
            <AIPlayerDisplay
              player={gameState.players[PlayerPosition.Player3]}
              isCurrentTurn={currentPlayer === PlayerPosition.Player3}
              isThinking={isAIThinking && currentPlayer === PlayerPosition.Player3}
            />
          </div>

          {/* 中央出牌区 */}
          <div className="gt-center">
            <div className="gt-play-area">
              {lastPlay ? (
                <div className="gt-last-play">
                  <div className="gt-last-play-label">
                    {getPlayerLabel(gameState.currentRound.lastPlayer!)} 出牌
                    <span className="gt-type-badge">{getCardTypeLabel(lastPlay.type)}</span>
                  </div>
                  <div className="gt-last-play-cards">
                    {lastPlay.cards.slice(0, 8).map((card, i) => (
                      <MiniCard key={i} card={card} />
                    ))}
                    {lastPlay.cards.length > 8 && (
                      <span className="gt-more-cards">+{lastPlay.cards.length - 8}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="gt-empty-play">
                  <div className="gt-empty-icon">🃏</div>
                  <div className="gt-empty-text">等待出牌</div>
                </div>
              )}
            </div>

            {/* 当前轮次指示 */}
            <div className="gt-turn-indicators">
              {[0, 1, 2, 3].map((pos) => (
                <div
                  key={pos}
                  className={`gt-turn-dot ${currentPlayer === pos ? "active" : ""}`}
                  title={getPositionLabel(pos as PlayerPosition)}
                />
              ))}
            </div>
          </div>

          {/* 东方（AI 东，position 1） */}
          <div className="gt-player gt-player-right">
            <AIPlayerDisplay
              player={gameState.players[PlayerPosition.Player1]}
              isCurrentTurn={currentPlayer === PlayerPosition.Player1}
              isThinking={isAIThinking && currentPlayer === PlayerPosition.Player1}
            />
          </div>
        </div>

        {/* ===== 玩家区域（南方） ===== */}
        <div className="gt-player-area">
          {/* 错误提示 */}
          {errorMsg && (
            <div className="gt-error-toast">{errorMsg}</div>
          )}

          {/* 选牌提示 */}
          {selectedCards.length > 0 && (
            <div className={`gt-validation-hint ${validation.valid ? "valid" : "invalid"}`}>
              已选 {selectedCards.length} 张 · {validation.reason}
            </div>
          )}

          {/* 手牌区 */}
          <div className="gt-hand-area">
            <div className="gt-hand-cards">
              {myHand.map((card, index) => {
                const isSelected = selectedCards.some(
                  c => c.rank === card.rank && c.suit === card.suit
                );
                return (
                  <div
                    key={`${card.rank}-${card.suit}-${index}`}
                    className={`gt-card ${isSelected ? "selected" : ""} ${!isMyTurn || isAIThinking ? "disabled" : ""}`}
                    onClick={() => handleCardClick(card)}
                  >
                    <div className="gt-card-top">
                      <span style={{ color: SUIT_COLORS[card.suit] || "#000" }}>
                        {getRankDisplay(card.rank)}
                      </span>
                    </div>
                    <div className="gt-card-suit" style={{ color: SUIT_COLORS[card.suit] || "#000" }}>
                      {SUIT_SYMBOLS[card.suit] || ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="gt-controls">
            <div className="gt-player-label">
              <span className="gt-my-name">{playerName}</span>
              <span className="gt-card-count">{myHand.length} 张</span>
            </div>

            <div className="gt-action-buttons">
              <button
                className="gt-btn gt-btn-pass"
                onClick={handlePass}
                disabled={!isMyTurn || isAIThinking || !lastPlay}
              >
                不要
              </button>
              <button
                className={`gt-btn gt-btn-play ${validation.valid && isMyTurn ? "ready" : ""}`}
                onClick={handlePlay}
                disabled={!isMyTurn || isAIThinking || selectedCards.length === 0 || !validation.valid}
              >
                {selectedCards.length > 0
                  ? `出牌 (${selectedCards.length}张)`
                  : "出牌"}
              </button>
            </div>

            {!isMyTurn && (
              <div className="gt-waiting">
                {isAIThinking ? "AI 思考中..." : "等待其他玩家..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 子组件 =====

function AIPlayerDisplay({
  player,
  isCurrentTurn,
  isThinking,
}: {
  player: { name: string; cardsRemaining: number; position: PlayerPosition };
  isCurrentTurn: boolean;
  isThinking: boolean;
}) {
  return (
    <div className={`gt-ai-player ${isCurrentTurn ? "active" : ""}`}>
      <div className="gt-ai-avatar">
        {isThinking ? (
          <span className="gt-thinking-dots">...</span>
        ) : (
          <span>🤖</span>
        )}
      </div>
      <div className="gt-ai-info">
        <div className="gt-ai-name">{player.name}</div>
        <div className="gt-ai-cards">{player.cardsRemaining} 张</div>
      </div>
      {isCurrentTurn && <div className="gt-turn-arrow">▼</div>}
    </div>
  );
}

function MiniCard({ card }: { card: Card }) {
  const color = SUIT_COLORS[card.suit] || "#000";
  const suit = SUIT_SYMBOLS[card.suit] || "";
  const rank = getRankDisplay(card.rank);
  return (
    <div className="gt-mini-card" style={{ color }}>
      <span className="gt-mini-rank">{rank}</span>
      <span className="gt-mini-suit">{suit}</span>
    </div>
  );
}
