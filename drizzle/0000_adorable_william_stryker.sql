CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`updated` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agents_owner` ON `agents` (`owner`,`archived`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`agent_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`prompt` text NOT NULL,
	`output` text DEFAULT '' NOT NULL,
	`mode` text NOT NULL,
	`cost` integer NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_owner_created` ON `runs` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `preview_wallets` (
	`owner` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 250 NOT NULL,
	CONSTRAINT "positive_balance" CHECK("preview_wallets"."balance" >= 0)
);
