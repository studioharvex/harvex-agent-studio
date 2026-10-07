-- Bought vs free credits (client, 1 Oct 2026). Only earnings paid for with BOUGHT credits can be claimed as USDT, so free
-- credits (the starting grant, tier allotments) can never be turned into real money through a creator account.
--   preview_wallets.paid         part of balance bought with USDT (or earned from bought credits); 0 <= paid <= balance
--   preview_wallets.earned_paid  earnings that came from buyers' bought credits: the only claimable earnings
--   runs.paid_cost               credits of this run taken from `paid` (free credits are spent first); given back on refund
--   runs.creator_paid            part of the creator's share backed by bought credits, credited when the run completes
-- Existing wallets: `paid` = what they topped up, capped at their balance; earlier earnings stay spendable, not claimable.
-- Additive only.
ALTER TABLE `preview_wallets` ADD `paid` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `preview_wallets` ADD `earned_paid` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `runs` ADD `paid_cost` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `runs` ADD `creator_paid` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `preview_wallets` SET `paid` = MAX(0, MIN(`balance`, COALESCE((SELECT SUM(`credits`) FROM `topups` WHERE `topups`.`owner` = `preview_wallets`.`owner`), 0)));
