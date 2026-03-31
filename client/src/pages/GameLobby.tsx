import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import {
  BookOpen,
  ChevronRight,
  Crown,
  History,
  LogOut,
  Play,
  Shield,
  Swords,
  TrendingUp,
  Trophy,
  User,
  Users,
  Zap,
} from "lucide-react";
import GameTable from "./GameTable";
import { GameStateData, Team } from "@shared/types";
import { createInitialGameState } from "@/lib/gameEngine";
import "./GameLobby.css";

type LobbyView = "lobby" | "playing" | "result";

export default function GameLobby() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [view, setView] = useState<LobbyView>("lobby");
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [finalState, setFinalState] = useState<GameStateData | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [, setLocation] = useLocation();

  const saveGameMutation = trpc.game.finishGame.useMutation();

  const handleStartGame = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setIsStarting(true);
    setTimeout(() => {
      const playerName = user?.name || "玩家";
      const newGame = createInitialGameState(playerName);
      setGameState(newGame);
      setView("playing");
      setFinalState(null);
      setIsStarting(false);
    }, 300);
  };

  const handleGameEnd = async (state: GameStateData) => {
    setFinalState(state);
    setView("result");
    setGameState(null);
    if (isAuthenticated) {
      try {
        await saveGameMutation.mutateAsync({
          gameId: 0,
          winningTeam: String(state.winningTeam ?? ""),
          finalRank: state.currentRank,
        });
      } catch {}
    }
  };

  const handleBackToLobby = () => {
    setView("lobby");
    setGameState(null);
    setFinalState(null);
  };

  const handlePlayAgain = () => {
    const playerName = user?.name || "玩家";
    const newGame = createInitialGameState(playerName);
    setGameState(newGame);
    setView("playing");
    setFinalState(null);
  };

  // 游戏进行中
  if (view === "playing" && gameState) {
    return (
      <GameTable
        key={gameState.gameId}
        gameState={gameState}
        playerName={user?.name || "玩家"}
        onGameEnd={handleGameEnd}
        onBackToLobby={handleBackToLobby}
      />
    );
  }

  // 游戏结算界面
  if (view === "result" && finalState) {
    const playerWon = finalState.winningTeam === Team.Team1;
    return (
      <div className="lobby-root">
        <nav className="lobby-nav">
          <div className="lobby-nav-brand">
            <Crown size={22} className="brand-icon" />
            <span>掼蛋</span>
          </div>
          <div className="lobby-nav-auth">
            {isAuthenticated && user && (
              <div className="nav-user">
                <div className="nav-avatar"><User size={14} /></div>
                <span className="nav-username">{user.name}</span>
                <button className="nav-logout" onClick={logout} title="退出">
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="lobby-result-wrap">
          <div className={`result-card ${playerWon ? "win" : "lose"}`}>
            {/* 胜负标题 */}
            <div className="result-icon-wrap">
              {playerWon ? <Trophy size={52} /> : <Shield size={52} />}
            </div>
            <h2 className="result-title">{playerWon ? "恭喜获胜！" : "再接再厉"}</h2>
            <p className="result-subtitle">
              {playerWon ? "你和北家队友共同赢得了这局游戏" : "东家和西家获得了胜利"}
            </p>

            {/* 队伍对战结果 */}
            <div className="result-teams-row">
              <div className={`result-team-block ${playerWon ? "winner" : "loser"}`}>
                <div className="result-team-label">{playerWon ? <Trophy size={13}/> : <Shield size={13}/>}你的队伍</div>
                <div className="result-team-players">
                  {[finalState.players[0], finalState.players[2]].map((p, i) => (
                    <div key={i} className="result-player-row">
                      <span className="result-player-icon">{i === 0 ? <User size={12}/> : <Shield size={12}/>}</span>
                      <span className="result-player-name">{p.name}</span>
                      <span className="result-player-cards">{p.cardsRemaining}张</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="result-vs">VS</div>
              <div className={`result-team-block ${!playerWon ? "winner" : "loser"}`}>
                <div className="result-team-label">{!playerWon ? <Trophy size={13}/> : <Shield size={13}/>}对方队伍</div>
                <div className="result-team-players">
                  {[finalState.players[1], finalState.players[3]].map((p, i) => (
                    <div key={i} className="result-player-row">
                      <span className="result-player-icon"><Shield size={12}/></span>
                      <span className="result-player-name">{p.name}</span>
                      <span className="result-player-cards">{p.cardsRemaining}张</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 升级信息 */}
            <div className="result-rank-row">
              <TrendingUp size={14} />
              <span>当前升级级别：</span>
              <strong className="result-rank-val">{finalState.currentRank}</strong>
            </div>

            <div className="result-actions">
              <button className="lobby-btn-primary" onClick={handlePlayAgain}>
                <Play size={16} />再来一局
              </button>
              <button className="lobby-btn-secondary" onClick={handleBackToLobby}>
                返回大厅
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 大厅主界面
  return (
    <div className="lobby-root">
      {/* 顶部导航 */}
      <nav className="lobby-nav">
        <div className="lobby-nav-brand">
          <Crown size={22} className="brand-icon" />
          <span>掼蛋</span>
        </div>

        <div className="lobby-nav-links">
          <button className="nav-link" onClick={() => setLocation("/rules")}>
            <BookOpen size={15} />规则
          </button>
          <button className="nav-link" onClick={() => setLocation("/history")}>
            <History size={15} />历史
          </button>
          <button className="nav-link" onClick={() => setLocation("/statistics")}>
            <TrendingUp size={15} />统计
          </button>
        </div>

        <div className="lobby-nav-auth">
          {loading ? null : isAuthenticated && user ? (
            <div className="nav-user">
              <div className="nav-avatar"><User size={14} /></div>
              <span className="nav-username">{user.name}</span>
              <button className="nav-logout" onClick={logout} title="退出登录">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <a href={getLoginUrl()} className="nav-login-btn">
              <User size={14} />登录
            </a>
          )}
        </div>
      </nav>

      {/* 英雄区域 */}
      <div className="lobby-hero">
        <div className="hero-left">
          <div className="hero-badge">
            <Zap size={13} />
            <span>智能 AI 对战</span>
          </div>
          <h1 className="hero-title">掼蛋</h1>
          <p className="hero-subtitle">经典升级扑克 · 4人对战 · 智能 AI 陪练</p>

          {isAuthenticated ? (
            <button
              className="lobby-btn-primary hero-cta"
              onClick={handleStartGame}
              disabled={isStarting}
            >
              {isStarting ? (
                <><Zap size={18} className="spin-icon" />发牌中...</>
              ) : (
                <><Play size={18} />开始游戏</>
              )}
            </button>
          ) : (
            <a href={getLoginUrl()} className="lobby-btn-primary hero-cta">
              <User size={18} />登录开始游戏
            </a>
          )}
        </div>

        {/* 装饰牌扇 */}
        <div className="hero-cards-deco" aria-hidden="true">
          {[
            { label: "A", suit: "♠", color: "#1a1a1a" },
            { label: "K", suit: "♥", color: "#c0392b" },
            { label: "Q", suit: "♦", color: "#c0392b" },
            { label: "J", suit: "♣", color: "#1a1a1a" },
            { label: "10", suit: "♠", color: "#1a1a1a" },
          ].map((c, i) => (
            <div key={i} className={`deco-card deco-card-${i}`}>
              <span style={{ color: c.color }}>{c.label}</span>
              <span style={{ color: c.color }}>{c.suit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 功能入口网格 */}
      <div className="lobby-grid">
        <div className="lobby-card primary" onClick={handleStartGame}>
          <div className="lobby-card-icon">
            <Swords size={22} />
          </div>
          <div className="lobby-card-body">
            <h3>快速对战</h3>
            <p>与 3 个 AI 对手立即开始一局掼蛋</p>
          </div>
          <ChevronRight size={16} className="lobby-card-arrow" />
        </div>

        <div className="lobby-card" onClick={() => setLocation("/rules")}>
          <div className="lobby-card-icon rules">
            <BookOpen size={22} />
          </div>
          <div className="lobby-card-body">
            <h3>游戏规则</h3>
            <p>了解掼蛋的完整规则和牌型说明</p>
          </div>
          <ChevronRight size={16} className="lobby-card-arrow" />
        </div>

        <div className="lobby-card" onClick={() => setLocation("/history")}>
          <div className="lobby-card-icon history">
            <History size={22} />
          </div>
          <div className="lobby-card-body">
            <h3>游戏历史</h3>
            <p>查看你的历史对局记录</p>
          </div>
          <ChevronRight size={16} className="lobby-card-arrow" />
        </div>

        <div className="lobby-card" onClick={() => setLocation("/statistics")}>
          <div className="lobby-card-icon stats">
            <TrendingUp size={22} />
          </div>
          <div className="lobby-card-body">
            <h3>个人统计</h3>
            <p>胜率、升级进度和成就数据</p>
          </div>
          <ChevronRight size={16} className="lobby-card-arrow" />
        </div>
      </div>

      {/* 底部特性栏 */}
      <div className="lobby-features">
        <div className="feature-item">
          <Shield size={18} />
          <span>完整规则</span>
        </div>
        <div className="feature-divider" />
        <div className="feature-item">
          <Zap size={18} />
          <span>智能 AI</span>
        </div>
        <div className="feature-divider" />
        <div className="feature-item">
          <Trophy size={18} />
          <span>成就系统</span>
        </div>
        <div className="feature-divider" />
        <div className="feature-item">
          <Users size={18} />
          <span>4 人对战</span>
        </div>
      </div>
    </div>
  );
}
