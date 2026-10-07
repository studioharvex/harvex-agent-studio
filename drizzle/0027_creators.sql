-- Verified creators (lib/creators.ts). Additive only.
--
-- creators: an account's claim to an X handle. One row per account.
--   handle       the X handle, lower case, without the @
--   code         the code the creator posts from that handle
--   proof        the link to that post (https://x.com/<handle>/status/<id>), once the creator sent it
--   status       pending (code given) | review (post link sent) | verified | rejected
--   note         what the reviewer told the creator on a rejection
-- A handle is verified for one account only: the partial unique index refuses a second one.
CREATE TABLE `creators` (
	`owner` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`code` text NOT NULL,
	`proof` text,
	`status` text NOT NULL,
	`note` text,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creators_verified_handle` ON `creators` (`handle`) WHERE `status`='verified';
--> statement-breakpoint
CREATE INDEX `creators_status` ON `creators` (`status`,`updated`);
