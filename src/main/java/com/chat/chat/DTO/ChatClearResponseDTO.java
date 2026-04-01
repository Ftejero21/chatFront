package com.chat.chat.DTO;

import java.time.LocalDateTime;

public class ChatClearResponseDTO {

    private boolean ok;
    private Long chatId;
    private Long userId;
    private Long clearedBeforeMessageId;
    private LocalDateTime clearedAt;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getClearedBeforeMessageId() {
        return clearedBeforeMessageId;
    }

    public void setClearedBeforeMessageId(Long clearedBeforeMessageId) {
        this.clearedBeforeMessageId = clearedBeforeMessageId;
    }

    public LocalDateTime getClearedAt() {
        return clearedAt;
    }

    public void setClearedAt(LocalDateTime clearedAt) {
        this.clearedAt = clearedAt;
    }
}
