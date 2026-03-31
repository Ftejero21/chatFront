package com.chat.chat.Utils;

import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class E2EGroupValidationUtils {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private E2EGroupValidationUtils() {
    }

    public static boolean isTextType(String tipo) {
        return tipo == null
                || tipo.isBlank()
                || Constantes.TIPO_TEXT.equalsIgnoreCase(tipo)
                || Constantes.TIPO_POLL.equalsIgnoreCase(tipo);
    }

    public static boolean hasPublicKey(String publicKey) {
        return publicKey != null && !publicKey.trim().isEmpty();
    }

    public static boolean isAudioType(String tipo) {
        return tipo != null && Constantes.TIPO_AUDIO.equalsIgnoreCase(tipo);
    }

    public static boolean isImageType(String tipo) {
        return tipo != null && Constantes.TIPO_IMAGE.equalsIgnoreCase(tipo);
    }

    public static boolean isFileType(String tipo) {
        return tipo != null && Constantes.TIPO_FILE.equalsIgnoreCase(tipo);
    }

    public static boolean isE2EGroupAudio(E2EDiagnosticUtils.ContentDiagnostic diag) {
        return diag != null && "JSON_E2E_GROUP_AUDIO".equals(diag.getClassification());
    }

    public static boolean isE2EAudio(E2EDiagnosticUtils.ContentDiagnostic diag) {
        return diag != null && "JSON_E2E_AUDIO".equals(diag.getClassification());
    }

    public static boolean isE2EGroupImage(E2EDiagnosticUtils.ContentDiagnostic diag) {
        return diag != null && "JSON_E2E_GROUP_IMAGE".equals(diag.getClassification());
    }

    public static boolean isE2EImage(E2EDiagnosticUtils.ContentDiagnostic diag) {
        return diag != null && "JSON_E2E_IMAGE".equals(diag.getClassification());
    }

    public static boolean isE2EGroupFile(E2EDiagnosticUtils.ContentDiagnostic diag) {
        return diag != null && "JSON_E2E_GROUP_FILE".equals(diag.getClassification());
    }

    public static boolean isE2EFile(E2EDiagnosticUtils.ContentDiagnostic diag) {
        return diag != null && "JSON_E2E_FILE".equals(diag.getClassification());
    }

    public static List<Long> expectedActiveRecipientIds(ChatGrupalEntity chat, Long senderId) {
        if (chat == null || chat.getUsuarios() == null) {
            return List.of();
        }
        return chat.getUsuarios().stream()
                .filter(Objects::nonNull)
                .filter(UsuarioEntity::isActivo)
                .map(UsuarioEntity::getId)
                .filter(Objects::nonNull)
                .filter(id -> !Objects.equals(id, senderId))
                .sorted()
                .collect(Collectors.toList());
    }

    public static List<Long> activeMemberIds(ChatGrupalEntity chat) {
        if (chat == null || chat.getUsuarios() == null) {
            return List.of();
        }
        return chat.getUsuarios().stream()
                .filter(Objects::nonNull)
                .filter(UsuarioEntity::isActivo)
                .map(UsuarioEntity::getId)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
    }

    public static Set<String> expectedRecipientKeySet(ChatGrupalEntity chat, Long senderId) {
        return expectedActiveRecipientIds(chat, senderId).stream()
                .map(String::valueOf)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    public static Set<String> payloadRecipientKeySet(String content) {
        return E2EDiagnosticUtils.extractForReceptoresKeys(content);
    }

    public static boolean hasRequiredE2EGroupFields(E2EDiagnosticUtils.ContentDiagnostic diag) {
        if (diag == null) {
            return false;
        }
        return "JSON_E2E_GROUP".equals(diag.getClassification())
                && diag.hasIv()
                && diag.hasCiphertext()
                && diag.hasForEmisor()
                && diag.hasForReceptores()
                && diag.hasForAdmin();
    }

    public static boolean hasRequiredE2EGroupAudioFields(String content) {
        return hasRequiredJsonFields(content, "ivFile", "forEmisor", "forReceptores", "forAdmin", "audioUrl");
    }

    public static boolean hasRequiredE2EAudioFields(String content) {
        return hasRequiredJsonFields(content, "ivFile", "forEmisor", "forReceptor", "forAdmin", "audioUrl");
    }

    public static boolean hasRequiredE2EGroupImageFields(String content) {
        return hasRequiredJsonFieldsWithType(content,
                Set.of("E2E_GROUP_IMAGE"),
                "ivFile", "forEmisor", "forReceptores", "forAdmin", "imageUrl");
    }

    public static boolean hasRequiredE2EImageFields(String content) {
        return hasRequiredJsonFieldsWithType(content,
                Set.of("E2E_IMAGE"),
                "ivFile", "forEmisor", "forReceptor", "forAdmin", "imageUrl");
    }

    public static boolean hasRequiredE2EGroupFileFields(String content) {
        if (!hasRequiredJsonFieldsWithType(content,
                Set.of("E2E_GROUP_FILE"),
                "ivFile", "forEmisor", "forReceptores", "forAdmin", "fileUrl", "fileMime", "fileNombre", "fileSizeBytes")) {
            return false;
        }
        return hasNonEmptyObject(content, "forReceptores")
                && fileSizeBytesInRange(content, 1L, Long.MAX_VALUE);
    }

    public static boolean hasRequiredE2EFileFields(String content) {
        if (!hasRequiredJsonFieldsWithType(content,
                Set.of("E2E_FILE"),
                "ivFile", "forEmisor", "forReceptor", "forAdmin", "fileUrl", "fileMime", "fileNombre", "fileSizeBytes")) {
            return false;
        }
        return fileSizeBytesInRange(content, 1L, Long.MAX_VALUE);
    }

    public static boolean fileSizeBytesInRange(String content, long minInclusive, long maxInclusive) {
        if (content == null || content.isBlank()) {
            return false;
        }
        try {
            JsonNode root = MAPPER.readTree(content);
            if (root == null || !root.isObject()) {
                return false;
            }
            JsonNode sizeNode = root.get("fileSizeBytes");
            if (sizeNode == null || sizeNode.isNull()) {
                return false;
            }
            long size;
            if (sizeNode.isIntegralNumber()) {
                size = sizeNode.asLong();
            } else if (sizeNode.isTextual()) {
                size = Long.parseLong(sizeNode.asText().trim());
            } else {
                return false;
            }
            return size >= minInclusive && size <= maxInclusive;
        } catch (Exception ex) {
            return false;
        }
    }

    public static boolean recipientKeysMatchExactly(ChatGrupalEntity chat, Long senderId, Set<String> payloadKeys) {
        Set<String> expected = expectedRecipientKeySet(chat, senderId);
        Set<String> actual = payloadKeys == null ? Collections.emptySet() : payloadKeys;
        return expected.equals(actual);
    }

    private static boolean hasRequiredJsonFields(String content, String... requiredFields) {
        return hasRequiredJsonFieldsWithType(content, null, requiredFields);
    }

    private static boolean hasRequiredJsonFieldsWithType(String content,
                                                         Set<String> acceptedTypes,
                                                         String... requiredFields) {
        if (content == null || content.isBlank()) {
            return false;
        }
        try {
            JsonNode root = MAPPER.readTree(content);
            if (!root.isObject()) {
                return false;
            }
            if (acceptedTypes != null && !acceptedTypes.isEmpty()) {
                JsonNode typeNode = root.get("type");
                if (typeNode == null || typeNode.isNull() || !typeNode.isTextual()) {
                    return false;
                }
                String type = typeNode.asText();
                if (type == null || type.isBlank() || !acceptedTypes.contains(type.toUpperCase())) {
                    return false;
                }
            }
            for (String field : requiredFields) {
                JsonNode node = root.get(field);
                if (node == null || node.isNull()) {
                    return false;
                }
                if (node.isTextual() && node.asText().isBlank()) {
                    return false;
                }
            }
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private static boolean hasNonEmptyObject(String content, String field) {
        if (content == null || content.isBlank() || field == null || field.isBlank()) {
            return false;
        }
        try {
            JsonNode root = MAPPER.readTree(content);
            JsonNode node = root == null ? null : root.get(field);
            if (node == null || !node.isObject()) {
                return false;
            }
            return node.fields().hasNext();
        } catch (Exception ex) {
            return false;
        }
    }
}
