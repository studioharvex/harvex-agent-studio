-- Fixed-rate holder rewards: every REWARD_HARVEX_PER_UNIT HARVEX held earns REWARD_USD_PER_UNIT_HOUR of the reward token per hour.
-- Additive only.
-- reward_prices      : the reward token's USD price (8 decimals: $1.00 = 100000000), with history. source = 'chainlink:<roundId>'
--                      (read from REWARD_PRICE_FEED) or 'manual'; observed = unix time of the price itself (the feed's
--                      updatedAt). Each period converts its USD accrual to the reward token at the latest price when it is built.
-- reward_periods     : + usd_total (8 decimals) and price_e8 used for the conversion.
-- reward_allocations : + usd (8 decimals) and units (complete 3M HARVEX blocks held at the end of the period).
CREATE TABLE `reward_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`price_e8` text NOT NULL,
	`previous_e8` text,
	`note` text,
	`source` text NOT NULL DEFAULT 'manual',
	`observed` integer,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `reward_periods` ADD `usd_total` text;
--> statement-breakpoint
ALTER TABLE `reward_periods` ADD `price_e8` text;
--> statement-breakpoint
ALTER TABLE `reward_allocations` ADD `usd` text;
--> statement-breakpoint
ALTER TABLE `reward_allocations` ADD `units` integer;
