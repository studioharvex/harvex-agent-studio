-- Agent chat on Telegram (lib/notify.ts). Additive only.
--
-- A linked Telegram chat (notify_channels, kind 'telegram') can be given one of its owner's agents and one of that
-- agent's skills. A message to the bot in that chat (in a group: /ask …) then runs the skill with the message as the
-- task, paid with the owner's credits like a manual run, and the answer is sent back to the chat.
--   chat_agent / chat_skill   the agent and skill that answer (NULL: the chat only receives reports)
--   chat_daily                answers per UTC day in this chat (the owner's cap on what a group can spend)
--   chat_day / chat_used      the day being counted and how many answers it has had
--   chat_last                 time of the last accepted question (ms), for the short pause between questions
-- tg_updates: Telegram update ids already handled, so a message is never answered twice when two readers see it.
ALTER TABLE `notify_channels` ADD `chat_agent` text;
--> statement-breakpoint
ALTER TABLE `notify_channels` ADD `chat_skill` text;
--> statement-breakpoint
ALTER TABLE `notify_channels` ADD `chat_daily` integer DEFAULT 20 NOT NULL;
--> statement-breakpoint
ALTER TABLE `notify_channels` ADD `chat_day` text;
--> statement-breakpoint
ALTER TABLE `notify_channels` ADD `chat_used` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `notify_channels` ADD `chat_last` integer;
--> statement-breakpoint
CREATE TABLE `tg_updates` (
	`update_id` integer PRIMARY KEY NOT NULL,
	`at` integer NOT NULL
);
