-- Referral boost of the holder reward (lib/boost.ts). Additive only.
--
-- reward_allocations.boost: the percentage that allocation was paid at. NULL or 100: no boost; 120: the inviter had
--   two invited friends holding a full reward unit through that period (1.2x). `usd` and `amount` already include it.
ALTER TABLE `reward_allocations` ADD `boost` integer;
