-- Agent knowledge: sources a creator pasted for an agent to answer from (lib/knowledge.ts). Additive only.
--
-- knowledge_sources: one pasted source of an agent (notes, an FAQ, an old thread): its title, kind and size.
-- knowledge_chunks:  the passages a source was cut into; the ones that bear on a question go to the AI with it.
-- agents.kb_rev:     goes up each time the agent's sources change. It is part of the mark the agent check stores
--                    (lib/agents.ts configMark), so an agent stops counting as checked when what it knows changed.
CREATE TABLE `knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`chars` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_sources_agent` ON `knowledge_sources` (`agent_id`);
--> statement-breakpoint
CREATE TABLE `knowledge_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`n` integer NOT NULL,
	`text` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_chunks_agent` ON `knowledge_chunks` (`agent_id`);
--> statement-breakpoint
ALTER TABLE `agents` ADD `kb_rev` integer DEFAULT 0 NOT NULL;
