CREATE OR REPLACE VIEW v_satellite_latest_tle AS
SELECT s.norad_id, s.name, s.owner_country, s.constellation,
       t.epoch, t.line1, t.line2
FROM satellite s
JOIN LATERAL (
  SELECT t1.epoch, t1.line1, t1.line2
  FROM tle t1
  WHERE t1.norad_id = s.norad_id
  ORDER BY t1.epoch DESC
  LIMIT 1
) t ON true;



