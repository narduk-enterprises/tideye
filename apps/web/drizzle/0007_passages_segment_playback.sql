-- Sub-voyage segmentation (same logical trip, multiple rows) + optional playback telemetry JSON

ALTER TABLE `passages` ADD COLUMN `segment_group_id` text;
ALTER TABLE `passages` ADD COLUMN `segment_index` integer NOT NULL DEFAULT 0;
ALTER TABLE `passages` ADD COLUMN `playback_json` text;
