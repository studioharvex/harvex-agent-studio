-- Daily free-credit refill and the 5-hour window for heavy skills (client, 1 Oct 2026; lib/economy.ts, lib/runs.ts).
--   preview_wallets.refilled  ISO time of the last free-credit refill. Every FREE_REFILL_HOURS (24) the FREE part of the
--                             balance (balance - paid) is topped back up to FREE_REFILL_CREDITS (25); bought credits are
--                             never touched and the free part never grows past the refill amount.
-- The heavy-skill window reuses ai_quotas (drizzle/0013) with keys 'h:<owner>:<window start ms>', so it is as atomic as
-- the daily limits and a failed run gives its count back. Additive only.
ALTER TABLE `preview_wallets` ADD `refilled` text;
