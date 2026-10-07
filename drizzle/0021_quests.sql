-- Quests (lib/quests.ts). Additive only.
--
-- quest_claims: the quests an account has claimed, one row per account and quest. The primary key is the lock: a
--   second claim of the same quest fails the whole batch, so its credits are added exactly once.
--   quest_claims.credits  the free credits that claim added (0 when the server gives none)
CREATE TABLE `quest_claims` (
	`owner` text NOT NULL,
	`quest` text NOT NULL,
	`credits` integer NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`owner`, `quest`)
);
