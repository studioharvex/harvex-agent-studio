-- Delivery of scheduled run results to Discord or Telegram (lib/notify.ts). Additive only.
--
-- notify_channels: where an account lets its agents send finished scheduled runs.
--   kind    'discord' (target = the channel's webhook address, given by the owner) or
--           'telegram' (target = the chat id that pressed Start on the server's bot with the owner's one-time code)
--   label   what the page shows ("Discord · reports", "Telegram · @name"); the target itself is never sent to a browser
--   fails   consecutive failed sends; a channel that is gone (webhook deleted, bot blocked) is marked with dead = 1
-- notify_links: one-time codes that tie a Telegram chat to an account (10 minutes).
-- notify_state: small values of the delivery code (the Telegram update offset, the bot's name).
-- schedules.notify: the channel a schedule sends each result to (NULL: History only).
CREATE TABLE `notify_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`target` text NOT NULL,
	`label` text NOT NULL,
	`fails` integer DEFAULT 0 NOT NULL,
	`dead` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_sent` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notify_channels_target` ON `notify_channels` (`owner`,`kind`,`target`);
--> statement-breakpoint
CREATE TABLE `notify_links` (
	`code` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notify_links_owner` ON `notify_links` (`owner`);
--> statement-breakpoint
CREATE TABLE `notify_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `schedules` ADD `notify` text;
