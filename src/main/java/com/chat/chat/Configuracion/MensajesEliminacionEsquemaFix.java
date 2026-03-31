package com.chat.chat.Configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migra historial legacy de borrado logico:
 * - asegura la columna fecha_eliminacion
 * - completa fecha_eliminacion para mensajes historicos con activo=false
 *   usando COALESCE(updated_at, fecha_envio, UTC_TIMESTAMP()) cuando existe updated_at.
 */
@Component
public class MensajesEliminacionEsquemaFix {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajesEliminacionEsquemaFix.class);

    private static final String SQL_COLUMN_EXISTS = "SELECT COUNT(1) FROM information_schema.COLUMNS " +
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mensajes' AND COLUMN_NAME = ?";
    private static final String SQL_ADD_FECHA_ELIMINACION =
            "ALTER TABLE mensajes ADD COLUMN fecha_eliminacion TIMESTAMP NULL";

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.db.fix-mensajes-eliminacion-on-startup:true}")
    private boolean habilitado;

    public MensajesEliminacionEsquemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void asegurarEsquemaYBackfill() {
        if (!habilitado) {
            return;
        }

        try {
            agregarColumnaSiNoExiste("fecha_eliminacion", SQL_ADD_FECHA_ELIMINACION);
            int actualizados = ejecutarBackfillLegacy();
            if (actualizados > 0) {
                LOGGER.info("[DB_FIX] backfill fecha_eliminacion aplicado a {} mensajes legacy", actualizados);
            }
        } catch (Exception ex) {
            LOGGER.warn("[DB_FIX] no se pudo asegurar/backfillear fecha_eliminacion: {}", ex.getClass().getSimpleName());
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

    private int ejecutarBackfillLegacy() {
        boolean hasUpdatedAt = columnaExiste("updated_at");
        String expression = hasUpdatedAt
                ? "COALESCE(updated_at, fecha_envio, UTC_TIMESTAMP())"
                : "COALESCE(fecha_envio, UTC_TIMESTAMP())";
        String sql = "UPDATE mensajes SET fecha_eliminacion = " + expression +
                " WHERE activo = false AND fecha_eliminacion IS NULL";
        return jdbcTemplate.update(sql);
    }

    private boolean columnaExiste(String columna) {
        Integer count = jdbcTemplate.queryForObject(SQL_COLUMN_EXISTS, Integer.class, columna);
        return count != null && count > 0;
    }
}
