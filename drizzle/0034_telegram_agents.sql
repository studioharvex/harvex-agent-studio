-- A published agent in any Telegram chat (lib/notify.ts). Additive only.
--
-- Until now the agent that answers in a linked Telegram chat had to be one of the channel owner's own agents, with one
-- of its skills. Now it can also answer in its own voice (chat_skill 'chat': a conversation, lib/talk.ts), and it can
-- be an agent someone else published: each answer is then a chat message to that agent, paid by the account that
-- linked the chat, and its creator earns their price per message.
--   chat_price   the creator's price per message that the owner saw and accepted when setting it up (NULL for the
--                owner's own agents). A message is only sent while the agent still costs this; otherwise the chat
--                says the price changed and nothing is charged until the owner confirms.
--   chat_thread  the conversation of this chat with this agent, so the agent has the last turns as context.
ALTER TABLE `notify_channels` ADD `chat_price` integer;
--> statement-breakpoint
ALTER TABLE `notify_channels` ADD `chat_thread` text;
