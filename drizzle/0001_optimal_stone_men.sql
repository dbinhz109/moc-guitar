CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`ext` text NOT NULL,
	`size` integer NOT NULL,
	`content_hash` text NOT NULL,
	`storage_key` text NOT NULL,
	`practice` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_user_client_unique` ON `documents` (`user_id`,`client_id`);