import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, LogIn, LogOut, User, Trophy, BookOpen, History } from "lucide-react";
import GameTable from "./GameTable";
import { GameStateData, PlayerPosition } from "@shared/types";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import "./GameLobby.css";

/**
 * 游戏大厅和启动页面
 */
export default function GameLobby() {
  const { user, isAuthenticated, logout } = useAuth();
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

  const handleStartGame = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setIsLoading(true);
    createGameMutation.mutate({ aiDifficulty: "medium" });
  };

  const handlePlayCards = (cards: any[]) => {
    console.log("Playing cards:", cards);
  };

  const handlePass = () => {
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

  return (
    <div className="game-lobby">
      {/* ===== 顶部导航栏 ===== */}
      <nav className="lobby-nav">
        <div className="nav-brand">
          <span className="nav-logo">🃏</span>
          <span className="nav-title">掼蛋</span>
        </div>
        <div className="nav-links">
          <button className="nav-link" onClick={() => setLocation("/rules")}>
            <BookOpen size={16} />
            游戏规则
          </button>
          <button className="nav-link" onClick={() => setLocation("/history")}>
            <History size={16} />
            游戏历史
          </button>
          <button className="nav-link" onClick={() => setLocation("/statistics")}>
            <Trophy size={16} />
            统计数据
          </button>
        </div>
        <div className="nav-auth">
          {isAuthenticated && user ? (
            <div className="nav-user">
              <div className="nav-avatar">
                <User size={16} />
              </div>
              <span className="nav-username">{user.name}</span>
              <button className="nav-logout" onClick={() => logout()}>
                <LogOut size={16} />
                退出
              </button>
            </div>
          ) : (
            <a href={getLoginUrl()} className="nav-login-btn">
              <LogIn size={16} />
              登录
            </a>
          )}
        </div>
      </nav>

      <div className="lobby-container">
        {/* ===== 英雄区域 ===== */}
        <div className="lobby-hero">
          <div className="hero-content">
            <h1 className="game-title">掼蛋</h1>
            <p className="game-subtitle">经典中国升级扑克 · 四人对战 · 智能 AI</p>
            {isAuthenticated ? (
              <div className="hero-welcome">
                <span>欢迎回来，</span>
                <span className="username">{user?.name}</span>
              </div>
            ) : (
              <div className="hero-cta">
                <p className="hero-desc">登录后即可与 AI 对手展开精彩对局</p>
                <a href={getLoginUrl()} className="hero-login-btn">
                  <LogIn size={18} />
                  立即登录开始游戏
                </a>
              </div>
            )}
          </div>
          <div className="hero-cards">
            <div className="card-fan">
              <div className="fan-card fan-card-1">A♠</div>
              <div className="fan-card fan-card-2">K♥</div>
              <div className="fan-card fan-card-3">Q♦</div>
              <div className="fan-card fan-card-4">J♣</div>
            </div>
          </div>
        </div>

        {/* ===== 游戏选项 ===== */}
        <div className="game-options">
          <Card className="option-card option-primary">
            <div className="option-content">
              <div className="option-icon">🎮</div>
              <h3>快速开始</h3>
              <p>与 3 个 AI 对手进行一局掼蛋游戏</p>
              <Button
                onClick={handleStartGame}
                disabled={isLoading}
                className="start-button"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    准备中...
                  </>
                ) : isAuthenticated ? (
                  "开始游戏"
                ) : (
                  <>
                    <LogIn size={16} className="mr-2" />
                    登录并开始
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card className="option-card" onClick={() => setLocation("/rules")} style={{ cursor: "pointer" }}>
            <div className="option-content">
              <div className="option-icon">📖</div>
              <h3>游戏规则</h3>
              <p>了解掼蛋的完整规则和牌型说明</p>
              <Button variant="outline" className="rules-button" size="lg">
                查看规则
              </Button>
            </div>
          </Card>

          <Card className="option-card" onClick={() => setLocation("/history")} style={{ cursor: "pointer" }}>
            <div className="option-content">
              <div className="option-icon">📊</div>
              <h3>游戏历史</h3>
              <p>查看您的对局记录和统计数据</p>
              <Button variant="outline" className="history-button" size="lg">
                查看历史
              </Button>
            </div>
          </Card>
        </div>

        {/* ===== 游戏特性 ===== */}
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
              <p>基于规则的 AI 对手，策略多变</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📈</div>
              <h4>统计数据</h4>
              <p>追踪胜率、升级等级和连胜记录</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✨</div>
              <h4>优雅设计</h4>
              <p>精致的视觉设计和流畅的交互体验</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
