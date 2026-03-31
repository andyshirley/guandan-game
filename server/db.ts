import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, games, gameRounds, playerStats } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * 游戏相关的数据库查询函数
 */

export async function createGame(
  createdBy: number,
  currentRank: string,
  gameData: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(games).values({
    createdBy,
    currentRank,
    gameData,
    status: "playing",
  });

  return result;
}

export async function finishGame(
  gameId: number,
  winningTeam: number,
  gameData: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(games)
    .set({
      status: "finished",
      winningTeam,
      endedAt: new Date(),
      gameData,
    })
    .where(eq(games.id, gameId));
}

export async function getGameById(gameId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function addGameRound(
  gameId: number,
  roundNumber: number,
  playerPosition: number,
  cardsPlayed: string | null,
  cardType: string | null,
  isPassed: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(gameRounds).values({
    gameId,
    roundNumber,
    playerPosition,
    cardsPlayed,
    cardType,
    isPassed: isPassed ? 1 : 0,
  });
}

export async function getPlayerStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updatePlayerStats(
  userId: number,
  stats: Partial<typeof playerStats.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getPlayerStats(userId);
  if (existing) {
    await db
      .update(playerStats)
      .set(stats)
      .where(eq(playerStats.userId, userId));
  } else {
    await db.insert(playerStats).values({
      userId,
      ...stats,
    });
  }
}

export async function getGameHistory(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(games)
    .where(eq(games.createdBy, userId))
    .orderBy(desc(games.createdAt))
    .limit(limit);

  return result;
}
