import React, { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import GameTable from "./GameTable";
import { GameStateData, PlayerPosition } from "@shared/types";
import { useLocation } from "wouter";
import "./GameLobby.css";

/**
 * 游戏大厅和启动页面
 */
export default function GameLobby() {
  const { user, isAuthenticated } = useAuth();
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playerPosition] = useState<PlayerPosition>(PlayerPosition.Player0);
  const [, setLocation] = useLocation();

  const createGameMutation = trpc.game.createGame.useMutation({
    onSuccess: (data) => {
      setGameState(data.gameState);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Failed to create game:", error);
      setIsLoading(false);
    },
  });

  const handleStartGame = async () => {
    if (!isAuthenticated) {
      alert("请先登录");
      return;
    }

    setIsLoading(true);
    createGameMutation.mutate({
      aiDifficulty: "medium",
    });
  };

  const handlePlayCards = (cards: any[]) => {
    // 实现出牌逻辑
    console.log("Playing cards:", cards);
  };

  const handlePass = () => {
    // 实现不要逻辑
    console.log("Passing");
  };

  // 如果游戏已开始，显示游戏牌桌
  if (gameState) {
    return (
      <GameTable
        gameState={gameState}
        onPlayCards={handlePlayCards}
        onPass={handlePass}
        playerPosition={playerPosition}
      />
    );
  }

  // 显示游戏大厅
  return (
    <div className="game-lobby">
      <div className="lobby-container">
        {/* 顶部标题 */}
        <div className="lobby-header">
          <h1 className="game-title">掼蛋</h1>
          <p className="game-subtitle">经典中国扑克游戏</p>
        </div>

        {/* 用户信息 */}
        <div className="user-section">
          {isAuthenticated && user ? (
            <div className="user-info">
              <p>欢迎，<span className="username">{user.name}</span></p>
            </div>
          ) : (
            <div className="login-prompt">
              <p>请登录以开始游戏</p>
            </div>
          )}
        </div>

        {/* 游戏选项 */}
        <div className="game-options">
          <Card className="option-card">
            <div className="option-content">
              <h3>快速开始</h3>
              <p>与 3 个 AI 对手进行一局游戏</p>
              <Button
                onClick={handleStartGame}
                disabled={!isAuthenticated || isLoading}
                className="start-button"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    准备中...
                  </>
                ) : (
                  "开始游戏"
                )}
              </Button>
            </div>
          </Card>

          <Card className="option-card">
            <div className="option-content">
              <h3>游戏规则</h3>
              <p>了解掼蛋的基本规则和玩法</p>
              <Button
                variant="outline"
                className="rules-button"
                size="lg"
                onClick={() => setLocation("/rules")}
              >
                查看规则
              </Button>
            </div>
          </Card>

          <Card className="option-card">
            <div className="option-content">
              <h3>游戏历史</h3>
              <p>查看您的游戏记录和统计数据</p>
              <Button
                variant="outline"
                className="history-button"
                size="lg"
                onClick={() => setLocation("/history")}
              >
                查看历史
              </Button>
            </div>
          </Card>
        </div>

        {/* 游戏特性 */}
        <div className="features-section">
          <h2>游戏特性</h2>
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon">🎴</div>
              <h4>完整规则</h4>
              <p>支持升级、进贡、还贡等完整掼蛋规则</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🤖</div>
              <h4>智能 AI</h4>
              <p>三个难度级别的 AI 对手</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <h4>统计数据</h4>
              <p>追踪您的胜率、升级等级和连胜记录</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✨</div>
              <h4>优雅设计</h4>
              <p>精致的视觉设计和流畅的动画</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
