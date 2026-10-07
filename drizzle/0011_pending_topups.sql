-- Pending top-ups (lib/topups.ts). On mainnet a payment is only credited once its block is "safe" (posted to Ethereum,
-- about 10-15 minutes). The hash is kept here per account so the scheduler finishes it even when the buyer closed the
-- page. Keyed by (chain, tx, owner): someone else submitting the same hash can neither take nor erase the buyer's entry.
-- Additive only.
CREATE TABLE `topup_pending` (
	`chain_id` integer NOT NULL,
	`tx_hash` text NOT NULL,
	`owner` text NOT NULL,
	`created` text NOT NULL,
	`checked` text,
	PRIMARY KEY(`chain_id`, `tx_hash`, `owner`)
);
--> statement-breakpoint
CREATE INDEX `topup_pending_owner` ON `topup_pending` (`owner`);
