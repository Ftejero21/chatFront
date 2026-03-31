package com.chat.chat.Entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "e2e_private_key_backup")
public class E2EPrivateKeyBackupEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Lob
    @Column(name = "encrypted_private_key", columnDefinition = "TEXT", nullable = false)
    private String encryptedPrivateKey;

    @Column(name = "iv", nullable = false, length = 1024)
    private String iv;

    @Column(name = "salt", nullable = false, length = 1024)
    private String salt;

    @Column(name = "kdf", nullable = false, length = 32)
    private String kdf;

    @Column(name = "kdf_hash", nullable = false, length = 32)
    private String kdfHash;

    @Column(name = "kdf_iterations", nullable = false)
    private Integer kdfIterations;

    @Column(name = "key_length_bits", nullable = false)
    private Integer keyLengthBits;

    @Lob
    @Column(name = "public_key", columnDefinition = "TEXT", nullable = false)
    private String publicKey;

    @Column(name = "public_key_fingerprint", nullable = false, length = 256)
    private String publicKeyFingerprint;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getEncryptedPrivateKey() {
        return encryptedPrivateKey;
    }

    public void setEncryptedPrivateKey(String encryptedPrivateKey) {
        this.encryptedPrivateKey = encryptedPrivateKey;
    }

    public String getIv() {
        return iv;
    }

    public void setIv(String iv) {
        this.iv = iv;
    }

    public String getSalt() {
        return salt;
    }

    public void setSalt(String salt) {
        this.salt = salt;
    }

    public String getKdf() {
        return kdf;
    }

    public void setKdf(String kdf) {
        this.kdf = kdf;
    }

    public String getKdfHash() {
        return kdfHash;
    }

    public void setKdfHash(String kdfHash) {
        this.kdfHash = kdfHash;
    }

    public Integer getKdfIterations() {
        return kdfIterations;
    }

    public void setKdfIterations(Integer kdfIterations) {
        this.kdfIterations = kdfIterations;
    }

    public Integer getKeyLengthBits() {
        return keyLengthBits;
    }

    public void setKeyLengthBits(Integer keyLengthBits) {
        this.keyLengthBits = keyLengthBits;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(String publicKey) {
        this.publicKey = publicKey;
    }

    public String getPublicKeyFingerprint() {
        return publicKeyFingerprint;
    }

    public void setPublicKeyFingerprint(String publicKeyFingerprint) {
        this.publicKeyFingerprint = publicKeyFingerprint;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
