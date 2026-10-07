-- BNB Smart Chain: wallet-link nonces, on-chain credit top-ups, earnings claims (merkle epochs)
-- and holder-tier allotments. Additive only; earlier migrations stay untouched.
CREATE TABLE `chain_nonces` (
	`nonce` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`chain_id` integer NOT NULL,
	`tx_hash` text NOT NULL,
	`log_index` integer NOT NULL,
	`token` text NOT NULL,
	`from_address` text NOT NULL,
	`amount` text NOT NULL,
	`credits` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topups_tx` ON `topups` (`chain_id`,`tx_hash`,`log_index`);--> statement-breakpoint
CREATE INDEX `topups_owner` ON `topups` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`address` text NOT NULL,
	`credits` integer NOT NULL,
	`amount` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`epoch` integer,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `claims_owner` ON `claims` (`owner`,`created`);--> statement-breakpoint
CREATE INDEX `claims_status` ON `claims` (`status`,`address`);--> statement-breakpoint
CREATE TABLE `claim_epochs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`root` text NOT NULL,
	`total` text NOT NULL,
	`leaves` text NOT NULL,
	`status` text DEFAULT 'built' NOT NULL,
	`tx_hash` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tier_periods` (
	`period` text PRIMARY KEY NOT NULL,
	`block` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tier_allotments` (
	`period` text NOT NULL,
	`owner` text NOT NULL,
	`tier` text NOT NULL,
	`credits` integer NOT NULL,
	`block` integer NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`period`,`owner`)
);
--> statement-breakpoint
CREATE TABLE `tier_allotment_wallets` (
	`period` text NOT NULL,
	`address` text NOT NULL,
	`owner` text NOT NULL,
	PRIMARY KEY(`period`,`address`)
);
--> statement-breakpoint
CREATE TABLE `tier_cache` (
	`owner` text PRIMARY KEY NOT NULL,
	`tier` text NOT NULL,
	`balance` text NOT NULL,
	`checked` text NOT NULL
);
