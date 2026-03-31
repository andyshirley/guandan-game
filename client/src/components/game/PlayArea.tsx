import React from "react";
import { CardPlay, PlayerPosition, Suit, Rank } from "@shared/types";
import "./PlayArea.css";

interface PlayAreaProps {
  lastPlay: CardPlay | null;
  lastPlayer: PlayerPosition | null;
  currentPlayer: PlayerPosition;
}

/**
 * 出牌区域组件
 * 显示最后一张出牌和当前轮次信息
 */
export default function PlayArea({
  lastPlay,
  lastPlayer,
  currentPlayer,
}: PlayAreaProps) {
  const getSuitSymbol = (suit: Suit): string => {
    switch (suit) {
      case Suit.Hearts:
        return "♥";
      case Suit.Diamonds:
        return "♦";
      case Suit.Clubs:
        return "♣";
      case Suit.Spades:
        return "♠";
    }
  };

  const getSuitColor = (suit: Suit): string => {
    return suit === Suit.Hearts || suit === Suit.Diamonds ? "red" : "black";
  };

  const getRankDisplay = (rank: Rank): string => {
    switch (rank) {
      case Rank.SmallJoker:
        return "小王";
      case Rank.BigJoker:
        return "大王";
      default:
        return rank;
    }
  };

  const getCardTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      single: "单牌",
      pair: "对子",
      triple: "三张",
      sequence: "顺子",
      pair_seq: "对顺",
      triple_seq: "三顺",
      bomb: "炸弹",
      royal_bomb: "王炸",
    };
    return labels[type] || type;
  };

  const getPlayerName = (position: PlayerPosition): string => {
    const names = ["玩家", "AI 1", "AI 2", "AI 3"];
    return names[position];
  };

  return (
    <div className="play-area">
      {lastPlay ? (
        <div className="last-play">
          <div className="play-header">
            <span className="player-name">
              {getPlayerName(lastPlayer!)} 出牌
            </span>
            <span className="card-type">
              {getCardTypeLabel(lastPlay.type)}
            </span>
          </div>

          <div className="play-cards">
            {lastPlay.cards.map((card, index) => (
              <div
                key={index}
                className="card-display"
                style={{ color: getSuitColor(card.suit) }}
              >
                <div className="card-rank">{getRankDisplay(card.rank)}</div>
                <div className="card-suit">{getSuitSymbol(card.suit)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-play">
          <p>等待出牌...</p>
        </div>
      )}

      <div className="current-player-indicator">
        <span>当前轮到: {getPlayerName(currentPlayer)}</span>
      </div>
    </div>
  );
}
