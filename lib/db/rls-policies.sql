-- πroka Row-Level Security Policies
-- Enforces data access control at the database level

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users table
-- Everyone can read public fields of verified users
CREATE POLICY "Users can read public profiles"
  ON users FOR SELECT
  USING (
    -- Own profile (always readable)
    auth.uid() = id
    -- OR public profile (verified + not banned)
    OR (verified_at IS NOT NULL AND mod_step NOT IN ('suspend', 'remove'))
  );

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Photos table
-- Users can read photos from profiles they can see
CREATE POLICY "Users can read photos from visible profiles"
  ON photos FOR SELECT
  USING (
    -- Own photos (always readable)
    auth.uid() = user_id
    -- OR photos from users they can see
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = photos.user_id
        AND u.verified_at IS NOT NULL
        AND u.mod_step NOT IN ('suspend', 'remove')
    )
  );

-- Users can insert their own photos
CREATE POLICY "Users can upload own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update own photos"
  ON photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Locations table
-- Users can only see their own true location
-- Public location visible to others
CREATE POLICY "Users can read own location"
  ON locations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert own location
CREATE POLICY "Users can save own location"
  ON locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own location
CREATE POLICY "Users can update own location"
  ON locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversations table
-- Users can only read conversations they're part of
CREATE POLICY "Users can read own conversations"
  ON conversations FOR SELECT
  USING (
    auth.uid() = user_id_a OR auth.uid() = user_id_b
  );

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id_a);

-- Messages table
-- Users can read messages from conversations they're in
CREATE POLICY "Users can read messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_id_a = auth.uid() OR c.user_id_b = auth.uid())
    )
  );

-- Users can insert messages to their conversations
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.user_id_a = auth.uid() OR c.user_id_b = auth.uid())
    )
  );

-- Health cards table
-- Users can only read their own health cards
-- Trusted contacts can see if user allows
CREATE POLICY "Users can read own health cards"
  ON health_cards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert/update own health cards
CREATE POLICY "Users can manage own health cards"
  ON health_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health cards"
  ON health_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Place checkins table
-- Users can only read/write their own checkins
CREATE POLICY "Users can read own checkins"
  ON place_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create checkins"
  ON place_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins"
  ON place_checkins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own checkins"
  ON place_checkins FOR DELETE
  USING (auth.uid() = user_id);

-- Event RSVPs table
-- Users can only manage their own RSVPs
CREATE POLICY "Users can read own RSVPs"
  ON event_rsvps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create RSVPs"
  ON event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs"
  ON event_rsvps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit log table
-- Users can only read logs about themselves
-- Admins can read all logs
CREATE POLICY "Users can read own audit logs"
  ON audit_log FOR SELECT
  USING (
    -- Own actions
    auth.uid() = moderator_id
    -- OR actions taken against them
    OR auth.uid() = target_user_id
    -- OR they're an admin (has admin role - would need separate table)
  );

-- Only app can insert audit logs (no client insert)
CREATE POLICY "Audit logs are server-only"
  ON audit_log FOR INSERT
  WITH CHECK (false);

-- Prevent all deletes on audit log
CREATE POLICY "Audit logs cannot be deleted"
  ON audit_log FOR DELETE
  USING (false);
