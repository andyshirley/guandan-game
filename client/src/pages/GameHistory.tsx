import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crown,
  History,
  Loader2,
  LogIn,
  Swords,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import "./GameHistory.css";

export default function GameHistory() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [limit, setLimit] = useState(20);

  const { data: games, isLoading, error } = trpc.game.getGameHistory.useQuery(
    { limit },
    { enabled: isAuthenticated }
  );

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffH < 1) return "刚刚";
    if (diffH < 24) return `${diffH} 小时前`;
    if (diffD < 7) return `${diffD} 天前`;
    return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatFullDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  if (authLoading) {
    return (
      <div className="hist-root">
        <div className="hist-loading-full"><Loader2 size={28} className="hist-spin" /></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="hist-root">
        <header className="hist-header">
          <button className="hist-back-btn" onClick={() => navigate("/")}>
            <ArrowLeft size={16} /><span>返回</span>
          </button>
          <div className="hist-header-title"><History size={18} /><span>游戏历史</span></div>
          <div style={{ width: 72 }} />
        </header>
        <div className="hist-auth-prompt">
          <div className="hist-auth-icon"><Crown size={36} /></div>
          <h2>登录查看历史</h2>
          <p>登录后可查看您的全部对局记录</p>
          <a href={getLoginUrl()} className="hist-login-btn">
            <LogIn size={16} /><span>立即登录</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="hist-root">
      {/* 顶部导航 */}
      <header className="hist-header">
        <button className="hist-back-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} /><span>返回</span>
        </button>
        <div className="hist-header-title">
          <History size={18} /><span>游戏历史</span>
        </div>
        <div className="hist-user-chip">
          <Crown size={12} /><span>{user?.name ?? "玩家"}</span>
        </div>
      </header>

      <div className="hist-body">
        {isLoading ? (
          <div className="hist-loading-full">
            <Loader2 size={28} className="hist-spin" />
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="hist-error">
            <XCircle size={28} />
            <span>加载失败，请刷新重试</span>
          </div>
        ) : !games || games.length === 0 ? (
          <div className="hist-empty">
            <Swords size={48} />
            <h3>暂无对局记录</h3>
            <p>开始你的第一局掼蛋，记录将在此显示</p>
            <button className="hist-start-btn" onClick={() => navigate("/")}>
              <Zap size={15} />开始游戏
            </button>
          </div>
        ) : (
          <>
            {/* 汇总信息栏 */}
            <div className="hist-summary">
              <div className="hist-summary-item">
                <CalendarDays size={14} />
                <span>共 <strong>{games.length}</strong> 条记录</span>
              </div>
              <div className="hist-summary-item">
                <Trophy size={14} />
                <span>
                  胜 <strong>{games.filter(g => g.winningTeam === 0).length}</strong> 负 <strong>{games.filter(g => g.winningTeam === 1).length}</strong>
                </span>
              </div>
            </div>

            {/* 对局列表 */}
            <div className="hist-list">
              {games.map((game) => {
                const isWin = game.winningTeam === 0;
                const isFinished = game.status === "finished";
                return (
                  <div key={game.id} className={`hist-item${isFinished ? (isWin ? " win" : " loss") : " ongoing"}`}>
                    {/* 左侧：结果图标 */}
                    <div className="hist-item-icon">
                      {!isFinished ? (
                        <Clock size={18} />
                      ) : isWin ? (
                        <Trophy size={18} />
                      ) : (
                        <XCircle size={18} />
                      )}
                    </div>

                    {/* 中间：详情 */}
                    <div className="hist-item-body">
                      <div className="hist-item-top">
                        <span className={`hist-result-badge${isFinished ? (isWin ? " win" : " loss") : " ongoing"}`}>
                          {!isFinished ? "进行中" : isWin ? "胜利" : "失败"}
                        </span>
                        <span className="hist-rank-chip">
                          <TrendingUp size={11} />
                          升 {game.currentRank}
                        </span>
                        {isFinished && game.winningTeam !== null && (
                          <span className="hist-team-chip">
                            {game.winningTeam === 0 ? "我方队伍胜" : "对方队伍胜"}
                          </span>
                        )}
                      </div>
                      <div className="hist-item-time" title={formatFullDate(game.createdAt)}>
                        <CalendarDays size={11} />
                        {formatDate(game.createdAt)}
                      </div>
                    </div>

                    {/* 右侧：状态指示 */}
                    <div className="hist-item-status">
                      {isFinished ? (
                        isWin
                          ? <CheckCircle2 size={16} className="hist-status-win" />
                          : <XCircle size={16} className="hist-status-loss" />
                      ) : (
                        <div className="hist-status-dot" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 加载更多 */}
            {games.length >= limit && (
              <button className="hist-load-more" onClick={() => setLimit(limit + 20)}>
                <ChevronDown size={15} />
                加载更多
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
