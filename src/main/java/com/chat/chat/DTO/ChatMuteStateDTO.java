package com.chat.chat.DTO;

import java.time.LocalDateTime;

public class ChatMuteStateDTO {

    private boolean ok;
    private Long chatId;
    private Long userId;
    private boolean muted;
    private Boolean mutedForever;
    private LocalDateTime mutedUntil;

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

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        this.muted = muted;
    }

    public Boolean getMutedForever() {
        return mutedForever;
    }

    public void setMutedForever(Boolean mutedForever) {
        this.mutedForever = mutedForever;
    }

    public LocalDateTime getMutedUntil() {
        return mutedUntil;
    }

    public void setMutedUntil(LocalDateTime mutedUntil) {
        this.mutedUntil = mutedUntil;
    }
}
