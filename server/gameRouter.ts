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
   * 出牌
   */
  playCards: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      cards: z.array(z.object({
        rank: z.string(),
        suit: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // 获取游戏状态（实际应从缓存或 WebSocket 获取）
        // 这里为简化示例，实际应使用 Redis 或内存缓存
        const gameState: GameStateData = {
          gameId: input.gameId,
          status: GameStatus.Playing,
          players: [],
          currentRank: Rank.Three,
          currentRound: {
            roundNumber: 1,
            currentPlayer: PlayerPosition.Player0,
            lastPlay: null,
            lastPlayer: null,
            passCount: 0,
            plays: [],
          },
          gameHistory: [],
          winningTeam: null,
          startedAt: new Date(),
          endedAt: null,
        };

        // 转换卡片格式
        const cards: Card[] = input.cards.map((c) => ({
          rank: c.rank as any,
          suit: c.suit as any,
        }));

        // 执行出牌
        const result = playCards(gameState, PlayerPosition.Player0, cards);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          };
        }

        // 如果游戏未结束，执行 AI 出牌
        if (result.updatedGame && result.updatedGame.status === "playing") {
          // AI 轮次处理（简化版）
          // 实际应异步处理
        }

        return {
          success: true,
          gameState: result.updatedGame,
        };
      } catch (error) {
        console.error("Failed to play cards:", error);
        throw new Error("Failed to play cards");
      }
    }),

  /**
   * 不要
   */
  pass: protectedProcedure
    .input(z.object({
      gameId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // 获取游戏状态
        const gameState: GameStateData = {
          gameId: input.gameId,
          status: GameStatus.Playing,
          players: [],
          currentRank: Rank.Three,
          currentRound: {
            roundNumber: 1,
            currentPlayer: PlayerPosition.Player0,
            lastPlay: null,
            lastPlayer: null,
            passCount: 0,
            plays: [],
          },
          gameHistory: [],
          winningTeam: null,
          startedAt: new Date(),
          endedAt: null,
        };

        // 执行不要
        const result = handlePass(gameState, PlayerPosition.Player0);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          };
        }

        return {
          success: true,
          gameState: result.updatedGame,
        };
      } catch (error) {
        console.error("Failed to pass:", error);
        throw new Error("Failed to pass");
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
