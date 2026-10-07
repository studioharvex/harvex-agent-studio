-- Agent teams (lib/teams.ts). Additive only.
--
-- teams:       a saved line of two or three steps of one account. `steps` is JSON: [{agentId, skill}, ...]; an agent
--              is one of the owner's own or one published by someone else (checked again every time a step runs).
-- runs.relay:  the id of one team run; every step of it is a normal run that carries the same id.
-- runs.step:   the step's place in that team run (1, 2, 3). Both stay NULL for every other run.
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`runs` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `teams_owner` ON `teams` (`owner`,`updated`);
--> statement-breakpoint
ALTER TABLE `runs` ADD `relay` text;
--> statement-breakpoint
ALTER TABLE `runs` ADD `step` integer;
--> statement-breakpoint
CREATE INDEX `runs_relay` ON `runs` (`owner`,`relay`);
