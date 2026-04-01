package com.chat.chat.Configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MensajesProgramadosEsquemaFix {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajesProgramadosEsquemaFix.class);

    private static final String SQL_CREATE_TABLE_SCHEDULED = """
            CREATE TABLE IF NOT EXISTS chat_scheduled_message (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              created_by BIGINT NOT NULL,
              chat_id BIGINT NOT NULL,
              message_content TEXT NOT NULL,
              scheduled_at TIMESTAMP NOT NULL,
              status VARCHAR(20) NOT NULL,
              attempts INT NOT NULL DEFAULT 0,
              last_error VARCHAR(1000) NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              sent_at TIMESTAMP NULL,
              lock_token VARCHAR(80) NULL,
              lock_until TIMESTAMP NULL,
              scheduled_batch_id VARCHAR(64) NULL,
              ws_emitted BOOLEAN NOT NULL DEFAULT FALSE,
              ws_emitted_at TIMESTAMP NULL,
              ws_destinations VARCHAR(1000) NULL,
              ws_emit_error VARCHAR(1000) NULL,
              persisted_message_id BIGINT NULL,
              CONSTRAINT fk_sched_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
              CONSTRAINT fk_sched_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
              INDEX idx_sched_status_scheduled_at (status, scheduled_at),
              INDEX idx_sched_created_by (created_by),
              INDEX idx_sched_lock_until (lock_until),
              INDEX idx_sched_batch (scheduled_batch_id)
            )
            """;
    private static final String SQL_COLUMN_EXISTS = "SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_scheduled_message' AND COLUMN_NAME = ?";
    private static final String SQL_ADD_WS_EMITTED = "ALTER TABLE chat_scheduled_message ADD COLUMN ws_emitted BOOLEAN NOT NULL DEFAULT FALSE";
    private static final String SQL_ADD_WS_EMITTED_AT = "ALTER TABLE chat_scheduled_message ADD COLUMN ws_emitted_at TIMESTAMP NULL";
    private static final String SQL_ADD_WS_DESTINATIONS = "ALTER TABLE chat_scheduled_message ADD COLUMN ws_destinations VARCHAR(1000) NULL";
    private static final String SQL_ADD_WS_EMIT_ERROR = "ALTER TABLE chat_scheduled_message ADD COLUMN ws_emit_error VARCHAR(1000) NULL";
    private static final String SQL_ADD_PERSISTED_MESSAGE_ID = "ALTER TABLE chat_scheduled_message ADD COLUMN persisted_message_id BIGINT NULL";

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.db.fix-mensajes-programados-on-startup:true}")
    private boolean habilitado;

    public MensajesProgramadosEsquemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void asegurarEsquemaMensajesProgramados() {
        if (!habilitado) {
            return;
        }
        try {
            jdbcTemplate.execute(SQL_CREATE_TABLE_SCHEDULED);
            agregarColumnaSiNoExiste("ws_emitted", SQL_ADD_WS_EMITTED);
            agregarColumnaSiNoExiste("ws_emitted_at", SQL_ADD_WS_EMITTED_AT);
            agregarColumnaSiNoExiste("ws_destinations", SQL_ADD_WS_DESTINATIONS);
            agregarColumnaSiNoExiste("ws_emit_error", SQL_ADD_WS_EMIT_ERROR);
            agregarColumnaSiNoExiste("persisted_message_id", SQL_ADD_PERSISTED_MESSAGE_ID);
            LOGGER.info("[DB_FIX] esquema de mensajes programados verificado");
        } catch (Exception ex) {
            LOGGER.warn("[DB_FIX] no se pudo asegurar esquema de mensajes programados: {}", ex.getClass().getSimpleName());
        }
    }

    private void agregarColumnaSiNoExiste(String columna, String sqlAdd) {
        Integer count = jdbcTemplate.queryForObject(SQL_COLUMN_EXISTS, Integer.class, columna);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(sqlAdd);
        LOGGER.info("[DB_FIX] columna {} creada en chat_scheduled_message", columna);
    }
}
