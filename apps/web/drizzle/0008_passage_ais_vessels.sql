-- Historical AIS / other-vessel tracks exported from Influx during passage seed (batch only).

CREATE TABLE `passage_ais_vessels` (
  `passage_id` text NOT NULL,
  `mmsi` text NOT NULL,
  `profile_json` text NOT NULL,
  `samples_json` text NOT NULL,
  PRIMARY KEY (`passage_id`, `mmsi`)
);

CREATE INDEX `passage_ais_vessels_passage_id_idx` ON `passage_ais_vessels` (`passage_id`);
