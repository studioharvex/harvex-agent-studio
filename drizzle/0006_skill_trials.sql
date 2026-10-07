-- Skill trials (client request 30 Sep 2026): every skill is open, each user may try each skill a limited number
-- of times (SKILL_TRIAL_LIMIT, default 2). The counter is raised in the same batch as the run; when the limit is
-- reached the update writes -1, the CHECK fails and the whole batch (run, debit, ledger) rolls back.
CREATE TABLE `skill_trials` (
	`owner` text NOT NULL,
	`skill` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `skill`),
	CONSTRAINT "trial_limit" CHECK("skill_trials"."used" >= 0)
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `skill` text;
