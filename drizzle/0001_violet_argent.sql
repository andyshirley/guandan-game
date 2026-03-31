CREATE TABLE `gameRounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`roundNumber` int NOT NULL,
	`playerPosition` int NOT NULL,
	`cardsPlayed` text,
	`cardType` varchar(32),
	`isPassed` boolean NOT NULL DEFAULT false,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameRounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdBy` int NOT NULL,
	`status` enum('playing','finished') NOT NULL DEFAULT 'playing',
	`currentRank` varchar(2) NOT NULL DEFAULT '3',
	`winningTeam` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`gameData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playerStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalGames` int NOT NULL DEFAULT 0,
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`currentRank` varchar(2) NOT NULL DEFAULT '3',
	`maxRank` varchar(2) NOT NULL DEFAULT '3',
	`winStreak` int NOT NULL DEFAULT 0,
	`maxWinStreak` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playerStats_id` PRIMARY KEY(`id`),
	CONSTRAINT `playerStats_userId_unique` UNIQUE(`userId`)
);
