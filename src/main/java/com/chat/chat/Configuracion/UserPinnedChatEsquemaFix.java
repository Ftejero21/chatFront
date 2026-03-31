package com.chat.chat.Configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserPinnedChatEsquemaFix {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserPinnedChatEsquemaFix.class);

    private static final String SQL_CREATE_TABLE_USER_PINNED_CHAT = """
            CREATE TABLE IF NOT EXISTS user_pinned_chat (
              user_id BIGINT NOT NULL,
              chat_id BIGINT NOT NULL,
              pinned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (user_id),
              CONSTRAINT fk_user_pinned_chat_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
              CONSTRAINT fk_user_pinned_chat_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
              INDEX idx_user_pinned_chat_chat (chat_id),
              INDEX idx_user_pinned_chat_pinned_at (pinned_at)
            )
            """;

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.db.fix-user-pinned-chat-on-startup:true}")
    private boolean habilitado;

    public UserPinnedChatEsquemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void asegurarEsquemaUserPinnedChat() {
        if (!habilitado) {
            return;
        }
        try {
            jdbcTemplate.execute(SQL_CREATE_TABLE_USER_PINNED_CHAT);
            LOGGER.info("[DB_FIX] esquema de user_pinned_chat verificado");
        } catch (Exception ex) {
            LOGGER.warn("[DB_FIX] no se pudo verificar esquema de user_pinned_chat: {}", ex.getClass().getSimpleName());
        }
    }
}
