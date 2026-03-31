import React from "react";
import { Player } from "@shared/types";
import "./PlayerInfo.css";

interface PlayerInfoProps {
  player: Player;
  position: "top" | "left" | "right";
  isCurrentTurn: boolean;
}

/**
 * 玩家信息组件
 * 显示玩家名称、剩余牌数和当前状态
 */
export default function PlayerInfo({
  player,
  position,
  isCurrentTurn,
}: PlayerInfoProps) {
  return (
    <div className={`player-info player-${position} ${isCurrentTurn ? "active" : ""}`}>
      <div className="player-header">
        <span className="player-name">{player.name}</span>
        {player.isAI && <span className="ai-badge">AI</span>}
      </div>
      <div className="player-stats">
        <div className="cards-remaining">
          <span className="label">剩余:</span>
          <span className="value">{player.cardsRemaining}</span>
        </div>
      </div>
      {isCurrentTurn && (
        <div className="turn-indicator">
          <span className="pulse">轮到你了</span>
        </div>
      )}
    </div>
  );
}
