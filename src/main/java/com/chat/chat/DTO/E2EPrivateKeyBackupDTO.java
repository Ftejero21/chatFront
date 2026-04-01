package com.chat.chat.DTO;

public class E2EPrivateKeyBackupDTO {

    private String encryptedPrivateKey;
    private String iv;
    private String salt;
    private String kdf;
    private String kdfHash;
    private Integer kdfIterations;
    private Integer keyLengthBits;
    private String publicKey;
    private String publicKeyFingerprint;

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
}
