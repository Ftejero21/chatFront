CREATE TABLE IF NOT EXISTS chat_pinned_message (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  pinned_by_user_id BIGINT NOT NULL,
  pinned_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  unpinned_at TIMESTAMP NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uk_chat_pinned_message_chat UNIQUE (chat_id),
  CONSTRAINT fk_chat_pinned_message_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_pinned_message_message FOREIGN KEY (message_id) REFERENCES mensajes(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_pinned_message_sender FOREIGN KEY (sender_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_pinned_message_pinner FOREIGN KEY (pinned_by_user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_pinned_message_chat_id ON chat_pinned_message (chat_id);
CREATE INDEX idx_chat_pinned_message_expires_at ON chat_pinned_message (expires_at);
