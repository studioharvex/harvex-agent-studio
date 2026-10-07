-- Daily live AI limits (lib/runs.ts), replacing live_quotas (fixed at 10 by its CHECK; kept, no longer written).
-- Keys: 'u:<owner>:<YYYY-MM-DD>' = manual live runs of one account (LIVE_DAILY_PER_USER),
--       'all:<YYYY-MM-DD>'       = every live run of the whole studio, schedules included (AI_DAILY_RUNS).
-- The counters are raised in the same D1 batch as the run and the debit; at the limit the update writes -1, the CHECK
-- fails and the whole batch rolls back, so parallel requests can never pass a limit. A failed run gives its count back.
-- Additive only.
CREATE TABLE `ai_quotas` (
	`key` text PRIMARY KEY NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_quota_limit" CHECK("ai_quotas"."used" >= 0)
);
