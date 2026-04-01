package com.chat.chat.Mapper;

import com.chat.chat.DTO.ChatPinnedMessageDTO;
import com.chat.chat.Entity.ChatPinnedMessageEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.MessageType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class ChatPinnedMessageMapper {

    private static final int PREVIEW_MAX_LEN = 180;
    private static final String PREVIEW_AUDIO = "[Audio]";
    private static final String PREVIEW_IMAGE = "[Imagen]";
    private static final String PREVIEW_FILE = "[Archivo]";
    private static final String PREVIEW_POLL = "[Encuesta]";
    private static final String PREVIEW_SYSTEM = "[Sistema]";
    private static final String PREVIEW_ENCRYPTED = "[Mensaje cifrado]";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public ChatPinnedMessageDTO toDto(Long chatId, ChatPinnedMessageEntity pin, MensajeEntity mensaje) {
        ChatPinnedMessageDTO dto = new ChatPinnedMessageDTO();
        dto.setChatId(chatId);
        dto.setMessageId(pin.getMessageId());

        Long senderId = pin.getSenderId();
        String senderName = PREVIEW_SYSTEM;
        if (mensaje != null && mensaje.getEmisor() != null) {
            senderId = mensaje.getEmisor().getId();
            senderName = buildNombreCompleto(mensaje.getEmisor().getNombre(), mensaje.getEmisor().getApellido());
        }

        dto.setSenderId(senderId);
        dto.setSenderName(senderName);
        dto.setMessageType(mapMessageType(mensaje == null ? null : mensaje.getTipo()));
        dto.setPreview(buildPreview(mensaje));
        dto.setPinnedAt(pin.getPinnedAt());
        dto.setPinnedByUserId(pin.getPinnedByUserId());
        dto.setExpiresAt(pin.getExpiresAt());
        return dto;
    }

    private String mapMessageType(MessageType type) {
        if (type == null) {
            return Constantes.TIPO_TEXT;
        }
        if (type == MessageType.VIDEO) {
            return Constantes.TIPO_FILE;
        }
        return type.name();
    }

    private String buildPreview(MensajeEntity mensaje) {
        if (mensaje == null || mensaje.getTipo() == null) {
            return "";
        }
        return switch (mensaje.getTipo()) {
            case AUDIO -> PREVIEW_AUDIO;
            case IMAGE -> PREVIEW_IMAGE;
            case FILE, VIDEO -> {
                String fileName = extractFileNameFromMessage(mensaje);
                yield fileName == null ? PREVIEW_FILE : truncate(PREVIEW_FILE + " " + fileName);
            }
            case POLL -> PREVIEW_POLL;
            case SYSTEM -> {
                String text = sanitizePreviewText(mensaje.getContenido());
                yield text.isBlank() ? PREVIEW_SYSTEM : text;
            }
            case TEXT -> sanitizePreviewText(mensaje.getContenido());
        };
    }

    private String extractFileNameFromMessage(MensajeEntity mensaje) {
        if (mensaje == null) {
            return null;
        }

        String mediaUrl = mensaje.getMediaUrl();
        if (mediaUrl != null && !mediaUrl.isBlank()) {
            int slash = mediaUrl.lastIndexOf('/');
            if (slash >= 0 && slash + 1 < mediaUrl.length()) {
                return mediaUrl.substring(slash + 1);
            }
            return mediaUrl;
        }

        String raw = mensaje.getContenido();
        if (raw == null || raw.isBlank()) {
            return null;
        }

        try {
            JsonNode root = OBJECT_MAPPER.readTree(raw);
            String name = firstNonBlank(
                    root.path("fileNombre").asText(null),
                    root.path("fileName").asText(null),
                    root.path("imageNombre").asText(null));
            if (name != null && !name.isBlank()) {
                return name;
            }
            String url = firstNonBlank(
                    root.path("fileUrl").asText(null),
                    root.path("url").asText(null),
                    root.path("imageUrl").asText(null));
            if (url == null || url.isBlank()) {
                return null;
            }
            int slash = url.lastIndexOf('/');
            return slash >= 0 && slash + 1 < url.length() ? url.substring(slash + 1) : url;
        } catch (Exception ex) {
            return null;
        }
    }

    private String sanitizePreviewText(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        if (isLikelyEncryptedPayload(raw)) {
            return PREVIEW_ENCRYPTED;
        }
        String normalized = raw.replaceAll("\\s+", " ").trim();
        return truncate(normalized);
    }

    private boolean isLikelyEncryptedPayload(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (!trimmed.startsWith("{")) {
            return false;
        }
        return trimmed.contains("\"ciphertext\"")
                || trimmed.contains("\"forReceptor\"")
                || trimmed.contains("\"forReceptores\"")
                || trimmed.contains("\"forEmisor\"");
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        if (value.length() <= PREVIEW_MAX_LEN) {
            return value;
        }
        return value.substring(0, PREVIEW_MAX_LEN - 3) + "...";
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String buildNombreCompleto(String nombre, String apellido) {
        String n = nombre == null ? "" : nombre.trim();
        String a = apellido == null ? "" : apellido.trim();
        String full = (n + (a.isEmpty() ? "" : " " + a)).trim();
        return full.isEmpty() ? Constantes.DEFAULT_CALLER_NAME : full;
    }
}
