ALTER TABLE chat_user_state
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP NULL;

CREATE INDEX idx_chat_user_state_user_activo
  ON chat_user_state (user_id, activo);

UPDATE chat_user_state
SET activo = TRUE
WHERE activo IS NULL;

INSERT INTO chat_user_state (
  chat_id,
  user_id,
  cleared_before_message_id,
  cleared_at,
  muted_until,
  muted_forever,
  activo,
  hidden_at,
  created_at,
  updated_at
)
SELECT DISTINCT
  ci.id,
  ci.usuario1_id,
  NULL,
  NULL,
  NULL,
  FALSE,
  TRUE,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM chats_individuales ci
LEFT JOIN chat_user_state s
  ON s.chat_id = ci.id AND s.user_id = ci.usuario1_id
WHERE ci.usuario1_id IS NOT NULL
  AND s.id IS NULL;

INSERT INTO chat_user_state (
  chat_id,
  user_id,
  cleared_before_message_id,
  cleared_at,
  muted_until,
  muted_forever,
  activo,
  hidden_at,
  created_at,
  updated_at
)
SELECT DISTINCT
  ci.id,
  ci.usuario2_id,
  NULL,
  NULL,
  NULL,
  FALSE,
  TRUE,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM chats_individuales ci
LEFT JOIN chat_user_state s
  ON s.chat_id = ci.id AND s.user_id = ci.usuario2_id
WHERE ci.usuario2_id IS NOT NULL
  AND s.id IS NULL;

INSERT INTO chat_user_state (
  chat_id,
  user_id,
  cleared_before_message_id,
  cleared_at,
  muted_until,
  muted_forever,
  activo,
  hidden_at,
  created_at,
  updated_at
)
SELECT DISTINCT
  cgu.chat_id,
  cgu.usuario_id,
  NULL,
  NULL,
  NULL,
  FALSE,
  TRUE,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM chat_grupal_usuarios cgu
LEFT JOIN chat_user_state s
  ON s.chat_id = cgu.chat_id AND s.user_id = cgu.usuario_id
WHERE cgu.chat_id IS NOT NULL
  AND cgu.usuario_id IS NOT NULL
  AND s.id IS NULL;
