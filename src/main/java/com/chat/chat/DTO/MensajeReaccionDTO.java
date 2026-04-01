package com.chat.chat.DTO;

import com.chat.chat.Utils.ReactionAction;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class MensajeReaccionDTO {

    public static final String EVENT_MESSAGE_REACTION = "MESSAGE_REACTION";

    private String event;
    private Long messageId;
    private Long chatId;
    private boolean esGrupo;
    private Long reactorUserId;
    private Long targetUserId;
    private String emoji;
    private String action;
    private LocalDateTime createdAt;

    public List<String> validarEntrada() {
        List<String> errors = new ArrayList<>();
        if (messageId == null || messageId <= 0) {
            errors.add("messageId debe ser > 0");
        }
        if (chatId == null || chatId <= 0) {
            errors.add("chatId debe ser > 0");
        }
        if (reactorUserId == null || reactorUserId <= 0) {
            errors.add("reactorUserId debe ser > 0");
        }

        ReactionAction actionParsed = parseActionOrNull(action);
        if (actionParsed == null) {
            errors.add("action debe ser SET o REMOVE");
        } else if (actionParsed == ReactionAction.SET) {
            String normalizedEmoji = normalizeEmoji(emoji);
            if (normalizedEmoji == null) {
                errors.add("emoji es obligatorio para action=SET");
            }
        }
        return errors;
    }

    public ReactionAction actionAsEnumOrNull() {
        return parseActionOrNull(action);
    }

    private ReactionAction parseActionOrNull(String actionRaw) {
        if (actionRaw == null || actionRaw.isBlank()) {
            return null;
        }
        try {
            return ReactionAction.valueOf(actionRaw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static String normalizeEmoji(String rawEmoji) {
        if (rawEmoji == null) {
            return null;
        }
        String trimmed = rawEmoji.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public Long getMessageId() {
        return messageId;
    }

    public void setMessageId(Long messageId) {
        this.messageId = messageId;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public boolean isEsGrupo() {
        return esGrupo;
    }

    public void setEsGrupo(boolean esGrupo) {
        this.esGrupo = esGrupo;
    }

    public Long getReactorUserId() {
        return reactorUserId;
    }

    public void setReactorUserId(Long reactorUserId) {
        this.reactorUserId = reactorUserId;
    }

    public Long getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId) {
        this.targetUserId = targetUserId;
    }

    public String getEmoji() {
        return emoji;
    }

    public void setEmoji(String emoji) {
        this.emoji = emoji;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
