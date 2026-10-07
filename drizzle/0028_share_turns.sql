-- Shared conversations (lib/share.ts). Additive only.
--
-- run_shares.turns: for a shared chat message (runs.talk), how many earlier turns of the same conversation the public
--                   page shows above it (0 to 5). 0 for every other shared answer.
ALTER TABLE `run_shares` ADD `turns` integer DEFAULT 0 NOT NULL;
