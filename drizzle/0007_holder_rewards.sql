-- Holder rewards (lib/rewards.ts). Additive only.
-- holder_*   : the holder recorder. Every HARVEX Transfer log (with its block time) and the running balance and
--              unbroken-hold start of each address. Rebuilt from holder_transfers at any time.
-- reward_*   : fundings verified on-chain, periods (pool, snapshot, cumulative merkle root) and per-address allocations.
CREATE TABLE `holder_sync` (
	`token` text PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`last_ts` integer NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holder_transfers` (
	`token` text NOT NULL,
	`block` integer NOT NULL,
	`log_index` integer NOT NULL,
	`tx_hash` text NOT NULL,
	`from_addr` text NOT NULL,
	`to_addr` text NOT NULL,
	`value` text NOT NULL,
	`ts` integer NOT NULL,
	PRIMARY KEY(`token`, `block`, `log_index`)
);
--> statement-breakpoint
CREATE INDEX `holder_transfers_ts` ON `holder_transfers` (`token`,`ts`);
--> statement-breakpoint
CREATE TABLE `holder_balances` (
	`token` text NOT NULL,
	`address` text NOT NULL,
	`balance` text NOT NULL,
	`since` integer,
	`updated` integer NOT NULL,
	PRIMARY KEY(`token`, `address`)
);
--> statement-breakpoint
CREATE TABLE `reward_fundings` (
	`tx_hash` text NOT NULL,
	`log_index` integer NOT NULL,
	`token` text NOT NULL,
	`from_addr` text NOT NULL,
	`amount` text NOT NULL,
	`block` integer NOT NULL,
	`ts` integer NOT NULL,
	`note` text,
	`period_id` integer,
	`created` text NOT NULL,
	PRIMARY KEY(`tx_hash`, `log_index`)
);
--> statement-breakpoint
CREATE TABLE `reward_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`start_ts` integer NOT NULL,
	`end_ts` integer NOT NULL,
	`end_block` integer NOT NULL,
	`pool` text NOT NULL,
	`distributed` text NOT NULL,
	`eligible` integer NOT NULL,
	`total_weight` text NOT NULL,
	`root` text NOT NULL,
	`leaves` text NOT NULL,
	`status` text NOT NULL,
	`tx_hash` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reward_allocations` (
	`period_id` integer NOT NULL,
	`address` text NOT NULL,
	`weight` text NOT NULL,
	`amount` text NOT NULL,
	`balance` text NOT NULL,
	`since` integer,
	PRIMARY KEY(`period_id`, `address`)
);
--> statement-breakpoint
CREATE INDEX `reward_allocations_address` ON `reward_allocations` (`address`);
