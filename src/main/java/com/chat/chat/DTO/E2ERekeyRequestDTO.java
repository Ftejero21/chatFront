package com.chat.chat.DTO;

public class E2ERekeyRequestDTO {
    private String newPublicKey;
    private String expectedOldFingerprint;
    private String currentPassword;
    private String otp;

    public String getNewPublicKey() {
        return newPublicKey;
    }

    public void setNewPublicKey(String newPublicKey) {
        this.newPublicKey = newPublicKey;
    }

    public String getExpectedOldFingerprint() {
        return expectedOldFingerprint;
    }

    public void setExpectedOldFingerprint(String expectedOldFingerprint) {
        this.expectedOldFingerprint = expectedOldFingerprint;
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
