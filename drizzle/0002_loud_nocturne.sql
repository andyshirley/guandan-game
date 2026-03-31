ALTER TABLE `gameRounds` MODIFY COLUMN `isPassed` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `gameRounds` MODIFY COLUMN `isPassed` tinyint NOT NULL DEFAULT 0;