package com.chat.chat.DTO;

import java.time.LocalDateTime;

public class E2EStateDTO {
    private boolean hasPublicKey;
    private String publicKeyFingerprint;
    private LocalDateTime updatedAt;

    public boolean isHasPublicKey() {
        return hasPublicKey;
    }

    public boolean getHasPublicKey() {
        return hasPublicKey;
    }

    public void setHasPublicKey(boolean hasPublicKey) {
        this.hasPublicKey = hasPublicKey;
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
