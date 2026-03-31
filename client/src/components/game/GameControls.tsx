import React from "react";
import { CardPlay } from "@shared/types";
import { Button } from "@/components/ui/button";
import "./GameControls.css";

interface GameControlsProps {
  isMyTurn: boolean;
  selectedCardsCount: number;
  onPlay: () => void;
  onPass: () => void;
  lastPlay: CardPlay | null;
  canPass: boolean;
}

/**
 * 游戏控制组件
 * 提供出牌、不要等操作按钮
 */
export default function GameControls({
  isMyTurn,
  selectedCardsCount,
  onPlay,
  onPass,
  lastPlay,
  canPass,
}: GameControlsProps) {
  return (
    <div className="game-controls">
      <div className="control-buttons">
        <Button
          onClick={onPlay}
          disabled={!isMyTurn || selectedCardsCount === 0}
          className="play-button"
          size="lg"
        >
          出牌 ({selectedCardsCount})
        </Button>

        <Button
          onClick={onPass}
          disabled={!isMyTurn || !canPass}
          variant="outline"
          className="pass-button"
          size="lg"
        >
          不要
        </Button>
      </div>

      {!isMyTurn && (
        <div className="waiting-message">
          <p>等待其他玩家出牌...</p>
        </div>
      )}
    </div>
  );
}
