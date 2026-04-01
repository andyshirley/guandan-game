import React from "react";
import { Card, Suit, Rank } from "@shared/types";
import "./PlayerHand.css";

interface PlayerHandProps {
  cards: Card[];
  selectedCards: Card[];
  onCardClick: (card: Card) => void;
  disabled?: boolean;
}

/**
 * 玩家手牌展示组件
 */
export default function PlayerHand({
  cards,
  selectedCards,
  onCardClick,
  disabled = false,
}: PlayerHandProps) {
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

  const isCardSelected = (card: Card): boolean => {
    return selectedCards.some((c) => c.id === card.id);
  };

  // 按点数排序牌
  const sortedCards = [...cards].sort((a, b) => {
    const rankOrder = [
      "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2",
      "joker_small", "joker_big"
    ];
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
  });

  return (
    <div className="player-hand">
      <div className="hand-cards">
        {sortedCards.map((card, index) => (
          <div
            key={`${card.rank}-${card.suit}-${index}`}
            className={`card ${isCardSelected(card) ? "selected" : ""} ${disabled ? "disabled" : ""}`}
            onClick={() => !disabled && onCardClick(card)}
            style={{
              color: getSuitColor(card.suit),
            }}
          >
            <div className="card-inner">
              <div className="card-rank">{getRankDisplay(card.rank)}</div>
              <div className="card-suit">{getSuitSymbol(card.suit)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="hand-info">
        <span>共 {cards.length} 张牌</span>
        {selectedCards.length > 0 && (
          <span className="selected-count">已选 {selectedCards.length} 张</span>
        )}
      </div>
    </div>
  );
}
