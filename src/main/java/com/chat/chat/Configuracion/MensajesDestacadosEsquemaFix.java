package com.chat.chat.Configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MensajesDestacadosEsquemaFix {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajesDestacadosEsquemaFix.class);

    private static final String SQL_CREATE_TABLE_MENSAJE_DESTACADO = """
            CREATE TABLE IF NOT EXISTS mensaje_destacado (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              usuario_id BIGINT NOT NULL,
              mensaje_id BIGINT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_mensaje_destacado_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
              CONSTRAINT fk_mensaje_destacado_mensaje FOREIGN KEY (mensaje_id) REFERENCES mensajes(id) ON DELETE CASCADE,
              UNIQUE KEY uk_mensaje_destacado_usuario_mensaje (usuario_id, mensaje_id),
              INDEX idx_mensaje_destacado_usuario (usuario_id),
              INDEX idx_mensaje_destacado_mensaje (mensaje_id)
            )
            """;

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.db.fix-mensajes-destacados-on-startup:true}")
    private boolean habilitado;

    public MensajesDestacadosEsquemaFix(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void asegurarEsquemaMensajesDestacados() {
        if (!habilitado) {
            return;
        }
        try {
            jdbcTemplate.execute(SQL_CREATE_TABLE_MENSAJE_DESTACADO);
            LOGGER.info("[DB_FIX] esquema de mensajes destacados verificado");
        } catch (Exception ex) {
            LOGGER.warn("[DB_FIX] no se pudo verificar esquema de mensajes destacados: {}", ex.getClass().getSimpleName());
        }
    }
}
