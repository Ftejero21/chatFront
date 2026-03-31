CREATE TABLE IF NOT EXISTS chat_user_state (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  cleared_before_message_id BIGINT NULL,
  cleared_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uk_chat_user_state_chat_user UNIQUE (chat_id, user_id),
  CONSTRAINT fk_chat_user_state_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_user_state_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_user_state_user_chat ON chat_user_state (user_id, chat_id);
CREATE INDEX idx_chat_user_state_chat_user ON chat_user_state (chat_id, user_id);
CREATE INDEX idx_chat_user_state_cutoff ON chat_user_state (chat_id, user_id, cleared_before_message_id);
