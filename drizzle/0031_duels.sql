-- The arena (lib/arena.ts): two agents answer one question, and readers pick the better answer. Additive only.
--
-- duels: one question that the same account put to two published agents in a chat (two completed runs with the same
--   text). Nothing of a run is copied: the page /arena/<id> reads the two runs as they are. Deleting the row takes
--   the page down.
--   duels.id     the public id in the link (16 random URL-safe characters)
--   duels.run_a  the answer shown on the left; duels.run_b the one on the right. A run is in one duel at most.
-- duel_votes: one pick per account and duel ('a' or 'b'); it can be changed or taken back.
CREATE TABLE `duels` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`run_a` text NOT NULL,
	`run_b` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duels_run_a` ON `duels` (`run_a`);
--> statement-breakpoint
CREATE UNIQUE INDEX `duels_run_b` ON `duels` (`run_b`);
--> statement-breakpoint
CREATE INDEX `duels_owner` ON `duels` (`owner`);
--> statement-breakpoint
CREATE TABLE `duel_votes` (
	`duel_id` text NOT NULL,
	`voter` text NOT NULL,
	`choice` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`duel_id`, `voter`)
);
