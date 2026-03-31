CREATE TABLE IF NOT EXISTS user_pinned_chat (
  user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  pinned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_pinned_chat_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_pinned_chat_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_pinned_chat_chat ON user_pinned_chat (chat_id);
CREATE INDEX idx_user_pinned_chat_pinned_at ON user_pinned_chat (pinned_at);
