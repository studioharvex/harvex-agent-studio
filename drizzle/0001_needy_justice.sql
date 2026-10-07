CREATE TABLE `live_quotas` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_attempt_limit" CHECK("live_quotas"."attempts" <= 10)
);
