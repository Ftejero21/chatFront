CREATE TABLE IF NOT EXISTS e2e_private_key_backup (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  iv VARCHAR(1024) NOT NULL,
  salt VARCHAR(1024) NOT NULL,
  kdf VARCHAR(32) NOT NULL,
  kdf_hash VARCHAR(32) NOT NULL,
  kdf_iterations INT NOT NULL,
  key_length_bits INT NOT NULL,
  public_key TEXT NOT NULL,
  public_key_fingerprint VARCHAR(256) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_e2e_private_key_backup_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT uk_e2e_private_key_backup_user UNIQUE (user_id)
);

CREATE INDEX idx_e2e_private_key_backup_user ON e2e_private_key_backup (user_id);
