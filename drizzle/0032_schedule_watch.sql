-- Schedules that report only on change (lib/watch.ts). Additive only.
--
-- schedules.on_change   1: at each slot the server first looks whether what the skill reads has changed since the last
--                       report (wallet monitor: the balances and the number of transactions sent; whale watch: a
--                       transfer of at least watch_min HARVEX, or a new address among the ten biggest holders). No
--                       change: nothing runs and nothing is charged. Only the wallet monitor and whale watch.
-- schedules.watch_min   whale watch: the smallest transfer that counts, in whole HARVEX (NULL = the default).
-- schedules.watch_mark  what the last report (or quiet check) saw, to compare the next check with.
-- schedules.checked     when the last check was made.
-- schedules.quiet       checks that found no change since the last report.
ALTER TABLE `schedules` ADD `on_change` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `schedules` ADD `watch_min` integer;
--> statement-breakpoint
ALTER TABLE `schedules` ADD `watch_mark` text;
--> statement-breakpoint
ALTER TABLE `schedules` ADD `checked` text;
--> statement-breakpoint
ALTER TABLE `schedules` ADD `quiet` integer DEFAULT 0 NOT NULL;
