import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import "./Statistics.css";

/**
 * 玩家统计页面
 */
export default function Statistics() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading, error } = trpc.game.getPlayerStats.useQuery(
    { userId: user?.id || 0 },
    { enabled: isAuthenticated && !!user }
  );

  const calculateWinRate = (): string => {
    if (!stats || stats.totalGames === 0) return "0%";
    return ((stats.wins / stats.totalGames) * 100).toFixed(1) + "%";
  };

  return (
    <div className="statistics-page">
      <div className="stats-container">
        <div className="stats-header">
          <h1>游戏统计</h1>
          <p>查看您的游戏数据和成就</p>
        </div>

        {!isAuthenticated ? (
          <Card className="login-prompt-card">
            <div className="prompt-content">
              <p>请登录以查看统计数据</p>
              <Button onClick={() => setLocation("/")} size="lg">
                返回首页
              </Button>
            </div>
          </Card>
        ) : isLoading ? (
          <div className="loading-container">
            <Loader2 className="spinner" />
            <p>加载中...</p>
          </div>
        ) : error ? (
          <Card className="error-card">
            <div className="error-content">
              <p>加载统计数据失败</p>
              <Button onClick={() => setLocation("/")} variant="outline" size="lg">
                返回首页
              </Button>
            </div>
          </Card>
        ) : stats ? (
          <>
            {/* 主要统计信息 */}
            <div className="stats-grid">
              <Card className="stat-card">
                <div className="stat-label">总局数</div>
                <div className="stat-value">{stats.totalGames}</div>
              </Card>

              <Card className="stat-card">
                <div className="stat-label">胜利</div>
                <div className="stat-value">{stats.wins}</div>
              </Card>

              <Card className="stat-card">
                <div className="stat-label">失败</div>
                <div className="stat-value">{stats.losses}</div>
              </Card>

              <Card className="stat-card">
                <div className="stat-label">胜率</div>
                <div className="stat-value">{calculateWinRate()}</div>
              </Card>
            </div>

            {/* 详细统计 */}
            <div className="detailed-stats">
              <Card className="detail-section">
                <h3>升级信息</h3>
                <div className="detail-content">
                  <div className="detail-item">
                    <span className="label">当前级别</span>
                    <span className="value">{stats.currentRank}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">最高级别</span>
                    <span className="value">{stats.maxRank}</span>
                  </div>
                </div>
              </Card>

              <Card className="detail-section">
                <h3>连胜记录</h3>
                <div className="detail-content">
                  <div className="detail-item">
                    <span className="label">当前连胜</span>
                    <span className="value">{stats.winStreak}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">最高连胜</span>
                    <span className="value">{stats.maxWinStreak}</span>
                  </div>
                </div>
              </Card>

              <Card className="detail-section">
                <h3>总积分</h3>
                <div className="detail-content">
                  <div className="detail-item">
                    <span className="label">积分</span>
                    <span className="value">{stats.totalScore}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* 成就 */}
            <Card className="achievements-section">
              <h3>成就</h3>
              <div className="achievements-grid">
                <div className="achievement-item">
                  <div className="achievement-icon">🎮</div>
                  <div className="achievement-name">新手玩家</div>
                  <div className="achievement-desc">完成第一局游戏</div>
                </div>
                <div className="achievement-item">
                  <div className="achievement-icon">🏆</div>
                  <div className="achievement-name">连胜王</div>
                  <div className="achievement-desc">达到 5 连胜</div>
                </div>
                <div className="achievement-item">
                  <div className="achievement-icon">👑</div>
                  <div className="achievement-name">升级高手</div>
                  <div className="achievement-desc">升级到最高级别</div>
                </div>
                <div className="achievement-item">
                  <div className="achievement-icon">💯</div>
                  <div className="achievement-name">完美胜率</div>
                  <div className="achievement-desc">达到 100% 胜率</div>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        <div className="stats-footer">
          <Button
            onClick={() => setLocation("/")}
            className="back-button"
            size="lg"
          >
            返回大厅
          </Button>
        </div>
      </div>
    </div>
  );
}
