-- Agent quality: the check before publishing and ratings of answers (lib/agent-check.ts, lib/ratings.ts).
-- Additive only.
--
-- agents.checked_at / check_mark / check_passed / check_result: the last check of the agent. `check_mark` is a mark of
--   the instructions that were checked (lib/agents.ts configMark): an agent shows "Checked" only while its current
--   instructions still carry that mark and the check passed. `check_result` is the list of checks as JSON, for the
--   owner.
-- run_ratings: one rating per run, by the account the run belongs to (1 = helpful, -1 = not helpful).
ALTER TABLE `agents` ADD `checked_at` text;
--> statement-breakpoint
ALTER TABLE `agents` ADD `check_mark` text;
--> statement-breakpoint
ALTER TABLE `agents` ADD `check_passed` integer;
--> statement-breakpoint
ALTER TABLE `agents` ADD `check_result` text;
--> statement-breakpoint
CREATE TABLE `run_ratings` (
	`run_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`agent_id` text NOT NULL,
	`value` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `run_ratings_agent` ON `run_ratings` (`agent_id`);
