-- Referrals (lib/referrals.ts). Additive only.
--
-- referral_codes:   the invite code of an account (made the first time its owner opens the invite card).
-- referrals:        who invited an account. One row per invited account, written once, before its first run.
-- referral_rewards: the reward of one invitation, paid once when the invited account completed a run. The primary
--                   key (the invited account) is the lock: a second payment fails the whole batch.
--   referral_rewards.referrer_credits  0 when the inviter had already reached the limit of rewarded invitations
CREATE TABLE `referral_codes` (
	`owner` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_code` ON `referral_codes` (`code`);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`referee` text PRIMARY KEY NOT NULL,
	`referrer` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `referrals_referrer` ON `referrals` (`referrer`);
--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`referee` text PRIMARY KEY NOT NULL,
	`referrer` text NOT NULL,
	`referrer_credits` integer NOT NULL,
	`referee_credits` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `referral_rewards_referrer` ON `referral_rewards` (`referrer`);
