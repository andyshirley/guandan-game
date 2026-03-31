import React, { useState, useEffect } from "react";
import { Card, CardType, GameStateData, Player, PlayerPosition, Rank } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Card as CardComponent } from "@/components/ui/card";
import PlayerHand from "@/components/game/PlayerHand";
import PlayArea from "@/components/game/PlayArea";
import PlayerInfo from "@/components/game/PlayerInfo";
import GameControls from "@/components/game/GameControls";
import "./GameTable.css";

interface GameTableProps {
  gameState: GameStateData;
  onPlayCards: (cards: Card[]) => void;
  onPass: () => void;
  playerPosition: PlayerPosition;
}

/**
 * 游戏牌桌主组件
 * 显示牌桌布局、玩家信息、手牌和出牌区域
 */
export default function GameTable({
  gameState,
  onPlayCards,
  onPass,
  playerPosition,
}: GameTableProps) {
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const currentPlayer = gameState.players[playerPosition];
  const isMyTurn = gameState.currentRound.currentPlayer === playerPosition;

  // 获取其他三个玩家的信息
  const getOtherPlayers = (): Player[] => {
    const positions = [0, 1, 2, 3] as const;
    return positions
      .filter((pos) => pos !== playerPosition)
      .map((pos) => gameState.players[pos]);
  };

  const handleCardClick = (card: Card) => {
    const isSelected = selectedCards.some(
      (c) => c.rank === card.rank && c.suit === card.suit
    );

    if (isSelected) {
      setSelectedCards(
        selectedCards.filter((c) => !(c.rank === card.rank && c.suit === card.suit))
      );
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handlePlayCards = () => {
    if (selectedCards.length > 0) {
      onPlayCards(selectedCards);
      setSelectedCards([]);
    }
  };

  const handlePass = () => {
    onPass();
    setSelectedCards([]);
  };

  return (
    <div className="game-table-container">
      {/* 顶部：对手信息 */}
      <div className="game-table-top">
        <div className="opponent-info">
          <PlayerInfo
            player={getOtherPlayers()[0]}
            position="top"
            isCurrentTurn={
              gameState.currentRound.currentPlayer === getOtherPlayers()[0].position
            }
          />
        </div>
      </div>

      {/* 中间：出牌区域和对手 */}
      <div className="game-table-middle">
        <div className="opponent-left">
          <PlayerInfo
            player={getOtherPlayers()[1]}
            position="left"
            isCurrentTurn={
              gameState.currentRound.currentPlayer === getOtherPlayers()[1].position
            }
          />
        </div>

        {/* 中央出牌区域 */}
        <div className="play-area-container">
          <div className="rank-indicator">
            <span className="label">升级级别:</span>
            <span className="value">{gameState.currentRank}</span>
          </div>

          <PlayArea
            lastPlay={gameState.currentRound.lastPlay}
            lastPlayer={gameState.currentRound.lastPlayer}
            currentPlayer={gameState.currentRound.currentPlayer}
          />

          <div className="round-info">
            <span>第 {gameState.currentRound.roundNumber} 轮</span>
          </div>
        </div>

        <div className="opponent-right">
          <PlayerInfo
            player={getOtherPlayers()[2]}
            position="right"
            isCurrentTurn={
              gameState.currentRound.currentPlayer === getOtherPlayers()[2].position
            }
          />
        </div>
      </div>

      {/* 底部：玩家手牌和控制 */}
      <div className="game-table-bottom">
        <div className="player-section">
          <div className="player-hand-container">
            <PlayerHand
              cards={currentPlayer.hand}
              selectedCards={selectedCards}
              onCardClick={handleCardClick}
              disabled={!isMyTurn}
            />
          </div>

          <GameControls
            isMyTurn={isMyTurn}
            selectedCardsCount={selectedCards.length}
            onPlay={handlePlayCards}
            onPass={handlePass}
            lastPlay={gameState.currentRound.lastPlay}
            canPass={gameState.currentRound.lastPlay !== null}
          />
        </div>
      </div>

      {/* 游戏状态指示器 */}
      <div className="game-status">
        {gameState.status === "finished" && (
          <div className="status-message">
            <h2>游戏结束</h2>
            <p>
              {gameState.winningTeam === 0
                ? "队伍 1 获胜！"
                : "队伍 2 获胜！"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
