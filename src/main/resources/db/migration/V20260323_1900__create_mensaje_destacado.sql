CREATE TABLE IF NOT EXISTS mensaje_destacado (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT NOT NULL,
  mensaje_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mensaje_destacado_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_mensaje_destacado_mensaje FOREIGN KEY (mensaje_id) REFERENCES mensajes(id) ON DELETE CASCADE,
  CONSTRAINT uk_mensaje_destacado_usuario_mensaje UNIQUE (usuario_id, mensaje_id)
);

CREATE INDEX idx_mensaje_destacado_usuario ON mensaje_destacado (usuario_id);
CREATE INDEX idx_mensaje_destacado_mensaje ON mensaje_destacado (mensaje_id);
