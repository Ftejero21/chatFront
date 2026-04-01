package com.chat.chat.DTO;

import java.time.Instant;

public class MensajeProgramadoDTO {
    private Long id;
    private Long createdBy;
    private Long chatId;
    private String messageContent;
    private Instant scheduledAt;
    private String status;
    private Integer attempts;
    private String lastError;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant sentAt;
    private String scheduledBatchId;
    private Boolean wsEmitted;
    private Instant wsEmittedAt;
    private String wsDestinations;
    private String wsEmitError;
    private Long persistedMessageId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long createdBy) {
        this.createdBy = createdBy;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public String getMessageContent() {
        return messageContent;
    }

    public void setMessageContent(String messageContent) {
        this.messageContent = messageContent;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getAttempts() {
        return attempts;
    }

    public void setAttempts(Integer attempts) {
        this.attempts = attempts;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }

    public String getScheduledBatchId() {
        return scheduledBatchId;
    }

    public void setScheduledBatchId(String scheduledBatchId) {
        this.scheduledBatchId = scheduledBatchId;
    }

    public Boolean getWsEmitted() {
        return wsEmitted;
    }

    public void setWsEmitted(Boolean wsEmitted) {
        this.wsEmitted = wsEmitted;
    }

    public Instant getWsEmittedAt() {
        return wsEmittedAt;
    }

    public void setWsEmittedAt(Instant wsEmittedAt) {
        this.wsEmittedAt = wsEmittedAt;
    }

    public String getWsDestinations() {
        return wsDestinations;
    }

    public void setWsDestinations(String wsDestinations) {
        this.wsDestinations = wsDestinations;
    }

    public String getWsEmitError() {
        return wsEmitError;
    }

    public void setWsEmitError(String wsEmitError) {
        this.wsEmitError = wsEmitError;
    }

    public Long getPersistedMessageId() {
        return persistedMessageId;
    }

    public void setPersistedMessageId(Long persistedMessageId) {
        this.persistedMessageId = persistedMessageId;
    }
}
