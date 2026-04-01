package com.chat.chat.Configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class EncuestasEsquemaFix {

    private static final Logger LOGGER = LoggerFactory.getLogger(EncuestasEsquemaFix.class);

    private static final String SQL_CREATE_TABLE_POLL = """
            CREATE TABLE IF NOT EXISTS poll (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              mensaje_id BIGINT NOT NULL UNIQUE,
              chat_id BIGINT NOT NULL,
              question VARCHAR(500) NOT NULL,
              allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
              created_by BIGINT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              activo BOOLEAN NOT NULL DEFAULT TRUE,
              CONSTRAINT fk_poll_mensaje FOREIGN KEY (mensaje_id) REFERENCES mensajes(id) ON DELETE CASCADE,
              CONSTRAINT fk_poll_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
              CONSTRAINT fk_poll_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
              INDEX idx_poll_mensaje (mensaje_id),
              INDEX idx_poll_chat (chat_id),
              INDEX idx_poll_created_by (created_by)
            )
            """;

    private static final String SQL_CREATE_TABLE_POLL_OPTION = """
            CREATE TABLE IF NOT EXISTS poll_option (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              poll_id BIGINT NOT NULL,
              option_key VARCHAR(120) NOT NULL,
              option_text VARCHAR(500) NOT NULL,
              order_index INT NOT NULL,
              vote_count BIGINT NOT NULL DEFAULT 0,
              CONSTRAINT fk_poll_option_poll FOREIGN KEY (poll_id) REFERENCES poll(id) ON DELETE CASCADE,
              UNIQUE KEY uk_poll_option_key (poll_id, option_key),
              INDEX idx_poll_option_poll (poll_id)
            )
            """;

    private static final String SQL_CREATE_TABLE_POLL_VOTE = """
            CREATE TABLE IF NOT EXISTS poll_vote (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              poll_id BIGINT NOT NULL,
              option_id BIGINT NOT NULL,
              user_id BIGINT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_poll_vote_poll FOREIGN KEY (poll_id) REFERENCES poll(id) ON DELETE CASCADE,
              CONSTRAINT fk_poll_vote_option FOREIGN KEY (option_id) REFERENCES poll_option(id) ON DELETE CASCADE,
              CONSTRAINT fk_poll_vote_user FOREIGN KEY (user_id) REFERENCES usuarios(id),
              UNIQUE KEY uk_poll_vote_unique (poll_id, option_id, user_id),
              INDEX idx_poll_vote_poll (poll_id),
              INDEX idx_poll_vote_poll_user (poll_id, user_id),
              INDEX idx_poll_vote_option (option_id)
            )
            """;

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.db.fix-encuestas-on-startup:true}")
    private boolean habilitado;

    public EncuestasEsquemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void asegurarEsquemaEncuestas() {
        if (!habilitado) {
            return;
        }
        try {
            jdbcTemplate.execute(SQL_CREATE_TABLE_POLL);
            jdbcTemplate.execute(SQL_CREATE_TABLE_POLL_OPTION);
            jdbcTemplate.execute(SQL_CREATE_TABLE_POLL_VOTE);
            LOGGER.info("[DB_FIX] esquema de encuestas verificado");
        } catch (Exception ex) {
            LOGGER.warn("[DB_FIX] no se pudo verificar esquema de encuestas: {}", ex.getClass().getSimpleName());
        }
    }
}
