package com.chat.chat.Utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.Objects;

import javax.crypto.Cipher;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.security.spec.MGF1ParameterSpec;

@Component
public class AdminAuditCrypto {
    private static final Logger LOGGER = LoggerFactory.getLogger(AdminAuditCrypto.class);
    private static final String TRANSFORM_RSA_OAEP_SHA256 = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";

    @Value("${app.audit.admin-private-key-pem:}")
    private String adminPrivateKeyPem;

    @Value("${app.audit.admin-private-key-path:}")
    private String adminPrivateKeyPath;

    private volatile PrivateKey cachedKey;
    private volatile String cachedPublicKeySpkiBase64;

    @Value("${app.audit.admin-public-key-spki:}")
    private String adminPublicKeySpki;

    @Value("${app.audit.admin-public-key-spki-path:}")
    private String adminPublicKeySpkiPath;

    public String decryptBase64Envelope(String base64Ciphertext) {
        if (isBlank(base64Ciphertext)) {
            return null;
        }

        PrivateKey key = getOrLoadKey();
        if (key == null) {
            return null;
        }

        try {
            byte[] ciphertext = Base64.getDecoder().decode(base64Ciphertext);
            Cipher cipher = Cipher.getInstance(TRANSFORM_RSA_OAEP_SHA256);
            OAEPParameterSpec spec = new OAEPParameterSpec(
                    "SHA-256",
                    "MGF1",
                    MGF1ParameterSpec.SHA256,
                    PSource.PSpecified.DEFAULT
            );
            cipher.init(Cipher.DECRYPT_MODE, key, spec);
            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            LOGGER.warn("AUDIT admin envelope decrypt failed: {}", ex.getClass().getSimpleName());
            return null;
        }
    }

    public String getAuditPublicKeySpkiBase64() {
        if (!isBlank(cachedPublicKeySpkiBase64)) {
            return cachedPublicKeySpkiBase64;
        }

        String fromConfig = resolveConfiguredPublicKey();
        if (!isBlank(fromConfig)) {
            cachedPublicKeySpkiBase64 = fromConfig;
            return cachedPublicKeySpkiBase64;
        }

        PrivateKey privateKey = getOrLoadKey();
        if (!(privateKey instanceof RSAPrivateCrtKey rsaPrivate)) {
            LOGGER.warn("AUDIT admin public key derive failed: {}", privateKey == null ? "PrivateKeyMissing" : privateKey.getClass().getSimpleName());
            return null;
        }

        try {
            RSAPublicKeySpec publicSpec = new RSAPublicKeySpec(rsaPrivate.getModulus(), rsaPrivate.getPublicExponent());
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(publicSpec);
            cachedPublicKeySpkiBase64 = Base64.getEncoder().encodeToString(publicKey.getEncoded());
            return cachedPublicKeySpkiBase64;
        } catch (Exception ex) {
            LOGGER.warn("AUDIT admin public key derive failed: {}", ex.getClass().getSimpleName());
            return null;
        }
    }

    public String getAuditPrivateKeyPkcs8PemIfMatchesPublicKey() {
        PrivateKey privateKey = getOrLoadKey();
        if (privateKey == null) {
            return null;
        }

        String currentPublic = getAuditPublicKeySpkiBase64();
        String derivedPublic = derivePublicKeySpkiBase64(privateKey);
        if (isBlank(currentPublic) || isBlank(derivedPublic)) {
            LOGGER.warn("AUDIT admin private key export skipped: missing public key context");
            return null;
        }

        if (!Objects.equals(currentPublic, derivedPublic)) {
            LOGGER.warn("AUDIT admin private key export skipped: public/private mismatch");
            return null;
        }

        byte[] pkcs8Der = privateKey.getEncoded();
        if (pkcs8Der == null || pkcs8Der.length == 0) {
            return null;
        }
        return toPem("PRIVATE KEY", pkcs8Der);
    }

    private PrivateKey getOrLoadKey() {
        if (cachedKey != null) {
            return cachedKey;
        }

        String pem = resolvePem();
        if (isBlank(pem)) {
            return null;
        }

        try {
            String sanitized = pem
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(sanitized);
            PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(der);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            cachedKey = kf.generatePrivate(keySpec);
            return cachedKey;
        } catch (Exception ex) {
            LOGGER.warn("AUDIT admin private key load failed: {}", ex.getClass().getSimpleName());
            return null;
        }
    }

    private String resolvePem() {
        if (!isBlank(adminPrivateKeyPem)) {
            return adminPrivateKeyPem;
        }
        if (!isBlank(adminPrivateKeyPath)) {
            try {
                return Files.readString(Path.of(adminPrivateKeyPath), StandardCharsets.UTF_8);
            } catch (Exception ex) {
                LOGGER.warn("AUDIT admin private key path read failed: {}", ex.getClass().getSimpleName());
                return null;
            }
        }
        return null;
    }

    private String resolveConfiguredPublicKey() {
        if (!isBlank(adminPublicKeySpki)) {
            return normalizePublicKeyBase64(adminPublicKeySpki);
        }
        if (!isBlank(adminPublicKeySpkiPath)) {
            try {
                String fileContent = Files.readString(Path.of(adminPublicKeySpkiPath), StandardCharsets.UTF_8);
                return normalizePublicKeyBase64(fileContent);
            } catch (Exception ex) {
                LOGGER.warn("AUDIT admin public key path read failed: {}", ex.getClass().getSimpleName());
                return null;
            }
        }
        return null;
    }

    private String normalizePublicKeyBase64(String rawValue) {
        if (isBlank(rawValue)) {
            return null;
        }
        String sanitized = rawValue
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        try {
            byte[] decoded = Base64.getDecoder().decode(sanitized);
            return Base64.getEncoder().encodeToString(decoded);
        } catch (IllegalArgumentException ex) {
            LOGGER.warn("AUDIT admin public key format invalid: {}", ex.getClass().getSimpleName());
            return null;
        }
    }

    private String derivePublicKeySpkiBase64(PrivateKey privateKey) {
        if (!(privateKey instanceof RSAPrivateCrtKey rsaPrivate)) {
            return null;
        }
        try {
            RSAPublicKeySpec publicSpec = new RSAPublicKeySpec(rsaPrivate.getModulus(), rsaPrivate.getPublicExponent());
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(publicSpec);
            return Base64.getEncoder().encodeToString(publicKey.getEncoded());
        } catch (Exception ex) {
            LOGGER.warn("AUDIT admin public key derive failed: {}", ex.getClass().getSimpleName());
            return null;
        }
    }

    private String toPem(String type, byte[] derBytes) {
        String base64 = Base64.getEncoder().encodeToString(derBytes);
        StringBuilder sb = new StringBuilder();
        sb.append("-----BEGIN ").append(type).append("-----\n");
        for (int i = 0; i < base64.length(); i += 64) {
            int end = Math.min(i + 64, base64.length());
            sb.append(base64, i, end).append('\n');
        }
        sb.append("-----END ").append(type).append("-----");
        return sb.toString();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
