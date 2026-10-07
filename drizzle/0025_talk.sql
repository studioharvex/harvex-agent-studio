-- Talk to an agent (lib/talk.ts). Additive only.
--
-- runs.talk: the id of one conversation between an account and an agent. Every message of the conversation is a
--            normal run that carries the same id (skill 'chat'); NULL for every other run.
ALTER TABLE `runs` ADD `talk` text;
--> statement-breakpoint
CREATE INDEX `runs_talk` ON `runs` (`owner`,`talk`);
