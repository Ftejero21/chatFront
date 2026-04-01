package com.chat.chat.Configuracion;

import com.chat.chat.Utils.Constantes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class MensajesTipoSchemaFix {
    private static final Logger LOGGER = LoggerFactory.getLogger(MensajesTipoSchemaFix.class);

    private final JdbcTemplate jdbcTemplate;

    @Value(Constantes.PROP_DB_FIX_MENSAJES_TIPO)
    private boolean enabled;

    public MensajesTipoSchemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureTipoColumnSupportsSystem() {
        if (!enabled) {
            return;
        }

        try {
            String columnType = jdbcTemplate.queryForObject(
                    Constantes.SQL_INFO_SCHEMA_COLUMN_TYPE_MENSAJES_TIPO,
                    String.class
            );

            if (columnType == null || columnType.isBlank()) {
                return;
            }

            String normalized = columnType.toUpperCase(Locale.ROOT);
            boolean missingSystem = !normalized.contains("'SYSTEM'");
            boolean missingImage = !normalized.contains("'IMAGE'");
            boolean missingVideo = !normalized.contains("'VIDEO'");
            boolean missingFile = !normalized.contains("'FILE'");
            boolean missingPoll = !normalized.contains("'POLL'");
            if (normalized.startsWith("ENUM(") && (missingSystem || missingImage || missingVideo || missingFile || missingPoll)) {
                jdbcTemplate.execute(Constantes.SQL_ALTER_MENSAJES_TIPO_MULTIMEDIA);
                LOGGER.info(Constantes.LOG_DB_FIX_TIPO_MULTIMEDIA);
            }

            ensureMediaIndex();
        } catch (Exception ex) {
            LOGGER.warn(Constantes.LOG_DB_FIX_TIPO_WARN, ex.getClass().getSimpleName());
        }
    }

    private void ensureMediaIndex() {
        Integer count = jdbcTemplate.queryForObject(
                Constantes.SQL_INFO_SCHEMA_INDEX_COUNT,
                Integer.class,
                Constantes.IDX_MENSAJES_MEDIA_FEED
        );
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(Constantes.SQL_CREATE_INDEX_MENSAJES_MEDIA_FEED + Constantes.IDX_MENSAJES_MEDIA_FEED + Constantes.SQL_CREATE_INDEX_MENSAJES_MEDIA_FEED_SUFFIX);
        LOGGER.info(Constantes.LOG_DB_FIX_INDEX_CREATED, Constantes.IDX_MENSAJES_MEDIA_FEED);
    }
}
