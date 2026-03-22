-- Optional GeoJSON (FeatureCollection or LineString JSON) for map polylines
ALTER TABLE `passages` ADD COLUMN `track_geojson` text;
