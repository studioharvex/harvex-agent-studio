-- Better Auth (email magic link + Sign-In with Ethereum). New tables are prefixed ba_.
-- Existing email users are copied into ba_user with the SAME id, so their agents, wallets and
-- ledger rows (keyed by owner = user id) keep working after the switch.
CREATE TABLE `ba_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ba_user_email_unique` ON `ba_user` (`email`);--> statement-breakpoint
CREATE TABLE `ba_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ba_session_token_unique` ON `ba_session` (`token`);--> statement-breakpoint
CREATE INDEX `ba_session_user` ON `ba_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `ba_account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ba_account_user` ON `ba_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `ba_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `ba_verification_identifier` ON `ba_verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `ba_wallet_address` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`address` text NOT NULL,
	`chain_id` integer NOT NULL,
	`is_primary` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ba_wallet_address_user` ON `ba_wallet_address` (`user_id`);--> statement-breakpoint
CREATE INDEX `ba_wallet_address_address` ON `ba_wallet_address` (`address`);--> statement-breakpoint
INSERT OR IGNORE INTO `ba_user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`)
SELECT `id`, `email`, lower(`email`), 1,
	COALESCE(CAST(strftime('%s', `created`) AS INTEGER) * 1000, 0),
	COALESCE(CAST(strftime('%s', COALESCE(`last_login`, `created`)) AS INTEGER) * 1000, 0)
FROM `users`;
