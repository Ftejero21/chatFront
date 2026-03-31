package com.chat.chat.DTO;

import java.time.LocalDateTime;

public class UserPinnedChatResponseDTO {
    private Long chatId;
    private LocalDateTime pinnedAt;

    public UserPinnedChatResponseDTO() {
    }

    public UserPinnedChatResponseDTO(Long chatId, LocalDateTime pinnedAt) {
        this.chatId = chatId;
        this.pinnedAt = pinnedAt;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public LocalDateTime getPinnedAt() {
        return pinnedAt;
    }

    public void setPinnedAt(LocalDateTime pinnedAt) {
        this.pinnedAt = pinnedAt;
    }
}
