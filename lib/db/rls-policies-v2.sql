-- πroka Row-Level Security Policies v2
-- Enforces data access control at the database level
-- Matches the actual 001_schema.sql structure

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_flags ENABLE ROW LEVEL SECURITY;

-- Users table
-- Everyone can read public fields of verified users
CREATE POLICY "Users can read public profiles"
  ON users FOR SELECT
  USING (
    auth.uid() = id
    OR (verified_at IS NOT NULL AND (mod_step IS NULL OR mod_step NOT IN ('suspended', 'removed')))
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Photos table
CREATE POLICY "Users can read photos from visible profiles"
  ON photos FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = photos.user_id
        AND u.verified_at IS NOT NULL
        AND (u.mod_step IS NULL OR u.mod_step NOT IN ('suspended', 'removed'))
    )
  );

CREATE POLICY "Users can upload own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own photos"
  ON photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos"
  ON photos FOR DELETE
  USING (auth.uid() = user_id);

-- Locations table - private, user only
CREATE POLICY "Users can read own location"
  ON locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save own location"
  ON locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own location"
  ON locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversations table
CREATE POLICY "Users can read own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = a_id OR auth.uid() = b_id);

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = a_id);

-- Messages table
CREATE POLICY "Users can read messages in their conversations"
  ON dm_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = dm_messages.conversation_id
        AND (c.a_id = auth.uid() OR c.b_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages"
  ON dm_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.a_id = auth.uid() OR c.b_id = auth.uid())
    )
  );

-- Health cards - owner only
CREATE POLICY "Users can read own health cards"
  ON health_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own health cards"
  ON health_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health cards"
  ON health_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Checkins - user only
CREATE POLICY "Users can read own checkins"
  ON checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create checkins"
  ON checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins"
  ON checkins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own checkins"
  ON checkins FOR DELETE
  USING (auth.uid() = user_id);

-- RSVPs - user only
CREATE POLICY "Users can read own RSVPs"
  ON rsvps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create RSVPs"
  ON rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs"
  ON rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- Audit log
CREATE POLICY "Users can read own audit logs"
  ON audit_log FOR SELECT
  USING (
    auth.uid() = actor_id
    OR auth.uid() = target_user_id
  );

CREATE POLICY "Audit logs are server-only insert"
  ON audit_log FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON audit_log FOR DELETE
  USING (false);

-- Trust signals
CREATE POLICY "Users can read own trust signals"
  ON trust_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own trust signals"
  ON trust_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Album grants - owner and grantee can see
CREATE POLICY "Users can read own album grants"
  ON album_grants FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = grantee_id);

CREATE POLICY "Users can create album grants"
  ON album_grants FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Statuses - user only
CREATE POLICY "Users can read own status"
  ON statuses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own status"
  ON statuses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status"
  ON statuses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Blocks - user who blocked or got blocked
CREATE POLICY "Users can read own blocks"
  ON blocks FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Users can create blocks"
  ON blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Reports - reporter or target
CREATE POLICY "Users can read own reports"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id OR auth.uid() = target_id);

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Notifications - user only
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Favorites - user only
CREATE POLICY "Users can read own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Taste flags - user only
CREATE POLICY "Users can read own taste flags"
  ON taste_flags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own taste flags"
  ON taste_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own taste flags"
  ON taste_flags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
