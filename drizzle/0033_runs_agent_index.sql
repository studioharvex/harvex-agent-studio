-- The weekly board (lib/board.ts) counts the runs of each published agent in a span of days, and an agent's page
-- reads its last fifty runs (lib/market.ts): both look runs up by agent. Additive only: an index, no data changes.
CREATE INDEX IF NOT EXISTS `runs_agent_created` ON `runs` (`agent_id`,`created`);
