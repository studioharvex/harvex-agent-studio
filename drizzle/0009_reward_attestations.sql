-- A reward token may not be allowed to go to US persons or to restricted and sanctioned jurisdictions. Before the dashboard serves a
-- claim proof, the account confirms it is eligible (self-certification, stored with the wording version and time).
CREATE TABLE `reward_attestations` (
	`owner` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`country` text NOT NULL,
	`created` text NOT NULL
);
