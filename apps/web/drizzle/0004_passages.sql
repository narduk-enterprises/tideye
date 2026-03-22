-- Passages inferred from vessel track (seed from Influx-derived script)

CREATE TABLE IF NOT EXISTS `passages` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `started_at` text NOT NULL,
  `ended_at` text NOT NULL,
  `start_lat` real NOT NULL,
  `start_lon` real NOT NULL,
  `end_lat` real NOT NULL,
  `end_lon` real NOT NULL,
  `distance_nm` real NOT NULL,
  `position_source` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `passages_started_at_idx` ON `passages` (`started_at` DESC);
