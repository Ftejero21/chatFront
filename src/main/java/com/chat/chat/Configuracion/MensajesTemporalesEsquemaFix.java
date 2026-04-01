package com.chat.chat.Configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MensajesTemporalesEsquemaFix {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajesTemporalesEsquemaFix.class);

    private static final String SQL_COLUMN_EXISTS = "SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mensajes' AND COLUMN_NAME = ?";
    private static final String SQL_INDEX_EXISTS = "SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mensajes' AND INDEX_NAME = ?";
    private static final String SQL_ADD_MENSAJE_TEMPORAL = "ALTER TABLE mensajes ADD COLUMN mensaje_temporal BOOLEAN NOT NULL DEFAULT FALSE";
    private static final String SQL_ENFORCE_MENSAJE_TEMPORAL = "ALTER TABLE mensajes MODIFY COLUMN mensaje_temporal BOOLEAN NOT NULL DEFAULT FALSE";
    private static final String SQL_ADD_MENSAJE_TEMPORAL_SEGUNDOS = "ALTER TABLE mensajes ADD COLUMN mensaje_temporal_segundos BIGINT NULL";
    private static final String SQL_ADD_EXPIRA_EN = "ALTER TABLE mensajes ADD COLUMN expira_en TIMESTAMP NULL";
    private static final String SQL_ADD_MOTIVO_ELIMINACION = "ALTER TABLE mensajes ADD COLUMN motivo_eliminacion VARCHAR(80) NULL";
    private static final String SQL_ADD_PLACEHOLDER_TEXTO = "ALTER TABLE mensajes ADD COLUMN placeholder_texto VARCHAR(500) NULL";
    private static final String SQL_ADD_INDEX_TEMPORAL = "CREATE INDEX idx_mensajes_temporal_expira_en ON mensajes (mensaje_temporal, expira_en)";
    private static final String SQL_CREATE_TABLE_AUDITORIA = "CREATE TABLE IF NOT EXISTS mensajes_temporales_auditoria (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
            "mensaje_id BIGINT NOT NULL UNIQUE," +
            "chat_id BIGINT NULL," +
            "contenido_original TEXT NULL," +
            "tipo_original VARCHAR(30) NULL," +
            "media_url_original VARCHAR(255) NULL," +
            "audio_url_original VARCHAR(255) NULL," +
            "image_url_original VARCHAR(255) NULL," +
            "file_url_original VARCHAR(255) NULL," +
            "media_mime_original VARCHAR(255) NULL," +
            "media_duracion_ms_original INT NULL," +
            "reenviado BOOLEAN NOT NULL DEFAULT FALSE," +
            "mensaje_original_id BIGINT NULL," +
            "reply_to_message_id BIGINT NULL," +
            "reply_snippet VARCHAR(255) NULL," +
            "reply_author_name VARCHAR(120) NULL," +
            "fecha_envio_original TIMESTAMP NULL," +
            "expira_en_original TIMESTAMP NULL," +
            "estado_temporal_original VARCHAR(20) NULL," +
            "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" +
            ")";

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.db.fix-mensajes-temporales-on-startup:true}")
    private boolean habilitado;

    public MensajesTemporalesEsquemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void asegurarEsquemaMensajesTemporales() {
        if (!habilitado) {
            return;
        }

        try {
            agregarColumnaSiNoExiste("mensaje_temporal", SQL_ADD_MENSAJE_TEMPORAL);
            jdbcTemplate.execute(SQL_ENFORCE_MENSAJE_TEMPORAL);
            agregarColumnaSiNoExiste("mensaje_temporal_segundos", SQL_ADD_MENSAJE_TEMPORAL_SEGUNDOS);
            agregarColumnaSiNoExiste("expira_en", SQL_ADD_EXPIRA_EN);
            agregarColumnaSiNoExiste("motivo_eliminacion", SQL_ADD_MOTIVO_ELIMINACION);
            agregarColumnaSiNoExiste("placeholder_texto", SQL_ADD_PLACEHOLDER_TEXTO);
            agregarIndiceSiNoExiste("idx_mensajes_temporal_expira_en", SQL_ADD_INDEX_TEMPORAL);
            jdbcTemplate.execute(SQL_CREATE_TABLE_AUDITORIA);
        } catch (Exception ex) {
            LOGGER.warn("[DB_FIX] no se pudo asegurar esquema de mensajes temporales: {}", ex.getClass().getSimpleName());
        }
    }

    private void agregarColumnaSiNoExiste(String columna, String sqlAdd) {
        Integer count = jdbcTemplate.queryForObject(SQL_COLUMN_EXISTS, Integer.class, columna);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(sqlAdd);
        LOGGER.info("[DB_FIX] columna {} creada en tabla mensajes", columna);
    }

    private void agregarIndiceSiNoExiste(String indice, String sqlAdd) {
        Integer count = jdbcTemplate.queryForObject(SQL_INDEX_EXISTS, Integer.class, indice);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(sqlAdd);
        LOGGER.info("[DB_FIX] indice {} creado para mensajes temporales", indice);
    }
}
