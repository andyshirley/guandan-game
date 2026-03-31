import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createGame as dbCreateGame,
  finishGame,
  getGameById,
  addGameRound,
  getPlayerStats,
  updatePlayerStats,
  getGameHistory,
} from "./db";
import {
  createGame,
  dealCards,
  playCards,
  handlePass,
  getAIMove,
  generateGameId,
} from "./gameEngine";
import { Card, GameStateData, PlayerPosition, Player, Team, getTeam, GameStatus, Rank } from "@shared/types";

/**
 * 游戏路由
 * 处理游戏创建、出牌、AI 决策等操作
 */
export const gameRouter = router({
  /**
   * 创建新游戏
   */
  createGame: protectedProcedure
    .input(z.object({
      aiDifficulty: z.enum(["easy", "medium", "hard"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // 创建玩家列表
        const players: Player[] = [
          {
            position: PlayerPosition.Player0,
            userId: ctx.user.id,
            name: ctx.user.name || "玩家",
            isAI: false,
            hand: [],
            cardsRemaining: 0,
            isReady: false,
          },
          {
            position: PlayerPosition.Player1,
            userId: 0,
            name: "AI 1",
            isAI: true,
            hand: [],
            cardsRemaining: 0,
            isReady: false,
          },
          {
            position: PlayerPosition.Player2,
            userId: 0,
            name: "AI 2",
            isAI: true,
            hand: [],
            cardsRemaining: 0,
            isReady: false,
          },
          {
            position: PlayerPosition.Player3,
            userId: 0,
            name: "AI 3",
            isAI: true,
            hand: [],
            cardsRemaining: 0,
            isReady: false,
          },
        ];

        // 创建游戏状态
        const gameState = createGame(players);

        // 发牌
        const hands = dealCards(players);
        gameState.players.forEach((player, index) => {
          player.hand = hands[index];
          player.cardsRemaining = hands[index].length;
        });

        // 保存到数据库
        const result = await dbCreateGame(
          ctx.user.id,
          gameState.currentRank,
          JSON.stringify(gameState)
        );

        return {
          gameId: gameState.gameId,
          gameState,
          success: true,
        };
      } catch (error) {
        console.error("Failed to create game:", error);
        throw new Error("Failed to create game");
      }
    }),

  /**
   * 出牌（仅用于数据库记录，游戏逻辑在前端本地执行）
   * 注意：游戏实时状态由前端 client/src/lib/gameEngine.ts 管理
   */
  recordPlay: protectedProcedure
    .input(z.object({
      gameId: z.number(),
      roundNumber: z.number(),
      playerPosition: z.number(),
      cardsPlayed: z.string().nullable(),
      cardType: z.string().nullable(),
      isPassed: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await addGameRound(
          input.gameId,
          input.roundNumber,
          input.playerPosition,
          input.cardsPlayed,
          input.cardType,
          input.isPassed
        );
        return { success: true };
      } catch (error) {
        console.error("Failed to record play:", error);
        // 记录失败不影响游戏进行
        return { success: false };
      }
    }),

  /**
   * 完成游戏，保存结果到数据库
   */
  finishGame: protectedProcedure
    .input(z.object({
      gameId: z.number(),
      winningTeam: z.string(),
      finalRank: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // winningTeam: "team1" -> 1, "team2" -> 2
        const winningTeamNum = input.winningTeam === "team1" ? 1 : 2;
        await finishGame(input.gameId, winningTeamNum, JSON.stringify({ finalRank: input.finalRank }));
        // 更新玩家统计
        const isWin = input.winningTeam === "team1";
        const existing = await getPlayerStats(ctx.user.id);
        const currentWins = existing?.wins ?? 0;
        const currentLosses = existing?.losses ?? 0;
        const currentStreak = existing?.winStreak ?? 0;
        const maxStreak = existing?.maxWinStreak ?? 0;
        const newStreak = isWin ? currentStreak + 1 : 0;
        await updatePlayerStats(ctx.user.id, {
          wins: isWin ? currentWins + 1 : currentWins,
          losses: isWin ? currentLosses : currentLosses + 1,
          totalGames: (existing?.totalGames ?? 0) + 1,
          currentRank: input.finalRank,
          maxRank: input.finalRank,
          winStreak: newStreak,
          maxWinStreak: Math.max(maxStreak, newStreak),
        });
        return { success: true };
      } catch (error) {
        console.error("Failed to finish game:", error);
        return { success: false };
      }
    }),

  /**
   * 获取游戏状态
   */
  getGame: publicProcedure
    .input(z.object({
      gameId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        // 实际应从缓存或数据库获取
        return {
          gameId: input.gameId,
          status: "playing",
          message: "Game state retrieved",
        };
      } catch (error) {
        console.error("Failed to get game:", error);
        throw new Error("Failed to get game");
      }
    }),

  /**
   * 获取玩家统计
   */
  getPlayerStats: publicProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const stats = await getPlayerStats(input.userId);
        return stats || {
          userId: input.userId,
          totalGames: 0,
          wins: 0,
          losses: 0,
          currentRank: "3",
          maxRank: "3",
          winStreak: 0,
          maxWinStreak: 0,
          totalScore: 0,
        };
      } catch (error) {
        console.error("Failed to get player stats:", error);
        throw new Error("Failed to get player stats");
      }
    }),

  /**
   * 获取游戏历史
   */
  getGameHistory: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const games = await getGameHistory(ctx.user.id, input.limit);
        return games;
      } catch (error) {
        console.error("Failed to get game history:", error);
        throw new Error("Failed to get game history");
      }
    }),
});

export type GameRouter = typeof gameRouter;
