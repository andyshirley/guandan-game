import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 游戏记录表：记录每一局游戏的基本信息
 */
export const games = mysqlTable("games", {
  id: int("id").autoincrement().primaryKey(),
  /** 游戏创建者（玩家）的 user id */
  createdBy: int("createdBy").notNull(),
  /** 游戏状态：进行中、已完成 */
  status: mysqlEnum("status", ["playing", "finished"]).default("playing").notNull(),
  /** 当前升级级别 (3-A-2-K-Q-J-10-9-8-7-6-5-4-3) */
  currentRank: varchar("currentRank", { length: 2 }).default("3").notNull(),
  /** 获胜队伍 (0-2 或 1-3，null 表示游戏未结束) */
  winningTeam: int("winningTeam"),
  /** 游戏开始时间 */
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  /** 游戏结束时间 */
  endedAt: timestamp("endedAt"),
  /** 游戏数据（JSON：玩家信息、最终分数等） */
  gameData: text("gameData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Game = typeof games.$inferSelect;
export type InsertGame = typeof games.$inferInsert;

/**
 * 游戏回合表：记录游戏中的每一轮出牌
 */
export const gameRounds = mysqlTable("gameRounds", {
  id: int("id").autoincrement().primaryKey(),
  /** 所属游戏 ID */
  gameId: int("gameId").notNull(),
  /** 回合序号 */
  roundNumber: int("roundNumber").notNull(),
  /** 出牌玩家位置 (0-3) */
  playerPosition: int("playerPosition").notNull(),
  /** 出牌内容 (JSON：牌的组合) */
  cardsPlayed: text("cardsPlayed"),
  /** 牌型 (single, pair, triple, bomb, etc.) */
  cardType: varchar("cardType", { length: 32 }),
  /** 是否是"不要" */
  isPassed: boolean("isPassed").notNull().default(false),
  /** 回合开始时间 */
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type GameRound = typeof gameRounds.$inferSelect;
export type InsertGameRound = typeof gameRounds.$inferInsert;

/**
 * 玩家统计表：记录玩家的游戏统计数据
 */
export const playerStats = mysqlTable("playerStats", {
  id: int("id").autoincrement().primaryKey(),
  /** 玩家 ID */
  userId: int("userId").notNull().unique(),
  /** 总游戏局数 */
  totalGames: int("totalGames").default(0).notNull(),
  /** 获胜局数 */
  wins: int("wins").default(0).notNull(),
  /** 失败局数 */
  losses: int("losses").default(0).notNull(),
  /** 当前升级级别 */
  currentRank: varchar("currentRank", { length: 2 }).default("3").notNull(),
  /** 最高升级级别 */
  maxRank: varchar("maxRank", { length: 2 }).default("3").notNull(),
  /** 连胜次数 */
  winStreak: int("winStreak").default(0).notNull(),
  /** 最高连胜记录 */
  maxWinStreak: int("maxWinStreak").default(0).notNull(),
  /** 总分数 */
  totalScore: int("totalScore").default(0).notNull(),
  /** 最后更新时间 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlayerStats = typeof playerStats.$inferSelect;
export type InsertPlayerStats = typeof playerStats.$inferInsert;