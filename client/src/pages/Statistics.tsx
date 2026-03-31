import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Award,
  BarChart2,
  CheckCircle2,
  Crown,
  Flame,
  Loader2,
  LogIn,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import "./Statistics.css";

export default function Statistics() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading, error } = trpc.game.getPlayerStats.useQuery(
    { userId: user?.id || 0 },
    { enabled: isAuthenticated && !!user }
  );

  if (authLoading) {
    return (
      <div className="stats-root">
        <div className="stats-loading-full">
          <Loader2 size={28} className="stats-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="stats-root">
        <header className="stats-header">
          <button className="stats-back-btn" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
            <span>返回</span>
          </button>
          <div className="stats-header-title">
            <BarChart2 size={18} />
            <span>游戏统计</span>
          </div>
          <div style={{ width: 72 }} />
        </header>
        <div className="stats-auth-prompt">
          <div className="stats-auth-icon"><Crown size={36} /></div>
          <h2>登录查看统计</h2>
          <p>登录后可查看您的游戏数据、胜率和成就</p>
          <a href={getLoginUrl()} className="stats-login-btn">
            <LogIn size={16} />
            <span>立即登录</span>
          </a>
        </div>
      </div>
    );
  }

  const winRate = stats && stats.totalGames > 0
    ? Math.round((stats.wins / stats.totalGames) * 100)
    : 0;

  return (
    <div className="stats-root">
      {/* 顶部导航 */}
      <header className="stats-header">
        <button className="stats-back-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>
        <div className="stats-header-title">
          <BarChart2 size={18} />
          <span>游戏统计</span>
        </div>
        <div className="stats-user-chip">
          <Crown size={12} />
          <span>{user?.name ?? "玩家"}</span>
        </div>
      </header>

      <div className="stats-body">
        {isLoading ? (
          <div className="stats-loading-full">
            <Loader2 size={28} className="stats-spin" />
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="stats-error">
            <XCircle size={28} />
            <span>加载失败，请刷新重试</span>
          </div>
        ) : !stats ? (
          <div className="stats-empty">
            <Swords size={48} />
            <h3>尚无对局记录</h3>
            <p>开始你的第一局掼蛋，数据将在此显示</p>
            <button className="stats-start-btn" onClick={() => navigate("/")}>
              <Zap size={15} />
              开始游戏
            </button>
          </div>
        ) : (
          <>
            {/* 核心 KPI */}
            <section className="stats-kpi-grid">
              <div className="stats-kpi-card">
                <div className="stats-kpi-icon total"><Swords size={20} /></div>
                <div className="stats-kpi-val">{stats.totalGames}</div>
                <div className="stats-kpi-label">总对局</div>
              </div>
              <div className="stats-kpi-card">
                <div className="stats-kpi-icon wins"><Trophy size={20} /></div>
                <div className="stats-kpi-val">{stats.wins}</div>
                <div className="stats-kpi-label">胜利</div>
              </div>
              <div className="stats-kpi-card">
                <div className="stats-kpi-icon losses"><XCircle size={20} /></div>
                <div className="stats-kpi-val">{stats.losses}</div>
                <div className="stats-kpi-label">失败</div>
              </div>
              <div className="stats-kpi-card highlight">
                <div className="stats-kpi-icon rate"><Target size={20} /></div>
                <div className="stats-kpi-val">{stats.totalGames > 0 ? `${winRate}%` : "—"}</div>
                <div className="stats-kpi-label">胜率</div>
              </div>
            </section>

            {/* 详细数据 */}
            <section className="stats-detail-grid">
              <div className="stats-detail-card">
                <div className="stats-detail-header">
                  <TrendingUp size={15} />
                  <span>升级进度</span>
                </div>
                <div className="stats-rank-display">
                  <div className="stats-rank-item">
                    <div className="stats-rank-label">当前级别</div>
                    <div className="stats-rank-value current">{stats.currentRank ?? "2"}</div>
                  </div>
                  <div className="stats-rank-arrow">→</div>
                  <div className="stats-rank-item">
                    <div className="stats-rank-label">最高级别</div>
                    <div className="stats-rank-value best">{stats.maxRank ?? "2"}</div>
                  </div>
                </div>
              </div>

              <div className="stats-detail-card">
                <div className="stats-detail-header">
                  <Flame size={15} />
                  <span>连胜记录</span>
                </div>
                <div className="stats-streak-row">
                  <div className="stats-streak-item">
                    <div className="stats-streak-num current">{stats.winStreak ?? 0}</div>
                    <div className="stats-streak-label">当前连胜</div>
                  </div>
                  <div className="stats-streak-divider" />
                  <div className="stats-streak-item">
                    <div className="stats-streak-num best">{stats.maxWinStreak ?? 0}</div>
                    <div className="stats-streak-label">最高连胜</div>
                  </div>
                </div>
              </div>

              <div className="stats-detail-card">
                <div className="stats-detail-header">
                  <Award size={15} />
                  <span>积分</span>
                </div>
                <div className="stats-score-display">
                  <div className="stats-score-num">{stats.totalScore ?? 0}</div>
                  <div className="stats-score-label">总积分</div>
                </div>
              </div>
            </section>

            {/* 成就 */}
            <section className="stats-achievements">
              <div className="stats-section-title">
                <Crown size={15} />
                <span>成就</span>
              </div>
              <div className="stats-achievement-grid">
                {[
                  {
                    icon: <Swords size={18} />,
                    name: "初出茅庐",
                    desc: "完成第一局游戏",
                    unlocked: (stats.totalGames ?? 0) >= 1,
                  },
                  {
                    icon: <Trophy size={18} />,
                    name: "常胜将军",
                    desc: "累计胜利 10 局",
                    unlocked: (stats.wins ?? 0) >= 10,
                  },
                  {
                    icon: <Crown size={18} />,
                    name: "王者荣耀",
                    desc: "升级到 A",
                    unlocked: ["A", "2"].includes(stats.maxRank ?? ""),
                  },
                  {
                    icon: <Flame size={18} />,
                    name: "连胜之王",
                    desc: "达成 5 连胜",
                    unlocked: (stats.maxWinStreak ?? 0) >= 5,
                  },
                ].map((ach, i) => (
                  <div key={i} className={`stats-achievement-item${ach.unlocked ? " unlocked" : ""}`}>
                    <div className="stats-ach-icon">{ach.icon}</div>
                    <div className="stats-ach-info">
                      <div className="stats-ach-name">{ach.name}</div>
                      <div className="stats-ach-desc">{ach.desc}</div>
                    </div>
                    <div className="stats-ach-status">
                      {ach.unlocked
                        ? <CheckCircle2 size={16} />
                        : <div className="stats-ach-lock" />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
