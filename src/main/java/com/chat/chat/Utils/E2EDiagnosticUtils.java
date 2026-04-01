package com.chat.chat.Utils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

public final class E2EDiagnosticUtils {

    public static final String TRACE_ID_MDC_KEY = "e2eTraceId";
    private static final int HASH12_LEN = 12;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private E2EDiagnosticUtils() {
    }

    public static String newTraceId() {
        String raw = UUID.randomUUID().toString().replace("-", "");
        return raw.substring(0, 16);
    }

    public static String currentTraceId() {
        String traceId = MDC.get(TRACE_ID_MDC_KEY);
        return traceId == null || traceId.isBlank() ? null : traceId;
    }

    public static ContentDiagnostic analyze(String content) {
        int len = content == null ? 0 : content.length();
        String hash12 = hash12(content);
        if (content == null || content.isBlank()) {
            return new ContentDiagnostic("PLAIN_TEXT", len, hash12, false,
                    false, false, false, false, false, 0, null);
        }

        String trimmed = content.trim();
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
            return new ContentDiagnostic("PLAIN_TEXT", len, hash12, false,
                    false, false, false, false, false, 0, null);
        }

        try {
            JsonNode root = MAPPER.readTree(content);
            if (!root.isObject()) {
                return new ContentDiagnostic("JSON_OTHER", len, hash12, false,
                        false, false, false, false, false, 0, null);
            }

            String type = root.path("type").asText("");
            boolean hasIv = root.has("iv");
            boolean hasIvFile = root.has("ivFile");
            boolean hasCiphertext = root.has("ciphertext");
            boolean hasForEmisor = root.has("forEmisor");
            boolean hasForReceptor = root.has("forReceptor");
            boolean hasForReceptores = root.has("forReceptores");
            boolean hasForAdmin = root.has("forAdmin");
            int forReceptoresKeys = countKeys(root.get("forReceptores"));

            if ("E2E_GROUP_AUDIO".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E_GROUP_AUDIO", len, hash12, true,
                        hasIv || hasIvFile, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
            }
            if ("E2E_AUDIO".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E_AUDIO", len, hash12, false,
                        hasIv || hasIvFile, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
            }
            if ("E2E_GROUP_IMAGE".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E_GROUP_IMAGE", len, hash12, true,
                        hasIv || hasIvFile, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
            }
            if ("E2E_IMAGE".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E_IMAGE", len, hash12, false,
                        hasIv || hasIvFile, hasCiphertext, hasForEmisor, hasForReceptores || hasForReceptor, hasForAdmin, forReceptoresKeys, null);
            }
            if ("E2E_GROUP_FILE".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E_GROUP_FILE", len, hash12, true,
                        hasIv || hasIvFile, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
            }
            if ("E2E_FILE".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E_FILE", len, hash12, false,
                        hasIv || hasIvFile, hasCiphertext, hasForEmisor, hasForReceptores || hasForReceptor, hasForAdmin, forReceptoresKeys, null);
            }

            boolean isE2EGroup = "E2E_GROUP".equalsIgnoreCase(type) || hasForReceptores;
            if (isE2EGroup) {
                return new ContentDiagnostic("JSON_E2E_GROUP", len, hash12, true,
                        hasIv, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
            }
            if ("E2E".equalsIgnoreCase(type)) {
                return new ContentDiagnostic("JSON_E2E", len, hash12, false,
                        hasIv, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
            }
            return new ContentDiagnostic("JSON_OTHER", len, hash12, false,
                    hasIv, hasCiphertext, hasForEmisor, hasForReceptores, hasForAdmin, forReceptoresKeys, null);
        } catch (JsonProcessingException ex) {
            return new ContentDiagnostic("INVALID_JSON", len, hash12, false,
                    false, false, false, false, false, 0, ex.getClass().getSimpleName());
        }
    }

    public static ContentDiagnostic analyze(String content, String tipo) {
        ContentDiagnostic base = analyze(content);
        if ("PLAIN_TEXT".equals(base.getClassification())
                && tipo != null
                && "AUDIO".equalsIgnoreCase(tipo)) {
            return new ContentDiagnostic("PLAIN_AUDIO",
                    base.getLength(),
                    base.getHash12(),
                    base.isE2eGroup(),
                    base.hasIv(),
                    base.hasCiphertext(),
                    base.hasForEmisor(),
                    base.hasForReceptores(),
                    base.hasForAdmin(),
                    base.getForReceptoresKeys(),
                    base.getParseErrorClass());
        }
        if ("PLAIN_TEXT".equals(base.getClassification())
                && tipo != null
                && "IMAGE".equalsIgnoreCase(tipo)) {
            return new ContentDiagnostic("PLAIN_IMAGE",
                    base.getLength(),
                    base.getHash12(),
                    base.isE2eGroup(),
                    base.hasIv(),
                    base.hasCiphertext(),
                    base.hasForEmisor(),
                    base.hasForReceptores(),
                    base.hasForAdmin(),
                    base.getForReceptoresKeys(),
                    base.getParseErrorClass());
        }
        if ("PLAIN_TEXT".equals(base.getClassification())
                && tipo != null
                && "FILE".equalsIgnoreCase(tipo)) {
            return new ContentDiagnostic("PLAIN_FILE",
                    base.getLength(),
                    base.getHash12(),
                    base.isE2eGroup(),
                    base.hasIv(),
                    base.hasCiphertext(),
                    base.hasForEmisor(),
                    base.hasForReceptores(),
                    base.hasForAdmin(),
                    base.getForReceptoresKeys(),
                    base.getParseErrorClass());
        }
        return base;
    }

    public static Set<String> extractForReceptoresKeys(String content) {
        Set<String> keys = new LinkedHashSet<>();
        if (content == null || content.isBlank()) {
            return keys;
        }
        try {
            JsonNode root = MAPPER.readTree(content);
            if (!root.isObject()) {
                return keys;
            }
            JsonNode forReceptores = root.get("forReceptores");
            if (forReceptores == null || !forReceptores.isObject()) {
                return keys;
            }
            var fields = forReceptores.fieldNames();
            while (fields.hasNext()) {
                keys.add(fields.next());
            }
            return keys;
        } catch (JsonProcessingException ex) {
            return keys;
        }
    }

    public static String fingerprint12(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        String normalized = value.replaceAll("\\s", "");
        return hash12(normalized);
    }

    private static int countKeys(JsonNode node) {
        if (node == null || node.isNull()) {
            return 0;
        }
        if (node.isObject()) {
            int count = 0;
            var fields = node.fieldNames();
            while (fields.hasNext()) {
                fields.next();
                count++;
            }
            return count;
        }
        if (node.isArray()) {
            return node.size();
        }
        return 0;
    }

    private static String hash12(String content) {
        if (content == null) {
            return "-";
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit((b & 0xF), 16));
            }
            return sb.substring(0, Math.min(HASH12_LEN, sb.length()));
        } catch (NoSuchAlgorithmException ex) {
            return "sha256_error";
        }
    }

    public static final class ContentDiagnostic {
        private final String classification;
        private final int length;
        private final String hash12;
        private final boolean e2eGroup;
        private final boolean hasIv;
        private final boolean hasCiphertext;
        private final boolean hasForEmisor;
        private final boolean hasForReceptores;
        private final boolean hasForAdmin;
        private final int forReceptoresKeys;
        private final String parseErrorClass;

        public ContentDiagnostic(String classification,
                                 int length,
                                 String hash12,
                                 boolean e2eGroup,
                                 boolean hasIv,
                                 boolean hasCiphertext,
                                 boolean hasForEmisor,
                                 boolean hasForReceptores,
                                 boolean hasForAdmin,
                                 int forReceptoresKeys,
                                 String parseErrorClass) {
            this.classification = classification;
            this.length = length;
            this.hash12 = hash12;
            this.e2eGroup = e2eGroup;
            this.hasIv = hasIv;
            this.hasCiphertext = hasCiphertext;
            this.hasForEmisor = hasForEmisor;
            this.hasForReceptores = hasForReceptores;
            this.hasForAdmin = hasForAdmin;
            this.forReceptoresKeys = forReceptoresKeys;
            this.parseErrorClass = parseErrorClass;
        }

        public String getClassification() {
            return classification;
        }

        public int getLength() {
            return length;
        }

        public String getHash12() {
            return hash12;
        }

        public boolean isE2eGroup() {
            return e2eGroup;
        }

        public boolean hasIv() {
            return hasIv;
        }

        public boolean hasCiphertext() {
            return hasCiphertext;
        }

        public boolean hasForEmisor() {
            return hasForEmisor;
        }

        public boolean hasForReceptores() {
            return hasForReceptores;
        }

        public boolean hasForAdmin() {
            return hasForAdmin;
        }

        public int getForReceptoresKeys() {
            return forReceptoresKeys;
        }

        public String getParseErrorClass() {
            return parseErrorClass;
        }
    }
}
