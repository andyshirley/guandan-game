import React, { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import "./GameHistory.css";

/**
 * 游戏历史页面
 */
export default function GameHistory() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [limit, setLimit] = useState(20);

  const { data: games, isLoading, error } = trpc.game.getGameHistory.useQuery(
    { limit },
    { enabled: isAuthenticated }
  );

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusLabel = (status: string): string => {
    return status === "finished" ? "已完成" : "进行中";
  };

  const getStatusColor = (status: string): string => {
    return status === "finished" ? "completed" : "playing";
  };

  return (
    <div className="game-history-page">
      <div className="history-container">
        <div className="history-header">
          <h1>游戏历史</h1>
          <p>查看您的游戏记录和统计数据</p>
        </div>

        {!isAuthenticated ? (
          <Card className="login-prompt-card">
            <div className="prompt-content">
              <p>请登录以查看游戏历史</p>
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
              <p>加载游戏历史失败</p>
              <Button onClick={() => setLocation("/")} variant="outline" size="lg">
                返回首页
              </Button>
            </div>
          </Card>
        ) : games && games.length > 0 ? (
          <>
            <div className="games-list">
              {games.map((game) => (
                <Card key={game.id} className="game-item">
                  <div className="game-info">
                    <div className="game-time">
                      {formatDate(game.createdAt)}
                    </div>
                    <div className="game-details">
                      <span className={`status ${getStatusColor(game.status)}`}>
                        {getStatusLabel(game.status)}
                      </span>
                      <span className="rank">升级级别: {game.currentRank}</span>
                      {game.winningTeam !== null && (
                        <span className="result">
                          {game.winningTeam === 0 ? "队伍 1 胜" : "队伍 2 胜"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="game-action">
                    <Button variant="outline" size="sm">
                      查看详情
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {games.length >= limit && (
              <div className="load-more">
                <Button
                  onClick={() => setLimit(limit + 20)}
                  variant="outline"
                  size="lg"
                >
                  加载更多
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card className="empty-card">
            <div className="empty-content">
              <p>还没有游戏记录</p>
              <Button onClick={() => setLocation("/")} size="lg">
                开始游戏
              </Button>
            </div>
          </Card>
        )}

        <div className="history-footer">
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
