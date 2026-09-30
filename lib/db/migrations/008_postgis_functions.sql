-- PostGIS and location-based functions

-- Function: Find nearby users
CREATE OR REPLACE FUNCTION nearby_users(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_m INTEGER,
  requester_id UUID,
  limit_count INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  handle TEXT,
  distance_m DOUBLE PRECISION,
  photo_url TEXT,
  intent TEXT
) AS $$
  SELECT
    u.id,
    u.handle,
    ST_Distance(l.public_geo, ST_Point(user_lon, user_lat)::geography) AS distance_m,
    NULL::TEXT AS photo_url, -- TODO: fetch latest photo
    s.intent::TEXT
  FROM locations l
  JOIN users u ON u.id = l.user_id
  LEFT JOIN statuses s ON s.user_id = u.id
  WHERE
    ST_DWithin(l.public_geo, ST_Point(user_lon, user_lat)::geography, radius_m)
    AND u.id != requester_id
    AND u.deleted_at IS NULL
    AND u.verified_at IS NOT NULL
    AND (u.mod_step IS NULL OR u.mod_step NOT IN ('suspended', 'removed'))
    AND u.visibility != 'hidden'
    -- Exclude mutual blocks
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = requester_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = requester_id)
    )
  ORDER BY distance_m ASC
  LIMIT limit_count
$$ LANGUAGE SQL STABLE;

-- Function: Find hotspots (clustered users)
CREATE OR REPLACE FUNCTION nearby_hotspots(
  center_lat DOUBLE PRECISION,
  center_lon DOUBLE PRECISION,
  radius_m INTEGER DEFAULT 25000
)
RETURNS TABLE (
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  count BIGINT
) AS $$
  SELECT
    AVG(ST_Y(l.public_geo::geometry)) AS lat,
    AVG(ST_X(l.public_geo::geometry)) AS lon,
    COUNT(*) AS count
  FROM locations l
  JOIN users u ON u.id = l.user_id
  WHERE
    ST_DWithin(l.public_geo, ST_Point(center_lon, center_lat)::geography, radius_m)
    AND u.deleted_at IS NULL
    AND u.verified_at IS NOT NULL
    AND u.visibility != 'hidden'
  GROUP BY ST_ClusterKMeans(l.public_geo, 10) OVER ()
  HAVING COUNT(*) >= 3
  ORDER BY count DESC
$$ LANGUAGE SQL STABLE;

-- Index for location queries
CREATE INDEX IF NOT EXISTS idx_locations_geo ON locations USING GIST (public_geo);

-- Index for faster location lookups by user
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations (user_id);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_statuses_ends_at ON statuses (ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON statuses (user_id);

-- Trigger: Auto-expire statuses
CREATE OR REPLACE FUNCTION expire_old_statuses()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM statuses WHERE ends_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_statuses
AFTER INSERT ON statuses
FOR EACH ROW
EXECUTE FUNCTION expire_old_statuses();

-- Trigger: Auto-expire checkins
CREATE OR REPLACE FUNCTION expire_old_checkins()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM checkins WHERE expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_checkins
AFTER INSERT ON checkins
FOR EACH ROW
EXECUTE FUNCTION expire_old_checkins();

-- Trigger: Soft-delete locations after 24h
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS void AS $$
BEGIN
  DELETE FROM locations
  WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND user_id NOT IN (
      -- Keep if user has active status or checkin
      SELECT user_id FROM statuses WHERE ends_at > NOW()
      UNION
      SELECT user_id FROM checkins WHERE expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql;
