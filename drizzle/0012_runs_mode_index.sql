-- Live AI daily ceiling (AI_DAILY_RUNS, lib/runs.ts) counts live runs of the current UTC day across all accounts.
-- This index keeps that count cheap. Additive only.
CREATE INDEX `runs_mode_created` ON `runs` (`mode`,`created`);
