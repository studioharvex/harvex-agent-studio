-- Wallet monitor skill (lib/monitor.ts). Additive only.
--
-- wallet_watch: the last reading an account's agents took of an address (block, time, balances), so the next report
--   can say what changed since. One row per account, chain and address; replaced at every completed run.
--   wallet_watch.reading   JSON: {eth, nonce, tokens: {<token address>: {s: symbol, d: decimals, v: raw amount}}}
-- The two indexes let the monitor list the HARVEX transfers of one address from the holder recorder's table without
-- reading every transfer of the token.
CREATE TABLE `wallet_watch` (
	`owner` text NOT NULL,
	`chain_id` integer NOT NULL,
	`address` text NOT NULL,
	`block` integer NOT NULL,
	`ts` integer NOT NULL,
	`reading` text NOT NULL,
	PRIMARY KEY(`owner`, `chain_id`, `address`)
);
--> statement-breakpoint
CREATE INDEX `holder_transfers_from` ON `holder_transfers` (`token`,`from_addr`,`block`);
--> statement-breakpoint
CREATE INDEX `holder_transfers_to` ON `holder_transfers` (`token`,`to_addr`,`block`);
