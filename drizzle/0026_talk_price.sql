-- A chat price of its own per published agent (lib/talk.ts). Additive only.
--
-- agents.talk_price: what the creator charges for one chat message, apart from the price of a task run (`price`).
--                    NULL = the creator never set one, and the task price applies to a message too.
ALTER TABLE `agents` ADD `talk_price` integer;
