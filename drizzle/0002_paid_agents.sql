ALTER TABLE `agents` ADD `published` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `uses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `published_at` text;--> statement-breakpoint
CREATE INDEX `agents_published` ON `agents` (`published`,`archived`,`uses`);--> statement-breakpoint
ALTER TABLE `preview_wallets` ADD `earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`ref` text,
	`note` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ledger_owner_created` ON `credit_ledger` (`owner`,`created`);
