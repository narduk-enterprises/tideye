-- One-time Apple reverse-geocode labels at seed time (avoid per-request geocoding)

ALTER TABLE `passages` ADD `start_place_label` text;
ALTER TABLE `passages` ADD `end_place_label` text;
