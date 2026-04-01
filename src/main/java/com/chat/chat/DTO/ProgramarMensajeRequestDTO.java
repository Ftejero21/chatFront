package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class ProgramarMensajeRequestDTO {
    private String message;
    private String contenido;
    @JsonAlias("chat_ids")
    private List<Long> chatIds;
    @JsonAlias("chatId")
    private Long chatId;
    @JsonAlias({"fechaProgramada", "scheduled_at"})
    private Instant scheduledAt;
    @JsonAlias({"userId", "createdBy"})
    private Long createdBy;

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getContenido() {
        return contenido;
    }

    public void setContenido(String contenido) {
        this.contenido = contenido;
    }

    public List<Long> getChatIds() {
        Set<Long> merged = new LinkedHashSet<>();
        if (chatIds != null) {
            merged.addAll(chatIds);
        }
        if (chatId != null) {
            merged.add(chatId);
        }
        return new ArrayList<>(merged);
    }

    public void setChatIds(List<Long> chatIds) {
        this.chatIds = chatIds;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long createdBy) {
        this.createdBy = createdBy;
    }
}
