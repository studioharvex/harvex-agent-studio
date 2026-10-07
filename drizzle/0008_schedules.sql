-- Scheduled agent work (lib/schedules.ts): the owner picks an agent, a skill, the task and how many times a day it runs.
-- The scheduler claims a due row by moving next_run forward (optimistic lock), then runs it like a manual run, paid with
-- credits (SCHEDULE_RUN_COST). Runs keep schedule_id so History shows where they came from.
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`agent_id` text NOT NULL,
	`skill` text NOT NULL,
	`prompt` text NOT NULL,
	`per_day` integer NOT NULL,
	`start_minute` integer NOT NULL,
	`mode` text DEFAULT 'auto' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`next_run` text NOT NULL,
	`last_run` text,
	`last_status` text,
	`last_run_id` text,
	`runs` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedules_due` ON `schedules` (`active`,`next_run`);
--> statement-breakpoint
CREATE INDEX `schedules_owner` ON `schedules` (`owner`);
--> statement-breakpoint
ALTER TABLE `runs` ADD `schedule_id` text;
