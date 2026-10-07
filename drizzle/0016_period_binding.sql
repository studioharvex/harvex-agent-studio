-- Security audit, 1 Oct 2026 (lib/rewards.ts, app/api/claims/epoch). Additive only.
--
-- 1. Periods and claim epochs remember the contract, token and chain they were built for. A cumulative merkle tree only
--    makes sense for ONE contract: `claimed()` starts at zero on a new one, so building on top of old periods after
--    REWARD_CONTRACT or CLAIMS_CONTRACT changed (a redeploy, or a database that ran on testnet before) would make every
--    earlier payout claimable a second time. The server refuses to build when the configured contract differs from the
--    one stored on the existing periods. Rows from before this migration have NULL and count as "another contract".
--   reward_periods.contract / token / chain_id   what the period was built for
--   reward_periods.posted_at                     unix seconds when the root poster sent the root (a transaction that
--                                                never lands is sent again after a wait instead of blocking forever)
--   claim_epochs.contract / chain_id             the same for earnings claims
--
-- 2. reward_watch: the server reads every RootUpdated event of the reward vault. A root it did not build itself means
--    the root poster key (or the owner) posted something else: the server stops posting and reports it, because a
--    forged root can pay a thief up to the payout limit in every window until the vault is paused.
--   reward_watch.contract    the vault
--   reward_watch.last_block  RootUpdated events were read up to this block
--   reward_watch.alert       empty, or the reason the server stopped (root, block, transaction); cleared by the operator
ALTER TABLE `reward_periods` ADD `contract` text;
--> statement-breakpoint
ALTER TABLE `reward_periods` ADD `token` text;
--> statement-breakpoint
ALTER TABLE `reward_periods` ADD `chain_id` integer;
--> statement-breakpoint
ALTER TABLE `reward_periods` ADD `posted_at` integer;
--> statement-breakpoint
ALTER TABLE `claim_epochs` ADD `contract` text;
--> statement-breakpoint
ALTER TABLE `claim_epochs` ADD `chain_id` integer;
--> statement-breakpoint
CREATE TABLE `reward_watch` (
	`contract` text PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`alert` text,
	`updated` text NOT NULL
);
