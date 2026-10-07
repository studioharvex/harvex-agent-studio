-- Shared answers (lib/share.ts). Additive only.
--
-- run_shares: the runs whose answer their owner made public under /s/<id>. One row per shared run; deleting the row
--   takes the page down. Nothing of the run is copied: the page reads the run as it is.
--   run_shares.id         the public id in the link (16 random URL-safe characters, not the run's id)
--   run_shares.show_task  1: the page also shows what the owner asked (cut to a few hundred characters)
CREATE TABLE `run_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`owner` text NOT NULL,
	`show_task` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_shares_run` ON `run_shares` (`run_id`);
--> statement-breakpoint
CREATE INDEX `run_shares_owner` ON `run_shares` (`owner`);
