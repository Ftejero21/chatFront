package com.chat.chat.Utils;

import com.chat.chat.DTO.E2EMessagePayloadDTO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class E2EPayloadUtils {
    public static final String AUDIT_STATUS_NO_AUDITABLE = "NO_AUDITABLE";

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private E2EPayloadUtils() {
    }

    public static String normalizeForStorage(String payloadJson) {
        if (isGroupE2EPayload(payloadJson)) {
            return payloadJson;
        }
        E2EMessagePayloadDTO payload = tryParse(payloadJson);
        if (payload == null) {
            return payloadJson;
        }

        if (isBlank(payload.getForAdmin())) {
            payload.setForAdmin(null);
            payload.setAuditStatus(AUDIT_STATUS_NO_AUDITABLE);
        } else {
            payload.setAuditStatus(null);
        }
        return toJson(payload, payloadJson);
    }

    public static String sanitizeForAdminAudit(String payloadJson) {
        if (isGroupE2EPayload(payloadJson)) {
            return payloadJson;
        }
        E2EMessagePayloadDTO payload = tryParse(payloadJson);
        if (payload == null) {
            return isBlank(payloadJson) ? buildNoAuditablePayloadJson(payloadJson) : payloadJson;
        }

        if (isBlank(payload.getForAdmin())) {
            payload.setForAdmin(null);
            payload.setAuditStatus(AUDIT_STATUS_NO_AUDITABLE);
        } else {
            payload.setAuditStatus(null);
        }
        return toJson(payload, payloadJson);
    }

    public static boolean hasAdminEnvelope(String payloadJson) {
        return !isBlank(getAdminEnvelope(payloadJson));
    }

    public static String getAdminEnvelope(String payloadJson) {
        if (isBlank(payloadJson)) {
            return null;
        }

        try {
            JsonNode root = MAPPER.readTree(payloadJson);
            JsonNode adminNode = root.get("forAdmin");
            if (adminNode == null || adminNode.isNull()) {
                return null;
            }

            String forAdmin = adminNode.asText();
            return isBlank(forAdmin) ? null : forAdmin;
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private static String buildNoAuditablePayloadJson(String fallback) {
        E2EMessagePayloadDTO payload = new E2EMessagePayloadDTO();
        payload.setAuditStatus(AUDIT_STATUS_NO_AUDITABLE);
        return toJson(payload, fallback);
    }



    private static E2EMessagePayloadDTO tryParse(String json) {
        if (isBlank(json)) {
            return null;
        }
        try {
            E2EMessagePayloadDTO dto = MAPPER.readValue(json, E2EMessagePayloadDTO.class);
            if (isBlank(dto.getType()) || isBlank(dto.getIv()) || isBlank(dto.getCiphertext())) {
                return null;
            }
            return dto;
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private static String toJson(E2EMessagePayloadDTO payload, String fallback) {
        try {
            return MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return fallback;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static boolean isGroupE2EPayload(String payloadJson) {
        if (isBlank(payloadJson)) {
            return false;
        }
        return payloadJson.contains("\"type\":\"E2E_GROUP\"") || payloadJson.contains("\"forReceptores\"");
    }
}
