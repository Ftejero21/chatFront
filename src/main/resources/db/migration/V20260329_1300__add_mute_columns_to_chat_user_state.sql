ALTER TABLE chat_user_state
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS muted_forever BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_chat_user_state_mute_active
  ON chat_user_state (user_id, muted_forever, muted_until);
